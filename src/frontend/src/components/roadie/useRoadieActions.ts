import {
  type ArchiveReason,
  type ContactSet,
  type CrewId,
  type PositionId,
  type RoadieId,
  type RoadieProfile,
  type RoadieStatus,
  type SignatureRef,
  createActor,
} from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Invalidate every query a roadie mutation can affect. */
function useInvalidateRoadie() {
  const queryClient = useQueryClient();
  return (id: RoadieId) => {
    void queryClient.invalidateQueries({ queryKey: ["roadies"] });
    void queryClient.invalidateQueries({ queryKey: ["roadie", id.toString()] });
    void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

/** Edit a roadie's non-contact profile details. */
export function useUpdateRoadieDetails() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRoadie();
  return useMutation({
    mutationFn: async (args: { id: RoadieId; profile: RoadieProfile }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateRoadieDetails(args.id, args.profile);
    },
    onSuccess: (_data, args) => {
      invalidate(args.id);
    },
  });
}

/** Change a roadie's main position, second position or crew. */
export function useChangePosition() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRoadie();
  return useMutation({
    mutationFn: async (args: {
      id: RoadieId;
      mainPositionId: PositionId;
      secondPositionId: PositionId | null;
      crewId: CrewId | null;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.changePosition(
        args.id,
        args.mainPositionId,
        args.secondPositionId,
        args.crewId,
      );
    },
    onSuccess: (_data, args) => {
      invalidate(args.id);
    },
  });
}

/** Archive a roadie with a required reason. */
export function useArchiveRoadie() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRoadie();
  return useMutation({
    mutationFn: async (args: { id: RoadieId; reason: ArchiveReason }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.archiveRoadie(args.id, args.reason);
    },
    onSuccess: (_data, args) => {
      invalidate(args.id);
    },
  });
}

/** Rehire an archived roadie, optionally with a reason. */
export function useRehireRoadie() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRoadie();
  return useMutation({
    mutationFn: async (args: { id: RoadieId; reason: string | null }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.rehireRoadie(args.id, args.reason);
    },
    onSuccess: (_data, args) => {
      invalidate(args.id);
    },
  });
}

/** Update a roadie's status (phase 1: Hired, Paperwork done, Archived). */
export function useUpdateRoadieStatus() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRoadie();
  return useMutation({
    mutationFn: async (args: { id: RoadieId; status: RoadieStatus }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateRoadieStatus(args.id, args.status);
    },
    onSuccess: (_data, args) => {
      invalidate(args.id);
    },
  });
}

/**
 * Read a roadie's contact set (Admin/Store Manager only). The backend returns
 * a one-element array for managers and an empty array for every other
 * read-capable role, so element 0 is the contact set and an empty array means
 * no contact details. A bare contact set (or null) is accepted too so the
 * read stays tolerant of either shape.
 */
export function useContactSet(id: RoadieId | undefined, enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["contactSet", id?.toString()],
    queryFn: async () => {
      if (!actor || id === undefined) return null;
      const result = await actor.getContactSet(id);
      if (Array.isArray(result)) return result[0] ?? null;
      return result ?? null;
    },
    enabled: enabled && !!actor && !isFetching && id !== undefined,
  });
}

/** Save a roadie's contact set (Admin/Store Manager only). */
export function useUpdateContactSet() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRoadie();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: RoadieId; contactSet: ContactSet }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateContactSet(args.id, args.contactSet);
    },
    onSuccess: (_data, args) => {
      invalidate(args.id);
      void queryClient.invalidateQueries({
        queryKey: ["contactSet", args.id.toString()],
      });
    },
  });
}

/** Re-sign a roadie's availability (Admin/Store Manager only). */
export function useResignAvailability() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRoadie();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: RoadieId; signature: SignatureRef }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.resignAvailability(args.id, args.signature);
    },
    onSuccess: (_data, args) => {
      invalidate(args.id);
      void queryClient.invalidateQueries({
        queryKey: ["contactSet", args.id.toString()],
      });
    },
  });
}

/** Whether a roadie is a minor as of now. */
export function useIsMinor(id: RoadieId | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["isMinor", id?.toString()],
    queryFn: async () => {
      if (!actor || id === undefined) return false;
      return actor.isMinor(id);
    },
    enabled: !!actor && !isFetching && id !== undefined,
  });
}

/** Read the editable paperwork and orientation checklists. */
export function useChecklists() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["checklists"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getChecklists();
    },
    enabled: !!actor && !isFetching,
  });
}

/** Change-log entries for one roadie, newest first. */
export function useRoadieChangeLog(id: RoadieId | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["changeLog", "roadie", id?.toString()],
    queryFn: async () => {
      if (!actor || id === undefined) return [];
      const entries = await actor.listChangeLog();
      return entries
        .filter((entry) => entry.subjectRoadieId === id)
        .sort((a, b) => Number(b.at - a.at));
    },
    enabled: !!actor && !isFetching && id !== undefined,
  });
}
