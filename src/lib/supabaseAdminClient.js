import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = `${window.location.origin}/api`;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// .env.localが無い/service role keyが未設定のビルドではcreateClientが例外を投げ、
// AdminPasscodeページ全体が白画面になってしまうため、キーが無ければnullを返す。
export const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;
