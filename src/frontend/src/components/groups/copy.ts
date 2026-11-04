import { useI18n } from "@/hooks/useI18n";

/**
 * Groups-local copy for keys the shared dictionary does not provide. Kept
 * beside the groups components so the shared dictionary stays owned by the
 * foundation. Falls back to English for any locale without a translation.
 */
const groupsCopy: Record<string, { en: string; es: string }> = {
  "groups.board.capacityLabel": { en: "Capacity", es: "Capacidad" },
  "groups.board.stations": { en: "Stations", es: "Estaciones" },
  "groups.board.noStations": { en: "No stations", es: "Sin estaciones" },
  "groups.board.removeTrainer": {
    en: "Remove trainer",
    es: "Quitar entrenador",
  },
  "groups.board.removeTrainerTitle": {
    en: "Remove trainer from this shift",
    es: "Quitar entrenador de este turno",
  },
  "groups.board.removeTrainerBody": {
    en: "This removes {name}'s group and returns its roadies to Unassigned.",
    es: "Esto quita el grupo de {name} y devuelve sus roadies a Sin asignar.",
  },
  "groups.board.addTrainerTitle": {
    en: "Add trainer to this shift",
    es: "Agregar entrenador a este turno",
  },
  "groups.board.addTrainerConfirm": {
    en: "Add trainer",
    es: "Agregar entrenador",
  },
  "groups.board.addTrainerError": {
    en: "We couldn't add that trainer.",
    es: "No pudimos agregar a ese entrenador.",
  },
  "groups.board.trainerAdded": {
    en: "Trainer added.",
    es: "Entrenador agregado.",
  },
  "groups.board.capacityHint": {
    en: "Change how many roadies this trainer can take.",
    es: "Cambia cuántos roadies puede tomar este entrenador.",
  },
  "groups.board.capacityDecrease": {
    en: "Decrease capacity",
    es: "Reducir capacidad",
  },
  "groups.board.capacityIncrease": {
    en: "Increase capacity",
    es: "Aumentar capacidad",
  },
  "groups.board.capacitySaveError": {
    en: "We couldn't save the capacity.",
    es: "No pudimos guardar la capacidad.",
  },
  "groups.board.dropHere": {
    en: "Drop roadies here",
    es: "Suelta roadies aquí",
  },
  "groups.board.dragging": {
    en: "Moving {name}",
    es: "Moviendo a {name}",
  },
  "groups.board.dragHint": {
    en: "Drag a roadie to a trainer, Unassigned or Off this shift.",
    es: "Arrastra un roadie a un entrenador, Sin asignar o Fuera de este turno.",
  },
  "groups.board.selected": {
    en: "Selected: {name}",
    es: "Seleccionado: {name}",
  },
  "groups.board.clearSelection": {
    en: "Clear selection",
    es: "Limpiar selección",
  },
  "groups.board.moveSelected": {
    en: "Move to…",
    es: "Mover a…",
  },
  "groups.board.stationFilter": {
    en: "Filter by station",
    es: "Filtrar por estación",
  },
  "groups.board.allStations": {
    en: "All stations",
    es: "Todas las estaciones",
  },
  "groups.board.unassignedCount": {
    en: "{count} unassigned",
    es: "{count} sin asignar",
  },
  "groups.board.offCount": {
    en: "{count} off",
    es: "{count} fuera",
  },
  "groups.board.roadieCount": {
    en: "{count} roadies",
    es: "{count} roadies",
  },
  "groups.board.roadieCountOne": {
    en: "1 roadie",
    es: "1 roadie",
  },
  "groups.board.overCapacityCount": {
    en: "{count} over",
    es: "{count} de más",
  },
  "groups.board.phoneHeading": {
    en: "Groups by trainer",
    es: "Grupos por entrenador",
  },
  "groups.board.phoneUnassigned": {
    en: "Unassigned",
    es: "Sin asignar",
  },
  "groups.board.phoneOff": {
    en: "Off this shift",
    es: "Fuera de este turno",
  },
  "groups.board.phoneEmpty": {
    en: "No roadies in this group.",
    es: "No hay roadies en este grupo.",
  },
  "groups.board.phoneHint": {
    en: "Tap a roadie, then choose Move to…",
    es: "Toca un roadie y elige Mover a…",
  },
  "groups.board.moveTitle": {
    en: "Move {name}",
    es: "Mover a {name}",
  },
  "groups.board.moveBody": {
    en: "Choose a trainer, Off this shift, or the same day's other shift.",
    es: "Elige un entrenador, Fuera de este turno o el otro turno del mismo día.",
  },
  "groups.board.moveTrainerSection": {
    en: "Trainer",
    es: "Entrenador",
  },
  "groups.board.moveOtherShiftSection": {
    en: "Other shift",
    es: "Otro turno",
  },
  "groups.board.moveConfirm": {
    en: "Move roadie",
    es: "Mover roadie",
  },
  "groups.board.moveCancel": {
    en: "Cancel",
    es: "Cancelar",
  },
  "groups.board.moveError": {
    en: "We couldn't move that roadie.",
    es: "No pudimos mover a ese roadie.",
  },
  "groups.board.moveNoTargets": {
    en: "There is nowhere else to move this roadie.",
    es: "No hay otro lugar al que mover a este roadie.",
  },
  "groups.board.copySourceLabel": {
    en: "Copy from",
    es: "Copiar de",
  },
  "groups.board.copySourcePlaceholder": {
    en: "Select a shift",
    es: "Selecciona un turno",
  },
  "groups.board.copyNoSources": {
    en: "There is no other shift to copy from.",
    es: "No hay otro turno del que copiar.",
  },
  "groups.board.copyError": {
    en: "We couldn't copy that board.",
    es: "No pudimos copiar ese tablero.",
  },
  "groups.board.autoFillError": {
    en: "We couldn't make groups.",
    es: "No pudimos crear los grupos.",
  },
  "groups.board.clearError": {
    en: "We couldn't clear the board.",
    es: "No pudimos limpiar el tablero.",
  },
  "groups.board.saving": {
    en: "Saving…",
    es: "Guardando…",
  },
  "groups.board.saved": {
    en: "Board saved.",
    es: "Tablero guardado.",
  },
  "groups.board.saveError": {
    en: "We couldn't save the board.",
    es: "No pudimos guardar el tablero.",
  },
  "groups.board.retry": {
    en: "Retry",
    es: "Reintentar",
  },
  "groups.board.unsaved": {
    en: "Unsaved changes",
    es: "Cambios sin guardar",
  },
  "groups.board.saveButton": {
    en: "Save board",
    es: "Guardar tablero",
  },
  "groups.board.discardButton": {
    en: "Discard changes",
    es: "Descartar cambios",
  },
  "groups.board.noTrainersTitle": {
    en: "No trainers on this shift yet",
    es: "Aún no hay entrenadores en este turno",
  },
  "groups.board.noTrainersBody": {
    en: "Add a trainer to start building groups for this shift.",
    es: "Agrega un entrenador para empezar a crear grupos en este turno.",
  },
  "groups.board.offThisShiftHint": {
    en: "Roadies who are not working this shift.",
    es: "Roadies que no trabajan en este turno.",
  },
  "groups.board.unassignedHint": {
    en: "Active roadies not yet in a group.",
    es: "Roadies activos que aún no están en un grupo.",
  },
  "groups.board.overCapacityBadge": {
    en: "Over capacity",
    es: "Sobre capacidad",
  },
  "groups.board.capacityOf": {
    en: "{count} / {capacity}",
    es: "{count} / {capacity}",
  },
  "groups.board.capacityOfOver": {
    en: "{count} / {capacity}",
    es: "{count} / {capacity}",
  },
  "groups.board.trainerPhotoAlt": {
    en: "Trainer photo",
    es: "Foto del entrenador",
  },
  "groups.board.unnamedTrainer": {
    en: "Unnamed trainer",
    es: "Entrenador sin nombre",
  },
  "groups.board.managerRole": {
    en: "Manager",
    es: "Gerente",
  },
  "groups.board.trainingManagerRole": {
    en: "Training Manager",
    es: "Gerente de capacitación",
  },
  "groups.board.trainerRole": {
    en: "NSO Trainer",
    es: "Entrenador NSO",
  },
  "groups.board.visitingManagerRole": {
    en: "Visiting Manager",
    es: "Gerente visitante",
  },
  "groups.board.leadershipRole": {
    en: "Leadership",
    es: "Liderazgo",
  },
  "groups.board.adminRole": {
    en: "Admin",
    es: "Administrador",
  },
  "groups.board.availableTrainers": {
    en: "Available trainers",
    es: "Entrenadores disponibles",
  },
  "groups.board.noAvailableTrainers": {
    en: "No trainers are available for this shift.",
    es: "No hay entrenadores disponibles para este turno.",
  },
  "groups.board.alreadyOnShift": {
    en: "Already on this shift",
    es: "Ya está en este turno",
  },
  "groups.board.accessCovers": {
    en: "Access covers this date",
    es: "El acceso cubre esta fecha",
  },
  "groups.board.accessEnds": {
    en: "Access ends {date}",
    es: "El acceso termina {date}",
  },
  "groups.board.accessNotYet": {
    en: "Access starts {date}",
    es: "El acceso comienza {date}",
  },
  "groups.board.accessExpired": {
    en: "Access ended {date}",
    es: "El acceso terminó {date}",
  },
  "groups.board.accessNoDate": {
    en: "No end date",
    es: "Sin fecha de fin",
  },
  "groups.board.warningsNone": {
    en: "No warnings for this shift.",
    es: "Sin advertencias para este turno.",
  },
  "groups.board.warningsTitle": {
    en: "Warnings",
    es: "Advertencias",
  },
  "groups.board.noticeAdded": {
    en: "Added: {names}",
    es: "Agregados: {names}",
  },
  "groups.board.noticeRemoved": {
    en: "Removed: {names}",
    es: "Quitados: {names}",
  },
  "groups.board.noticeBy": {
    en: "by {name}",
    es: "por {name}",
  },
  "groups.board.noticeDismiss": {
    en: "Dismiss",
    es: "Descartar",
  },
  "groups.board.noticeDismissError": {
    en: "We couldn't dismiss that notice.",
    es: "No pudimos descartar ese aviso.",
  },
  "groups.board.noticeTitle": {
    en: "Your group changed",
    es: "Tu grupo cambió",
  },
  "groups.board.noticeShift": {
    en: "{shift}",
    es: "{shift}",
  },
  "groups.board.noticeWhen": {
    en: "{when}",
    es: "{when}",
  },
  "groups.board.readOnly": {
    en: "You can view the boards but not edit them.",
    es: "Puedes ver los tableros pero no editarlos.",
  },
  "groups.board.shiftAm": { en: "AM", es: "AM" },
  "groups.board.shiftPm": { en: "PM", es: "PM" },
  "groups.board.dayChip": {
    en: "Training Day {day}",
    es: "Día de capacitación {day}",
  },
  "groups.board.friendsFamilyChip": {
    en: "Friends & Family",
    es: "Amigos y familia",
  },
  "groups.board.friendsFamilyPmOnly": {
    en: "Friends & Family nights run PM only.",
    es: "Las noches de Amigos y familia son solo PM.",
  },
  "groups.board.shiftPickerLabel": {
    en: "Shift",
    es: "Turno",
  },
  "groups.board.noShifts": {
    en: "No training shifts are scheduled yet.",
    es: "Aún no hay turnos de capacitación programados.",
  },
  "groups.board.roadieUnavailable": {
    en: "Marked unavailable",
    es: "Marcado como no disponible",
  },
  "groups.board.roadieUnavailableShort": {
    en: "Unavailable",
    es: "No disponible",
  },
  "groups.board.roadiePhotoAlt": {
    en: "Roadie photo",
    es: "Foto del roadie",
  },
  "groups.board.viewCard": {
    en: "View card",
    es: "Ver ficha",
  },
  "groups.board.roadieChip": {
    en: "{name}, {position}",
    es: "{name}, {position}",
  },
  "groups.board.roadieChipUnavailable": {
    en: "{name}, {position}, marked unavailable",
    es: "{name}, {position}, marcado como no disponible",
  },
  "groups.board.dragHandle": {
    en: "Drag {name}",
    es: "Arrastrar a {name}",
  },
  "groups.board.selectRoadie": {
    en: "Select {name}",
    es: "Seleccionar a {name}",
  },
  "groups.board.deselectRoadie": {
    en: "Deselect {name}",
    es: "Deseleccionar a {name}",
  },
  "groups.board.openCard": {
    en: "Open {name}'s card",
    es: "Abrir la ficha de {name}",
  },
  "groups.board.toolbarLabel": {
    en: "Board tools",
    es: "Herramientas del tablero",
  },
  "groups.board.copyTitle": {
    en: "Copy from another shift",
    es: "Copiar de otro turno",
  },
  "groups.board.copyBody": {
    en: "This replaces this shift's groups, capacities and Off list.",
    es: "Esto reemplaza los grupos, capacidades y la lista de Fuera de este turno.",
  },
  "groups.board.copyConfirm": {
    en: "Copy board",
    es: "Copiar tablero",
  },
  "groups.board.clearTitle": {
    en: "Clear this board",
    es: "Limpiar este tablero",
  },
  "groups.board.clearBody": {
    en: "This removes every group and the Off list for this shift.",
    es: "Esto elimina todos los grupos y la lista de Fuera de este turno.",
  },
  "groups.board.clearConfirm": {
    en: "Clear board",
    es: "Limpiar tablero",
  },
  "groups.board.autoFill": {
    en: "Make groups for me",
    es: "Crear grupos por mí",
  },
  "groups.board.copyFrom": {
    en: "Copy from…",
    es: "Copiar de…",
  },
  "groups.board.clear": {
    en: "Clear board",
    es: "Limpiar tablero",
  },
  "groups.board.cancel": {
    en: "Cancel",
    es: "Cancelar",
  },
  "groups.board.confirm": {
    en: "Confirm",
    es: "Confirmar",
  },
  "groups.board.close": {
    en: "Close",
    es: "Cerrar",
  },
  "groups.board.loading": {
    en: "Loading groups…",
    es: "Cargando grupos…",
  },
  "groups.board.error": {
    en: "We couldn't load the groups.",
    es: "No pudimos cargar los grupos.",
  },
  "groups.board.empty": {
    en: "No shift boards have been set up yet.",
    es: "Aún no se han configurado tableros de turno.",
  },
  "groups.board.title": { en: "Groups", es: "Grupos" },
  "groups.board.subtitle": {
    en: "Training shift boards",
    es: "Tableros de turnos de capacitación",
  },
};

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  let value = template;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

/**
 * Translate a groups key, preferring the shared dictionary and falling back to
 * the groups-local copy for keys the foundation has not defined.
 */
export function useGroupsCopy() {
  const { locale, t } = useI18n();
  return {
    t: (key: string, vars?: Record<string, string | number>) => {
      const entry = groupsCopy[key];
      if (entry) {
        return interpolate(locale === "es" ? entry.es : entry.en, vars);
      }
      return t(key, vars);
    },
  };
}
