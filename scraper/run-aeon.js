import { searchAeon, fetchAeonCategory } from "./lib/aeon.js";
import { getStoreByName, upsertProduct, upsertStoreProduct, insertPriceHistory } from "./lib/db.js";
import { KEYWORD_CATEGORY, SEED_KEYWORDS, isNoiseProduct, AEON_CATEGORIES, matchesRequiredKeyword } from "./lib/categories.js";

async function main() {
  const store = await getStoreByName("イオンネットスーパー イオン岡山店");
  if (!store) throw new Error("store not found: イオンネットスーパー イオン岡山店");

  let total = 0;
  for (const keyword of SEED_KEYWORDS) {
    const categoryUrl = AEON_CATEGORIES[keyword]?.url;
    const items = categoryUrl ? await fetchAeonCategory(categoryUrl) : await searchAeon(keyword);
    console.log(`[${keyword}] ${categoryUrl ? "カテゴリ" : "検索"} ${items.length}件`);

    for (const item of items) {
      if (!item.janCode || item.taxPrice == null) continue;
      if (categoryUrl) {
        if (!matchesRequiredKeyword(keyword, item.name)) continue;
      } else if (isNoiseProduct(keyword, item.name)) continue;

      const product = await upsertProduct({
        janCode: item.janCode,
        name: item.name,
        category: KEYWORD_CATEGORY[keyword],
        genericName: keyword,
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
