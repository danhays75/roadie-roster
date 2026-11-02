import type { GiftBagGroup, GiftBagLabel, GiftBagsData } from "@/backend";
import { GiftBagCategory } from "@/backend";
import ExcelJS from "exceljs";

/** The shopping-list sheet name. */
const SHOPPING_SHEET = "Shopping list";
/** The labels sheet name. */
const LABELS_SHEET = "Labels";

/**
 * The order the shopping-list categories are written in, matching the page's
 * display order: candy/snack, drink, sports team, color, shirt size, hat size.
 */
export const SHOPPING_CATEGORY_ORDER: GiftBagCategory[] = [
  GiftBagCategory.candySnack,
  GiftBagCategory.drink,
  GiftBagCategory.sportsTeam,
  GiftBagCategory.color,
  GiftBagCategory.shirtSize,
  GiftBagCategory.hatSize,
];

/** The label columns, in the order they appear on the Avery 5163 label. */
export const LABEL_FIELDS: Array<{
  key: keyof GiftBagLabel;
  header: string;
}> = [
  { key: "name", header: "Name" },
  { key: "positionName", header: "Position" },
  { key: "candySnack", header: "Candy or snack" },
  { key: "drink", header: "Drink" },
  { key: "sportsTeam", header: "Sports team" },
  { key: "color", header: "Color" },
  { key: "shirtSize", header: "Shirt size" },
  { key: "hatSize", header: "Hat size" },
];

/** A group's answers sorted by count, highest first, then alphabetically. */
export function sortAnswers(
  group: GiftBagGroup,
): Array<{ answer: string; count: number }> {
  return group.answers
    .map((entry) => ({ answer: entry.answer, count: Number(entry.count) }))
    .sort((a, b) => b.count - a.count || a.answer.localeCompare(b.answer));
}

/** The group for a category, or undefined when the backend omitted it. */
export function groupForCategory(
  groups: GiftBagGroup[],
  category: GiftBagCategory,
): GiftBagGroup | undefined {
  return groups.find((group) => group.category === category);
}

/** The label value for a field, or an empty string when absent. */
export function labelValue(
  label: GiftBagLabel,
  key: keyof GiftBagLabel,
): string {
  const value = label[key];
  return typeof value === "string" ? value : "";
}

/** Build the two-sheet Gift Bags workbook: shopping list + labels. */
export function buildGiftBagsWorkbook(data: GiftBagsData): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Roadie";
  workbook.created = new Date();

  const shopping = workbook.addWorksheet(SHOPPING_SHEET);
  shopping.columns = [
    { header: "Category", key: "category", width: 22 },
    { header: "Answer", key: "answer", width: 32 },
    { header: "Count", key: "count", width: 10 },
  ];
  for (const category of SHOPPING_CATEGORY_ORDER) {
    const group = groupForCategory(data.groups, category);
    if (!group) continue;
    for (const entry of sortAnswers(group)) {
      shopping.addRow({
        category,
        answer: entry.answer,
        count: entry.count,
      });
    }
    shopping.addRow({
      category,
      answer: "No answer",
      count: Number(group.noAnswer),
    });
  }
  shopping.getRow(1).font = { bold: true };
  shopping.views = [{ state: "frozen", ySplit: 1 }];

  const labels = workbook.addWorksheet(LABELS_SHEET);
  labels.columns = LABEL_FIELDS.map((field) => ({
    header: field.header,
    key: field.key,
    width: field.key === "name" ? 24 : 18,
  }));
  for (const label of data.labels) {
    labels.addRow(
      Object.fromEntries(
        LABEL_FIELDS.map((field) => [field.key, labelValue(label, field.key)]),
      ),
    );
  }
  labels.getRow(1).font = { bold: true };
  labels.views = [{ state: "frozen", ySplit: 1 }];

  return workbook;
}

/** Serialize the Gift Bags workbook to an .xlsx Blob. */
export async function giftBagsWorkbookToBlob(
  data: GiftBagsData,
): Promise<Blob> {
  const workbook = buildGiftBagsWorkbook(data);
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
 * Build the Gift Bags workbook and trigger a browser download, reusing the
 * same iOS-aware delivery as the roster export.
 */
export async function downloadGiftBags(
  data: GiftBagsData,
  filename: string,
): Promise<void> {
  const blob = await giftBagsWorkbookToBlob(data);

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
