import * as cheerio from "cheerio";

const STORE_BASE_URL = "https://shop.aeon.com/netsuper/01050000041900/";

// 商品ページURL・画像URLの末尾13桁がJANコードと一致する
// 例: .../010500000419004901810124213.html -> 4901810124213
function extractJanFromUrl(url) {
  const match = url.match(/(\d{13})\.html$/);
  return match ? match[1] : null;
}

export async function searchAeon(keyword) {
  const url = `${STORE_BASE_URL}search/?q=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`aeon search failed: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const items = [];
  $("li.product-item").each((_, el) => {
    const $el = $(el);
    const link = $el.find("a.product-item-link").first();
    const name = link.text().trim();
    const href = link.attr("href");
    if (!name || !href) return;

    const jan = extractJanFromUrl(href);
    const basePriceText = $el.find(".floor-price").first().text().trim();
    const taxPriceText = $el.find(".floor-tax").first().text().trim();
    const taxDecimalText = $el.find(".decimal-tax").first().text().trim();

    const basePrice = basePriceText ? Number(basePriceText.replace(/[^\d]/g, "")) : null;
    const taxPrice = taxPriceText
      ? Number(`${taxPriceText.replace(/[^\d]/g, "")}${taxDecimalText.replace(".", ".")}`)
      : null;

    items.push({
      name,
      url: href,
      janCode: jan,
      basePrice,
      taxPrice,
    });
  });

  return items;
}
