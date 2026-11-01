import type { Roadie, RoadieStatus } from "@/backend";
import { RoadieStatus as RoadieStatusEnum } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { StoreLogo } from "@/components/StoreLogo";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/hooks/useI18n";
import { useCrews, usePositions, useRoadies } from "@/hooks/useQueries";
import { refToDataUrl, roadieStatusLabel } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";

type Filter = "all" | "active" | "archived";

function statusTone(status: RoadieStatus) {
  if (status === RoadieStatusEnum.archived) return "muted" as const;
  if (status === RoadieStatusEnum.needsMoreTime) return "pending" as const;
  return "hired" as const;
}

function RoadieRow({
  roadie,
  positionName,
  positionCode,
  crewName,
}: {
  roadie: Roadie;
  positionName: string;
  positionCode: string;
  crewName: string;
}) {
  const { t } = useI18n();
  const name = roadie.profile.preferredName || roadie.profile.name;
  return (
    <li data-ocid="roster.item">
      <Link
        to="/roster/$roadieId"
        params={{ roadieId: roadie.id.toString() }}
        data-ocid="roster.item.link"
        className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-subtle transition-smooth hover:-translate-y-0.5 hover:shadow-elevated"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-muted">
          {roadie.photo ? (
            <img
              src={refToDataUrl(roadie.photo) ?? undefined}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon
              className="h-6 w-6 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold uppercase tracking-wide text-foreground">
            {name}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {positionName}
            {positionCode ? ` · ${positionCode}` : ""}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {t("roadie.field.crew")}: {crewName}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge
            tone={statusTone(roadie.status)}
            ocid="roster.item.status"
          >
            {roadieStatusLabel(roadie.status)}
          </StatusBadge>
        </div>
        <span className="sr-only">{t("roster.viewCard")}</span>
      </Link>
    </li>
  );
}

export default function RosterPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { data: roadies, isLoading, isError, refetch } = useRoadies();
  const { data: positions } = usePositions();
  const { data: crews } = useCrews();

  const positionMap = useMemo(() => {
    const map = new Map<string, { name: string; code: string }>();
    for (const position of positions ?? []) {
      map.set(position.id.toString(), {
        name: position.name,
        code: position.code,
      });
    }
    return map;
  }, [positions]);

  const crewMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const crew of crews ?? []) {
      map.set(crew.id.toString(), crew.name);
    }
    return map;
  }, [crews]);

  const filtered = useMemo(() => {
    const list = roadies ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((roadie) => {
      const archived = roadie.status === RoadieStatusEnum.archived;
      if (filter === "active" && archived) return false;
      if (filter === "archived" && !archived) return false;
      if (!q) return true;
      const name = (
        roadie.profile.preferredName || roadie.profile.name
      ).toLowerCase();
      const position = (
        positionMap.get(roadie.mainPositionId.toString())?.name ?? ""
      ).toLowerCase();
      return name.includes(q) || position.includes(q);
    });
  }, [roadies, query, filter, positionMap]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("roster.filter.all") },
    { key: "active", label: t("roster.filter.active") },
    { key: "archived", label: t("roster.filter.archived") },
  ];

  return (
    <div className="space-y-6" data-ocid="roster.page">
      <PageHeader title={t("roster.title")} subtitle={t("roster.subtitle")} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <label htmlFor="roster-search" className="sr-only">
            {t("roster.search")}
          </label>
          <Input
            id="roster-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("roster.searchPlaceholder")}
            data-ocid="roster.search_input"
            className="touch-target"
          />
        </div>
        <div
          role="tablist"
          aria-label={t("roster.title")}
          className="flex gap-1 rounded-md border border-border bg-card p-1"
        >
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              data-ocid={`roster.filter.${item.key}.tab`}
              onClick={() => setFilter(item.key)}
              className={`touch-target rounded px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wider transition-colors ${
                filter === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <LoadingState label={t("roster.loading")} />}
      {isError && (
        <ErrorState
          message={t("roster.error")}
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState title={query ? t("roster.empty") : t("roster.emptyAll")} />
      )}

      {filtered.length > 0 && (
        <ul className="space-y-3" data-ocid="roster.list">
          {filtered.map((roadie) => {
            const position = positionMap.get(roadie.mainPositionId.toString());
            return (
              <RoadieRow
                key={roadie.id.toString()}
                roadie={roadie}
                positionName={position?.name ?? t("roadie.field.none")}
                positionCode={position?.code ?? ""}
                crewName={
                  roadie.crewId === undefined
                    ? t("roadie.field.none")
                    : (crewMap.get(roadie.crewId.toString()) ??
                      t("roadie.field.none"))
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
