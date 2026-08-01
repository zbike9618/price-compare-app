// scraper/test-ai-categorize.js
// Gemini API（無料枠）でカテゴリ分類の精度を試すテストスクリプト。
// 読み取り専用（DBへの書き込みは行わない）。結果はコンソール表示＋scraper/tmp/以下にJSON保存。
//
// 使い方:
//   GEMINI_API_KEY=xxx node scraper/test-ai-categorize.js 野菜 --limit=60
//
// 参考: docs/superpowers/specs/2026-08-01-ai-categorize-test-design.md（このセッションの計画）

import { mkdir, writeFile } from "node:fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SUBCATEGORIES } from "../src/lib/subcategories.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://192.168.11.114:8000";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1MDcyNzAyLCJleHAiOjE5NDI3NTI3MDJ9.Td8X4Gbl2mkslj0Kspaznme5RuNK8sqJawZGZrAavS8";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// 本番の\\192.168.11.102\minecraft\minecraft\S3\discord_chat\discord.js を参考にしたモデル
// フォールバック順。2026-08-01時点でgemini-2.5-flash/flash-lite・gemini-3-flashは新規利用不可(404)で、
// gemini-3.1-flash-liteのみ成功した。廃止モデルも一応残しつつ、動作確認済みのものを先頭に置く
const AI_MODELS = ["gemini-3.1-flash-lite", "gemini-3-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash"];
const BATCH_SIZE = 20;
const CATEGORIES = ["野菜", "果物", "精肉", "魚介", "日配食品", "乳製品", "パン類", "麺類", "調味料", "日用品"];

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

function parseArgs(argv) {
  const [category, ...rest] = argv;
  let limit = 100;
  for (const arg of rest) {
    const m = arg.match(/^--limit=(\d+)$/);
    if (m) limit = Number(m[1]);
  }
  return { category, limit };
}

async function fetchProducts(category, limit) {
  const url = `${SUPABASE_URL}/rest/v1/products?category=eq.${encodeURIComponent(category)}&select=id,name&limit=${limit}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`products取得に失敗: ${res.status} ${await res.text()}`);
  return res.json();
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

function buildPrompt(category, products) {
  const subcategoryLabels = (SUBCATEGORIES[category] ?? []).map((s) => s.label);
  return `あなたはスーパーの商品分類の専門家です。以下は「${category}」カテゴリに分類されている商品名の一覧です。
それぞれについて、次の3点を判定してJSON配列で返してください（説明文は不要、JSON配列のみ）:

1. categoryOk: 本当に「${category}」というカテゴリ（生鮮食品としての${category}そのもの）に該当する商品か（true/false）。
   お菓子・調味料入りの加工品・無関係なブランド名の非食品などが紛れている場合はfalseにしてください。
2. suggestedCategory: categoryOkがfalseの場合、正しいと思われる大カテゴリ名を次の中から選んでください: ${CATEGORIES.join("、")}。
   食品ではない、またはどれにも当てはまらない場合は"除外候補"としてください。categoryOkがtrueの場合はnullにしてください。
3. subcategory: categoryOkがtrueの場合、次の中カテゴリ候補から最も近いものを1つ選んでください: ${subcategoryLabels.join("、") || "(候補なし)"}。
   どれにも当てはまらない場合は、ふさわしい新しい中カテゴリ名を提案してください（例: "白菜"）。判断がつかない場合は"その他"としてください。

商品名一覧:
${products.map((p, i) => `${i + 1}. ${p.name}`).join("\n")}

出力形式（商品名一覧と同じ順番、同じ件数で返すこと）:
[{"name": "商品名", "categoryOk": true, "suggestedCategory": null, "subcategory": "キャベツ"}, ...]`;
}

async function classifyBatch(category, products) {
  const prompt = buildPrompt(category, products);

  for (const modelName of AI_MODELS) {
    try {
      console.log(`  [AI] モデル ${modelName} で試行中...`);
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error("AI応答タイムアウト")), 20000)),
      ]);
      const text = result.response.text();
      return JSON.parse(text);
    } catch (e) {
      console.error(`  [AI Error] ${modelName} が利用できませんでした: ${e.message}`);
    }
  }
  throw new Error("すべてのモデルで分類に失敗しました");
}

async function main() {
  const { category, limit } = parseArgs(process.argv.slice(2));
  if (!category) {
    console.error(`使い方: GEMINI_API_KEY=xxx node scraper/test-ai-categorize.js <カテゴリ名> [--limit=100]`);
    console.error(`カテゴリ一覧: ${CATEGORIES.join("、")}`);
    process.exit(1);
  }
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY環境変数が必要です");
    process.exit(1);
  }

  console.log(`「${category}」カテゴリから最大${limit}件取得します...`);
  const products = await fetchProducts(category, limit);
  console.log(`${products.length}件を${BATCH_SIZE}件ずつのバッチに分けて分類します...`);

  const results = [];
  for (const batch of chunk(products, BATCH_SIZE)) {
    const classified = await classifyBatch(category, batch);
    results.push(...classified);
  }

  console.log("\n=== 分類結果 ===");
  for (const r of results) {
    const flag = r.categoryOk ? "OK" : `要確認 → ${r.suggestedCategory}`;
    console.log(`[${flag}] ${r.name}  中カテゴリ: ${r.subcategory}`);
  }

  const misclassified = results.filter((r) => !r.categoryOk);
  console.log(`\n合計${results.length}件中、大カテゴリの誤分類候補: ${misclassified.length}件`);

  await mkdir("scraper/tmp", { recursive: true });
  const outPath = `scraper/tmp/ai-categorize-${category}-${Date.now()}.json`;
  await writeFile(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n結果を保存しました: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
