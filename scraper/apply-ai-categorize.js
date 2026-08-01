// scraper/apply-ai-categorize.js
// Gemini APIでのカテゴリ分類結果を本番DBに反映する。
// ai_reviewed_atが未設定(null)の商品だけを対象にすることで、判定済みの商品を
// 毎回AIに通し直す無駄（Gemini無料枠の消費）を避ける。
//
// - categoryOk: true → subcategoryを更新し、ai_reviewed_atを記録（以後スキップされる）
// - categoryOk: false → 誤判定を減らすため、同じ商品を1件だけの独立したリクエストで
//   もう一度分類し直す（2回目の意見）。1回目と2回目のsuggestedCategoryが一致した場合のみ
//   実際にDBを変更する:
//     - suggestedCategoryが"除外候補" → category/subcategoryは変更せず、
//       ai_reviewed_atだけ記録して以後スキップ。scraper/tmp/excluded-candidates-<date>.jsonに記録
//     - それ以外 → categoryをそのカテゴリ名に更新（既存の10カテゴリに限らず、AIが提案した
//       新しいカテゴリ名もそのまま採用する）。ai_reviewed_atは設定しない
//       （新カテゴリ側で改めて中カテゴリ判定が必要なため、次回対象に残す）
//   1回目と2回目が一致しない場合は判定を保留し、DB・ai_reviewed_atどちらも変更しない
//   （次回の実行でまた対象になる）
//
// 使い方:
//   GEMINI_API_KEY=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scraper/apply-ai-categorize.js [カテゴリ名]
//   カテゴリ名を省略すると、DB内の全カテゴリ（新設された分も含む）を順番に処理する

import { mkdir, appendFile } from "node:fs/promises";
import { updateProductClassification } from "./lib/db.js";
import {
  chunk,
  createClassifier,
  fetchDistinctCategories,
  fetchProductsByCategory,
  normalizeCategory,
} from "./lib/aiCategorize.js";

const EXCLUDED_CANDIDATE = "除外候補";
const SUPABASE_URL = process.env.SUPABASE_URL || "http://192.168.11.114:8000";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1MDcyNzAyLCJleHAiOjE5NDI3NTI3MDJ9.Td8X4Gbl2mkslj0Kspaznme5RuNK8sqJawZGZrAavS8";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 20;
const BATCH_LIMIT_PER_CATEGORY = 1000; // 現状最多カテゴリでも900件弱なので十分な上限
const DELAY_BETWEEN_BATCHES_MS = 3000; // 無料枠のレート制限を避けるための待機

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processCategory(category, classifyBatch, availableCategories) {
  console.log(`\n=== 「${category}」カテゴリを処理します ===`);
  const products = await fetchProductsByCategory(SUPABASE_URL, SUPABASE_ANON_KEY, category, BATCH_LIMIT_PER_CATEGORY, {
    unreviewedOnly: true,
  });
  if (products.length === 0) {
    console.log("未判定の商品はありません（スキップ）");
    return { categoryUpdated: 0, subcategoryUpdated: 0, excluded: 0, unconfirmed: 0, failed: 0 };
  }
  console.log(`未判定の${products.length}件を${BATCH_SIZE}件ずつのバッチで分類・反映します...`);

  let categoryUpdated = 0;
  let subcategoryUpdated = 0;
  let excluded = 0;
  let unconfirmed = 0;
  let failed = 0;

  const batches = chunk(products, BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    let results;
    try {
      results = await classifyBatch(category, batch, availableCategories);
    } catch (e) {
      console.error(`  バッチ${i + 1}/${batches.length}の分類に失敗、スキップします: ${e.message}`);
      failed += batch.length;
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const product = batch[j];
      const first = results[j];
      if (!first) continue;

      try {
        if (first.categoryOk) {
          const patch = { id: product.id, aiReviewedAt: new Date().toISOString() };
          if (first.subcategory) patch.subcategory = first.subcategory;
          await updateProductClassification(patch);
          if (first.subcategory) subcategoryUpdated += 1;
          continue;
        }

        // 誤判定を減らすため、同じ商品をもう一度単独で判定し直して確認する
        let second;
        try {
          [second] = await classifyBatch(category, [product], availableCategories);
        } catch (e) {
          console.error(`  [再確認エラー] ${product.name}: ${e.message}`);
          failed += 1;
          continue;
        }

        const firstSuggestion = normalizeCategory(first.suggestedCategory);
        const secondSuggestion = second ? normalizeCategory(second.suggestedCategory) : null;
        const agrees = second && !second.categoryOk && firstSuggestion && firstSuggestion === secondSuggestion;

        if (!agrees) {
          console.log(`  [判定不一致・保留] ${product.name}: 1回目=${firstSuggestion ?? "不明"} / 2回目=${second?.categoryOk ? "OK" : secondSuggestion ?? "不明"}`);
          unconfirmed += 1;
          continue;
        }

        if (firstSuggestion === EXCLUDED_CANDIDATE) {
          await updateProductClassification({ id: product.id, aiReviewedAt: new Date().toISOString() });
          await mkdir("scraper/tmp", { recursive: true });
          const line = JSON.stringify({ id: product.id, name: product.name, category }) + "\n";
          await appendFile(`scraper/tmp/excluded-candidates-${new Date().toISOString().slice(0, 10)}.json`, line, "utf-8");
          excluded += 1;
        } else {
          // 2回とも一致した提案なので、既存カテゴリでも新規カテゴリでもそのまま採用する
          await updateProductClassification({ id: product.id, category: firstSuggestion });
          categoryUpdated += 1;
          console.log(`  [category更新・2回確認済み] ${product.name}: ${category} → ${firstSuggestion}`);
        }
      } catch (e) {
        console.error(`  [DB更新エラー] ${product.name}: ${e.message}`);
        failed += 1;
      }
    }

    if (i < batches.length - 1) await sleep(DELAY_BETWEEN_BATCHES_MS);
  }

  console.log(
    `「${category}」完了: category更新${categoryUpdated}件 / subcategory更新${subcategoryUpdated}件 / 除外候補記録${excluded}件 / 判定不一致${unconfirmed}件 / 失敗${failed}件`
  );
  return { categoryUpdated, subcategoryUpdated, excluded, unconfirmed, failed };
}

async function main() {
  const targetCategory = process.argv[2];
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY環境変数が必要です");
    process.exit(1);
  }

  const classifyBatch = createClassifier(GEMINI_API_KEY);
  const availableCategories = await fetchDistinctCategories(SUPABASE_URL, SUPABASE_ANON_KEY);
  const categories = targetCategory ? [targetCategory] : availableCategories;

  console.log(`対象カテゴリ: ${categories.join("、")}`);

  const totals = { categoryUpdated: 0, subcategoryUpdated: 0, excluded: 0, unconfirmed: 0, failed: 0 };
  for (const category of categories) {
    const r = await processCategory(category, classifyBatch, availableCategories);
    totals.categoryUpdated += r.categoryUpdated;
    totals.subcategoryUpdated += r.subcategoryUpdated;
    totals.excluded += r.excluded;
    totals.unconfirmed += r.unconfirmed;
    totals.failed += r.failed;
  }

  console.log(
    `\n=== 全体まとめ === category更新${totals.categoryUpdated}件 / subcategory更新${totals.subcategoryUpdated}件 / 除外候補記録${totals.excluded}件 / 判定不一致${totals.unconfirmed}件 / 失敗${totals.failed}件`
  );
  console.log(`除外候補は scraper/tmp/excluded-candidates-*.json を参照してください`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
