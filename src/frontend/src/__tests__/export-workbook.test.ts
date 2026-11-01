import type { ExportData } from "@/backend";
import { Shift } from "@/backend";
import { buildExportWorkbook } from "@/lib/export";
import { describe, expect, it } from "vitest";

/** A minimal export payload with one roadie who has a phone number. */
function sampleData(): ExportData {
  return {
    overview: [{ positionName: "Cashier", totalPar: 4n, hired: 1n, need: 3n }],
    fohTotal: 1n,
    bohTotal: 0n,
    grandTotal: 1n,
    fohNeed: 3n,
    bohNeed: 0n,
    grandNeed: 3n,
    fohTotalPar: 4n,
    bohTotalPar: 0n,
    grandTotalPar: 4n,
    groups: [
      [
        "Cashier",
        [
          {
            name: "Ada Lovelace",
            phone: "+1-555-0100",
            availability: [Shift.am],
            availabilityByDay: [],
            onboardingComplete: true,
            policiesComplete: false,
            alcoholCert: false,
            foodHandlers: true,
            shirtSize: "M",
            weekdayLunch: true,
          },
        ],
      ],
    ],
  };
}

/** Flatten every cell of every worksheet into one string for inspection. */
function workbookText(data: ExportData, variant: "shareable" | "full"): string {
  const workbook = buildExportWorkbook(data, variant);
  const parts: string[] = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        parts.push(String(cell.value ?? ""));
      });
    });
  });
  return parts.join("|");
}

describe("export workbook", () => {
  it("omits the contact phone column from the Shareable export", () => {
    const text = workbookText(sampleData(), "shareable");
    expect(text).not.toContain("Phone");
    expect(text).not.toContain("+1-555-0100");
    // Non-contact columns are still present.
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("Cashier");
  });

  it("includes the contact phone column in the Full export", () => {
    const text = workbookText(sampleData(), "full");
    expect(text).toContain("Phone");
    expect(text).toContain("+1-555-0100");
  });
});
