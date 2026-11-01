import type { ExportData } from "@/backend";
import { Shift } from "@/backend";
import { buildExportWorkbook } from "@/lib/export";
import { describe, expect, it } from "vitest";

/** A payload with two roadies across two position groups. */
function sampleData(): ExportData {
  return {
    overview: [
      { positionName: "Cashier", totalPar: 4n, hired: 1n, need: 3n },
      { positionName: "Cook", totalPar: 2n, hired: 1n, need: 1n },
    ],
    fohTotal: 1n,
    bohTotal: 1n,
    grandTotal: 2n,
    groups: [
      [
        "Cashier",
        [
          {
            name: "Ada Lovelace",
            phone: "+1-555-0100",
            availability: [Shift.am],
            onboardingComplete: true,
            policiesComplete: false,
            alcoholCert: false,
            foodHandlers: true,
            shirtSize: "M",
            weekdayLunch: true,
          },
        ],
      ],
      [
        "Cook",
        [
          {
            name: "Grace Hopper",
            phone: "+1-555-0200",
            availability: [Shift.pm],
            onboardingComplete: false,
            policiesComplete: true,
            alcoholCert: true,
            foodHandlers: false,
            shirtSize: "L",
            weekdayLunch: false,
          },
        ],
      ],
    ],
  };
}

/** Every cell of every worksheet, in sheet/row order. */
function workbookCells(
  data: ExportData,
  variant: "shareable" | "full",
): string[][] {
  const workbook = buildExportWorkbook(data, variant);
  const sheets: string[][] = [];
  workbook.eachSheet((sheet) => {
    const rows: string[] = [];
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        rows.push(String(cell.value ?? ""));
      });
    });
    sheets.push(rows);
  });
  return sheets;
}

describe("export variants differ only in contact details", () => {
  it("keeps every non-contact cell identical between Shareable and Full", () => {
    const data = sampleData();
    const shareable = workbookCells(data, "shareable");
    const full = workbookCells(data, "full");

    // Same sheets, same row counts.
    expect(shareable).toHaveLength(full.length);

    // The only difference is the contact phone column: dropping the "Phone"
    // header and each phone value from the Full export yields the Shareable
    // export cell-for-cell.
    const stripped = full.map((rows) =>
      rows.filter((cell) => cell !== "Phone" && !cell.startsWith("+1-555-")),
    );
    expect(stripped).toEqual(shareable);
  });

  it("carries the same overview totals in both variants", () => {
    const data = sampleData();
    const shareable = workbookCells(data, "shareable")[0];
    const full = workbookCells(data, "full")[0];
    expect(shareable).toEqual(full);
    expect(shareable).toContain("Grand total");
    expect(shareable).toContain("2");
  });
});
