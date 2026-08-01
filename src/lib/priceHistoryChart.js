// src/lib/priceHistoryChart.js
// 複数店舗分の価格履歴を、日付ごとに店舗名をキーとした行にマージしたrechartsグラフ用データに変換する。

/**
 * @param {Array<{ storeName: string, history: Array<{ price: number, scrapedAt: string }> }>} storeHistories
 *   各店舗の価格履歴（historyはscrapedAtの順序を問わない）
 * @returns {{ data: Array<Record<string, number|string>>, storeNames: string[] }}
 *   dataは日付昇順。各行は { date: "MM/DD", [storeName]: price, ... }
 */
export function buildChartSeries(storeHistories) {
  const storeNames = storeHistories.map((s) => s.storeName);
  const byDate = new Map();

  for (const { storeName, history } of storeHistories) {
    for (const { price, scrapedAt } of history) {
      const dateKey = scrapedAt.slice(0, 10); // YYYY-MM-DD
      if (!byDate.has(dateKey)) byDate.set(dateKey, { dateKey });
      // 同じ日に複数回スクレイピングされている場合は最新（配列の並び順に関わらず後勝ち）を採用しない。
      // 呼び出し側のhistoryはscrapedAt降順（新しい順）で渡される前提のため、まだ未設定の場合のみ書き込む
      const row = byDate.get(dateKey);
      if (row[storeName] === undefined) row[storeName] = price;
    }
  }

  const data = [...byDate.values()]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map(({ dateKey, ...prices }) => ({
      date: `${dateKey.slice(5, 7)}/${dateKey.slice(8, 10)}`,
      ...prices,
    }));

  return { data, storeNames };
}
