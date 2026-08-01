// GoogleフォームのURL。Zがフォーム作成後にここを実URLへ差し替える
export const FEEDBACK_FORM_URL = "https://forms.gle/REPLACE_ME";

// URLがプレースホルダーのままかどうかを判定する。
// 実URLに差し替えられるまではLP側のフィードバックセクションを非表示にするために使う
export function isFeedbackFormReady() {
  return !FEEDBACK_FORM_URL.includes("REPLACE_ME");
}
