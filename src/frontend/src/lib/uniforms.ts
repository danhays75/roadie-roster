import type {
  SizeCurve,
  SizeCurveEntry,
  UniformOrderRow,
  UniformOrderTotalsRow,
  UniformOrderView,
  UniformSettings,
  UniformSizeUnknownRow,
} from "@/backend";
import { UniformHouseFilter } from "@/backend";
import ExcelJS from "exceljs";

/** The seeded shirt size curve, used when the backend has no settings yet. */
export const DEFAULT_SHIRT_CURVE: SizeCurveEntry[] = [
  { size: "XS", percent: 3n },
  { size: "S", percent: 12n },
  { size: "M", percent: 25n },
  { size: "L", percent: 28n },
  { size: "XL", percent: 18n },
  { size: "2XL", percent: 10n },
  { size: "3XL", percent: 4n },
];

/** The seeded hat size curve, used when the backend has no settings yet. */
export const DEFAULT_HAT_CURVE: SizeCurveEntry[] = [
  { size: "One size", percent: 60n },
  { size: "S/M", percent: 20n },
  { size: "L/XL", percent: 20n },
];

/** The default buffer percentage applied to the projected order. */
export const DEFAULT_BUFFER_PERCENT = 10n;

/** The seeded uniform settings, used before the backend settings load. */
export const DEFAULT_UNIFORM_SETTINGS: UniformSettings = {
  sizeCurve: { shirts: DEFAULT_SHIRT_CURVE, hats: DEFAULT_HAT_CURVE },
  bufferPercent: DEFAULT_BUFFER_PERCENT,
};

/** The three house filters, in display order. */
export const UNIFORM_FILTERS: UniformHouseFilter[] = [
  UniformHouseFilter.all,
  UniformHouseFilter.foh,
  UniformHouseFilter.boh,
];

/** The copy key for each house filter. */
export const UNIFORM_FILTER_LABEL_KEY: Record<
  UniformHouseFilter,
  "uniformsFilterAll" | "uniformsFilterFoh" | "uniformsFilterBoh"
> = {
  [UniformHouseFilter.all]: "uniformsFilterAll",
  [UniformHouseFilter.foh]: "uniformsFilterFoh",
  [UniformHouseFilter.boh]: "uniformsFilterBoh",
};

/** The two uniform items, in display order. */
export const UNIFORM_ITEMS = ["Shirts", "Hats"] as const;

/** One item's size rows, in the order the backend returned them. */
export interface UniformItemGroup {
  item: string;
  rows: UniformOrderRow[];
}

/** Group the order rows by item, preserving the backend's row order. */
export function groupOrderRows(rows: UniformOrderRow[]): UniformItemGroup[] {
  const groups: UniformItemGroup[] = [];
  for (const row of rows) {
    const existing = groups.find((group) => group.item === row.item);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.push({ item: row.item, rows: [row] });
    }
  }
  return groups;
}

/** The backend's per-item totals row for one item, if present. */
export function totalsForItem(
  totals: UniformOrderTotalsRow[],
  item: string,
): UniformOrderTotalsRow | undefined {
  return totals.find((row) => row.item === item);
}

/** The sum of a size curve's percentages. */
export function curveTotal(entries: SizeCurveEntry[]): number {
  return entries.reduce((total, entry) => total + Number(entry.percent), 0);
}

/** Whether a size curve's percentages add up to exactly 100. */
export function curveIsBalanced(entries: SizeCurveEntry[]): boolean {
  return curveTotal(entries) === 100;
}

/** A copy of the settings with every percentage coerced to a whole number. */
export function normalizeSettings(settings: UniformSettings): UniformSettings {
  return {
    sizeCurve: {
      shirts: settings.sizeCurve.shirts.map((entry) => ({
        size: entry.size,
        percent: BigInt(Math.max(0, Math.trunc(Number(entry.percent)))),
      })),
      hats: settings.sizeCurve.hats.map((entry) => ({
        size: entry.size,
        percent: BigInt(Math.max(0, Math.trunc(Number(entry.percent)))),
      })),
    },
    bufferPercent: BigInt(
      Math.max(0, Math.trunc(Number(settings.bufferPercent))),
    ),
  };
}

/** The copy key describing which sizes a size-unknown roadie is missing. */
export function sizeUnknownReasonKey(
  row: UniformSizeUnknownRow,
):
  | "uniformsSizeUnknownMissingBoth"
  | "uniformsSizeUnknownMissingShirt"
  | "uniformsSizeUnknownMissingHat" {
  if (row.missingShirt && row.missingHat) {
    return "uniformsSizeUnknownMissingBoth";
  }
  if (row.missingShirt) return "uniformsSizeUnknownMissingShirt";
  return "uniformsSizeUnknownMissingHat";
}

/** The filename for the order workbook, dated by the local calendar day. */
export function uniformOrderFilename(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `uniform-order-${year}-${month}-${day}.xlsx`;
}

/** The order sheet name. */
const ORDER_SHEET = "Uniform order";

/**
 * Build the uniform order workbook: a header block with the store name and
 * date, then one row per item and size with hired, projected and order totals,
 * followed by the backend's per-item totals row.
 */
export function buildUniformOrderWorkbook(
  order: UniformOrderView,
  storeName: string,
  dateLabel: string,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Roadie";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(ORDER_SHEET);
  sheet.columns = [
    { key: "item", width: 16 },
    { key: "size", width: 16 },
    { key: "hired", width: 12 },
    { key: "projected", width: 12 },
    { key: "orderTotal", width: 14 },
  ];

  const title = sheet.addRow([storeName]);
  title.font = { bold: true, size: 14 };
  sheet.addRow([dateLabel]);
  sheet.addRow([]);

  const header = sheet.addRow([
    "Item",
    "Size",
    "Hired",
    "Projected",
    "Order total",
  ]);
  header.font = { bold: true };

  for (const group of groupOrderRows(order.rows)) {
    for (const row of group.rows) {
      sheet.addRow([
        row.item,
        row.size,
        Number(row.hired),
        Number(row.projected),
        Number(row.orderTotal),
      ]);
    }
    const totals = totalsForItem(order.totals, group.item);
    if (totals) {
      const totalsRow = sheet.addRow([
        totals.item,
        "Total",
        Number(totals.hired),
        Number(totals.projected),
        Number(totals.orderTotal),
      ]);
      totalsRow.font = { bold: true };
    }
  }

  sheet.views = [{ state: "frozen", ySplit: 4 }];
  return workbook;
}

/** Serialize the uniform order workbook to an .xlsx Blob. */
export async function uniformOrderWorkbookToBlob(
  order: UniformOrderView,
  storeName: string,
  dateLabel: string,
): Promise<Blob> {
  const workbook = buildUniformOrderWorkbook(order, storeName, dateLabel);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Whether the current device is an iPhone or iPad (incl. iPadOS desktop UA). */
function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

/**
 * Build the uniform order workbook and trigger a browser download, reusing the
 * same iOS-aware delivery as the roster and gift bag exports.
 */
export async function downloadUniformOrder(
  order: UniformOrderView,
  storeName: string,
  dateLabel: string,
  filename: string,
): Promise<void> {
  const blob = await uniformOrderWorkbookToBlob(order, storeName, dateLabel);

  if (isIosDevice()) {
    const file = new File([blob], filename, { type: blob.type });
    const canShare =
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });
    if (canShare) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch {
        // The user dismissed the share sheet; fall through to the anchor.
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  if (isIosDevice()) {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } else {
    URL.revokeObjectURL(url);
  }
}
