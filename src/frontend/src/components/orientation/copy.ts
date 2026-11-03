import { useI18n } from "@/hooks/useI18n";

/**
 * Orientation-surface copy. The shared dictionary in `lib/copy.ts` is
 * foundation-owned, so the orientation components keep their own strings here
 * and read the active locale from `useI18n()`.
 */
export interface OrientationCopy {
  title: string;
  subtitle: string;
  sessionLabel: string;
  sessionPlaceholder: string;
  sessionHint: string;
  noSessions: string;
  loading: string;
  error: string;
  empty: string;
  searchLabel: string;
  searchPlaceholder: string;
  presentCount: string;
  presentButton: string;
  presentSaving: string;
  presentDone: string;
  undoButton: string;
  paperworkIncomplete: string;
  archiveIncomplete: string;
  overrideButton: string;
  overrideTitle: string;
  overrideBody: string;
  overrideReason: string;
  overrideReasonPlaceholder: string;
  overrideConfirm: string;
  overrideRequired: string;
  noShowTag: string;
  archiveNoShows: string;
  archiveNoShowsTitle: string;
  archiveNoShowsBody: string;
  archiveNoShowsConfirm: string;
  archiveNoShowsEmpty: string;
  archiveNoShowsDone: string;
  moveButton: string;
  moveTitle: string;
  moveBody: string;
  moveTarget: string;
  moveConfirm: string;
  moveNoTargets: string;
  moveDone: string;
  uniformTitle: string;
  uniformBody: string;
  uniformLocked: string;
  uniformComplete: string;
  uniformMissing: string;
  uniformShirts: string;
  uniformHats: string;
  uniformSave: string;
  uniformSaved: string;
  uniformSaving: string;
  uniformError: string;
  uniformLoading: string;
  uniformEmpty: string;
  uniformCountDecrease: string;
  uniformCountIncrease: string;
  uniformCheckboxLabel: string;
  close: string;
  cancel: string;
  confirm: string;
  crewNone: string;
  positionNone: string;
  errorGeneric: string;
}

const en: OrientationCopy = {
  title: "Orientation",
  subtitle: "Check roadies in at their orientation session",
  sessionLabel: "Session",
  sessionPlaceholder: "Select a session",
  sessionHint: "Defaults to today's session, or the next one.",
  noSessions: "No orientation sessions are scheduled yet.",
  loading: "Loading the session…",
  error: "We couldn't load this orientation session.",
  empty: "No roadies are assigned to this session.",
  searchLabel: "Search roadies",
  searchPlaceholder: "Search by name, position or crew",
  presentCount: "{present} of {total} present",
  presentButton: "Present",
  presentSaving: "Saving…",
  presentDone: "Present",
  undoButton: "Undo present",
  paperworkIncomplete: "Paperwork incomplete",
  archiveIncomplete: "Archive: Paperwork Incomplete",
  overrideButton: "Override and mark Present",
  overrideTitle: "Override paperwork",
  overrideBody:
    "Marking this roadie Present with incomplete paperwork is logged with your reason.",
  overrideReason: "Reason",
  overrideReasonPlaceholder: "Why is this being overridden?",
  overrideConfirm: "Override and mark Present",
  overrideRequired: "Enter a reason to override.",
  noShowTag: "No-Show",
  archiveNoShows: "Archive all No-Shows as NCNS Orientation",
  archiveNoShowsTitle: "Archive all No-Shows",
  archiveNoShowsBody:
    "These roadies are still Pending and their session has passed. They will be archived as NCNS Orientation.",
  archiveNoShowsConfirm: "Archive No-Shows",
  archiveNoShowsEmpty: "There are no no-shows to archive.",
  archiveNoShowsDone: "No-shows archived.",
  moveButton: "Move to another session",
  moveTitle: "Move to another session",
  moveBody: "Choose the session this roadie should attend instead.",
  moveTarget: "Session",
  moveConfirm: "Move roadie",
  moveNoTargets: "There is no other session to move to.",
  moveDone: "Roadie moved.",
  uniformTitle: "Uniform check-off",
  uniformBody: "Check off the orientation uniform items for this roadie.",
  uniformLocked:
    "Paperwork incomplete — the uniform check-off unlocks once paperwork is 100%.",
  uniformComplete: "Uniform complete",
  uniformMissing: "Missing: {items}",
  uniformShirts: "Shirts",
  uniformHats: "Hats",
  uniformSave: "Save check-off",
  uniformSaved: "Check-off saved.",
  uniformSaving: "Saving…",
  uniformError: "We couldn't save the check-off.",
  uniformLoading: "Loading the check-off…",
  uniformEmpty: "No orientation uniform items are configured.",
  uniformCountDecrease: "Decrease {label}",
  uniformCountIncrease: "Increase {label}",
  uniformCheckboxLabel: "Check off {label}",
  close: "Close",
  cancel: "Cancel",
  confirm: "Confirm",
  crewNone: "No crew",
  positionNone: "No position",
  errorGeneric: "Something went wrong. Please try again.",
};

const es: OrientationCopy = {
  title: "Orientación",
  subtitle: "Registra a los roadies en su sesión de orientación",
  sessionLabel: "Sesión",
  sessionPlaceholder: "Selecciona una sesión",
  sessionHint: "Se usa por defecto la sesión de hoy, o la siguiente.",
  noSessions: "Aún no hay sesiones de orientación programadas.",
  loading: "Cargando la sesión…",
  error: "No pudimos cargar esta sesión de orientación.",
  empty: "No hay roadies asignados a esta sesión.",
  searchLabel: "Buscar roadies",
  searchPlaceholder: "Busca por nombre, puesto o equipo",
  presentCount: "{present} de {total} presentes",
  presentButton: "Presente",
  presentSaving: "Guardando…",
  presentDone: "Presente",
  undoButton: "Deshacer presente",
  paperworkIncomplete: "Papeleo incompleto",
  archiveIncomplete: "Archivar: papeleo incompleto",
  overrideButton: "Anular y marcar Presente",
  overrideTitle: "Anular papeleo",
  overrideBody:
    "Marcar a este roadie como Presente con papeleo incompleto queda registrado con tu motivo.",
  overrideReason: "Motivo",
  overrideReasonPlaceholder: "¿Por qué se anula?",
  overrideConfirm: "Anular y marcar Presente",
  overrideRequired: "Escribe un motivo para anular.",
  noShowTag: "No se presentó",
  archiveNoShows: "Archivar todos los No-Shows como NCNS Orientación",
  archiveNoShowsTitle: "Archivar todos los No-Shows",
  archiveNoShowsBody:
    "Estos roadies siguen Pendientes y su sesión ya pasó. Se archivarán como NCNS Orientación.",
  archiveNoShowsConfirm: "Archivar No-Shows",
  archiveNoShowsEmpty: "No hay no-shows para archivar.",
  archiveNoShowsDone: "No-shows archivados.",
  moveButton: "Mover a otra sesión",
  moveTitle: "Mover a otra sesión",
  moveBody: "Elige la sesión a la que este roadie debería asistir.",
  moveTarget: "Sesión",
  moveConfirm: "Mover roadie",
  moveNoTargets: "No hay otra sesión a la que moverlo.",
  moveDone: "Roadie movido.",
  uniformTitle: "Registro de uniforme",
  uniformBody:
    "Marca los artículos del uniforme de orientación de este roadie.",
  uniformLocked:
    "Papeleo incompleto — el registro de uniforme se desbloquea cuando el papeleo esté al 100%.",
  uniformComplete: "Uniforme completo",
  uniformMissing: "Falta: {items}",
  uniformShirts: "Camisas",
  uniformHats: "Gorras",
  uniformSave: "Guardar registro",
  uniformSaved: "Registro guardado.",
  uniformSaving: "Guardando…",
  uniformError: "No pudimos guardar el registro.",
  uniformLoading: "Cargando el registro…",
  uniformEmpty: "No hay artículos de uniforme de orientación configurados.",
  uniformCountDecrease: "Reducir {label}",
  uniformCountIncrease: "Aumentar {label}",
  uniformCheckboxLabel: "Marcar {label}",
  close: "Cerrar",
  cancel: "Cancelar",
  confirm: "Confirmar",
  crewNone: "Sin equipo",
  positionNone: "Sin puesto",
  errorGeneric: "Algo salió mal. Inténtalo de nuevo.",
};

const orientationCopy = { en, es } as const;

/** Interpolate `{name}` placeholders in an orientation copy string. */
export function fill(
  template: string,
  vars: Record<string, string | number>,
): string {
  let value = template;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

/** The orientation-surface copy for the active locale. */
export function useOrientationCopy(): OrientationCopy {
  const { locale } = useI18n();
  return orientationCopy[locale] ?? orientationCopy.en;
}
