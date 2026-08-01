-- スクレイピングの再実行時、既存商品のcategoryをキーワード判定値で上書きしないようにする。
-- category（と将来のsubcategory/ai_reviewed_at）はAIカテゴリ分類ステップが専任で管理し、
-- スクレイパーは新規商品の初期値としてのみ設定する。
create or replace function upsert_product_keep_category(p_jan_code text, p_name text, p_category text)
returns products as $$
  insert into products (jan_code, name, category)
  values (p_jan_code, p_name, p_category)
  on conflict (jan_code) do update set name = excluded.name
  returning *;
$$ language sql volatile;
