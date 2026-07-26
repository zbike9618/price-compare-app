import { chromium } from "playwright";

// マルイ宅配便・ニシナらくらく便が共通で使っているレガシーASPプラットフォーム用アダプタ。
// 生HTTPリクエストだと検索が原因不明で空振りするため、実ブラウザ(Playwright)経由で操作する。

async function submitAndWait(page, evaluateFn, ...args) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.evaluate(evaluateFn, ...args),
  ]);
}

export async function createLegacySession({ baseUrl, prefectureValue = "33", addressPath }) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  // 都道府県選択（target属性を外してポップアップ化を回避）
  await submitAndWait(
    page,
    (val) => {
      const form = document.forms["shop_form"];
      form.removeAttribute("target");
      form.querySelector("select[name=address]").value = val;
      form.submit();
    },
    prefectureValue
  );

  // 地区・町の絞り込み（addressPathの各階層をGETで辿る）
  const parts = addressPath.split(",");
  for (let i = 1; i <= parts.length; i++) {
    const partial = parts.slice(0, i).join(",");
    const url = new URL(`window_shopping.php?address=${partial}`, baseUrl).toString();
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }

  // 店舗確定（target属性を外し、window.close()を呼ばずsubmitのみ実行）
  await submitAndWait(page, () => {
    const form = document.forms["entry"];
    form.removeAttribute("target");
    form.submit();
  });

  // 「店内見学」ボタン（画像リンク、date_sel.phpへのリンク）があれば押す
  const visitButton = page.locator('a[href*="date_sel.php"]');
  if (await visitButton.count()) {
    await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), visitButton.first().click()]);
  }

  return { browser, page };
}

export async function searchLegacyPlatform(page, keyword) {
  await submitAndWait(
    page,
    (kw) => {
      const forms = [...document.forms];
      const searchForm = forms.find((f) => f.querySelector('input[name="p_dtl_srh_wd"]'));
      searchForm.querySelector('input[name="p_dtl_srh_wd"]').value = kw;
      searchForm.submit();
    },
    keyword
  );

  const items = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="open_win"]')];
    const byJan = new Map();
    for (const a of links) {
      const href = a.getAttribute("href");
      const m = href.match(/open_win\('(\d+)'/);
      if (!m) continue;
      const jan = m[1];
      if (!byJan.has(jan)) byJan.set(jan, { links: [] });
      byJan.get(jan).links.push(a);
    }

    const results = [];
    for (const [jan, { links: janLinks }] of byJan) {
      const nameLink = janLinks.find((a) => a.textContent.trim().length > 0);
      const name = nameLink ? nameLink.textContent.trim() : null;

      // 価格：最初のリンクを含む商品ブロック全体のテキストから「本体 xxx円」「税込 xxx円」を拾う
      const anchor = janLinks[0];
      let block = anchor.closest("table") || anchor.parentElement?.parentElement?.parentElement || anchor.parentElement;
      const blockText = block ? block.textContent.replace(/\s+/g, " ") : "";
      const baseMatch = blockText.match(/本体\s*([\d,]+)円/);
      const taxMatch = blockText.match(/税込\s*([\d,]+)円/);

      results.push({
        janCode: jan,
        name,
        basePrice: baseMatch ? Number(baseMatch[1].replace(/,/g, "")) : null,
        taxPrice: taxMatch ? Number(taxMatch[1].replace(/,/g, "")) : null,
      });
    }
    return results;
  });

  return items;
}

export async function closeLegacySession(browser) {
  await browser.close();
}
