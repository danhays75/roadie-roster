import { PageHeader } from "@/components/PageHeader";
import { AccessPanel } from "@/components/admin/AccessPanel";
import { ChecklistsPanel } from "@/components/admin/ChecklistsPanel";
import { CrewsPanel } from "@/components/admin/CrewsPanel";
import { PositionsPanel } from "@/components/admin/PositionsPanel";
import { SchedulePanel } from "@/components/admin/SchedulePanel";
import { StoreInfoPanel } from "@/components/admin/StoreInfoPanel";
import { TemplatePanel } from "@/components/admin/TemplatePanel";
import { APPROVAL_ROLES, useAccessState } from "@/hooks/useAccess";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { usePositions } from "@/hooks/useQueries";
import { useSeedWhenEmpty } from "@/hooks/useSeeding";
import { useState } from "react";

type AdminTab =
  | "access"
  | "store"
  | "positions"
  | "schedule"
  | "checklists"
  | "template"
  | "crews";

export default function AdminPage() {
  const { t } = useI18n();
  const demo = useDemo();
  const [tab, setTab] = useState<AdminTab>("store");
  const positions = usePositions();
  const access = useAccessState();
  const viewerRole = access.kind === "granted" ? access.grant.role : undefined;
  // The Crews tab is visible to Admin and Store Manager only.
  const canSeeCrews = !!viewerRole && APPROVAL_ROLES.includes(viewerRole);

  // Seed the store once when it has no positions yet so the admin page shows
  // the seeded positions, schedule, store info, checklists and retention.
  useSeedWhenEmpty(positions.isSuccess, (positions.data?.length ?? 0) === 0);

  // While demo mode is on the real-settings tabs are hidden: they change real
  // settings, which demo mode must not touch. The Store tab stays so an Admin
  // can reach the demo switch and turn demo mode off.
  const realSettingsTabs: AdminTab[] = [
    "positions",
    "schedule",
    "checklists",
    "template",
    "access",
  ];
  const showRealSettings = !demo.enabled;

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "store", label: t("admin.section.store") },
    ...(showRealSettings
      ? [
          { key: "positions" as const, label: t("admin.section.positions") },
          { key: "schedule" as const, label: t("admin.section.schedule") },
          { key: "checklists" as const, label: t("admin.section.checklists") },
          { key: "template" as const, label: t("admin.section.template") },
        ]
      : []),
    ...(canSeeCrews
      ? [{ key: "crews" as const, label: t("admin.section.crews") }]
      : []),
    ...(showRealSettings
      ? [{ key: "access" as const, label: t("admin.section.access") }]
      : []),
  ];

  // If demo mode turns on while a hidden tab is selected, fall back to Store.
  const activeTab =
    !showRealSettings && realSettingsTabs.includes(tab) ? "store" : tab;

  return (
    <div className="space-y-6" data-ocid="admin.page">
      <PageHeader title={t("admin.title")} subtitle={t("admin.subtitle")} />

      <div
        role="tablist"
        aria-label={t("admin.title")}
        className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1"
      >
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={activeTab === item.key}
            data-ocid={`admin.${item.key}.tab`}
            onClick={() => setTab(item.key)}
            className={`touch-target rounded px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === item.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === "store" && <StoreInfoPanel />}
      {activeTab === "positions" && <PositionsPanel />}
      {activeTab === "schedule" && <SchedulePanel />}
      {activeTab === "checklists" && <ChecklistsPanel />}
      {activeTab === "template" && <TemplatePanel />}
      {activeTab === "crews" && canSeeCrews && <CrewsPanel />}
      {activeTab === "access" && <AccessPanel />}
    </div>
  );
}
