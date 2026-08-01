// GoogleフォームのURL
export const FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeTWTsB_vbBvY-5alNd94ut_tnrXu_Uf0FOZXYlDCNNC7YFog/viewform?usp=publish-editor";

// URLがプレースホルダーのままかどうかを判定する。
// 実URLに差し替えられるまではLP側のフィードバックセクションを非表示にするために使う
export function isFeedbackFormReady() {
  return !FEEDBACK_FORM_URL.includes("REPLACE_ME");
}
