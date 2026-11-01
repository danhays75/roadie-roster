import { type PositionId, type RoadieId, createActor } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** The roster for one position, used to count on-hand roadies and list cards. */
export function useRosterForPosition(positionId: PositionId | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["rosterForPosition", positionId?.toString()],
    queryFn: async () => {
      if (!actor || positionId === undefined) return [];
      return actor.listRosterForPosition(positionId);
    },
    enabled: !!actor && !isFetching && positionId !== undefined,
  });
}

/** Apply a +1/−1 build-to adjustment for a position. */
export function useAdjustBuildTo() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      positionId: PositionId;
      openingDelta: bigint;
      afterOpeningDelta: bigint;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.adjustBuildTo(
        args.positionId,
        args.openingDelta,
        args.afterOpeningDelta,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["positions"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/** Rehire an archived roadie back onto the roster. */
export function useRehireRoadie() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: RoadieId; reason: string | null }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.rehireRoadie(args.id, args.reason);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["roadies"] });
      void queryClient.invalidateQueries({ queryKey: ["rosterForPosition"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}
