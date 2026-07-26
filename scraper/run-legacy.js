import { createLegacySession, searchLegacyPlatform, closeLegacySession } from "./lib/legacyPlatform.js";
import { getStoreByName, upsertProduct, upsertStoreProduct, insertPriceHistory } from "./lib/db.js";
import { KEYWORD_CATEGORY, SEED_KEYWORDS, isNoiseProduct } from "./lib/categories.js";

const SITES = {
  marui: {
    storeName: "マルイ宅配便",
    baseUrl: "https://www.marui-takuhai.com/",
    addressPath: "33,101,066",
  },
  nishina: {
    storeName: "ニシナらくらく便",
    baseUrl: "https://www.nishina-rakuraku.com/",
    addressPath: "33,101,066",
  },
};

async function run(siteKey) {
  const site = SITES[siteKey];
  if (!site) throw new Error(`unknown site: ${siteKey}`);

  const store = await getStoreByName(site.storeName);
  if (!store) throw new Error(`store not found in DB: ${site.storeName}`);

  const { browser, page } = await createLegacySession({
    baseUrl: site.baseUrl,
    addressPath: site.addressPath,
  });

  let total = 0;
  try {
    for (const keyword of SEED_KEYWORDS) {
      const items = await searchLegacyPlatform(page, keyword);
      console.log(`[${site.storeName}][${keyword}] ${items.length}件`);

      for (const item of items) {
        if (!item.janCode || !item.name || item.taxPrice == null) continue;
        if (isNoiseProduct(keyword, item.name)) continue;

        const product = await upsertProduct({
          janCode: item.janCode,
          name: item.name,
          category: KEYWORD_CATEGORY[keyword],
          genericName: keyword,
        });
        await upsertStoreProduct({
          storeId: store.id,
          productId: product.id,
          productUrl: site.baseUrl,
        });
        await insertPriceHistory({
          storeId: store.id,
          productId: product.id,
          price: Math.round(item.taxPrice),
        });
        total += 1;
      }
    }
  } finally {
    await closeLegacySession(browser);
  }
  console.log(`[${site.storeName}] 完了: ${total}件のprice_historyを記録`);
}

const siteKey = process.argv[2];
if (!siteKey) {
  console.error("usage: node run-legacy.js <marui|nishina>");
  process.exit(1);
}

run(siteKey).catch((err) => {
  console.error(err);
  process.exit(1);
});
