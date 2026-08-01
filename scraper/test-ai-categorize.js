// scraper/test-ai-categorize.js
// Gemini API（無料枠）でカテゴリ分類の精度を試すテストスクリプト。
// 読み取り専用（DBへの書き込みは行わない）。結果はコンソール表示＋scraper/tmp/以下にJSON保存。
// 本番反映するにはscraper/apply-ai-categorize.jsを使う。
//
// 使い方:
//   GEMINI_API_KEY=xxx node scraper/test-ai-categorize.js 野菜 --limit=60

import { mkdir, writeFile } from "node:fs/promises";
import { CATEGORIES, chunk, createClassifier, fetchProductsByCategory } from "./lib/aiCategorize.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://192.168.11.114:8000";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1MDcyNzAyLCJleHAiOjE5NDI3NTI3MDJ9.Td8X4Gbl2mkslj0Kspaznme5RuNK8sqJawZGZrAavS8";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 20;

function parseArgs(argv) {
  const [category, ...rest] = argv;
  let limit = 100;
  for (const arg of rest) {
    const m = arg.match(/^--limit=(\d+)$/);
    if (m) limit = Number(m[1]);
  }
  return { category, limit };
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

  const classifyBatch = createClassifier(GEMINI_API_KEY);

  console.log(`「${category}」カテゴリから最大${limit}件取得します...`);
  const products = await fetchProductsByCategory(SUPABASE_URL, SUPABASE_ANON_KEY, category, limit);
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
