import { DemoRole, Role } from "@/backend";
import {
  useClearDemoData,
  useDemoDataSummary,
  useDemoState,
  useLoadDemoData,
  useSetDemoManagerAs,
  useSetDemoMode,
  useSetDemoRole,
  useSetPretendDate,
} from "@/hooks/useQueries";
import type { DemoRoleOption, DemoState } from "@/types";
import type { Principal } from "@icp-sdk/core/principal";
import { useMemo } from "react";

/** The demo roles offered by the banner's "View as" picker, in display order. */
export const DEMO_ROLE_OPTIONS: DemoRoleOption[] = [
  { role: DemoRole.admin, label: "Admin" },
  { role: DemoRole.storeManager, label: "Store Manager" },
  { role: DemoRole.trainingManager, label: "Training Manager" },
  { role: DemoRole.trainer, label: "NSO Trainer" },
  { role: DemoRole.visitingManager, label: "Visiting Manager" },
  { role: DemoRole.leadership, label: "Leadership" },
  { role: DemoRole.kiosk, label: "Kiosk" },
];

/**
 * Map a demo role to the real application role it impersonates. The backend
 * enforces the same permission rules for the impersonated role as for a real
 * user with that role, so the frontend mirrors the mapping for its own gates.
 */
export function demoRoleToRole(role: DemoRole): Role {
  switch (role) {
    case DemoRole.admin:
      return Role.admin;
    case DemoRole.storeManager:
      return Role.storeManager;
    case DemoRole.trainingManager:
      return Role.trainingManager;
    case DemoRole.trainer:
      return Role.trainer;
    case DemoRole.visitingManager:
      return Role.visitingManager;
    case DemoRole.leadership:
      return Role.leadership;
    case DemoRole.kiosk:
      return Role.kiosk;
  }
}

/** The demo state with the caller's own demo role, or null while it loads. */
export interface DemoController {
  /** The current demo state, or null while it is still loading. */
  state: DemoState | null;
  /** Whether demo mode is on. */
  enabled: boolean;
  /** The caller's own impersonated role while demo mode is on, else null. */
  demoRole: DemoRole | null;
  /** The stations a demo NSO Trainer may see. */
  demoTrainerStations: bigint[];
  /** The demo manager a demo Store/Training Manager views as, or null. */
  demoManagerAs: Principal | null;
  /** The pretend "now" (date + AM/PM), or null to use the real clock. */
  pretendDate: DemoState["pretendDate"];
  /** When demo mode was turned on, if it is on. */
  turnedOnAt: bigint | null;
  /** When demo mode turns itself off, if it is on. */
  autoOffAt: bigint | null;
  /** Turn demo mode on or off (Admin only). */
  setEnabled: (enabled: boolean, confirmation: string) => void;
  /** Choose the caller's own impersonated demo role. */
  setRole: (role: DemoRole, stations: bigint[]) => void;
  /** Choose which demo manager a demo Store/Training Manager views as. */
  setManagerAs: (managerPrincipal: Principal) => void;
  /** Set or clear the pretend "now". */
  setPretendDate: (pretendDate: DemoState["pretendDate"]) => void;
  /** Whether a demo action is in flight. */
  isPending: boolean;
  /** The last demo action error, if any. */
  error: string | null;
}

/**
 * The demo mode data layer. Reads the demo state (readable by any caller,
 * including unregistered users) and exposes the actions the banner drives.
 * `demoRole` is the caller's own impersonated role, so two callers can view
 * different roles at once. Every action is a backend call; the backend enforces
 * who may perform it.
 */
export function useDemo(): DemoController {
  const { data } = useDemoState();
  const setMode = useSetDemoMode();
  const setRole = useSetDemoRole();
  const setManager = useSetDemoManagerAs();
  const setPretend = useSetPretendDate();

  const state = useMemo<DemoState | null>(() => {
    if (!data) return null;
    return {
      enabled: data.enabled,
      demoRole: data.demoRole ?? null,
      demoTrainerStations: data.demoTrainerStations,
      demoManagerAs: data.demoManagerAs ?? null,
      pretendDate: data.pretendDate ?? null,
      turnedOnAt: data.turnedOnAt ?? null,
      autoOffAt: data.autoOffAt ?? null,
    };
  }, [data]);

  const error = setMode.isError
    ? "Could not change demo mode."
    : setRole.isError
      ? "Could not change the demo role."
      : setManager.isError
        ? "Could not change the demo manager."
        : setPretend.isError
          ? "Could not change the pretend date."
          : null;

  return {
    state,
    enabled: state?.enabled ?? false,
    demoRole: state?.demoRole ?? null,
    demoTrainerStations: state?.demoTrainerStations ?? [],
    demoManagerAs: state?.demoManagerAs ?? null,
    pretendDate: state?.pretendDate ?? null,
    turnedOnAt: state?.turnedOnAt ?? null,
    autoOffAt: state?.autoOffAt ?? null,
    setEnabled: (enabled, confirmation) =>
      setMode.mutate({ enabled, confirmation }),
    setRole: (role, stations) => setRole.mutate({ role, stations }),
    setManagerAs: (managerPrincipal) => setManager.mutate(managerPrincipal),
    setPretendDate: (pretendDate) => setPretend.mutate(pretendDate),
    isPending:
      setMode.isPending ||
      setRole.isPending ||
      setManager.isPending ||
      setPretend.isPending,
    error,
  };
}

/**
 * The demo data controls (Admin, demo mode only): load and clear the demo data
 * set, with the current record counts. Kept separate from `useDemo` so the
 * banner does not subscribe to the summary read.
 */
export function useDemoData(enabled: boolean) {
  const summary = useDemoDataSummary(enabled);
  const load = useLoadDemoData();
  const clear = useClearDemoData();
  return {
    summary: summary.data ?? null,
    load: () => load.mutate(),
    clear: () => clear.mutate(),
    isPending: load.isPending || clear.isPending,
    error: load.isError
      ? "Could not load demo data."
      : clear.isError
        ? "Could not clear demo data."
        : null,
  };
}
