// カート項目のキー種別: "g:<genericName>"（物の名前・最安自動選択） / "p:<productId>"（特定商品指定）
export const genericKey = (genericName) => `g:${genericName}`;
export const productKey = (id) => `p:${id}`;
