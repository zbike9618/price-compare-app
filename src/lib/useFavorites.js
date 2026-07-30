import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

export function useFavorites(user) {
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());

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
        await supabase.from("favorites").delete().eq("product_id", productId);
      } else {
        await supabase.from("favorites").insert({ product_id: productId, user_id: user.id });
      }
    },
    [favoriteIds, user]
  );

  return { favoriteIds, toggleFavorite };
}
