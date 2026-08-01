const SUPABASE_URL = process.env.SUPABASE_URL || "http://192.168.11.114:8000";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
}

function headers(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
    ...extra,
  };
}

async function rest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers(options.headersExtra), ...options.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PostgREST ${options.method || "GET"} ${path} failed: ${res.status} ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function getStoreByName(name) {
  const rows = await rest(`stores?name=eq.${encodeURIComponent(name)}&select=id,name`);
  return rows?.[0] ?? null;
}

export async function upsertProduct({ janCode, name, category }) {
  // categoryは新規商品の初期値としてのみ使う。既存商品のcategoryはAIカテゴリ分類ステップ
  // (apply-ai-categorize.js)が専任で管理するため、再スクレイピング時に上書きしない
  // (upsert_product_keep_category関数、supabase/migrations/2026-08-01-upsert-product-keep-category.sql)
  const rows = await rest("rpc/upsert_product_keep_category", {
    method: "POST",
    body: JSON.stringify({ p_jan_code: janCode, p_name: name, p_category: category }),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function upsertStoreProduct({ storeId, productId, productUrl }) {
  await rest("store_products?on_conflict=store_id,product_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([{ store_id: storeId, product_id: productId, product_url: productUrl }]),
  });
}

export async function updateProductClassification({ id, category, subcategory, aiReviewedAt }) {
  const body = {};
  if (category !== undefined) body.category = category;
  if (subcategory !== undefined) body.subcategory = subcategory;
  if (aiReviewedAt !== undefined) body.ai_reviewed_at = aiReviewedAt;
  await rest(`products?id=eq.${id}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

export async function insertPriceHistory({ storeId, productId, price }) {
  await rest("price_history", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify([{ store_id: storeId, product_id: productId, price }]),
  });
}
