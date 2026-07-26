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

export async function upsertProduct({ janCode, name, category, genericName }) {
  const rows = await rest("products?on_conflict=jan_code", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ jan_code: janCode, name, category, generic_name: genericName }]),
  });
  return rows[0];
}

export async function upsertStoreProduct({ storeId, productId, productUrl }) {
  await rest("store_products?on_conflict=store_id,product_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([{ store_id: storeId, product_id: productId, product_url: productUrl }]),
  });
}

export async function insertPriceHistory({ storeId, productId, price }) {
  await rest("price_history", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify([{ store_id: storeId, product_id: productId, price }]),
  });
}
