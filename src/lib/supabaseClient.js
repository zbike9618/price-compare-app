import { createClient } from "@supabase/supabase-js";

// 本番公開URL(HTTPS)からアクセスした際、LAN内IP直指定だとmixed content扱いで
// ブロックされるため、同一オリジンのnginxリバースプロキシ(/api/)経由でSupabaseにアクセスする
const SUPABASE_URL = `${window.location.origin}/api`;
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1MDcyNzAyLCJleHAiOjE5NDI3NTI3MDJ9.Td8X4Gbl2mkslj0Kspaznme5RuNK8sqJawZGZrAavS8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
