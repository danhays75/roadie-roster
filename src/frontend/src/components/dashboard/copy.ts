import { useI18n } from "@/hooks/useI18n";

/**
 * Dashboard-local copy for keys the shared dictionary does not yet provide.
 * Kept beside the dashboard components so the shared dictionary stays owned by
 * the foundation. Falls back to English for any locale without a translation.
 */
const dashboardCopy: Record<string, { en: string; es: string }> = {
  "dashboard.position.onHandOf": {
    en: "{onHand} on hand · build to {target}",
    es: "{onHand} en plantilla · meta {target}",
  },
  "dashboard.position.needed": {
    en: "{count} needed",
    es: "Faltan {count}",
  },
  "dashboard.position.over": {
    en: "{count} over",
    es: "{count} de más",
  },
  "dashboard.position.filled": {
    en: "Filled",
    es: "Completo",
  },
  "dashboard.position.progressLabel": {
    en: "{name}: {onHand} of {target} hired",
    es: "{name}: {onHand} de {target} contratados",
  },
  "dashboard.panel.empty": {
    en: "No positions in this house yet.",
    es: "Aún no hay puestos en esta área.",
  },
  "dashboard.countdown.label": {
    en: "Countdown to opening",
    es: "Cuenta atrás para la apertura",
  },
  "dashboard.countdown.noDate": {
    en: "Opening date not set",
    es: "Fecha de apertura sin definir",
  },
  "dashboard.countdown.days": { en: "Days", es: "Días" },
  "dashboard.countdown.hours": { en: "Hours", es: "Horas" },
  "dashboard.countdown.minutes": { en: "Min", es: "Min" },
  "dashboard.timeline.now": { en: "Now", es: "Ahora" },
  "dashboard.timeline.empty": {
    en: "No schedule events have been added yet.",
    es: "Aún no se han añadido eventos al calendario.",
  },
  "dashboard.kpi.hired.hint": { en: "On hand now", es: "En plantilla ahora" },
  "dashboard.kpi.buildTo.hint": {
    en: "Opening target",
    es: "Meta de apertura",
  },
  "dashboard.kpi.stillNeeded.hint": {
    en: "To reach build-to",
    es: "Para llegar a la meta",
  },
  "dashboard.kpi.orientation.hint": {
    en: "Awaiting phase",
    es: "Fase pendiente",
  },
  "dashboard.kpi.certified.hint": {
    en: "Awaiting phase",
    es: "Fase pendiente",
  },
  "dashboard.adjust.mode": { en: "Adjust build to", es: "Ajustar meta" },
  "dashboard.adjust.done": { en: "Done adjusting", es: "Terminar ajuste" },
  "dashboard.adjust.hint": {
    en: "Each tap saves a +1 or −1 change to the build-to target and is logged.",
    es: "Cada toque guarda un cambio de +1 o −1 en la meta y queda registrado.",
  },
  "dashboard.adjust.opening": {
    en: "Opening build to",
    es: "Meta de apertura",
  },
  "dashboard.adjust.afterOpening": {
    en: "After-opening build to",
    es: "Meta posterior a la apertura",
  },
  "dashboard.adjust.increase": {
    en: "Increase {label}",
    es: "Aumentar {label}",
  },
  "dashboard.adjust.decrease": {
    en: "Decrease {label}",
    es: "Reducir {label}",
  },
  "dashboard.adjust.saving": { en: "Saving…", es: "Guardando…" },
  "dashboard.adjust.error": {
    en: "We couldn't save that change.",
    es: "No pudimos guardar ese cambio.",
  },
  "dashboard.roster.title": {
    en: "Position roster",
    es: "Plantilla del puesto",
  },
  "dashboard.roster.summary": {
    en: "{onHand} on hand · build to {target}",
    es: "{onHand} en plantilla · meta {target}",
  },
  "dashboard.roster.loading": {
    en: "Loading roster…",
    es: "Cargando plantilla…",
  },
  "dashboard.roster.error": {
    en: "We couldn't load this roster.",
    es: "No pudimos cargar esta plantilla.",
  },
  "dashboard.roster.empty": {
    en: "No roadies or open spots for this position.",
    es: "No hay roadies ni vacantes para este puesto.",
  },
  "dashboard.roster.openSpot": { en: "Open spot", es: "Vacante" },
  "dashboard.roster.archivedTitle": {
    en: "No longer a roadie",
    es: "Ya no es roadie",
  },
  "dashboard.roster.rehire": { en: "Rehire", es: "Recontratar" },
  "dashboard.roster.rehireError": {
    en: "We couldn't rehire that roadie.",
    es: "No pudimos recontratar a ese roadie.",
  },
  "dashboard.roster.showFormer": {
    en: "Show former ({count})",
    es: "Ver anteriores ({count})",
  },
  "dashboard.roster.hideFormer": {
    en: "Hide former ({count})",
    es: "Ocultar anteriores ({count})",
  },
  "dashboard.roster.formerTitle": {
    en: "No longer a roadie",
    es: "Ya no es roadie",
  },
  "roadie.card.modal.counter": {
    en: "{index} of {total}",
    es: "{index} de {total}",
  },
  "roadie.card.modal.prev": { en: "Previous", es: "Anterior" },
  "roadie.card.modal.next": { en: "Next", es: "Siguiente" },
  "roadie.card.modal.fullProfile": {
    en: "Open full profile",
    es: "Abrir perfil completo",
  },
  "roadie.card.modal.description": {
    en: "Roadie card. Swipe or use the arrow keys to move between cards.",
    es: "Ficha del roadie. Desliza o usa las flechas para moverte entre fichas.",
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
 * Translate a dashboard key, preferring the shared dictionary and falling back
 * to the dashboard-local copy for keys the foundation has not defined.
 */
export function useDashboardCopy() {
  const { locale, t } = useI18n();
  return {
    t: (key: string, vars?: Record<string, string | number>) => {
      const entry = dashboardCopy[key];
      if (entry) {
        return interpolate(locale === "es" ? entry.es : entry.en, vars);
      }
      return t(key, vars);
    },
  };
}
