# Shufoo!チラシOCRパイロット Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shufoo!のマルナカ平井店チラシ1件を対象に、タイル画像のダウンロード→ページ結合→OCR→商品名/価格候補抽出→ログ出力までの一連のパイプラインを動かし、実店舗データ取得の実用性をZが判断できる状態にする。

**Architecture:** 既存の`scraper/`ディレクトリに新規モジュールを追加する。`scraper/lib/shufooOcr.js`がチラシ一覧取得・タイル画像ダウンロード・ページ結合・OCR実行・商品名/価格抽出の各関数を提供し、`scraper/run-shufoo-ocr-pilot.js`がそれらを呼び出してログ出力するエントリポイントになる。DB書き込みは行わない。

**Tech Stack:** Node.js（ESM）、`sharp`（画像結合）、`tesseract.js`（OCR、日本語学習データ使用）、既存の`cheerio`（店舗ページのHTML解析）。

## Global Constraints

- DB書き込みは一切行わない（`scraper/lib/db.js`のupsert系関数を呼ばない）。今回のゴールはログ出力によるドライラン確認のみ
- 対象は「マルナカ平井店」（Shufoo!店舗ID `880696`）1店舗・直近チラシ1件のみ
- 既存の`scraper/lib/categories.js`の`isNoiseProduct`・`KEYWORD_CATEGORY`をそのまま再利用し、商品名候補のフィルタ・カテゴリ付与に使う（新しいノイズ語リストは作らない）
- 外部サイト（Shufoo!）への実際のリクエストを伴うため、ユニットテストは対象外。動作確認は実行ログの目視確認で行う

---

## File Structure

- `scraper/lib/shufooOcr.js`（新規）: チラシ一覧取得(`fetchShopFlyers`)、タイル画像URL列挙・ダウンロード(`fetchFlyerPageTiles`)、ページ画像結合(`mergeTilesToPage`)、OCR実行(`ocrPageImage`)、商品名/価格抽出(`extractProductCandidates`)を提供する
- `scraper/run-shufoo-ocr-pilot.js`（新規）: 上記関数を順に呼び出し、マルナカ平井店の最新チラシ1件・1ページ目を処理してログ出力するエントリポイント
- `scraper/package.json`（変更）: `sharp`・`tesseract.js`を依存関係に追加

---

## Task 1: 店舗ページからチラシ一覧を取得する

**Files:**
- Create: `scraper/lib/shufooOcr.js`
- Test: 手動実行で確認（外部サイト依存のためユニットテストは書かない）

**Interfaces:**
- Consumes: なし（`cheerio`は既存依存）
- Produces: `fetchShopFlyers(shopId: string): Promise<{contentId: string, date: string, thumbUrl: string}[]>` — 後続タスクがこの関数を呼び出してチラシ一覧を取得する

- [ ] **Step 1: `scraper/lib/shufooOcr.js`を新規作成し、店舗ページHTMLを取得してチラシ一覧を抽出する関数を書く**

```js
import * as cheerio from "cheerio";

const SHUFOO_BASE = "https://www.shufoo.net";

async function fetchShufooHtml(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`shufoo fetch failed: ${res.status} ${url}`);
  return res.text();
}

// 店舗ページのチラシサムネイル画像URL（例: https://ipqcache2.shufoo.net/c/2026/07/23/29497551150946/index/img/thumb/thumb_sp.jpg）
// からcontentId（数値ID）と掲載日(yyyy/mm/dd)を抽出する
function parseFlyerThumbUrl(url) {
  const match = url.match(/\/c\/(\d{4})\/(\d{2})\/(\d{2})\/(\d+)\/index\/img\/thumb\//);
  if (!match) return null;
  const [, y, m, d, contentId] = match;
  return { contentId, date: `${y}-${m}-${d}`, thumbUrl: url };
}

export async function fetchShopFlyers(shopId) {
  const html = await fetchShufooHtml(`${SHUFOO_BASE}/pntweb/shopDetail/${shopId}/`);
  const $ = cheerio.load(html);
  const seen = new Set();
  const flyers = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const parsed = parseFlyerThumbUrl(src);
    if (!parsed || seen.has(parsed.contentId)) return;
    seen.add(parsed.contentId);
    flyers.push(parsed);
  });
  return flyers;
}
```

- [ ] **Step 2: 動作確認スクリプトを一時的に実行して結果を確認する**

Run:
```bash
cd scraper
node -e "import('./lib/shufooOcr.js').then(m => m.fetchShopFlyers('880696')).then(r => console.log(JSON.stringify(r, null, 2)))"
```
Expected: `contentId`・`date`・`thumbUrl`を持つオブジェクトの配列が出力される（マルナカ平井店の掲載中チラシ件数分、2026-07-31時点で7件程度）

- [ ] **Step 3: コミット**

```bash
git add scraper/lib/shufooOcr.js
git commit -m "feat: Shufoo!店舗ページからチラシ一覧を取得するfetchShopFlyersを追加"
```

---

## Task 2: チラシ1件のタイル画像を全ページ分ダウンロードする

**Files:**
- Modify: `scraper/lib/shufooOcr.js`

**Interfaces:**
- Consumes: `fetchShopFlyers`が返す`contentId`（Task 1）
- Produces: `fetchFlyerPageTiles(contentId: string, date: string): Promise<Buffer[][]>` — 外側配列がページ、内側配列がそのページのタイル画像Bufferの配列。後続タスク(Task 3)がこれをページ結合に使う

- [ ] **Step 1: タイル画像を404が出るまで列挙してダウンロードする関数を書く**

チラシ画像のパスは`https://ipqcache2.shufoo.net/c/{yyyy}/{mm}/{dd}/{contentId}/index/img/{page}_100_{tile}.jpg`の形式（`date`は`fetchShopFlyers`が返す`YYYY-MM-DD`形式なので`/`区切りに変換する）。

```js
const IPQCACHE_BASE = "https://ipqcache2.shufoo.net";

async function fetchTileBuffer(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`tile fetch failed: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ページ・タイルとも0始まりで404が出るまで取得する。
// 1ページ目にタイルが1枚も無ければチラシ自体が存在しないとみなして打ち切る
export async function fetchFlyerPageTiles(contentId, date) {
  const [y, m, d] = date.split("-");
  const pages = [];
  for (let page = 0; page < 50; page += 1) {
    const tiles = [];
    for (let tile = 0; tile < 50; tile += 1) {
      const url = `${IPQCACHE_BASE}/c/${y}/${m}/${d}/${contentId}/index/img/${page}_100_${tile}.jpg`;
      const buf = await fetchTileBuffer(url);
      if (!buf) break;
      tiles.push(buf);
    }
    if (tiles.length === 0) break;
    pages.push(tiles);
  }
  return pages;
}
```

- [ ] **Step 2: Task 1の出力を使って動作確認する**

Run:
```bash
cd scraper
node -e "
import('./lib/shufooOcr.js').then(async m => {
  const flyers = await m.fetchShopFlyers('880696');
  const f = flyers[0];
  const pages = await m.fetchFlyerPageTiles(f.contentId, f.date);
  console.log('pages:', pages.length, 'tiles per page:', pages.map(p => p.length));
});
"
```
Expected: `pages: N tiles per page: [...]`の形式で、1ページ以上・各ページ1枚以上のタイルが取得できたことが分かる出力

- [ ] **Step 3: コミット**

```bash
git add scraper/lib/shufooOcr.js
git commit -m "feat: チラシのページ・タイル画像を列挙取得するfetchFlyerPageTilesを追加"
```

---

## Task 3: タイル画像をページ単位の1枚画像に結合する

**Files:**
- Modify: `scraper/lib/shufooOcr.js`
- Modify: `scraper/package.json`

**Interfaces:**
- Consumes: `fetchFlyerPageTiles`が返す`Buffer[]`（1ページ分のタイル配列、Task 2）
- Produces: `mergeTilesToPage(tiles: Buffer[]): Promise<Buffer>` — 縦結合したPNG画像のBuffer。Task 4のOCR入力になる

- [ ] **Step 1: `sharp`を依存関係に追加する**

```bash
cd scraper
npm install sharp
```

- [ ] **Step 2: タイルを縦に結合する関数を書く**

Shufoo!のタイルは確認できた例で510x512px程度の固定サイズを縦に並べたもの（`0_100_0.jpg`, `0_100_1.jpg`, ...）。`sharp`の`composite`で縦積みする。

```js
import sharp from "sharp";

export async function mergeTilesToPage(tiles) {
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  const width = Math.max(...metas.map((m) => m.width));
  const totalHeight = metas.reduce((sum, m) => sum + m.height, 0);

  let offsetY = 0;
  const composites = tiles.map((tile, i) => {
    const entry = { input: tile, top: offsetY, left: 0 };
    offsetY += metas[i].height;
    return entry;
  });

  return sharp({
    create: { width, height: totalHeight, channels: 3, background: "#ffffff" },
  })
    .composite(composites)
    .png()
    .toBuffer();
}
```

- [ ] **Step 3: 結合結果をファイルに保存して目視確認する**

Run:
```bash
cd scraper
node -e "
import('./lib/shufooOcr.js').then(async m => {
  const flyers = await m.fetchShopFlyers('880696');
  const f = flyers[0];
  const pages = await m.fetchFlyerPageTiles(f.contentId, f.date);
  const merged = await m.mergeTilesToPage(pages[0]);
  const fs = await import('fs');
  fs.writeFileSync('/tmp/merged-page0.png', merged);
  console.log('saved /tmp/merged-page0.png', merged.length, 'bytes');
});
"
```
Expected: `/tmp/merged-page0.png`が生成される。Readツールでこの画像を開き、タイルが継ぎ目なく結合され1ページ分のチラシとして読める見た目になっていることを目視確認する（ズレ・重複があれば`composites`のoffset計算を見直す）

- [ ] **Step 4: コミット**

```bash
git add scraper/lib/shufooOcr.js scraper/package.json scraper/package-lock.json
git commit -m "feat: タイル画像をページ単位に結合するmergeTilesToPageを追加"
```

---

## Task 4: OCRを実行し、価格パターンに近い商品名候補を抽出する

**Files:**
- Modify: `scraper/lib/shufooOcr.js`
- Modify: `scraper/package.json`

**Interfaces:**
- Consumes: `mergeTilesToPage`が返す`Buffer`（Task 3）、`scraper/lib/categories.js`の`isNoiseProduct`・`KEYWORD_CATEGORY`（既存）
- Produces: `ocrPageImage(pageBuffer: Buffer): Promise<{text: string, bbox: {x0,y0,x1,y1}}[]>`、`extractProductCandidates(words: {text,bbox}[]): {name: string, price: number, category: string|null}[]` — Task 5のログ出力エントリポイントが両方を呼び出す

- [ ] **Step 1: `tesseract.js`を依存関係に追加する**

```bash
cd scraper
npm install tesseract.js
```

- [ ] **Step 2: OCR実行関数を書く（日本語学習データを指定）**

```js
import { createWorker } from "tesseract.js";

export async function ocrPageImage(pageBuffer) {
  const worker = await createWorker("jpn");
  try {
    const { data } = await worker.recognize(pageBuffer);
    return data.words.map((w) => ({
      text: w.text,
      bbox: w.bbox,
    }));
  } finally {
    await worker.terminate();
  }
}
```

- [ ] **Step 3: 価格パターンを検出し、近傍の単語を商品名候補として組み立てる関数を書く**

「¥123」「123円」形式の単語を価格とみなし、同じY座標帯（価格の中心Yからtoleranceピクセル以内）にある価格以外の単語を商品名候補として連結する。`categories.js`の`isNoiseProduct`・`KEYWORD_CATEGORY`でカテゴリ推定・ノイズ除外を行う。

```js
import { KEYWORD_CATEGORY, isNoiseProduct } from "./categories.js";

function parsePriceText(text) {
  const yen = text.match(/^[¥￥]\s*(\d{2,5})$/);
  if (yen) return Number(yen[1]);
  const enSuffix = text.match(/^(\d{2,5})\s*円$/);
  if (enSuffix) return Number(enSuffix[1]);
  return null;
}

function bboxCenterY(bbox) {
  return (bbox.y0 + bbox.y1) / 2;
}

// 価格ワードと同じ行（Y座標帯が近い）にある非価格ワードを商品名候補として連結し、
// 既存のキーワード分類でカテゴリを推定する。マッチしない語はカテゴリnullのまま残す
export function extractProductCandidates(words, yTolerance = 15) {
  const priceWords = words
    .map((w) => ({ ...w, price: parsePriceText(w.text) }))
    .filter((w) => w.price != null);

  const candidates = [];
  for (const priceWord of priceWords) {
    const centerY = bboxCenterY(priceWord.bbox);
    const nameWords = words
      .filter((w) => w.price == null && Math.abs(bboxCenterY(w.bbox) - centerY) <= yTolerance)
      .sort((a, b) => a.bbox.x0 - b.bbox.x0)
      .map((w) => w.text);
    const name = nameWords.join("");
    if (!name) continue;

    const matchedKeyword = Object.keys(KEYWORD_CATEGORY).find((kw) => name.includes(kw));
    if (matchedKeyword && isNoiseProduct(matchedKeyword, name)) continue;

    candidates.push({
      name,
      price: priceWord.price,
      category: matchedKeyword ? KEYWORD_CATEGORY[matchedKeyword] : null,
    });
  }
  return candidates;
}
```

- [ ] **Step 4: Task 3で保存した`/tmp/merged-page0.png`を使って動作確認する**

Run:
```bash
cd scraper
node -e "
import('./lib/shufooOcr.js').then(async m => {
  const fs = await import('fs');
  const buf = fs.readFileSync('/tmp/merged-page0.png');
  const words = await m.ocrPageImage(buf);
  console.log('OCR words:', words.length);
  const candidates = m.extractProductCandidates(words);
  console.log(JSON.stringify(candidates, null, 2));
});
"
```
Expected: `OCR words: N`（0より大きい）と、価格・商品名候補のJSON配列が出力される。商品名が正しく読み取れているかはこの時点では目視確認のみでよい（精度の最終判断はTask 5後にZが行う）

- [ ] **Step 5: コミット**

```bash
git add scraper/lib/shufooOcr.js scraper/package.json scraper/package-lock.json
git commit -m "feat: OCR実行と価格近傍の商品名候補抽出ロジックを追加"
```

---

## Task 5: パイロット実行エントリポイントを作成し、ログ出力を確認する

**Files:**
- Create: `scraper/run-shufoo-ocr-pilot.js`

**Interfaces:**
- Consumes: `fetchShopFlyers`, `fetchFlyerPageTiles`, `mergeTilesToPage`, `ocrPageImage`, `extractProductCandidates`（すべてTask 1〜4で`scraper/lib/shufooOcr.js`に定義済み）
- Produces: なし（エントリポイント。DB書き込みは行わない）

- [ ] **Step 1: マルナカ平井店の最新チラシ1件・1ページ目を処理してログ出力するスクリプトを書く**

```js
import {
  fetchShopFlyers,
  fetchFlyerPageTiles,
  mergeTilesToPage,
  ocrPageImage,
  extractProductCandidates,
} from "./lib/shufooOcr.js";

const MARUNAKA_HIRAI_SHOP_ID = "880696";

async function main() {
  const flyers = await fetchShopFlyers(MARUNAKA_HIRAI_SHOP_ID);
  if (flyers.length === 0) throw new Error("チラシが見つかりませんでした");

  const target = flyers[0];
  console.log(`対象チラシ: contentId=${target.contentId} date=${target.date}`);

  const pages = await fetchFlyerPageTiles(target.contentId, target.date);
  console.log(`ページ数: ${pages.length}`);
  if (pages.length === 0) throw new Error("ページ画像が取得できませんでした");

  const pageImage = await mergeTilesToPage(pages[0]);
  console.log(`1ページ目を結合: ${pageImage.length}バイト`);

  const words = await ocrPageImage(pageImage);
  console.log(`OCR単語数: ${words.length}`);

  const candidates = extractProductCandidates(words);
  console.log(`商品名/価格候補: ${candidates.length}件`);
  console.log(JSON.stringify(candidates, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: 実行してログを確認する**

Run:
```bash
cd scraper
node run-shufoo-ocr-pilot.js
```
Expected: エラーなく完了し、「商品名/価格候補: N件」に続いて抽出結果のJSONが出力される

- [ ] **Step 3: コミット**

```bash
git add scraper/run-shufoo-ocr-pilot.js
git commit -m "feat: Shufoo!チラシOCRパイロットの実行エントリポイントを追加"
```

- [ ] **Step 4: 実行結果をZに提示する**

このタスクはコード変更を伴わない。実行ログ（商品名/価格候補のJSON）をそのままZに見せ、「実用に足る精度か」を判断してもらう。精度が低い場合は本格導入を見送り、project.mdにその判断と理由を記録する。
