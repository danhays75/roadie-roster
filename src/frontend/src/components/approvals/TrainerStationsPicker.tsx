import type { Position } from "@/backend";
import { useI18n } from "@/hooks/useI18n";

/**
 * Multi-select of trainer stations. Only rendered when the chosen role is
 * Trainer; the selection is required by the backend for that role.
 */
export function TrainerStationsPicker({
  positions,
  selectedIds,
  onChange,
}: {
  positions: Position[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <fieldset className="space-y-2 md:col-span-2">
      <legend className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t("approvals.stations.label")}
      </legend>
      {positions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("admin.positions.empty")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {positions.map((position) => {
            const id = position.id.toString();
            const checked = selectedIds.includes(id);
            return (
              <label
                key={id}
                className={`touch-target flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  checked
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--primary)]"
                  checked={checked}
                  data-ocid="approvals.station.checkbox"
                  onChange={() => toggle(id)}
                />
                {position.name}
              </label>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t("approvals.stations.hint")}
      </p>
    </fieldset>
  );
}
