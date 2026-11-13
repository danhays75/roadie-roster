import { a as useDashboardCopy, d as UserCheck, f as CircleCheck, g as cn, h as createLucideIcon, n as CardContent, o as Link, t as Card, v as require_jsx_runtime } from "./index-B71aqP7x.js";
/**
* @license lucide-react v0.511.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Target = createLucideIcon("target", [
	["circle", {
		cx: "12",
		cy: "12",
		r: "10",
		key: "1mglay"
	}],
	["circle", {
		cx: "12",
		cy: "12",
		r: "6",
		key: "1vlfrh"
	}],
	["circle", {
		cx: "12",
		cy: "12",
		r: "2",
		key: "1c9p78"
	}]
]);
//#endregion
//#region src/components/dashboard/KpiTiles.tsx
var import_jsx_runtime = require_jsx_runtime();
/**
* The single hiring progress bar: "Hired X of Y", filled to hired/build-to.
* X is everyone hired (pending + active, archived excluded) and Y is the
* build-to total, so the bar reads how close the store is to its target.
*/
function HiringProgress({ hired, buildToTotal }) {
	const { t } = useDashboardCopy();
	const pct = Math.min(100, Math.round(hired / Math.max(buildToTotal, 1) * 100));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		"data-ocid": "dashboard.progress",
		className: "animate-fade-rise rounded-lg border-border py-4 shadow-subtle",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
			className: "px-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground",
					children: t("dashboard.progress.title", {
						hired,
						total: buildToTotal
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-display text-sm font-bold tabular-nums text-foreground",
					children: [pct, "%"]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 h-3 w-full overflow-hidden rounded-full bg-muted",
				role: "progressbar",
				tabIndex: 0,
				"aria-valuenow": pct,
				"aria-valuemin": 0,
				"aria-valuemax": 100,
				"aria-label": t("dashboard.progress.aria", {
					hired,
					total: buildToTotal
				}),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block h-full rounded-full bg-primary transition-all",
					style: { width: `${pct}%` }
				})
			})]
		})
	});
}
/** The headline hiring tiles plus the single hiring progress bar. */
function KpiTiles({ hired, active, pending, buildToTotal, stillNeeded, certified, window }) {
	const { t } = useDashboardCopy();
	const hiredCount = Number(hired);
	const activeCount = Number(active);
	const pendingCount = Number(pending);
	const certifiedCount = Number(certified ?? 0n);
	const tiles = [{
		key: "hired",
		labelKey: "dashboard.kpi.hired",
		value: hiredCount.toString(),
		hintKey: "dashboard.kpi.hired.hint",
		icon: UserCheck,
		tone: "accent",
		detail: window.isOpen ? t("dashboard.kpi.hired.showedWaiting", {
			showed: activeCount,
			waiting: pendingCount
		}) : void 0
	}, {
		key: "still_needed",
		labelKey: "dashboard.kpi.stillNeeded",
		value: stillNeeded.toString(),
		hintKey: "dashboard.kpi.stillNeeded.toReach",
		icon: Target,
		tone: "primary"
	}];
	if (window.isOpen) tiles.push({
		key: "showed_up",
		labelKey: "dashboard.kpi.showedUp",
		value: t("dashboard.kpi.showedUp.value", {
			active: activeCount,
			hired: hiredCount
		}),
		hintKey: "dashboard.kpi.showedUp.hint",
		icon: CircleCheck,
		tone: "accent",
		link: window.afterOrientation ? {
			to: "/orientation",
			label: t("dashboard.kpi.showedUp.noShows", { count: pendingCount })
		} : void 0
	});
	if (window.afterSignOff) tiles.push({
		key: "certified",
		labelKey: "dashboard.kpi.certified",
		value: t("dashboard.kpi.certified.value", {
			certified: certifiedCount,
			hired: hiredCount
		}),
		hintKey: "dashboard.kpi.certified.hint",
		icon: CircleCheck,
		tone: "muted"
	});
	const toneClasses = {
		primary: "bg-primary/10 text-primary",
		accent: "bg-accent/10 text-accent",
		muted: "bg-muted text-muted-foreground"
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HiringProgress, {
			hired: hiredCount,
			buildToTotal: Number(buildToTotal)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4",
			"data-ocid": "dashboard.kpi.list",
			children: tiles.map((tile) => {
				const Icon = tile.icon;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					"data-ocid": `dashboard.kpi.${tile.key}`,
					className: "animate-fade-rise rounded-lg border-border py-4 shadow-subtle",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
						className: "px-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground",
									children: t(tile.labelKey)
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", toneClasses[tile.tone]),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
										className: "h-4 w-4",
										"aria-hidden": "true"
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 font-display text-3xl font-bold tabular-nums text-foreground",
								children: tile.value
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-xs text-muted-foreground",
								children: t(tile.hintKey, { total: Number(buildToTotal) })
							}),
							tile.detail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								"data-ocid": `dashboard.kpi.${tile.key}.detail`,
								className: "mt-1 text-xs font-medium text-accent",
								children: tile.detail
							}),
							tile.link && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: tile.link.to,
								"data-ocid": `dashboard.kpi.${tile.key}.link`,
								className: "mt-1 inline-block text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
								children: tile.link.label
							})
						]
					})
				}, tile.key);
			})
		})]
	});
}
//#endregion
export { KpiTiles };
