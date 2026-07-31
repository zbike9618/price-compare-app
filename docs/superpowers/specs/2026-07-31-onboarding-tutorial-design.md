# アプリ内チュートリアル（オンボーディング） 設計

## 背景・目的
price-compare-appの成果発表準備の一環で、Zからアプリ内チュートリアル（初回起動ガイド）の追加依頼があった。新規ユーザーが「最安値一覧」「買い物リスト比較」「地図範囲選択」「お気に入り」というコア機能に迷わず辿り着けるようにする。

## スコープ
- 対象: price-compare-appのフロントエンド（`src/`配下）のみ。DB・スクレイパーは変更しない
- 対象4ステップ: 最安値一覧・買い物リスト比較・地図範囲選択・お気に入り（既存の`NAV_ITEMS`と1:1対応）。ログイン機能は含めない
- 2つの表示モードを両方実装し、チュートリアル内で相互に切り替え可能にする:
  1. **ツアー型（デフォルト）**: 画面を暗転させ、対象のナビゲーション項目だけをハイライト（穴あき）し、吹き出しで説明を表示
  2. **モーダル型**: 画面中央にカードを表示し、アイコン＋タイトル＋説明文をステップごとに切り替え

## トリガー・永続化
- 初回訪問時に自動表示。`localStorage`のキー`priceCompareApp.onboardingSeen`（真偽値相当の文字列）で判定し、未設定なら自動表示、スキップ/完了時に立てて次回から自動表示しない
- `AppShell`のナビゲーション（サイドバー・下部ナビ両方）に「？」ヘルプボタンを追加し、いつでも手動で再表示できるようにする
- モード切り替え（ツアー⇔モーダル）はチュートリアル内のリンクで行い、切り替えても現在のステップ番号を保持する

## コンポーネント構成
- `src/lib/onboarding.js`（新規）: 4ステップ分のデータ定義（`id`・対象`data-tour-id`・タイトル・説明文・アイコン）と、`localStorage`永続化のヘルパー関数（`hasSeenOnboarding()`・`markOnboardingSeen()`）をエクスポートする。既存の`src/lib/geo.js`と同じ「定数+ヘルパー関数」パターンに合わせる
- `src/components/OnboardingTour.jsx`（新規）: 1つのコンポーネントでツアー型・モーダル型の両方を描画する。内部state`mode`（`"tour" | "modal"`）と`step`（0〜3）を持ち、`mode`に応じて表示を出し分ける
  - ツアー型: `position: fixed`の暗転オーバーレイ＋対象要素の位置に合わせた「穴」（`box-shadow`のスプレッドで周囲だけ暗くするテクニック）＋吹き出し（対象要素の近くに配置）
  - モーダル型: 中央固定のカード、アイコン・タイトル・説明文・進捗ドット・「戻る/次へ/スキップ」ボタン
  - 共通: 「次へ」「戻る」「スキップ」「モード切り替えリンク」「完了（最終ステップのみ）」
- `src/components/AppShell.jsx`（変更）: 各`NAV_ITEMS`ボタンに`data-tour-id={item.id}`属性を追加（ツアー型が位置を取得するため）。サイドバー・下部ナビそれぞれに「？」ヘルプボタンを追加し、クリックで親から渡された`onRequestOnboarding`を呼ぶ
- `src/pages/PriceCompareReal.jsx`（変更）: `showOnboarding`のstateを追加し、マウント時に`hasSeenOnboarding()`が`false`なら自動的に`true`にする。`AppShell`に`onRequestOnboarding`を渡し、`showOnboarding`が`true`のときに`<OnboardingTour>`を描画する

## ツアー型の位置計算
- 各step対象のnav要素を`document.querySelector('[data-tour-id="..."]')`で取得し、`getBoundingClientRect()`で位置を取得する
- サイドバー（PC）・下部ナビ（モバイル）はCSSのメディアクエリで排他表示されているため、実際に画面に見えている方の要素だけが正しい矩形を返す（非表示要素は`display:none`で`getBoundingClientRect()`が0を返すため、可視要素を自動的に優先できる）
- ウィンドウのresizeイベントで位置を再計算する
- 裏側の画面（`view`）は切り替えない。ツアーはあくまでナビゲーションの場所を教えるだけに留め、スコープを絞る

## テスト
- `src/lib/onboarding.js`の`hasSeenOnboarding`/`markOnboardingSeen`はlocalStorageに対する純粋な読み書きなので、`geo.test.js`と同様の形でユニットテストを書く（vitest、jsdom環境のlocalStorageモック）
- コンポーネントの見た目・位置計算はブラウザでの実機確認で担保する（既存のfrontend-rebuild計画等と同じ方針）
