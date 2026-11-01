import { createActor } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Re-apply the seeded store data when the store has no positions yet. The
 * backend call is idempotent: it seeds only while the store is empty and
 * returns `false` otherwise, so it is safe to call on every fresh load. A
 * successful seed invalidates every surface the seed populates so the
 * dashboard and admin page render the seeded positions, schedule, store info,
 * checklists and retention settings.
 */
export function useEnsureSeeded() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.ensureSeeded();
    },
    onSuccess: (seeded) => {
      if (!seeded) return;
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["positions"] });
      void queryClient.invalidateQueries({ queryKey: ["schedule"] });
      void queryClient.invalidateQueries({ queryKey: ["storeInfo"] });
      void queryClient.invalidateQueries({ queryKey: ["checklists"] });
      void queryClient.invalidateQueries({ queryKey: ["retentionSettings"] });
      void queryClient.invalidateQueries({ queryKey: ["rosterSummary"] });
    },
  });
}

/**
 * Seed the store once its configuration has loaded and is empty. A fresh
 * install replays the seed migration, but a store that has no positions yet is
 * repaired here so the dashboard and admin surfaces show the seeded data
 * instead of an empty shell.
 */
export function useSeedWhenEmpty(ready: boolean, isEmpty: boolean) {
  const { mutate } = useEnsureSeeded();
  const attempted = useRef(false);

  useEffect(() => {
    if (!ready || !isEmpty || attempted.current) return;
    attempted.current = true;
    mutate();
  }, [ready, isEmpty, mutate]);
}
