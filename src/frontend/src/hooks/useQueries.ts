import {
  type ApprovalDecision,
  type ApprovalRequest,
  type Checklists,
  type DuplicateMatch,
  type EventId,
  type Position,
  type PositionId,
  type RetentionSettings,
  type RoadieId,
  type Role,
  type ScheduleEvent,
  type SignatureRef,
  type SignupId,
  type SignupSubmission,
  type StoreInfo,
  type Timestamp,
  createActor,
} from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/* ---------------------------------------------------------------------------
   Access & approval
--------------------------------------------------------------------------- */

export function useMyAccess() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["myAccess"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMyAccess();
    },
    enabled: !!actor && !isFetching,
  });
}

export function usePendingUsers() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["pendingUsers"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listPendingUsers();
    },
    enabled: !!actor && !isFetching,
  });
}

export function usePendingSignups() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["pendingSignups"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listPendingSignups();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSignup(id: SignupId | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["signup", id?.toString()],
    queryFn: async () => {
      if (!actor || id === undefined) return null;
      return actor.getSignup(id);
    },
    enabled: !!actor && !isFetching && id !== undefined,
  });
}

export function useSignupDuplicates(id: SignupId | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["signupDuplicates", id?.toString()],
    queryFn: async () => {
      if (!actor || id === undefined) return [];
      return actor.findDuplicates(id);
    },
    enabled: !!actor && !isFetching && id !== undefined,
  });
}

export function useApproveSignup() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: SignupId;
      decision: ApprovalDecision;
      signature: SignatureRef;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.approveSignup(args.id, args.decision, args.signature);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pendingSignups"] });
      void queryClient.invalidateQueries({ queryKey: ["roadies"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

export function useRejectSignup() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: SignupId) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.rejectSignup(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pendingSignups"] });
    },
  });
}

export function useRequestAccess() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.requestAccess();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myAccess"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingUsers"] });
    },
  });
}

/**
 * Bridge the platform's first-admin grant into the app's own access model.
 * Idempotent: the backend only persists a grant while no app Admin exists and
 * the caller is already a platform admin, so it is safe to call for every
 * signed-in caller. Returns true once the caller holds an app Admin grant.
 */
export function useBootstrapAdmin() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.bootstrapAdmin();
    },
    onSuccess: (granted) => {
      if (granted) {
        void queryClient.invalidateQueries({ queryKey: ["myAccess"] });
        void queryClient.invalidateQueries({ queryKey: ["pendingUsers"] });
        void queryClient.invalidateQueries({ queryKey: ["accessGrants"] });
        void queryClient.invalidateQueries({ queryKey: ["adminCount"] });
      }
    },
  });
}

export function useAccessGrants() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["accessGrants"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listAccessGrants();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAdminCount() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["adminCount"],
    queryFn: async () => {
      if (!actor) return 0n;
      return actor.adminCount();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useApproveUser() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: ApprovalRequest) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.approveUser(request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pendingUsers"] });
      void queryClient.invalidateQueries({ queryKey: ["accessGrants"] });
      void queryClient.invalidateQueries({ queryKey: ["adminCount"] });
    },
  });
}

export function useUpdateUserRole() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { principal: Principal; role: Role }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateUserRole(args.principal, args.role);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accessGrants"] });
      void queryClient.invalidateQueries({ queryKey: ["adminCount"] });
    },
  });
}

export function useUpdateTrainerStations() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      principal: Principal;
      positionIds: PositionId[];
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateTrainerStations(args.principal, args.positionIds);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accessGrants"] });
    },
  });
}

export function useUpdateAccessEnd() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      principal: Principal;
      accessEndsAt: Timestamp | null;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateAccessEnd(args.principal, args.accessEndsAt);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accessGrants"] });
    },
  });
}

export function useRemoveUser() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (principal: Principal) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.removeUser(principal);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accessGrants"] });
      void queryClient.invalidateQueries({ queryKey: ["adminCount"] });
    },
  });
}

/* ---------------------------------------------------------------------------
   Store & schedule
--------------------------------------------------------------------------- */

export function useStoreInfo() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["storeInfo"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getStoreInfo();
    },
    enabled: !!actor && !isFetching,
  });
}

export function usePositions() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listPositions();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSchedule() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["schedule"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listSchedule();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUpdateStoreInfo() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (info: StoreInfo) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateStoreInfo(info);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storeInfo"] });
    },
  });
}

export function useCreatePosition() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (position: Position) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.createPosition(position);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["positions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdatePosition() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (position: Position) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updatePosition(position);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["positions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeletePosition() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: PositionId) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.deletePosition(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["positions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateScheduleEvent() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: ScheduleEvent) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.createScheduleEvent(event);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
  });
}

export function useUpdateScheduleEvent() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: ScheduleEvent) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateScheduleEvent(event);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
  });
}

export function useDeleteScheduleEvent() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: EventId) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.deleteScheduleEvent(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
  });
}

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

export function useUpdateChecklists() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (value: Checklists) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateChecklists(value);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["checklists"] });
    },
  });
}

export function useRetentionSettings() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["retentionSettings"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getRetentionSettings();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUpdateRetentionSettings() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: RetentionSettings) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateRetentionSettings(settings);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["retentionSettings"] });
    },
  });
}

export function useSaveStoreTemplate() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (name: string) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.saveStoreTemplate(name);
    },
  });
}

/* ---------------------------------------------------------------------------
   Roadies
--------------------------------------------------------------------------- */

export function useRoadies() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["roadies"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listRoadies();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useRoadie(id: RoadieId | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["roadie", id?.toString()],
    queryFn: async () => {
      if (!actor || id === undefined) return null;
      return actor.getRoadie(id);
    },
    enabled: !!actor && !isFetching && id !== undefined,
  });
}

export function useCrews() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["crews"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listCrews();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useChangeLog() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["changeLog"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listChangeLog();
    },
    enabled: !!actor && !isFetching,
  });
}

/* ---------------------------------------------------------------------------
   Dashboard & export
--------------------------------------------------------------------------- */

export function useDashboard() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getDashboard();
    },
    enabled: !!actor && !isFetching,
  });
}

/**
 * Per-position roster counts: on-hand roadies and open spots. The backend
 * derives both from the position's build-to target, so the dashboard panels
 * read on-hand and open spots from this summary rather than recounting.
 */
export function useRosterSummary() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["rosterSummary"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getRosterSummary();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useShareableExport() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["export", "shareable"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.buildShareableExport();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useFullExport() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["export", "full"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.buildFullExport();
    },
    enabled: !!actor && !isFetching,
  });
}
