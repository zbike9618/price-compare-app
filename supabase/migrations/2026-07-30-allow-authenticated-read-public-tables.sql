-- stores/products/price_history/store_productsは公開データの一覧表示に使うテーブルであり、
-- anonロールだけでなくauthenticatedロール(ログイン中のユーザー)からも読めるべきだが、
-- ポリシーがanonロール限定だったため、ログインするとこれらのテーブルが一切見えなくなっていた。
-- (favoritesは個人データのため引き続きauthenticated限定のまま変更しない)
alter policy "stores are publicly readable" on stores to anon, authenticated;
alter policy "products are publicly readable" on products to anon, authenticated;
alter policy "price_history is publicly readable" on price_history to anon, authenticated;
alter policy "store_products are publicly readable" on store_products to anon, authenticated;
