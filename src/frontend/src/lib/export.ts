import type { ExportData, ExportRow, Shift, Weekday } from "@/backend";
import { Shift as ShiftEnum, Weekday as WeekdayEnum } from "@/backend";
import { formatDateOnly } from "@/lib/format";
import ExcelJS from "exceljs";

/** Which columns a workbook includes. Full adds the contact phone column. */
export type ExportVariant = "shareable" | "full";

const OVERVIEW_SHEET = "Staff Pars and Overview";

/** Excel sheet names are capped at 31 chars and forbid : \ / ? * [ ]. */
function safeSheetName(name: string, used: Set<string>): string {
  const cleaned = name.replaceAll(/[:\\/?*[\]]/g, " ").trim() || "Group";
  let candidate = cleaned.slice(0, 31);
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const tag = ` (${suffix})`;
    candidate = `${cleaned.slice(0, 31 - tag.length)}${tag}`;
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Short day labels for the Wed–Tue availability columns. */
const WEEKDAY_LABELS: Record<Weekday, string> = {
  [WeekdayEnum.wed]: "Wed",
  [WeekdayEnum.thu]: "Thu",
  [WeekdayEnum.fri]: "Fri",
  [WeekdayEnum.sat]: "Sat",
  [WeekdayEnum.sun]: "Sun",
  [WeekdayEnum.mon]: "Mon",
  [WeekdayEnum.tue]: "Tue",
};

/**
 * The days (Wed–Tue order) the roadie is available for one shift, as a
 * comma-separated list such as "Wed, Fri". Blank when none.
 */
function shiftDays(row: ExportRow, shift: Shift): string {
  return row.availabilityByDay
    .filter(([, shifts]) => shifts.includes(shift))
    .map(([day]) => WEEKDAY_LABELS[day])
    .join(", ");
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

/** Column headers for a position-group sheet, in the required order. */
function groupHeaders(variant: ExportVariant): string[] {
  const headers = ["Date hired", "Shirt size", "Weekday lunch (Y)", "Name"];
  if (variant === "full") {
    headers.push(
      "Phone",
      "Email",
      "Emergency contact name",
      "Emergency contact phone",
      "Date of birth",
    );
  }
  headers.push(
    "Onboarding complete",
    "Policies & procedures",
    "Alcohol cert",
    "Food handlers",
    "Availability Wed-Tue AM",
    "Availability Wed-Tue PM",
    "Favorite team",
    "Favorite candy/snack",
    "Favorite drink",
    "Favorite color",
  );
  return headers;
}

function groupRow(row: ExportRow, variant: ExportVariant): string[] {
  const cells = [
    row.dateHired !== undefined ? formatDateOnly(row.dateHired) : "",
    row.shirtSize ?? "",
    row.weekdayLunch ? "Y" : "",
    row.name,
  ];
  if (variant === "full") {
    cells.push(
      row.phone ?? "",
      row.email ?? "",
      row.emergencyContactName ?? "",
      row.emergencyContactPhone ?? "",
      row.dateOfBirth !== undefined ? formatDateOnly(row.dateOfBirth) : "",
    );
  }
  cells.push(
    yesNo(row.onboardingComplete),
    yesNo(row.policiesComplete),
    yesNo(row.alcoholCert),
    yesNo(row.foodHandlers),
    shiftDays(row, ShiftEnum.am),
    shiftDays(row, ShiftEnum.pm),
    row.favoriteTeam ?? "",
    row.favoriteSnack ?? "",
    row.favoriteDrink ?? "",
    row.favoriteColor ?? "",
  );
  return cells;
}

/** Build the "Staff Pars and Overview" worksheet. */
function addOverviewSheet(workbook: ExcelJS.Workbook, data: ExportData): void {
  const sheet = workbook.addWorksheet(OVERVIEW_SHEET);
  sheet.columns = [
    { header: "Position", key: "position", width: 32 },
    { header: "Total Par", key: "totalPar", width: 12 },
    { header: "Hired", key: "hired", width: 10 },
    { header: "Need", key: "need", width: 10 },
  ];
  for (const row of data.overview) {
    sheet.addRow({
      position: row.positionName,
      totalPar: Number(row.totalPar),
      hired: Number(row.hired),
      need: Number(row.need),
    });
  }

  const totals = sheet.addRow({
    position: "FOH total",
    totalPar: Number(data.fohTotalPar),
    hired: Number(data.fohTotal),
    need: Number(data.fohNeed),
  });
  totals.font = { bold: true };
  const boh = sheet.addRow({
    position: "BOH total",
    totalPar: Number(data.bohTotalPar),
    hired: Number(data.bohTotal),
    need: Number(data.bohNeed),
  });
  boh.font = { bold: true };
  const grand = sheet.addRow({
    position: "Grand total",
    totalPar: Number(data.grandTotalPar),
    hired: Number(data.grandTotal),
    need: Number(data.grandNeed),
  });
  grand.font = { bold: true };

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

/** Build one worksheet per position group. */
function addGroupSheets(
  workbook: ExcelJS.Workbook,
  data: ExportData,
  variant: ExportVariant,
): void {
  const used = new Set<string>([OVERVIEW_SHEET.toLowerCase()]);
  for (const [groupName, rows] of data.groups) {
    const sheet = workbook.addWorksheet(safeSheetName(groupName, used));
    sheet.addRow(groupHeaders(variant));
    for (const row of rows) {
      sheet.addRow(groupRow(row, variant));
    }
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }
}

/** Build the workbook for the requested export variant. */
export function buildExportWorkbook(
  data: ExportData,
  variant: ExportVariant,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Roadie";
  workbook.created = new Date();
  addOverviewSheet(workbook, data);
  addGroupSheets(workbook, data, variant);
  return workbook;
}

/** Serialize the workbook to an .xlsx Blob. */
export async function exportWorkbookToBlob(
  data: ExportData,
  variant: ExportVariant,
): Promise<Blob> {
  const workbook = buildExportWorkbook(data, variant);
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
  // iPadOS 13+ reports as Macintosh but exposes touch points.
  const iPadOs = ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

/**
 * Build the workbook and trigger a browser download. On iPhone and iPad the
 * object URL is revoked after a delay rather than immediately, because Safari
 * may not have started the download when the click returns; when the Web Share
 * API can share files it is preferred so the user picks where the file goes.
 */
export async function downloadExport(
  data: ExportData,
  variant: ExportVariant,
  filename: string,
): Promise<void> {
  const blob = await exportWorkbookToBlob(data, variant);

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
        // The user dismissed the share sheet or sharing failed; fall through to
        // the anchor download so the export is still delivered.
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
    // Give Safari time to start the download before the URL is revoked.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } else {
    URL.revokeObjectURL(url);
  }
}
