import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";

export function useFavorites(user) {
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const pendingIdsRef = useRef(new Set());

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    let cancelled = false;
    supabase
      .from("favorites")
      .select("product_id")
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setFavoriteIds(new Set(data.map((row) => row.product_id)));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggleFavorite = useCallback(
    async (productId) => {
      if (pendingIdsRef.current.has(productId)) return;
      pendingIdsRef.current.add(productId);

      try {
        const wasFavorite = favoriteIds.has(productId);

        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.delete(productId);
          else next.add(productId);
          return next;
        });

        // ゲストモード: ローカル状態のみで永続化しない
        if (!user) return;

        if (wasFavorite) {
          const { error } = await supabase.from("favorites").delete().eq("product_id", productId);
          if (error) console.error("お気に入り削除に失敗しました:", error);
        } else {
          const { error } = await supabase.from("favorites").insert({ product_id: productId, user_id: user.id });
          if (error) console.error("お気に入り登録に失敗しました:", error);
        }
      } finally {
        pendingIdsRef.current.delete(productId);
      }
    },
    [favoriteIds, user]
  );

  return { favoriteIds, toggleFavorite };
}
