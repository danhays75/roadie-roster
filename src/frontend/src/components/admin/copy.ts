import type { EventKind } from "@/backend";

/**
 * Admin-surface copy. The shared dictionary in `lib/copy.ts` is foundation-owned,
 * so the admin panels keep their own strings here and read the active locale
 * from `useI18n()`.
 */
export interface AdminCopy {
  storeTitle: string;
  storeDescription: string;
  storeLoading: string;
  storeError: string;
  storeSave: string;
  storeSaved: string;
  storeSaveError: string;
  storeLogoAlt: string;
  storeLogoUpload: string;
  storeLogoRemove: string;
  storeSecondaryLogoAlt: string;
  storeSecondaryLogoUpload: string;
  storeSecondaryLogoRemove: string;
  storeAppName: string;
  storeStoreNumber: string;
  storeLocationName: string;
  storeAddress: string;
  storePhone: string;
  storeOpeningDate: string;
  storeTimeZone: string;
  storeShifts: string;
  storeAmStart: string;
  storeAmEnd: string;
  storePmStart: string;
  storePmEnd: string;
  storeShiftsSummary: string;
  storeLeaderTalkName: string;
  storeTrainingGroupSize: string;
  storeLeaderTalkSize: string;

  positionsTitle: string;
  positionsDescription: string;
  positionsAdd: string;
  positionsLoading: string;
  positionsError: string;
  positionsEmpty: string;
  positionsFoh: string;
  positionsBoh: string;
  positionsAlcohol: string;
  positionsBuildTo: string;
  positionsAddTitle: string;
  positionsEditTitle: string;
  positionsFormDescription: string;
  positionsName: string;
  positionsCode: string;
  positionsHouse: string;
  positionsMinimumAge: string;
  positionsOpeningBuildTo: string;
  positionsAfterOpeningBuildTo: string;
  positionsShirtsRequired: string;
  positionsHatsRequired: string;
  positionsDefaultShirts: string;
  positionsDefaultHats: string;
  positionsShirtType: string;
  positionsShirtTypePlaceholder: string;
  positionsShirtQty: string;
  positionsHatType: string;
  positionsHatTypePlaceholder: string;
  positionsHatQty: string;
  positionsUniformSummary: string;
  positionsCrewManager: string;
  positionsNeedsAlcoholCert: string;
  positionsSaveError: string;
  positionsDeleteTitle: string;
  positionsDeleteBody: string;
  positionsDeleteBlocked: string;

  scheduleTitle: string;
  scheduleDescription: string;
  scheduleAdd: string;
  scheduleLoading: string;
  scheduleError: string;
  scheduleEmpty: string;
  scheduleTrainingDayLabel: string;
  scheduleAddTitle: string;
  scheduleEditTitle: string;
  scheduleFormDescription: string;
  scheduleName: string;
  scheduleKind: string;
  scheduleStart: string;
  scheduleEnd: string;
  scheduleSaveError: string;
  scheduleDeleteTitle: string;
  scheduleDeleteBody: string;
  scheduleDeleteBlocked: string;
  scheduleMoveEveryone: string;
  scheduleMoveEveryoneTitle: string;
  scheduleMoveEveryoneBody: string;
  scheduleMoveEveryoneTarget: string;
  scheduleMoveEveryoneTargetPlaceholder: string;
  scheduleMoveEveryoneConfirm: string;
  scheduleMoveEveryoneDone: string;
  scheduleMoveEveryoneDeleteHint: string;
  scheduleMoveEveryoneNoTargets: string;
  scheduleMoveEveryoneError: string;
  scheduleMoveEveryoneClose: string;
  scheduleKinds: Record<EventKind, string>;

  checklistsTitle: string;
  checklistsDescription: string;
  checklistsLoading: string;
  checklistsError: string;
  checklistsEmpty: string;
  checklistsAddItem: string;
  checklistsRemoveItem: string;
  checklistsItemText: string;
  checklistsRequiresAlcoholCert: string;
  checklistsMinorOnly: string;
  checklistsToggleHint: string;
  checklistsEnabled: string;
  checklistsEnabledHint: string;
  checklistsMoveUp: string;
  checklistsMoveDown: string;
  checklistsItemType: string;
  checklistsItemTypeCheckbox: string;
  checklistsItemTypeCount: string;
  checklistsOrientationUniform: string;
  checklistsOrientationUniformHint: string;
  checklistsPaperwork: string;
  checklistsPaperworkHint: string;
  checklistsSave: string;
  checklistsSaved: string;
  checklistsSaveError: string;

  retentionTitle: string;
  retentionDescription: string;
  retentionLoading: string;
  retentionError: string;
  retentionArchivedContactSet: string;
  retentionNotes: string;
  retentionArchivedPhoto: string;
  retentionChangeLog: string;
  retentionSave: string;
  retentionSaveError: string;

  templateTitle: string;
  templateDescription: string;
  templateIncludesSchedule: string;
  templateIncludesPositions: string;
  templateIncludesChecklists: string;
  templateIncludesLeaderTalk: string;
  templateIncludesNoPeople: string;
  templateName: string;
  templateNamePlaceholder: string;
  templateSave: string;
  templateSaved: string;
  templateSaveError: string;

  accessDescription: string;

  uniformsTitle: string;
  uniformsDescription: string;
  uniformsLoading: string;
  uniformsError: string;
  uniformsEmpty: string;
  uniformsSizeCurve: string;
  uniformsSizeCurveHint: string;
  uniformsShirts: string;
  uniformsHats: string;
  uniformsSize: string;
  uniformsPercent: string;
  uniformsBuffer: string;
  uniformsBufferHint: string;
  uniformsSave: string;
  uniformsSaved: string;
  uniformsSaveError: string;
  uniformsOrderTitle: string;
  uniformsOrderDescription: string;
  uniformsFilterAll: string;
  uniformsFilterFoh: string;
  uniformsFilterBoh: string;
  uniformsColumnItem: string;
  uniformsColumnSize: string;
  uniformsColumnHired: string;
  uniformsColumnProjected: string;
  uniformsColumnOrderTotal: string;
  uniformsColumnTotal: string;
  uniformsSizeUnknownTitle: string;
  uniformsSizeUnknownHint: string;
  uniformsSizeUnknownMissingShirt: string;
  uniformsSizeUnknownMissingHat: string;
  uniformsSizeUnknownMissingBoth: string;
  uniformsSizeUnknownEmpty: string;
  uniformsDownload: string;
  uniformsPrint: string;
  uniformsPrintTitle: string;
  uniformsBufferSummary: string;
  uniformsCurveTotal: string;
  uniformsCurveTotalWarning: string;

  kioskPinTitle: string;
  kioskPinDescription: string;
  kioskPinLoading: string;
  kioskPinSet: string;
  kioskPinNotSet: string;
  kioskPinLabel: string;
  kioskPinPlaceholder: string;
  kioskPinConfirmLabel: string;
  kioskPinConfirmPlaceholder: string;
  kioskPinSave: string;
  kioskPinSaved: string;
  kioskPinError: string;
  kioskPinRequired: string;
  kioskPinMismatch: string;
  kioskPinHint: string;

  actionEdit: string;
  actionDelete: string;
  actionCancel: string;
  actionSave: string;
  optional: string;
}

const en: AdminCopy = {
  storeTitle: "Store info",
  storeDescription:
    "The store identity, opening date, shift times and leader talk format.",
  storeLoading: "Loading store settings…",
  storeError: "We couldn't load store settings.",
  storeSave: "Save settings",
  storeSaved: "Store settings saved.",
  storeSaveError: "We couldn't save the store settings.",
  storeLogoAlt: "Store logo",
  storeLogoUpload: "Upload logo",
  storeLogoRemove: "Remove logo",
  storeSecondaryLogoAlt: "Secondary logo",
  storeSecondaryLogoUpload: "Upload secondary logo",
  storeSecondaryLogoRemove: "Remove secondary logo",
  storeAppName: "App name",
  storeStoreNumber: "Store number",
  storeLocationName: "Location",
  storeAddress: "Address",
  storePhone: "Store phone",
  storeOpeningDate: "Opening date",
  storeTimeZone: "Time zone",
  storeShifts: "Shift times",
  storeAmStart: "AM start",
  storeAmEnd: "AM end",
  storePmStart: "PM start",
  storePmEnd: "PM end",
  storeShiftsSummary: "AM {am} · PM {pm}",
  storeLeaderTalkName: "Leader talk name",
  storeTrainingGroupSize: "Training group size",
  storeLeaderTalkSize: "Leader talk size",

  positionsTitle: "Positions",
  positionsDescription:
    "Every role on the floor, with its build-to targets and requirements.",
  positionsAdd: "Add position",
  positionsLoading: "Loading positions…",
  positionsError: "We couldn't load positions.",
  positionsEmpty: "No positions configured yet.",
  positionsFoh: "Front of house",
  positionsBoh: "Back of house",
  positionsAlcohol: "Alcohol cert",
  positionsBuildTo: "Build-to {opening} opening · {after} after · age {age}+",
  positionsAddTitle: "Add position",
  positionsEditTitle: "Edit position",
  positionsFormDescription:
    "Set the position details, build-to targets and requirements.",
  positionsName: "Name",
  positionsCode: "Card code",
  positionsHouse: "House",
  positionsMinimumAge: "Minimum age",
  positionsOpeningBuildTo: "Opening build-to",
  positionsAfterOpeningBuildTo: "After-opening build-to",
  positionsShirtsRequired: "Shirts required",
  positionsHatsRequired: "Hats required",
  positionsDefaultShirts: "Default shirts",
  positionsDefaultHats: "Default hats",
  positionsShirtType: "Shirt type",
  positionsShirtTypePlaceholder: "Polo",
  positionsShirtQty: "Shirts per roadie",
  positionsHatType: "Hat type",
  positionsHatTypePlaceholder: "Cap",
  positionsHatQty: "Hats per roadie",
  positionsUniformSummary:
    "Uniform: {shirtQty}× {shirtType} · {hatQty}× {hatType}",
  positionsCrewManager: "Crew manager",
  positionsNeedsAlcoholCert: "Needs alcohol certification",
  positionsSaveError: "We couldn't save that position.",
  positionsDeleteTitle: "Delete position",
  positionsDeleteBody: "Delete {name}? This cannot be undone.",
  positionsDeleteBlocked:
    "This position has active roadies and cannot be deleted.",

  scheduleTitle: "Opening schedule",
  scheduleDescription:
    "Deadlines, orientation, training days and opening events.",
  scheduleAdd: "Add event",
  scheduleLoading: "Loading schedule…",
  scheduleError: "We couldn't load the schedule.",
  scheduleEmpty: "No events scheduled yet.",
  scheduleTrainingDayLabel: "Training day {number}",
  scheduleAddTitle: "Add event",
  scheduleEditTitle: "Edit event",
  scheduleFormDescription: "Give the event a name, type and date and time.",
  scheduleName: "Name",
  scheduleKind: "Type",
  scheduleStart: "Starts",
  scheduleEnd: "Ends",
  scheduleSaveError: "We couldn't save that event.",
  scheduleDeleteTitle: "Delete event",
  scheduleDeleteBody: "Delete {name}? This cannot be undone.",
  scheduleDeleteBlocked: "This event has records and cannot be deleted.",
  scheduleMoveEveryone: "Move everyone",
  scheduleMoveEveryoneTitle: "Move everyone to another session",
  scheduleMoveEveryoneBody:
    "Move every roadie from {name} to another orientation session. The source session can then be deleted.",
  scheduleMoveEveryoneTarget: "Target session",
  scheduleMoveEveryoneTargetPlaceholder: "Choose a session",
  scheduleMoveEveryoneConfirm: "Move everyone",
  scheduleMoveEveryoneDone: "Moved {count} roadies.",
  scheduleMoveEveryoneDeleteHint:
    "The source session is now empty and can be deleted.",
  scheduleMoveEveryoneNoTargets:
    "There is no other orientation session to move to.",
  scheduleMoveEveryoneError: "We couldn't move the roadies.",
  scheduleMoveEveryoneClose: "Close",
  scheduleKinds: {
    deadline: "Deadline",
    orientation: "Orientation session",
    trainingDay: "Training day",
    friendsAndFamily: "Friends & family",
    openingDay: "Opening day",
    signOff: "Sign-off",
    other: "Other",
  },

  checklistsTitle: "Checklists",
  checklistsDescription:
    "The uniform and paperwork items roadies complete at orientation.",
  checklistsLoading: "Loading checklists…",
  checklistsError: "We couldn't load the checklists.",
  checklistsEmpty: "No items yet. Add the first one.",
  checklistsAddItem: "Add item",
  checklistsRemoveItem: "Remove item",
  checklistsItemText: "Item text",
  checklistsRequiresAlcoholCert: "Only alcohol positions",
  checklistsMinorOnly: "Only under 18",
  checklistsToggleHint: "Leave both off if the item applies to everyone.",
  checklistsEnabled: "On/Off",
  checklistsEnabledHint:
    "Turn an item off to hide it everywhere. The list order is the order roadies complete the steps.",
  checklistsMoveUp: "Move up",
  checklistsMoveDown: "Move down",
  checklistsItemType: "Type",
  checklistsItemTypeCheckbox: "Checkbox",
  checklistsItemTypeCount: "Count",
  checklistsOrientationUniform: "Orientation uniform",
  checklistsOrientationUniformHint: "What every roadie brings to orientation.",
  checklistsPaperwork: "Paperwork",
  checklistsPaperworkHint: "Documents collected before a roadie can start.",
  checklistsSave: "Save checklists",
  checklistsSaved: "Checklists saved.",
  checklistsSaveError: "We couldn't save the checklists.",

  retentionTitle: "Retention",
  retentionDescription: "How long archived records are kept before deletion.",
  retentionLoading: "Loading retention settings…",
  retentionError: "We couldn't load retention settings.",
  retentionArchivedContactSet: "Archived contact set (days)",
  retentionNotes: "Notes (days)",
  retentionArchivedPhoto: "Archived photo (days)",
  retentionChangeLog: "Change log (days)",
  retentionSave: "Save retention",
  retentionSaveError: "We couldn't save retention settings.",

  templateTitle: "Store template",
  templateDescription:
    "Save this store's setup to reuse when opening another location.",
  templateIncludesSchedule: "The opening schedule as days relative to opening",
  templateIncludesPositions: "Positions with their settings",
  templateIncludesChecklists: "Checklists and leader talk format",
  templateIncludesLeaderTalk: "Leader talk name and sizes",
  templateIncludesNoPeople: "No people data is included",
  templateName: "Template name",
  templateNamePlaceholder: "e.g. Lake Charles flagship",
  templateSave: "Save as store template",
  templateSaved: "Store template saved.",
  templateSaveError: "We couldn't save the store template.",

  accessDescription: "Who can sign in, and with which role.",

  uniformsTitle: "Uniforms",
  uniformsDescription:
    "The size curve and buffer that turn the roster into a uniform order.",
  uniformsLoading: "Loading uniform settings…",
  uniformsError: "We couldn't load the uniform settings.",
  uniformsEmpty: "No uniform order yet.",
  uniformsSizeCurve: "Size curve",
  uniformsSizeCurveHint:
    "The share of each size across the crew. Percentages should add up to 100.",
  uniformsShirts: "Shirts",
  uniformsHats: "Hats",
  uniformsSize: "Size",
  uniformsPercent: "Percent",
  uniformsBuffer: "Buffer",
  uniformsBufferHint:
    "Extra stock added on top of the projected order, as a percentage.",
  uniformsSave: "Save settings",
  uniformsSaved: "Uniform settings saved.",
  uniformsSaveError: "We couldn't save the uniform settings.",
  uniformsOrderTitle: "Uniform order",
  uniformsOrderDescription:
    "Hired and projected counts per size, with the buffered order total.",
  uniformsFilterAll: "All",
  uniformsFilterFoh: "FOH",
  uniformsFilterBoh: "BOH",
  uniformsColumnItem: "Item",
  uniformsColumnSize: "Size",
  uniformsColumnHired: "Hired",
  uniformsColumnProjected: "Projected",
  uniformsColumnOrderTotal: "Order total",
  uniformsColumnTotal: "Total",
  uniformsSizeUnknownTitle: "Size unknown",
  uniformsSizeUnknownHint:
    "Roadies missing a shirt or hat size. Set their size so the order is complete.",
  uniformsSizeUnknownMissingShirt: "Missing shirt size",
  uniformsSizeUnknownMissingHat: "Missing hat size",
  uniformsSizeUnknownMissingBoth: "Missing shirt and hat size",
  uniformsSizeUnknownEmpty: "Every roadie has a shirt and hat size.",
  uniformsDownload: "Download (Excel)",
  uniformsPrint: "Print",
  uniformsPrintTitle: "Uniform order",
  uniformsBufferSummary: "Buffer {percent}%",
  uniformsCurveTotal: "Total {percent}%",
  uniformsCurveTotalWarning: "The size curve should add up to 100%.",

  kioskPinTitle: "Kiosk staff PIN",
  kioskPinDescription:
    "The PIN staff enter to sign out of the kiosk on a shared device.",
  kioskPinLoading: "Checking the staff PIN…",
  kioskPinSet: "A staff PIN is set.",
  kioskPinNotSet: "No staff PIN is set yet. The kiosk cannot be signed out.",
  kioskPinLabel: "New staff PIN",
  kioskPinPlaceholder: "Enter a PIN",
  kioskPinConfirmLabel: "Confirm staff PIN",
  kioskPinConfirmPlaceholder: "Re-enter the PIN",
  kioskPinSave: "Save PIN",
  kioskPinSaved: "Staff PIN saved.",
  kioskPinError: "We couldn't save the staff PIN.",
  kioskPinRequired: "Enter a PIN.",
  kioskPinMismatch: "The PINs do not match.",
  kioskPinHint:
    "Only a one-way hash is stored. The PIN is never shown again after saving.",

  actionEdit: "Edit",
  actionDelete: "Delete",
  actionCancel: "Cancel",
  actionSave: "Save",
  optional: "Optional",
};

const es: AdminCopy = {
  storeTitle: "Información de la tienda",
  storeDescription:
    "La identidad de la tienda, fecha de apertura, turnos y formato de charla.",
  storeLoading: "Cargando ajustes…",
  storeError: "No pudimos cargar los ajustes de la tienda.",
  storeSave: "Guardar ajustes",
  storeSaved: "Ajustes de la tienda guardados.",
  storeSaveError: "No pudimos guardar los ajustes de la tienda.",
  storeLogoAlt: "Logotipo de la tienda",
  storeLogoUpload: "Subir logotipo",
  storeLogoRemove: "Quitar logotipo",
  storeSecondaryLogoAlt: "Logotipo secundario",
  storeSecondaryLogoUpload: "Subir logotipo secundario",
  storeSecondaryLogoRemove: "Quitar logotipo secundario",
  storeAppName: "Nombre de la app",
  storeStoreNumber: "Número de tienda",
  storeLocationName: "Ubicación",
  storeAddress: "Dirección",
  storePhone: "Teléfono de la tienda",
  storeOpeningDate: "Fecha de apertura",
  storeTimeZone: "Zona horaria",
  storeShifts: "Horarios de turno",
  storeAmStart: "Inicio AM",
  storeAmEnd: "Fin AM",
  storePmStart: "Inicio PM",
  storePmEnd: "Fin PM",
  storeShiftsSummary: "AM {am} · PM {pm}",
  storeLeaderTalkName: "Nombre de la charla",
  storeTrainingGroupSize: "Tamaño del grupo de entrenamiento",
  storeLeaderTalkSize: "Tamaño de la charla",

  positionsTitle: "Puestos",
  positionsDescription:
    "Cada rol en el piso, con sus metas de dotación y requisitos.",
  positionsAdd: "Añadir puesto",
  positionsLoading: "Cargando puestos…",
  positionsError: "No pudimos cargar los puestos.",
  positionsEmpty: "Aún no hay puestos configurados.",
  positionsFoh: "Sala",
  positionsBoh: "Cocina",
  positionsAlcohol: "Cert. alcohol",
  positionsBuildTo: "Meta {opening} apertura · {after} después · edad {age}+",
  positionsAddTitle: "Añadir puesto",
  positionsEditTitle: "Editar puesto",
  positionsFormDescription:
    "Define los detalles del puesto, metas de dotación y requisitos.",
  positionsName: "Nombre",
  positionsCode: "Código de tarjeta",
  positionsHouse: "Área",
  positionsMinimumAge: "Edad mínima",
  positionsOpeningBuildTo: "Meta de apertura",
  positionsAfterOpeningBuildTo: "Meta después de apertura",
  positionsShirtsRequired: "Camisetas requeridas",
  positionsHatsRequired: "Gorras requeridas",
  positionsDefaultShirts: "Camisetas por defecto",
  positionsDefaultHats: "Gorras por defecto",
  positionsShirtType: "Tipo de camiseta",
  positionsShirtTypePlaceholder: "Polo",
  positionsShirtQty: "Camisetas por roadie",
  positionsHatType: "Tipo de gorra",
  positionsHatTypePlaceholder: "Gorra",
  positionsHatQty: "Gorras por roadie",
  positionsUniformSummary:
    "Uniforme: {shirtQty}× {shirtType} · {hatQty}× {hatType}",
  positionsCrewManager: "Gerente de equipo",
  positionsNeedsAlcoholCert: "Requiere certificación de alcohol",
  positionsSaveError: "No pudimos guardar ese puesto.",
  positionsDeleteTitle: "Eliminar puesto",
  positionsDeleteBody: "¿Eliminar {name}? No se puede deshacer.",
  positionsDeleteBlocked:
    "Este puesto tiene roadies activos y no se puede eliminar.",

  scheduleTitle: "Calendario de apertura",
  scheduleDescription:
    "Fechas límite, orientación, días de entrenamiento y eventos de apertura.",
  scheduleAdd: "Añadir evento",
  scheduleLoading: "Cargando calendario…",
  scheduleError: "No pudimos cargar el calendario.",
  scheduleEmpty: "Aún no hay eventos programados.",
  scheduleTrainingDayLabel: "Día de entrenamiento {number}",
  scheduleAddTitle: "Añadir evento",
  scheduleEditTitle: "Editar evento",
  scheduleFormDescription: "Dale al evento un nombre, tipo y fecha y hora.",
  scheduleName: "Nombre",
  scheduleKind: "Tipo",
  scheduleStart: "Comienza",
  scheduleEnd: "Termina",
  scheduleSaveError: "No pudimos guardar ese evento.",
  scheduleDeleteTitle: "Eliminar evento",
  scheduleDeleteBody: "¿Eliminar {name}? No se puede deshacer.",
  scheduleDeleteBlocked: "Este evento tiene registros y no se puede eliminar.",
  scheduleMoveEveryone: "Mover a todos",
  scheduleMoveEveryoneTitle: "Mover a todos a otra sesión",
  scheduleMoveEveryoneBody:
    "Mueve a todos los roadies de {name} a otra sesión de orientación. La sesión de origen se puede eliminar después.",
  scheduleMoveEveryoneTarget: "Sesión de destino",
  scheduleMoveEveryoneTargetPlaceholder: "Elige una sesión",
  scheduleMoveEveryoneConfirm: "Mover a todos",
  scheduleMoveEveryoneDone: "Se movieron {count} roadies.",
  scheduleMoveEveryoneDeleteHint:
    "La sesión de origen ahora está vacía y se puede eliminar.",
  scheduleMoveEveryoneNoTargets:
    "No hay otra sesión de orientación a la que mover.",
  scheduleMoveEveryoneError: "No pudimos mover a los roadies.",
  scheduleMoveEveryoneClose: "Cerrar",
  scheduleKinds: {
    deadline: "Fecha límite",
    orientation: "Sesión de orientación",
    trainingDay: "Día de entrenamiento",
    friendsAndFamily: "Amigos y familia",
    openingDay: "Día de apertura",
    signOff: "Firma final",
    other: "Otro",
  },

  checklistsTitle: "Listas de verificación",
  checklistsDescription:
    "Los artículos de uniforme y papeleo que los roadies completan en orientación.",
  checklistsLoading: "Cargando listas…",
  checklistsError: "No pudimos cargar las listas.",
  checklistsEmpty: "Aún no hay artículos. Añade el primero.",
  checklistsAddItem: "Añadir artículo",
  checklistsRemoveItem: "Quitar artículo",
  checklistsItemText: "Texto del artículo",
  checklistsRequiresAlcoholCert: "Solo puestos con alcohol",
  checklistsMinorOnly: "Solo menores de 18",
  checklistsToggleHint:
    "Deja ambos desactivados si el artículo aplica a todos.",
  checklistsEnabled: "Activado/Desactivado",
  checklistsEnabledHint:
    "Desactiva un artículo para ocultarlo en todas partes. El orden de la lista es el orden en que los roadies completan los pasos.",
  checklistsMoveUp: "Subir",
  checklistsMoveDown: "Bajar",
  checklistsItemType: "Tipo",
  checklistsItemTypeCheckbox: "Casilla",
  checklistsItemTypeCount: "Cantidad",
  checklistsOrientationUniform: "Uniforme de orientación",
  checklistsOrientationUniformHint: "Lo que cada roadie trae a la orientación.",
  checklistsPaperwork: "Papeleo",
  checklistsPaperworkHint:
    "Documentos recogidos antes de que un roadie pueda empezar.",
  checklistsSave: "Guardar listas",
  checklistsSaved: "Listas guardadas.",
  checklistsSaveError: "No pudimos guardar las listas.",

  retentionTitle: "Retención",
  retentionDescription:
    "Cuánto tiempo se conservan los registros archivados antes de borrarse.",
  retentionLoading: "Cargando ajustes de retención…",
  retentionError: "No pudimos cargar los ajustes de retención.",
  retentionArchivedContactSet: "Contacto archivado (días)",
  retentionNotes: "Notas (días)",
  retentionArchivedPhoto: "Foto archivada (días)",
  retentionChangeLog: "Registro de cambios (días)",
  retentionSave: "Guardar retención",
  retentionSaveError: "No pudimos guardar los ajustes de retención.",

  templateTitle: "Plantilla de tienda",
  templateDescription:
    "Guarda la configuración de esta tienda para reutilizarla en otra ubicación.",
  templateIncludesSchedule:
    "El calendario de apertura como días relativos a la apertura",
  templateIncludesPositions: "Puestos con sus ajustes",
  templateIncludesChecklists: "Listas y formato de charla",
  templateIncludesLeaderTalk: "Nombre y tamaños de la charla",
  templateIncludesNoPeople: "No se incluyen datos de personas",
  templateName: "Nombre de la plantilla",
  templateNamePlaceholder: "p. ej. Lake Charles flagship",
  templateSave: "Guardar como plantilla",
  templateSaved: "Plantilla de tienda guardada.",
  templateSaveError: "No pudimos guardar la plantilla de tienda.",

  accessDescription: "Quién puede iniciar sesión y con qué rol.",

  uniformsTitle: "Uniformes",
  uniformsDescription:
    "La curva de tallas y el margen que convierten la plantilla en un pedido de uniformes.",
  uniformsLoading: "Cargando ajustes de uniformes…",
  uniformsError: "No pudimos cargar los ajustes de uniformes.",
  uniformsEmpty: "Aún no hay pedido de uniformes.",
  uniformsSizeCurve: "Curva de tallas",
  uniformsSizeCurveHint:
    "La proporción de cada talla en el equipo. Los porcentajes deben sumar 100.",
  uniformsShirts: "Camisetas",
  uniformsHats: "Gorras",
  uniformsSize: "Talla",
  uniformsPercent: "Porcentaje",
  uniformsBuffer: "Margen",
  uniformsBufferHint:
    "Stock extra añadido al pedido proyectado, como porcentaje.",
  uniformsSave: "Guardar ajustes",
  uniformsSaved: "Ajustes de uniformes guardados.",
  uniformsSaveError: "No pudimos guardar los ajustes de uniformes.",
  uniformsOrderTitle: "Pedido de uniformes",
  uniformsOrderDescription:
    "Conteos contratados y proyectados por talla, con el total del pedido con margen.",
  uniformsFilterAll: "Todos",
  uniformsFilterFoh: "Sala",
  uniformsFilterBoh: "Cocina",
  uniformsColumnItem: "Artículo",
  uniformsColumnSize: "Talla",
  uniformsColumnHired: "Contratados",
  uniformsColumnProjected: "Proyectados",
  uniformsColumnOrderTotal: "Total del pedido",
  uniformsColumnTotal: "Total",
  uniformsSizeUnknownTitle: "Talla desconocida",
  uniformsSizeUnknownHint:
    "Roadies sin talla de camiseta o gorra. Define su talla para completar el pedido.",
  uniformsSizeUnknownMissingShirt: "Falta talla de camiseta",
  uniformsSizeUnknownMissingHat: "Falta talla de gorra",
  uniformsSizeUnknownMissingBoth: "Falta talla de camiseta y gorra",
  uniformsSizeUnknownEmpty:
    "Todos los roadies tienen talla de camiseta y gorra.",
  uniformsDownload: "Descargar (Excel)",
  uniformsPrint: "Imprimir",
  uniformsPrintTitle: "Pedido de uniformes",
  uniformsBufferSummary: "Margen {percent}%",
  uniformsCurveTotal: "Total {percent}%",
  uniformsCurveTotalWarning: "La curva de tallas debe sumar 100%.",

  kioskPinTitle: "PIN del personal del quiosco",
  kioskPinDescription:
    "El PIN que el personal ingresa para cerrar la sesión del quiosco en un dispositivo compartido.",
  kioskPinLoading: "Comprobando el PIN del personal…",
  kioskPinSet: "Hay un PIN del personal configurado.",
  kioskPinNotSet:
    "Aún no hay un PIN del personal. No se puede cerrar la sesión del quiosco.",
  kioskPinLabel: "Nuevo PIN del personal",
  kioskPinPlaceholder: "Ingresa un PIN",
  kioskPinConfirmLabel: "Confirmar PIN del personal",
  kioskPinConfirmPlaceholder: "Vuelve a ingresar el PIN",
  kioskPinSave: "Guardar PIN",
  kioskPinSaved: "PIN del personal guardado.",
  kioskPinError: "No pudimos guardar el PIN del personal.",
  kioskPinRequired: "Ingresa un PIN.",
  kioskPinMismatch: "Los PIN no coinciden.",
  kioskPinHint:
    "Solo se guarda un hash de una vía. El PIN nunca se vuelve a mostrar tras guardarlo.",

  actionEdit: "Editar",
  actionDelete: "Eliminar",
  actionCancel: "Cancelar",
  actionSave: "Guardar",
  optional: "Opcional",
};

export const adminCopy = { en, es } as const;

/** Interpolate `{name}` placeholders in an admin copy string. */
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
