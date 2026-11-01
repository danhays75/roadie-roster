import { renderWithActor } from "@/__tests__/test-utils";
import type { AccessGrant, ExportData, Role } from "@/backend";
import { Role as RoleEnum } from "@/backend";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import ExportPage from "@/pages/Export";
import type { Principal } from "@icp-sdk/core/principal";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const t = (key: string, vars?: Record<string, string | number>) =>
  translate("en" as Locale, key, vars);

function wrap(ui: React.ReactElement) {
  return (
    <I18nContext.Provider value={{ locale: "en", setLocale: vi.fn(), t }}>
      {ui}
    </I18nContext.Provider>
  );
}

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

function grant(role: Role): AccessGrant {
  return {
    principal: PRINCIPAL,
    role,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    trainerPositionIds: [],
  };
}

const EMPTY_EXPORT: ExportData = {
  overview: [],
  fohTotal: 0n,
  bohTotal: 0n,
  grandTotal: 0n,
  fohNeed: 0n,
  bohNeed: 0n,
  grandNeed: 0n,
  fohTotalPar: 0n,
  bohTotalPar: 0n,
  grandTotalPar: 0n,
  groups: [],
};

function actorFor(role: Role) {
  return {
    getMyAccess: vi.fn(async () => grant(role)),
    buildShareableExport: vi.fn(async () => EMPTY_EXPORT),
    buildFullExport: vi.fn(async () => EMPTY_EXPORT),
  };
}

describe("ExportPage role gating", () => {
  it("locks the Full export for a non-manager role", async () => {
    const actor = actorFor(RoleEnum.trainer);
    renderWithActor(wrap(<ExportPage />), actor);

    expect(
      await screen.findByTestId("export.full.section.locked_state"),
    ).toBeInTheDocument();
    // The shareable export is still available.
    expect(
      screen.queryByTestId("export.shareable.section.locked_state"),
    ).not.toBeInTheDocument();
  });

  it("unlocks the Full export for a Store Manager", async () => {
    const actor = actorFor(RoleEnum.storeManager);
    renderWithActor(wrap(<ExportPage />), actor);

    expect(
      await screen.findByTestId("export.full.section.download_button"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("export.full.section.locked_state"),
    ).not.toBeInTheDocument();
  });
});
