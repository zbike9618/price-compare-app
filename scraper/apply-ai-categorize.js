// scraper/apply-ai-categorize.js
// Gemini APIでのカテゴリ分類結果を本番DBに反映する。
// ai_reviewed_atが未設定(null)の商品だけを対象にすることで、判定済みの商品を
// 毎回AIに通し直す無駄（Gemini無料枠の消費）を避ける。
// - categoryOk: true  → subcategoryを更新し、ai_reviewed_atを記録（以後スキップされる）
// - categoryOk: false かつ suggestedCategoryが既知の10カテゴリのいずれか → categoryのみ更新。
//   ai_reviewed_atは設定しない（新カテゴリ側で改めて中カテゴリ判定が必要なため、次回対象に残す）
// - suggestedCategory === "除外候補"（またはそれ以外の未知の値） → DBのcategory/subcategoryは
//   変更せず、ai_reviewed_atだけ記録して以後スキップ。scraper/tmp/excluded-candidates-<date>.json
//   にも記録する
//
// 使い方:
//   GEMINI_API_KEY=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scraper/apply-ai-categorize.js [カテゴリ名]
//   カテゴリ名を省略すると全10カテゴリを順番に処理する

import { mkdir, appendFile } from "node:fs/promises";
import { updateProductClassification } from "./lib/db.js";
import { CATEGORIES, EXCLUDED_CANDIDATE, chunk, createClassifier, fetchProductsByCategory } from "./lib/aiCategorize.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://192.168.11.114:8000";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1MDcyNzAyLCJleHAiOjE5NDI3NTI3MDJ9.Td8X4Gbl2mkslj0Kspaznme5RuNK8sqJawZGZrAavS8";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 20;
const BATCH_LIMIT_PER_CATEGORY = 1000; // 現状最多カテゴリでも655件なので十分な上限
const DELAY_BETWEEN_BATCHES_MS = 3000; // 無料枠のレート制限を避けるための待機

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processCategory(category, classifyBatch) {
  console.log(`\n=== 「${category}」カテゴリを処理します ===`);
  const products = await fetchProductsByCategory(SUPABASE_URL, SUPABASE_ANON_KEY, category, BATCH_LIMIT_PER_CATEGORY, {
    unreviewedOnly: true,
  });
  if (products.length === 0) {
    console.log("未判定の商品はありません（スキップ）");
    return { categoryUpdated: 0, subcategoryUpdated: 0, excluded: 0, failed: 0 };
  }
  console.log(`未判定の${products.length}件を${BATCH_SIZE}件ずつのバッチで分類・反映します...`);

  let categoryUpdated = 0;
  let subcategoryUpdated = 0;
  let excluded = 0;
  let failed = 0;

  const batches = chunk(products, BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    let results;
    try {
      results = await classifyBatch(category, batch);
    } catch (e) {
      console.error(`  バッチ${i + 1}/${batches.length}の分類に失敗、スキップします: ${e.message}`);
      failed += batch.length;
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const product = batch[j];
      const result = results[j];
      if (!result) continue;

      try {
        if (result.categoryOk) {
          const patch = { id: product.id, aiReviewedAt: new Date().toISOString() };
          if (result.subcategory) patch.subcategory = result.subcategory;
          await updateProductClassification(patch);
          if (result.subcategory) subcategoryUpdated += 1;
        } else if (CATEGORIES.includes(result.suggestedCategory)) {
          // 新カテゴリ側で改めて中カテゴリ判定が必要なため、ai_reviewed_atは設定しない
          await updateProductClassification({ id: product.id, category: result.suggestedCategory });
          categoryUpdated += 1;
          console.log(`  [category更新] ${product.name}: ${category} → ${result.suggestedCategory}`);
        } else {
          // "除外候補" またはAIが未知の値を返した場合は、category/subcategoryは変更せず
          // ai_reviewed_atだけ記録して以後スキップする
          await updateProductClassification({ id: product.id, aiReviewedAt: new Date().toISOString() });
          await mkdir("scraper/tmp", { recursive: true });
          const line = JSON.stringify({ id: product.id, name: product.name, category, suggestedCategory: result.suggestedCategory }) + "\n";
          await appendFile(`scraper/tmp/excluded-candidates-${new Date().toISOString().slice(0, 10)}.json`, line, "utf-8");
          excluded += 1;
        }
      } catch (e) {
        console.error(`  [DB更新エラー] ${product.name}: ${e.message}`);
        failed += 1;
      }
    }

    if (i < batches.length - 1) await sleep(DELAY_BETWEEN_BATCHES_MS);
  }

  console.log(
    `「${category}」完了: category更新${categoryUpdated}件 / subcategory更新${subcategoryUpdated}件 / 除外候補記録${excluded}件 / 失敗${failed}件`
  );
  return { categoryUpdated, subcategoryUpdated, excluded, failed };
}

async function main() {
  const targetCategory = process.argv[2];
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY環境変数が必要です");
    process.exit(1);
  }

  const classifyBatch = createClassifier(GEMINI_API_KEY);
  const categories = targetCategory ? [targetCategory] : CATEGORIES;

  if (targetCategory && !CATEGORIES.includes(targetCategory)) {
    console.error(`不明なカテゴリ: ${targetCategory}`);
    console.error(`カテゴリ一覧: ${CATEGORIES.join("、")}`);
    process.exit(1);
  }

  const totals = { categoryUpdated: 0, subcategoryUpdated: 0, excluded: 0, failed: 0 };
  for (const category of categories) {
    const r = await processCategory(category, classifyBatch);
    totals.categoryUpdated += r.categoryUpdated;
    totals.subcategoryUpdated += r.subcategoryUpdated;
    totals.excluded += r.excluded;
    totals.failed += r.failed;
  }

  console.log(
    `\n=== 全体まとめ === category更新${totals.categoryUpdated}件 / subcategory更新${totals.subcategoryUpdated}件 / 除外候補記録${totals.excluded}件 / 失敗${totals.failed}件`
  );
  console.log(`${EXCLUDED_CANDIDATE}は scraper/tmp/excluded-candidates-*.json を参照してください`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
