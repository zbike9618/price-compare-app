// scraper/lib/aiCategorize.js
// Gemini APIによる商品カテゴリ分類の共通ロジック。
// test-ai-categorize.js（読み取り専用テスト）とapply-ai-categorize.js（本番反映）で共用する。

import { GoogleGenerativeAI } from "@google/generative-ai";
import { SUBCATEGORIES } from "../../src/lib/subcategories.js";

export const CATEGORIES = ["野菜", "果物", "精肉", "魚介", "日配食品", "乳製品", "パン類", "麺類", "調味料", "日用品"];
export const EXCLUDED_CANDIDATE = "除外候補";

// 本番の\\192.168.11.102\minecraft\minecraft\S3\discord_chat\discord.js を参考にしたモデル
// フォールバック順。2026-08-01時点でgemini-2.5-flash/flash-lite・gemini-3-flashは新規利用不可(404)で、
// gemini-3.1-flash-liteのみ成功した。廃止モデルも一応残しつつ、動作確認済みのものを先頭に置く
export const AI_MODELS = ["gemini-3.1-flash-lite", "gemini-3-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash"];

export function chunk(array, size) {
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
   食品ではない、またはどれにも当てはまらない場合は"${EXCLUDED_CANDIDATE}"としてください。categoryOkがtrueの場合はnullにしてください。
3. subcategory: categoryOkがtrueの場合、次の中カテゴリ候補から最も近いものを1つ選んでください: ${subcategoryLabels.join("、") || "(候補なし)"}。
   どれにも当てはまらない場合は、ふさわしい新しい中カテゴリ名を提案してください（例: "白菜"）。判断がつかない場合は"その他"としてください。

商品名一覧:
${products.map((p, i) => `${i + 1}. ${p.name}`).join("\n")}

出力形式（商品名一覧と同じ順番、同じ件数で返すこと）:
[{"name": "商品名", "categoryOk": true, "suggestedCategory": null, "subcategory": "キャベツ"}, ...]`;
}

export function createClassifier(apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);

  return async function classifyBatch(category, products) {
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
  };
}

export async function fetchProductsByCategory(supabaseUrl, anonKey, category, limit) {
  const url = `${supabaseUrl}/rest/v1/products?category=eq.${encodeURIComponent(category)}&select=id,name&limit=${limit}`;
  const res = await fetch(url, {
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) throw new Error(`products取得に失敗: ${res.status} ${await res.text()}`);
  return res.json();
}
