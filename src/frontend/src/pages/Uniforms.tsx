import type {
  SizeCurveEntry,
  UniformHouseFilter,
  UniformOrderView,
  UniformSettings,
} from "@/backend";
import { UniformHouseFilter as UniformHouseFilterEnum } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { fill } from "@/components/admin/copy";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  canEditUniforms,
  canUniforms,
  useAccessState,
} from "@/hooks/useAccess";
import {
  useStoreInfo,
  useUniformOrder,
  useUniformSettings,
  useUpdateUniformSettings,
} from "@/hooks/useQueries";
import { formatDateOnly } from "@/lib/format";
import {
  DEFAULT_UNIFORM_SETTINGS,
  UNIFORM_FILTERS,
  UNIFORM_FILTER_LABEL_KEY,
  curveIsBalanced,
  curveTotal,
  downloadUniformOrder,
  groupOrderRows,
  normalizeSettings,
  sizeUnknownReasonKey,
  uniformOrderFilename,
} from "@/lib/uniforms";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Download, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** One editable size-curve column: a label and its percentage inputs. */
function CurveEditor({
  label,
  entries,
  editable,
  onChange,
}: {
  label: string;
  entries: SizeCurveEntry[];
  editable: boolean;
  onChange: (entries: SizeCurveEntry[]) => void;
}) {
  const copy = useAdminCopy();
  const total = curveTotal(entries);
  const balanced = curveIsBalanced(entries);

  return (
    <div
      data-ocid={`uniforms.curve.${label.toLowerCase()}`}
      className="rounded-lg border border-border bg-card p-4 shadow-subtle"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
          {label}
        </h3>
        <span
          data-ocid={`uniforms.curve.${label.toLowerCase()}.total`}
          className={cn(
            "font-mono text-xs tabular-nums",
            balanced ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {fill(copy.uniformsCurveTotal, { percent: total })}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {entries.map((entry, index) => (
          <li
            key={entry.size}
            data-ocid={`uniforms.curve.${label.toLowerCase()}.row.${index + 1}`}
            className="flex items-center gap-3"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {entry.size}
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={entry.percent.toString()}
              disabled={!editable}
              aria-label={`${label} ${entry.size} ${copy.uniformsPercent}`}
              data-ocid={`uniforms.curve.${label.toLowerCase()}.input.${index + 1}`}
              className="touch-target w-20 text-right font-mono tabular-nums"
              onChange={(event) => {
                const next = entries.map((current, currentIndex) =>
                  currentIndex === index
                    ? {
                        size: current.size,
                        percent: BigInt(
                          Math.max(
                            0,
                            Math.trunc(Number(event.target.value) || 0),
                          ),
                        ),
                      }
                    : current,
                );
                onChange(next);
              }}
            />
            <span className="w-4 text-sm text-muted-foreground">%</span>
          </li>
        ))}
      </ul>

      {!balanced && (
        <p
          data-ocid={`uniforms.curve.${label.toLowerCase()}.warning`}
          className="mt-3 text-xs text-destructive"
        >
          {copy.uniformsCurveTotalWarning}
        </p>
      )}
    </div>
  );
}

/** The order table for one item (Shirts or Hats). */
function OrderTable({
  item,
  rows,
}: {
  item: string;
  rows: UniformOrderView["rows"];
}) {
  const copy = useAdminCopy();

  return (
    <section
      data-ocid={`uniforms.order.${item.toLowerCase()}`}
      className="rounded-lg border border-border bg-card p-4 shadow-subtle"
    >
      <h3 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
        {item}
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-1.5 pr-2 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {copy.uniformsColumnSize}
              </th>
              <th className="py-1.5 px-2 text-right font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {copy.uniformsColumnHired}
              </th>
              <th className="py-1.5 px-2 text-right font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {copy.uniformsColumnProjected}
              </th>
              <th className="py-1.5 pl-2 text-right font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {copy.uniformsColumnOrderTotal}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.item}-${row.size}`}
                data-ocid={`uniforms.order.${item.toLowerCase()}.row.${index + 1}`}
                className="border-b border-border/60 last:border-0"
              >
                <td className="py-1.5 pr-2 text-foreground">{row.size}</td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums text-foreground">
                  {row.hired.toString()}
                </td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums text-foreground">
                  {row.projected.toString()}
                </td>
                <td className="py-1.5 pl-2 text-right font-mono font-semibold tabular-nums text-foreground">
                  {row.orderTotal.toString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The Size unknown section: roadies missing a shirt or hat size. */
function SizeUnknownSection({ order }: { order: UniformOrderView }) {
  const copy = useAdminCopy();
  const rows = order.sizeUnknown;

  return (
    <section
      data-ocid="uniforms.size_unknown.section"
      className="rounded-lg border border-border bg-card p-4 shadow-subtle"
      aria-labelledby="uniforms-size-unknown-heading"
    >
      <h2
        id="uniforms-size-unknown-heading"
        className="font-display text-xl font-bold uppercase tracking-wide text-foreground"
      >
        {copy.uniformsSizeUnknownTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {copy.uniformsSizeUnknownHint}
      </p>

      {rows.length === 0 ? (
        <p
          data-ocid="uniforms.size_unknown.empty_state"
          className="mt-3 text-sm text-muted-foreground"
        >
          {copy.uniformsSizeUnknownEmpty}
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {rows.map((row, index) => (
            <li
              key={row.roadieId.toString()}
              data-ocid={`uniforms.size_unknown.item.${index + 1}`}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
            >
              <Link
                to="/roster/$roadieId"
                params={{ roadieId: row.roadieId.toString() }}
                data-ocid={`uniforms.size_unknown.link.${index + 1}`}
                className="min-h-[44px] inline-flex items-center rounded-sm text-foreground underline decoration-dotted underline-offset-4 transition-smooth hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {row.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {copy[sizeUnknownReasonKey(row)]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function UniformsPage() {
  const copy = useAdminCopy();
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : undefined;
  const canView = canUniforms(role);
  const canEdit = canEditUniforms(role);

  const [filter, setFilter] = useState<UniformHouseFilter>(
    UniformHouseFilterEnum.all,
  );
  const settingsQuery = useUniformSettings(canView);
  const orderQuery = useUniformOrder(filter, canView);
  const updateSettings = useUpdateUniformSettings();
  const { data: storeInfo } = useStoreInfo();

  const [draft, setDraft] = useState<UniformSettings>(DEFAULT_UNIFORM_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  // Seed the editable draft once the backend settings arrive. The draft is
  // local UI state; a later refetch never overwrites what the user is editing.
  const settings = settingsQuery.data;
  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const storeName = useMemo(
    () => storeInfo?.locationName || storeInfo?.appName || "",
    [storeInfo],
  );
  const dateLabel = useMemo(
    () => (storeInfo ? formatDateOnly(storeInfo.openingDate) : ""),
    [storeInfo],
  );

  const order = orderQuery.data;
  const groups = order ? groupOrderRows(order.rows) : [];

  function handleSave() {
    setSaved(false);
    setSaveError(false);
    updateSettings.mutate(normalizeSettings(draft), {
      onSuccess: () => setSaved(true),
      onError: () => setSaveError(true),
    });
  }

  async function handleDownload() {
    if (!order) return;
    setIsDownloading(true);
    setDownloadError(false);
    try {
      await downloadUniformOrder(
        order,
        storeName,
        dateLabel,
        uniformOrderFilename(new Date()),
      );
    } catch {
      setDownloadError(true);
    } finally {
      setIsDownloading(false);
    }
  }

  if (!canView) {
    return (
      <div className="space-y-6" data-ocid="uniforms.page">
        <PageHeader title={copy.uniformsTitle} />
        <EmptyState title={copy.uniformsEmpty} ocid="uniforms.empty_state" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-ocid="uniforms.page">
      <div className="print-hide">
        <PageHeader
          title={copy.uniformsTitle}
          subtitle={copy.uniformsDescription}
          action={
            <>
              <Button
                type="button"
                variant="outline"
                className="touch-target"
                data-ocid="uniforms.print_button"
                disabled={!order}
                onClick={() => window.print()}
              >
                <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                {copy.uniformsPrint}
              </Button>
              <Button
                type="button"
                className="touch-target"
                data-ocid="uniforms.download_button"
                disabled={!order || isDownloading}
                onClick={() => void handleDownload()}
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                {isDownloading ? copy.uniformsLoading : copy.uniformsDownload}
              </Button>
            </>
          }
        />

        {downloadError && (
          <p
            data-ocid="uniforms.download_error"
            className="mt-3 text-sm text-destructive"
          >
            {copy.uniformsSaveError}
          </p>
        )}
      </div>

      {settingsQuery.isLoading && (
        <LoadingState
          label={copy.uniformsLoading}
          ocid="uniforms.loading_state"
        />
      )}

      {settingsQuery.isError && (
        <ErrorState
          message={copy.uniformsError}
          onRetry={() => void settingsQuery.refetch()}
          ocid="uniforms.error_state"
        />
      )}

      {settingsQuery.data && (
        <section
          data-ocid="uniforms.settings.section"
          className="space-y-4"
          aria-labelledby="uniforms-settings-heading"
        >
          <div>
            <h2
              id="uniforms-settings-heading"
              className="font-display text-xl font-bold uppercase tracking-wide text-foreground"
            >
              {copy.uniformsSizeCurve}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.uniformsSizeCurveHint}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <CurveEditor
              label={copy.uniformsShirts}
              entries={draft.sizeCurve.shirts}
              editable={canEdit}
              onChange={(shirts) =>
                setDraft((current) => ({
                  ...current,
                  sizeCurve: { ...current.sizeCurve, shirts },
                }))
              }
            />
            <CurveEditor
              label={copy.uniformsHats}
              entries={draft.sizeCurve.hats}
              editable={canEdit}
              onChange={(hats) =>
                setDraft((current) => ({
                  ...current,
                  sizeCurve: { ...current.sizeCurve, hats },
                }))
              }
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-subtle">
            <Label htmlFor="uniforms-buffer">{copy.uniformsBuffer}</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.uniformsBufferHint}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id="uniforms-buffer"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={draft.bufferPercent.toString()}
                disabled={!canEdit}
                data-ocid="uniforms.buffer.input"
                className="touch-target w-24 text-right font-mono tabular-nums"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    bufferPercent: BigInt(
                      Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                    ),
                  }))
                }
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="touch-target"
                data-ocid="uniforms.save_button"
                disabled={updateSettings.isPending}
                onClick={handleSave}
              >
                {copy.uniformsSave}
              </Button>
              {saved && (
                <span
                  data-ocid="uniforms.success_state"
                  className="text-sm text-accent"
                >
                  {copy.uniformsSaved}
                </span>
              )}
              {saveError && (
                <span
                  data-ocid="uniforms.save_error"
                  className="text-sm text-destructive"
                >
                  {copy.uniformsSaveError}
                </span>
              )}
            </div>
          )}
        </section>
      )}

      <section
        data-ocid="uniforms.order.section"
        className="space-y-4"
        aria-labelledby="uniforms-order-heading"
      >
        <div className="print-hide">
          <h2
            id="uniforms-order-heading"
            className="font-display text-xl font-bold uppercase tracking-wide text-foreground"
          >
            {copy.uniformsOrderTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.uniformsOrderDescription}
          </p>

          <div
            role="tablist"
            aria-label={copy.uniformsOrderTitle}
            className="mt-3 inline-flex rounded-md border border-border bg-card p-1"
          >
            {UNIFORM_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                data-ocid={`uniforms.filter.${value}`}
                className={cn(
                  "touch-target rounded-sm px-4 font-display text-xs font-semibold uppercase tracking-widest transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  filter === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setFilter(value)}
              >
                {copy[UNIFORM_FILTER_LABEL_KEY[value]]}
              </button>
            ))}
          </div>
        </div>

        {orderQuery.isLoading && (
          <LoadingState
            label={copy.uniformsLoading}
            ocid="uniforms.order.loading_state"
          />
        )}

        {orderQuery.isError && (
          <ErrorState
            message={copy.uniformsError}
            onRetry={() => void orderQuery.refetch()}
            ocid="uniforms.order.error_state"
          />
        )}

        {order && (
          <div className="print-area space-y-4">
            <div className="hidden print:block">
              <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
                {copy.uniformsPrintTitle}
              </h1>
              <p className="text-sm">
                {storeName} · {dateLabel}
              </p>
            </div>

            {groups.length === 0 ? (
              <EmptyState
                title={copy.uniformsEmpty}
                ocid="uniforms.order.empty_state"
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {groups.map((group) => (
                  <OrderTable
                    key={group.item}
                    item={group.item}
                    rows={group.rows}
                  />
                ))}
              </div>
            )}

            <p
              data-ocid="uniforms.buffer.summary"
              className="text-sm text-muted-foreground"
            >
              {fill(copy.uniformsBufferSummary, {
                percent: order.bufferPercent.toString(),
              })}
            </p>

            <SizeUnknownSection order={order} />
          </div>
        )}
      </section>
    </div>
  );
}
