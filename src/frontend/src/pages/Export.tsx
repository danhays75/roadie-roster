import type { ExportData } from "@/backend";
import { Role } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { useAccessState } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import { useFullExport, useShareableExport } from "@/hooks/useQueries";
import { type ExportVariant, downloadExport } from "@/lib/export";
import { Download, FileSpreadsheet, Lock } from "lucide-react";
import { useState } from "react";

/** Roles allowed to download the Full export with contact details. */
const FULL_EXPORT_ROLES: Role[] = [Role.admin, Role.storeManager];

function useCanDownloadFull(): boolean {
  const access = useAccessState();
  return (
    access.kind === "granted" && FULL_EXPORT_ROLES.includes(access.grant.role)
  );
}

function ExportCard({
  title,
  hint,
  data,
  isLoading,
  isError,
  onRetry,
  variant,
  filename,
  ocid,
  locked,
  lockedHint,
}: {
  title: string;
  hint: string;
  data: ExportData | null | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  variant: ExportVariant;
  filename: string;
  ocid: string;
  locked?: boolean;
  lockedHint?: string;
}) {
  const { t } = useI18n();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  async function handleDownload() {
    if (!data) return;
    setIsDownloading(true);
    setDownloadError(false);
    try {
      await downloadExport(data, variant, filename);
    } catch {
      setDownloadError(true);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <section
      data-ocid={ocid}
      className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-subtle"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
          aria-hidden="true"
        >
          <FileSpreadsheet className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>

      {locked ? (
        <div
          data-ocid={`${ocid}.locked_state`}
          className="mt-4 flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground"
        >
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{lockedHint}</span>
        </div>
      ) : (
        <>
          {isLoading && (
            <LoadingState
              label={t("export.loading")}
              className="mt-4"
              ocid={`${ocid}.loading_state`}
            />
          )}
          {isError && (
            <ErrorState
              message={t("export.error")}
              onRetry={onRetry}
              className="mt-4"
              ocid={`${ocid}.error_state`}
            />
          )}

          {data && (
            <>
              <dl className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <dt className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("export.grandTotal")}
                  </dt>
                  <dd className="font-display text-2xl font-bold">
                    {data.grandTotal.toString()}
                  </dd>
                </div>
                <div>
                  <dt className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("export.fohTotal")}
                  </dt>
                  <dd className="font-display text-2xl font-bold">
                    {data.fohTotal.toString()}
                  </dd>
                </div>
                <div>
                  <dt className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("export.bohTotal")}
                  </dt>
                  <dd className="font-display text-2xl font-bold">
                    {data.bohTotal.toString()}
                  </dd>
                </div>
              </dl>

              {downloadError && (
                <p
                  data-ocid={`${ocid}.download_error`}
                  className="mt-3 text-sm text-destructive"
                >
                  {t("export.error")}
                </p>
              )}

              <Button
                type="button"
                className="touch-target mt-4 w-full sm:w-auto"
                data-ocid={`${ocid}.download_button`}
                disabled={isDownloading}
                onClick={() => void handleDownload()}
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                {isDownloading
                  ? t("common.loading")
                  : t("export.action.download")}
              </Button>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default function ExportPage() {
  const { t } = useI18n();
  const canFull = useCanDownloadFull();
  const shareable = useShareableExport();
  const full = useFullExport();

  const hasAnyData = !!shareable.data || !!full.data;
  const settled = !shareable.isLoading && !full.isLoading;

  return (
    <div className="space-y-6" data-ocid="export.page">
      <PageHeader title={t("export.title")} subtitle={t("export.subtitle")} />

      {settled && !hasAnyData && (
        <EmptyState title={t("export.empty")} ocid="export.empty_state" />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ExportCard
          title={t("export.shareable")}
          hint={t("export.shareable.hint")}
          data={shareable.data}
          isLoading={shareable.isLoading}
          isError={shareable.isError}
          onRetry={() => void shareable.refetch()}
          variant="shareable"
          filename="roadie-shareable-export.xlsx"
          ocid="export.shareable.section"
        />
        <ExportCard
          title={t("export.full")}
          hint={t("export.full.hint")}
          data={full.data}
          isLoading={full.isLoading}
          isError={full.isError}
          onRetry={() => void full.refetch()}
          variant="full"
          filename="roadie-full-export.xlsx"
          ocid="export.full.section"
          locked={!canFull}
          lockedHint={t("export.full.locked")}
        />
      </div>
    </div>
  );
}
