import type { ExportData } from "@/backend";
import { Shift } from "@/backend";
import { buildExportWorkbook } from "@/lib/export";
import { describe, expect, it } from "vitest";

/**
 * Cover for the accepted Full export change: the Full variant gains Favorite
 * team, Favorite candy/snack, Favorite drink and Favorite color columns, and
 * the Shareable variant keeps them too (they are non-contact). The workbook is
 * built locally; no canister is contacted.
 */

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
            email: "ada@example.com",
            favoriteTeam: "LSU Tigers",
            favoriteSnack: "Snickers",
            favoriteDrink: "Coffee",
            favoriteColor: "Navy blue",
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

/** Every cell of every worksheet, in sheet/row order. */
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

describe("Full export gains the four Gift Bag columns", () => {
  it("includes the Favorite team, candy/snack, drink and color headers and values", () => {
    const full = workbookText(sampleData(), "full");
    expect(full).toContain("Favorite team");
    expect(full).toContain("Favorite candy/snack");
    expect(full).toContain("Favorite drink");
    expect(full).toContain("Favorite color");
    expect(full).toContain("LSU Tigers");
    expect(full).toContain("Snickers");
    expect(full).toContain("Coffee");
    expect(full).toContain("Navy blue");
  });

  it("keeps the four non-contact columns in the Shareable export", () => {
    const shareable = workbookText(sampleData(), "shareable");
    expect(shareable).toContain("Favorite team");
    expect(shareable).toContain("Favorite candy/snack");
    expect(shareable).toContain("Favorite drink");
    expect(shareable).toContain("Favorite color");
    // The Shareable export still omits the contact phone column.
    expect(shareable).not.toContain("Phone");
    expect(shareable).not.toContain("+1-555-0100");
  });
});
