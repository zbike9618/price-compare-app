# アプリ用パスコードゲート + LPフィードバックフォーム 設計

## 背景・目的
tokuchika（price-compare-app）を限定公開・招待制のベータテストとして特定の人にだけ試してもらい、フィードバックを集めたい。アプリ本体（`app.html`）は招待者だけがアクセスできるようにしつつ、LP（`index.html`）は引き続き誰でも閲覧できる状態を維持する。あわせてLPからGoogleフォームでフィードバックを収集できるようにする。

## スコープ
- 対象: フロントエンドのみ（`src/`配下）。DB・スクレイパーは変更しない
- パスコードは共通の固定コード1つ（招待者ごとの個別発行はしない）
- フィードバックフォームはGoogleフォームを利用する。フォーム自体（作成・URL発行）はZが手動で行う。今回の実装ではLPに導線（ボタン・リンク）と設定用プレースホルダーURLを用意するところまでを対象とする

## ① アプリ本体のパスコードゲート

### 方式
- 共通の固定パスコード1つ（例: `TOKUCHIKA2026`）を`src/lib/passcode.js`（新規）に定数として定義する
- `localStorage`のキー`priceCompareApp.passcodeUnlocked`で解除済みかどうかを判定する。既存の`onboarding.js`（`hasSeenOnboarding`/`markOnboardingSeen`）と同じ「定数+ヘルパー関数」パターンに合わせ、`isPasscodeUnlocked()`/`unlockPasscode()`をエクスポートする
- 入力されたコードは前後の空白除去・大文字小文字を無視して比較する（招待者の入力ミスを吸収するため）

### UI
- `src/components/PasscodeGate.jsx`（新規）: 画面中央にカード（パスコード入力欄＋送信ボタン＋簡単な案内文「招待コードを入力してください」）を表示するシンプルなコンポーネント。不一致時はエラーメッセージを表示する
- `src/pages/PriceCompareReal.jsx`（変更）: マウント時に`isPasscodeUnlocked()`をチェックし、`false`なら`<PasscodeGate>`のみを描画してアプリ本体（`AppShell`以下）を描画しない。入力成功時に`unlockPasscode()`を呼び、通常のアプリ画面に遷移する
- LP（`LandingPage.jsx`）・`index.html`は変更しない。LPから`app.html`へのCTAリンクもそのまま維持し、遷移先の`app.html`側でゲートがかかる

### 対象外
- サーバー側での認可（Supabase RLS等）は変更しない。既存のSupabase Authや`favorites`のRLSはそのまま。パスコードはあくまでURLを知らない人がアプリ画面に迷い込まないための簡易な入口ガードであり、厳密なセキュリティ機構としては扱わない

## ② LPフィードバックセクション

- `LandingPage.jsx`に新規セクション（例:「ご意見・フィードバックをお寄せください」という見出し＋一言案内＋Googleフォームへ遷移するボタン）を追加する
- GoogleフォームのURLは`src/lib/passcode.js`と同様に設定値として1箇所（例: `src/lib/feedbackForm.js`）にまとめ、`FEEDBACK_FORM_URL`としてエクスポートする。現時点では未確定のためプレースホルダー文字列（例: `"https://forms.gle/REPLACE_ME"`）を入れておき、Zがフォーム作成後にこの1箇所を差し替えるだけで反映できるようにする
- ボタンは新規タブで開く（`target="_blank" rel="noopener noreferrer"`）

## ③ フィードバックフォーム質問項目（案・ZがGoogleフォームに転記する用）

「使いやすさ・UXの感想」「継続意向」「機能要望」を軸に、以下をたたき台として用意する（ドキュメント内にテキストとして記載するのみ。実際のフォーム作成・質問登録はZが手動で行う）:

1. tokuchikaを使ってみた感想（自由記述）
2. 使いやすさはどうでしたか？（5段階: とても使いにくい〜とても使いやすい）
3. 分かりにくかった操作・画面があれば（自由記述・任意）
4. 今後も使い続けたいと思いますか？（はい／たぶん使う／わからない／使わないと思う）
5. 「4」でそう答えた理由（自由記述・任意）
6. 友人・家族にすすめたいと思いますか？（0〜10、NPS的指標）
7. あったら嬉しい機能・改善してほしい点（自由記述）
8. 不具合・気になった点があれば具体的に（自由記述・任意）

## テスト
- `src/lib/passcode.js`の`isPasscodeUnlocked`/`unlockPasscode`は`onboarding.test.js`/`geo.test.js`と同様の形でユニットテストを書く（vitest、jsdom環境のlocalStorageモック、大文字小文字・空白無視の比較ロジックも含む）
- `PasscodeGate`表示・入力・LPのフィードバックボタン導線は既存の他機能と同様、ブラウザでの実機確認で担保する

## 未確定事項（Zが後日対応）
- Googleフォームの実際の作成・質問登録・URL発行
- フォームURL確定後、`src/lib/feedbackForm.js`の`FEEDBACK_FORM_URL`を実URLに差し替える
- 共通パスコードの実際の値の決定・招待者への配布方法（LINE等）
