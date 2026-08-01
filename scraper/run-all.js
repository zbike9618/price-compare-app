// scraper/run-all.js
// 毎日のスクレイピング一式（イオン3店舗＋マルイ・ニシナ）を順番に実行し、
// 最後にAIカテゴリ分類（全カテゴリ）で訂正をかける。systemd timerから呼び出す想定。
// メモリの逼迫を避けるため、並列実行はせず1つずつ順番に実行する。

import { spawn } from "node:child_process";

const STEPS = [
  { label: "AEON（岡山店）", cmd: "node", args: ["run-aeon.js"] },
  { label: "AEON（青江店）", cmd: "node", args: ["run-aeon-aoe.js"] },
  { label: "AEON（倉敷店）", cmd: "node", args: ["run-aeon-kurashiki.js"] },
  { label: "マルイ宅配便", cmd: "node", args: ["run-legacy.js", "marui"] },
  { label: "ニシナらくらく便", cmd: "node", args: ["run-legacy.js", "nishina"] },
  { label: "AIカテゴリ分類（全カテゴリ）", cmd: "node", args: ["apply-ai-categorize.js"] },
];

function runStep(step) {
  return new Promise((resolve) => {
    console.log(`\n########## ${step.label} 開始 ##########`);
    const child = spawn(step.cmd, step.args, { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`########## ${step.label} 完了 ##########`);
      } else {
        console.error(`########## ${step.label} が終了コード${code}で失敗しました。次に進みます ##########`);
      }
      resolve();
    });
    child.on("error", (e) => {
      console.error(`########## ${step.label} の起動に失敗しました: ${e.message} ##########`);
      resolve();
    });
  });
}

async function main() {
  const startedAt = new Date();
  console.log(`=== run-all.js 開始: ${startedAt.toISOString()} ===`);
  for (const step of STEPS) {
    await runStep(step);
  }
  console.log(`\n=== run-all.js 完了: ${new Date().toISOString()}（開始から${Math.round((Date.now() - startedAt) / 1000)}秒） ===`);
}

main();
