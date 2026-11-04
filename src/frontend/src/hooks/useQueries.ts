import {
  type ApprovalDecision,
  type ApprovalRequest,
  type Checklists,
  type CrewId,
  type DemoActionResult,
  type DemoDataSummary,
  type DemoRole,
  type DemoStateView,
  type DuplicateMatch,
  type EventId,
  type LeaderSummary,
  type OrientationSessionOption,
  type OrientationSessionView,
  type PhotoRef,
  type Position,
  type PositionId,
  type PretendDate,
  type RetentionSettings,
  type RoadieId,
  type Role,
  type ScheduleEvent,
  type SignatureRef,
  type SignupId,
  type SignupSubmission,
  type StaffProfile,
  type StoreInfo,
  type StoreLogos,
  type StoreTemplateFile,
  type Timestamp,
  type UnassignedRoadieRow,
  type UniformCheckoffView,
  type UniformHouseFilter,
  type UniformOrderView,
  type UniformSettings,
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
  const enabled = !!actor && !isFetching;
  const query = useQuery({
    queryKey: ["myAccess"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMyAccess();
    },
    enabled,
    // Poll so a pending caller's approval appears without a manual reload.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  // A disabled query reports `isLoading: false`, so expose whether the read has
  // actually been able to run. Callers treat "not ready" as loading rather than
  // as a resolved pending state.
  return { ...query, isReady: enabled };
}

/**
 * The caller's own pending access request, if any. Returns null when the
 * caller has no pending entry; otherwise the requestedAt of that pending entry
 * and hasProfile = true when a staff profile has been submitted. Polls like
 * `useMyAccess` so a pending caller's state stays current without a reload.
 */
export function useMyPendingRequest() {
  const { actor, isFetching } = useActor(createActor);
  const enabled = !!actor && !isFetching;
  const query = useQuery({
    queryKey: ["myPendingRequest"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMyPendingRequest();
    },
    enabled,
    // Poll so a pending caller's request state stays current without a reload.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  // A disabled query reports `isLoading: false`, so expose whether the read has
  // actually been able to run. Callers treat "not ready" as loading rather than
  // as a resolved absent state.
  return { ...query, isReady: enabled };
}

/**
 * The pending sign-in queue. Only admins may read it, so callers pass
 * `enabled` (typically `canApprove(role)`) to avoid a trapping read for every
 * other role.
 */
export function usePendingUsers(enabled = true) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["pendingUsers"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listPendingUsers();
    },
    enabled: enabled && !!actor && !isFetching,
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

/**
 * Whether an Admin has set the kiosk staff PIN. The kiosk sign-out checks the
 * entered PIN against the stored hash, so this tells an admin whether a PIN
 * exists yet. Admin-only on the backend, so callers pass `enabled` to avoid a
 * trapping read for other roles.
 */
export function useHasKioskPin(enabled = true) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["hasKioskPin"],
    queryFn: async () => {
      if (!actor) return false;
      return actor.hasKioskPin();
    },
    enabled: enabled && !!actor && !isFetching,
  });
}

/**
 * Set the kiosk staff PIN. The backend stores only a one-way hash, so the
 * plaintext is never persisted or returned. Admin-only.
 */
export function useSetKioskPin() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pin: string) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.setKioskPin(pin);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hasKioskPin"] });
    },
  });
}

/* ---------------------------------------------------------------------------
   Demo mode
--------------------------------------------------------------------------- */

/**
 * The current demo state. Readable by any caller, including unregistered users,
 * so the banner can render on the sign-in and waiting screens. Polls so an
 * auto-off (eight hours) or another admin's change is reflected without a
 * reload.
 */
export function useDemoState() {
  const { actor, isFetching } = useActor(createActor);
  const enabled = !!actor && !isFetching;
  const query = useQuery({
    queryKey: ["demoState"],
    queryFn: async (): Promise<DemoStateView | null> => {
      if (!actor) return null;
      return actor.getDemoState();
    },
    enabled,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  return { ...query, isReady: enabled };
}

/**
 * Turn demo mode on or off (Admin only). Turning it on requires the literal
 * confirmation "DEMO". The demo state is invalidated so the banner and every
 * demo-aware read refresh.
 */
export function useSetDemoMode() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      enabled: boolean;
      confirmation: string;
    }): Promise<DemoActionResult> => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.setDemoMode(args.enabled, args.confirmation);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["demoState"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
      // Turning demo mode on/off changes what every screen shows, so refetch
      // every query (dashboard tiles, countdown, Today, Orientation, roster).
      void queryClient.invalidateQueries();
    },
  });
}

/**
 * Choose the impersonated demo role and, for a demo NSO Trainer, the stations
 * that role may see. Any signed-in caller may choose a demo role while demo
 * mode is on.
 */
export function useSetDemoRole() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      role: DemoRole;
      stations: PositionId[];
    }): Promise<DemoActionResult> => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.setDemoRole(args.role, args.stations);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["demoState"] });
      void queryClient.invalidateQueries({ queryKey: ["myAccess"] });
    },
  });
}

/**
 * Set or clear the pretend "now" used while demo mode is on. Null restores the
 * real clock.
 */
export function useSetPretendDate() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      pretendDate: PretendDate | null,
    ): Promise<DemoActionResult> => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.setPretendDate(pretendDate);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["demoState"] });
      // The pretend date overrides "now" for every screen, so refetch every
      // query (dashboard tiles, countdown, Today, Orientation, roster).
      void queryClient.invalidateQueries();
    },
  });
}

/** Count the demo records currently loaded (Admin, demo mode only). */
export function useDemoDataSummary(enabled = true) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["demoDataSummary"],
    queryFn: async (): Promise<DemoDataSummary | null> => {
      if (!actor) return null;
      return actor.getDemoDataSummary();
    },
    enabled: enabled && !!actor && !isFetching,
  });
}

/**
 * Seed the demo data set (Admin, demo mode only). Invalidates every surface the
 * seed populates so the demo records appear immediately.
 */
export function useLoadDemoData() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<DemoDataSummary> => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.loadDemoData();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["demoDataSummary"] });
      void queryClient.invalidateQueries({ queryKey: ["roadies"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingSignups"] });
      void queryClient.invalidateQueries({ queryKey: ["crews"] });
      void queryClient.invalidateQueries({ queryKey: ["leaders"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["rosterSummary"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/**
 * Remove every demo record (Admin, demo mode only). Real records are never
 * touched.
 */
export function useClearDemoData() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<DemoDataSummary> => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.clearDemoData();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["demoDataSummary"] });
      void queryClient.invalidateQueries({ queryKey: ["roadies"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingSignups"] });
      void queryClient.invalidateQueries({ queryKey: ["crews"] });
      void queryClient.invalidateQueries({ queryKey: ["leaders"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["rosterSummary"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/* ---------------------------------------------------------------------------
   Staff profile
--------------------------------------------------------------------------- */

/**
 * Store the caller's staff profile on their pending access request. Used by the
 * post-sign-in profile form before an Admin approves the caller. The backend
 * traps when the caller has no pending request, so callers only invoke this
 * while the access state is pending.
 */
export function useSubmitStaffProfile() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: StaffProfile) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.submitStaffProfile(profile);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myAccess"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingUsers"] });
    },
  });
}

/**
 * Update the caller's own staff profile on their access grant. Existing users
 * approved before profiles existed use this to fill theirs in without losing
 * access. The backend traps when the caller has no grant.
 */
export function useUpdateMyStaffProfile() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: StaffProfile) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateMyStaffProfile(profile);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myAccess"] });
      void queryClient.invalidateQueries({ queryKey: ["accessGrants"] });
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

/** The store's two uploaded logos, each absent when not set. */
export interface StoreLogoPair {
  logo: PhotoRef | null;
  secondaryLogo: PhotoRef | null;
}

const NO_STORE_LOGOS: StoreLogoPair = { logo: null, secondaryLogo: null };

/** Coerce one optional logo field to `PhotoRef | null`. */
function toPhotoRef(value: unknown): PhotoRef | null {
  return value instanceof Uint8Array ? value : null;
}

/**
 * Normalize the public `getStoreLogo` result. The current binding returns a
 * `StoreLogos` record with both logos; an older actor (or a test mock) may
 * return a bare `PhotoRef` for the main logo, which is treated as `logo` with
 * no secondary logo.
 */
function normalizeStoreLogos(value: unknown): StoreLogoPair {
  if (value instanceof Uint8Array) {
    return { logo: value, secondaryLogo: null };
  }
  if (typeof value === "object" && value !== null) {
    const record = value as StoreLogos;
    return {
      logo: toPhotoRef(record.logo),
      secondaryLogo: toPhotoRef(record.secondaryLogo),
    };
  }
  return NO_STORE_LOGOS;
}

/**
 * The store's uploaded logo bytes, read from the public `getStoreLogo`
 * endpoint. Both the main logo and the secondary logo are exposed so callers
 * can render either. The bytes never change for a given store, so the read is
 * cached indefinitely. Older actors (and test mocks) may not expose
 * `getStoreLogo`; the hook then resolves to both logos absent so callers fall
 * back to the built-in star instead of surfacing an error.
 */
export function useStoreLogo() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["storeLogo"],
    queryFn: async (): Promise<StoreLogoPair> => {
      if (!actor) return NO_STORE_LOGOS;
      const readLogo = readOptionalStoreLogo(actor);
      if (!readLogo) return NO_STORE_LOGOS;
      return normalizeStoreLogos(await readLogo());
    },
    enabled: !!actor && !isFetching,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Narrow an actor to its optional `getStoreLogo` read. The generated bindings
 * do not declare the method, so it is looked up structurally and only invoked
 * when the running actor actually exposes it.
 */
function readOptionalStoreLogo(
  actor: unknown,
): (() => Promise<unknown>) | null {
  if (typeof actor !== "object" || actor === null) return null;
  const candidate = (actor as { getStoreLogo?: unknown }).getStoreLogo;
  if (typeof candidate !== "function") return null;
  return () => (candidate as () => Promise<unknown>).call(actor);
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
      void queryClient.invalidateQueries({ queryKey: ["storeLogo"] });
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

/**
 * Download the current store configuration as a template file. This is a
 * mutation rather than a query so the build runs only when an Admin taps
 * Download, never on page load. The caller passes the returned file to the
 * download handler.
 */
export function useDownloadStoreTemplate() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (): Promise<StoreTemplateFile> => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.downloadStoreTemplate();
    },
  });
}

/**
 * Load a store template file (Admin only). The backend validates the file and
 * refuses once any roadie exists; on success it replaces positions, schedule
 * and checklists, so the affected reads are invalidated.
 */
export function useLoadStoreTemplate() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: StoreTemplateFile) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.loadStoreTemplate(file);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["positions"] });
      void queryClient.invalidateQueries({ queryKey: ["schedule"] });
      void queryClient.invalidateQueries({ queryKey: ["checklists"] });
      void queryClient.invalidateQueries({ queryKey: ["storeInfo"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
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

/**
 * A roadie's photo bytes, read on demand. `listRoadies` and
 * `listPendingSignups` no longer carry full photo bytes, so the roster list and
 * the roadie card fetch the photo by id instead. React Query caches the result
 * under the roadie id, and the bytes never change for a given id, so a
 * re-render or a revisit reuses the cached read rather than re-fetching.
 */
export function useRoadiePhoto(id: RoadieId | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["roadiePhoto", id?.toString()],
    queryFn: async () => {
      if (!actor || id === undefined) return null;
      return actor.getPhoto(id);
    },
    enabled: !!actor && !isFetching && id !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * The leaders roster: managers, trainers and market partners with their staff
 * profile, title and travel dates. Readable by every role except Kiosk and
 * Integration, so callers pass `enabled` (typically `canLeaders(role)`) to
 * avoid a trapping read for those roles.
 */
export function useLeaders(enabled = true) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["leaders"],
    queryFn: async (): Promise<LeaderSummary[]> => {
      if (!actor) return [];
      return actor.listLeaders();
    },
    enabled: enabled && !!actor && !isFetching,
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

/**
 * Create a crew (Admin/Store Manager only). The backend returns the new crew
 * id; the crews list is invalidated so the new row appears.
 */
export function useCreateCrew() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.createCrew(name);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["crews"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/**
 * Rename a crew and/or change its leader (Admin/Store Manager only). Both
 * fields save through the same update, so the crews list is invalidated once.
 */
export function useUpdateCrew() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: CrewId;
      name: string;
      leaderPrincipal: Principal | null;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateCrew(args.id, args.name, args.leaderPrincipal);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["crews"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/**
 * Delete a crew (Admin/Store Manager only). The backend refuses while any
 * roadie is assigned to the crew, so the caller surfaces that error.
 */
export function useDeleteCrew() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: CrewId) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.deleteCrew(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["crews"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
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

/**
 * The Full export, including contact details. This is a mutation rather than a
 * query so the expensive build runs only when an Admin or Store Manager taps
 * Download, never on page load. The caller invokes `mutateAsync()` from the
 * download handler and passes the returned data to the workbook builder.
 */
export function useFullExport() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.buildFullExport();
    },
  });
}

/* ---------------------------------------------------------------------------
   Orientation
--------------------------------------------------------------------------- */

/**
 * The orientation check-in view for one session: assigned roadies with photo,
 * name, position, crew and paperwork status, plus Present x / y counts.
 * Readable by Admin, Store Manager, Training Manager and Visiting Manager, so
 * callers pass `enabled` (typically `canOrientation(role)`) to avoid a trapping
 * read for other roles.
 */
export function useOrientationSessionView(
  eventId: EventId | undefined,
  enabled = true,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["orientationSession", eventId?.toString()],
    queryFn: async (): Promise<OrientationSessionView | null> => {
      if (!actor || eventId === undefined) return null;
      return actor.getOrientationSessionView(eventId);
    },
    enabled: enabled && !!actor && !isFetching && eventId !== undefined,
  });
}

/**
 * Mark a roadie Present at an orientation session (Admin/Store Manager only).
 * Idempotent on the backend, so concurrent managers converge. Invalidates the
 * session view, the dashboard and the roster summary so the counts refresh.
 */
export function useMarkPresent() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      roadieId: RoadieId;
      eventId: EventId;
      overrideReason?: string | null;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.markPresent(
        args.roadieId,
        args.eventId,
        args.overrideReason ?? null,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orientationSession"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["rosterSummary"] });
      void queryClient.invalidateQueries({ queryKey: ["roadies"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/**
 * Undo a roadie's Present mark at an orientation session (Admin/Store Manager
 * only). Invalidates the same reads as marking Present.
 */
export function useUndoPresent() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { roadieId: RoadieId; eventId: EventId }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.undoPresent(args.roadieId, args.eventId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orientationSession"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["rosterSummary"] });
      void queryClient.invalidateQueries({ queryKey: ["roadies"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/**
 * Move a roadie to another orientation session (Admin/Store Manager only).
 * Invalidates both the source and target session views plus the roster.
 */
export function useMoveRoadieToSession() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { roadieId: RoadieId; eventId: EventId }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.moveRoadieToSession(args.roadieId, args.eventId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orientationSession"] });
      void queryClient.invalidateQueries({
        queryKey: ["unassignedPendingRoadies"],
      });
      void queryClient.invalidateQueries({ queryKey: ["roadies"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["rosterSummary"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/**
 * The orientation sessions as lightweight options (id, name, start, end),
 * soonest first. Readable by orientation staff, so callers pass `enabled`
 * (typically `canOrientation(role)`) to avoid a trapping read for other roles.
 */
export function useOrientationSessions(enabled = true) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["orientationSessions"],
    queryFn: async (): Promise<OrientationSessionOption[]> => {
      if (!actor) return [];
      return actor.listOrientationSessions();
    },
    enabled: enabled && !!actor && !isFetching,
  });
}

/**
 * Pending roadies with no valid orientation session, each with name, position
 * and crew. Readable by orientation staff, so callers pass `enabled` (typically
 * `canOrientation(role)`) to avoid a trapping read for other roles.
 */
export function useUnassignedPendingRoadies(enabled = true) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["unassignedPendingRoadies"],
    queryFn: async (): Promise<UnassignedRoadieRow[]> => {
      if (!actor) return [];
      return actor.listUnassignedPendingRoadies();
    },
    enabled: enabled && !!actor && !isFetching,
  });
}

/**
 * Assign every unassigned pending roadie to a session (Admin/Store Manager
 * only). Returns the number moved. Invalidates the unassigned list, the session
 * views, the roster and the dashboard so every surface reflects the move.
 */
export function useMoveAllRoadiesToSession() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      fromEventId: EventId;
      toEventId: EventId;
    }): Promise<bigint> => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.moveAllRoadiesToSession(args.fromEventId, args.toEventId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["unassignedPendingRoadies"],
      });
      void queryClient.invalidateQueries({ queryKey: ["orientationSession"] });
      void queryClient.invalidateQueries({ queryKey: ["roadies"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["rosterSummary"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/**
 * Archive every no-show at a session as NCNS Orientation (Admin/Store Manager
 * only). Returns the archived roadie ids. Invalidates the session view, the
 * roster and the dashboard so the archived roadies drop out of the counts.
 */
export function useArchiveNoShows() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: EventId): Promise<RoadieId[]> => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.archiveNoShows(eventId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orientationSession"] });
      void queryClient.invalidateQueries({ queryKey: ["roadies"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["rosterSummary"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/**
 * The uniform check-off for a roadie: the required items with their checked
 * state and counts, plus whether the check-off is complete. Readable by Admin
 * and Store Manager only, so callers pass `enabled` to avoid a trapping read.
 */
export function useUniformCheckoff(
  roadieId: RoadieId | undefined,
  enabled = true,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["uniformCheckoff", roadieId?.toString()],
    queryFn: async (): Promise<UniformCheckoffView | null> => {
      if (!actor || roadieId === undefined) return null;
      return actor.getUniformCheckoff(roadieId);
    },
    enabled: enabled && !!actor && !isFetching && roadieId !== undefined,
  });
}

/**
 * A roadie's orientation check-off: the stored paperwork items and uniform
 * fields. Readable by Admin and Store Manager only, so callers pass `enabled`
 * to avoid a trapping read for other roles.
 */
export function useOrientationCheckoff(
  roadieId: RoadieId | undefined,
  enabled = true,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["orientationCheckoff", roadieId?.toString()],
    queryFn: async () => {
      if (!actor || roadieId === undefined) return null;
      return actor.getOrientationCheckoff(roadieId);
    },
    enabled: enabled && !!actor && !isFetching && roadieId !== undefined,
  });
}

/**
 * Save the uniform check-off for a roadie (Admin/Store Manager only). Writes
 * only the uniform fields, so the roadie's paperwork items are preserved.
 * Invalidates the check-off read plus the roster tile, the orientation list and
 * the alerts so every surface reflects the save.
 */
export function useSaveUniformCheckoff() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      roadieId: RoadieId;
      uniformItems: string[];
      uniformCounts: Array<[bigint, bigint]>;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.saveUniformCheckoff(
        args.roadieId,
        args.uniformItems,
        args.uniformCounts,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["uniformCheckoff"] });
      void queryClient.invalidateQueries({ queryKey: ["orientationCheckoff"] });
      void queryClient.invalidateQueries({ queryKey: ["orientationSession"] });
      void queryClient.invalidateQueries({ queryKey: ["roadies"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["rosterSummary"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/**
 * Set a roadie's paperwork items (Admin/Store Manager only). Writes only the
 * paperwork items, so the uniform fields are preserved. Invalidates the
 * check-off read plus the roster tile, the orientation list and the alerts so
 * every surface reflects the save.
 */
export function useSetPaperworkItems() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      roadieId: RoadieId;
      paperworkItems: string[];
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.setPaperworkItems(args.roadieId, args.paperworkItems);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orientationCheckoff"] });
      void queryClient.invalidateQueries({ queryKey: ["orientationSession"] });
      void queryClient.invalidateQueries({ queryKey: ["roadies"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["rosterSummary"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/* ---------------------------------------------------------------------------
   Uniforms
--------------------------------------------------------------------------- */

/**
 * The uniform settings: the shirt and hat size curve plus the buffer percent
 * applied to the projected order. Readable by Admin, Store Manager and Training
 * Manager, so callers pass `enabled` (typically `canUniforms(role)`) to avoid a
 * trapping read for other roles.
 */
export function useUniformSettings(enabled = true) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["uniformSettings"],
    queryFn: async (): Promise<UniformSettings | null> => {
      if (!actor) return null;
      return actor.getUniformSettings();
    },
    enabled: enabled && !!actor && !isFetching,
  });
}

/**
 * Save the uniform settings (Admin/Store Manager only). The backend guards the
 * write with requireRealSettingsManager, so it traps while demo mode is on. The
 * settings and the derived order are invalidated so both refresh.
 */
export function useUpdateUniformSettings() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: UniformSettings) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.updateUniformSettings(settings);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["uniformSettings"] });
      void queryClient.invalidateQueries({ queryKey: ["uniformOrder"] });
      void queryClient.invalidateQueries({ queryKey: ["changeLog"] });
    },
  });
}

/**
 * The uniform order for one house filter: per-item size rows with hired,
 * projected and order totals, the size-unknown roadies and the buffer percent
 * used. Readable by Admin, Store Manager and Training Manager, so callers pass
 * `enabled` (typically `canUniforms(role)`) to avoid a trapping read.
 */
export function useUniformOrder(filter: UniformHouseFilter, enabled = true) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["uniformOrder", filter],
    queryFn: async (): Promise<UniformOrderView | null> => {
      if (!actor) return null;
      return actor.getUniformOrder(filter);
    },
    enabled: enabled && !!actor && !isFetching,
  });
}
