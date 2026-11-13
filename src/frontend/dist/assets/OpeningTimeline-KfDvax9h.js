import { _ as EventKind, a as useDashboardCopy, b as __toESM, c as formatDateOnlyLong, g as cn, h as createLucideIcon, i as calendarInTimeZone, l as formatTimestampMediumDate, m as CalendarClock, n as CardContent, p as ChevronDown, s as dateOnlyToDate, t as Card, u as timestampToDate, v as require_jsx_runtime, y as require_react } from "./index-B71aqP7x.js";
/**
* @license lucide-react v0.511.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Flag = createLucideIcon("flag", [["path", {
	d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z",
	key: "i9b6wo"
}], ["line", {
	x1: "4",
	x2: "4",
	y1: "22",
	y2: "15",
	key: "1cm3nv"
}]]);
//#endregion
//#region src/components/dashboard/OpeningTimeline.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
/** Human label for a schedule event kind. */
function eventKindLabel(kind) {
	return {
		[EventKind.deadline]: "Deadline",
		[EventKind.orientation]: "Orientation",
		[EventKind.trainingDay]: "Training day",
		[EventKind.friendsAndFamily]: "Friends & family",
		[EventKind.openingDay]: "Opening day",
		[EventKind.signOff]: "Sign-off",
		[EventKind.other]: "Event"
	}[kind] ?? "Event";
}
/**
* A store-local calendar day key (`YYYY-MM-DD`) for an instant. Two instants
* share a key exactly when they fall on the same calendar day in the store's
* time zone, so keys compare lexicographically to order days.
*/
function localDayKey(instant, timeZone) {
	const { year, month, day } = calendarInTimeZone(instant, timeZone);
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function splitCountdown(ms) {
	const total = Math.max(0, Math.floor(ms / 1e3));
	return {
		days: Math.floor(total / 86400),
		hours: Math.floor(total % 86400 / 3600),
		minutes: Math.floor(total % 3600 / 60)
	};
}
function CountdownUnit({ value, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-w-16 flex-col items-center rounded-md bg-secondary px-3 py-2 text-secondary-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-3xl font-bold leading-none tabular-nums",
			children: value
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mt-1 font-display text-[10px] font-semibold uppercase tracking-widest text-white/70",
			children: label
		})]
	});
}
/** localStorage key remembering whether the schedule is expanded on this device. */
var SCHEDULE_STORAGE_KEY = "roadie-roster.dashboard.schedule-expanded";
/** Read the remembered schedule state, defaulting to collapsed. */
function readStoredExpanded() {
	try {
		return window.localStorage.getItem(SCHEDULE_STORAGE_KEY) === "true";
	} catch {
		return false;
	}
}
/** Persist the schedule state, ignoring unavailable storage. */
function storeExpanded(expanded) {
	try {
		window.localStorage.setItem(SCHEDULE_STORAGE_KEY, String(expanded));
	} catch {}
}
/**
* The countdown card and timeline, rendered from values the caller already
* holds: the effective "now" (with any demo pretend date applied), the store's
* time zone and whether any active roadie still has incomplete paperwork. It
* calls no backend hooks.
*/
function OpeningTimelineView({ events, openingDate, now, timeZone, hasIncompleteActivePaperwork }) {
	const { t } = useDashboardCopy();
	const zone = timeZone ?? "America/Chicago";
	const todayKey = (0, import_react.useMemo)(() => localDayKey(new Date(now), zone), [now, zone]);
	const [expanded, setExpanded] = (0, import_react.useState)(readStoredExpanded);
	const toggle = (0, import_react.useCallback)(() => {
		setExpanded((current) => {
			const next = !current;
			storeExpanded(next);
			return next;
		});
	}, []);
	const ordered = (0, import_react.useMemo)(() => [...events].sort((a, b) => Number(a.start - b.start)).filter((event) => {
		return timestampToDate(event.start) !== null;
	}), [events]);
	const dayKeys = (0, import_react.useMemo)(() => ordered.map((event) => {
		const date = timestampToDate(event.start);
		return date ? localDayKey(date, zone) : "";
	}), [ordered, zone]);
	const currentIndex = (0, import_react.useMemo)(() => {
		const todayIndex = dayKeys.findIndex((key) => key === todayKey);
		if (todayIndex !== -1) return todayIndex;
		return dayKeys.findIndex((key) => key > todayKey);
	}, [dayKeys, todayKey]);
	const nextEvent = (0, import_react.useMemo)(() => {
		for (const event of ordered) {
			const date = timestampToDate(event.start);
			if (date && date.getTime() > now) return event;
		}
		return null;
	}, [ordered, now]);
	const openingInstant = openingDate !== null ? dateOnlyToDate(openingDate) : null;
	const openingMs = openingInstant ? openingInstant.getTime() - now : null;
	const countdown = openingMs !== null ? splitCountdown(openingMs) : null;
	const regionId = "dashboard.timeline.region";
	const toggleLabel = expanded ? "Hide schedule" : "Show schedule";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		"data-ocid": "dashboard.countdown.card",
		className: "rounded-lg border-border py-5 shadow-subtle",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
			className: "space-y-5 px-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: toggle,
					"aria-expanded": expanded,
					"aria-controls": regionId,
					"data-ocid": "dashboard.countdown.header_toggle",
					className: "flex w-full flex-col gap-4 rounded-md text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flag, {
								className: "h-5 w-5",
								"aria-hidden": "true"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground",
							children: t("dashboard.countdown.label")
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-lg font-bold uppercase tracking-wide text-foreground",
							children: openingDate !== null ? formatDateOnlyLong(openingDate) : t("dashboard.countdown.noDate")
						})] })]
					}), countdown ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						"data-ocid": "dashboard.countdown.timer",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountdownUnit, {
								value: countdown.days,
								label: t("dashboard.countdown.days")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountdownUnit, {
								value: countdown.hours,
								label: t("dashboard.countdown.hours")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CountdownUnit, {
								value: countdown.minutes,
								label: t("dashboard.countdown.minutes")
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: t("dashboard.countdown.noDate")
					})]
				}),
				!expanded && nextEvent && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted-foreground",
					"data-ocid": "dashboard.timeline.next",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-display text-xs font-semibold uppercase tracking-widest text-primary",
							children: "Next:"
						}),
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium text-foreground",
							children: nextEvent.name
						}),
						" · ",
						formatTimestampMediumDate(nextEvent.start, timeZone)
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					id: regionId,
					"data-ocid": "dashboard.timeline.region",
					className: cn("grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-hidden",
						children: ordered.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
							className: "relative space-y-1 border-l border-border pl-5",
							"data-ocid": "dashboard.timeline.list",
							children: ordered.map((event, index) => {
								const isCurrent = index === currentIndex;
								const isToday = dayKeys[index] === todayKey;
								const isPast = dayKeys[index] < todayKey;
								const isPastDue = isPast && event.kind === EventKind.deadline && hasIncompleteActivePaperwork;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									"data-ocid": `dashboard.timeline.item.${index + 1}`,
									className: "relative py-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										className: cn("absolute -left-[26px] top-3.5 h-3 w-3 rounded-full border-2", isCurrent ? "border-primary bg-primary" : isPast ? "border-accent bg-accent" : "border-border bg-card")
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-3 py-2", isCurrent && "bg-primary/5 ring-1 ring-primary/30"),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: cn("truncate font-display text-sm font-semibold uppercase tracking-wide", isCurrent ? "text-primary" : "text-foreground"),
												children: event.name
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-muted-foreground",
												children: eventKindLabel(event.kind)
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [
												isToday && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "rounded-full bg-primary px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-widest text-primary-foreground",
													children: t("dashboard.timeline.now")
												}),
												!isToday && isPastDue && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "rounded-full bg-destructive/10 px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-widest text-destructive",
													children: t("dashboard.timeline.pastDue")
												}),
												!isToday && isPast && !isPastDue && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "rounded-full bg-muted px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-widest text-muted-foreground",
													children: t("dashboard.timeline.done")
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "flex items-center gap-1.5 text-xs text-muted-foreground",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarClock, {
														className: "h-3.5 w-3.5",
														"aria-hidden": "true"
													}), formatTimestampMediumDate(event.start, timeZone)]
												})
											]
										})]
									})]
								}, event.id.toString());
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: t("dashboard.timeline.empty")
						})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: toggle,
					"aria-expanded": expanded,
					"aria-controls": regionId,
					"data-ocid": "dashboard.timeline.toggle",
					className: "touch-target flex w-full items-center justify-center gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 font-display text-xs font-semibold uppercase tracking-widest text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					children: [toggleLabel, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, {
						"aria-hidden": "true",
						className: cn("h-4 w-4 transition-transform duration-300 ease-out motion-reduce:transition-none", expanded && "rotate-180")
					})]
				})
			]
		})
	});
}
//#endregion
export { OpeningTimelineView };
