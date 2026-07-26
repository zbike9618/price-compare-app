import { searchAeon } from "./lib/aeon.js";
import { getStoreByName, upsertProduct, upsertStoreProduct, insertPriceHistory } from "./lib/db.js";

// MVP用の初期検索キーワード（後日カテゴリ一覧クロールに置き換え予定）
const SEED_KEYWORDS = ["牛乳", "卵", "食パン", "豚肉", "キャベツ"];

async function main() {
  const store = await getStoreByName("イオンネットスーパー イオン岡山店");
  if (!store) throw new Error("store not found: イオンネットスーパー イオン岡山店");

  let total = 0;
  for (const keyword of SEED_KEYWORDS) {
    const items = await searchAeon(keyword);
    console.log(`[${keyword}] ${items.length}件`);

    for (const item of items) {
      if (!item.janCode || item.taxPrice == null) continue;

      const product = await upsertProduct({
        janCode: item.janCode,
        name: item.name,
        category: null,
      });
      await upsertStoreProduct({
        storeId: store.id,
        productId: product.id,
        productUrl: item.url,
      });
      await insertPriceHistory({
        storeId: store.id,
        productId: product.id,
        price: Math.round(item.taxPrice),
      });
      total += 1;
    }
  }
  console.log(`完了: ${total}件のprice_historyを記録`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
