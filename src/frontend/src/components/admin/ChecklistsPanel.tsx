import {
  type ChecklistItem,
  type Checklists,
  type RetentionSettings,
  UniformItemType,
} from "@/backend";
import { DemoSettingsNote } from "@/components/DemoBanner";
import { AdminSection, FormField } from "@/components/admin/FormField";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useDemo } from "@/hooks/useDemo";
import {
  useChecklists,
  useRetentionSettings,
  useUpdateChecklists,
  useUpdateRetentionSettings,
} from "@/hooks/useQueries";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ChecklistDraft {
  orientationUniform: ChecklistItem[];
  paperwork: ChecklistItem[];
}

function toDraft(value: Checklists): ChecklistDraft {
  return {
    orientationUniform: value.orientationUniform.map((item) => ({ ...item })),
    paperwork: value.paperwork.map((item) => ({ ...item })),
  };
}

function nextItemId(items: ChecklistItem[]): bigint {
  return items.reduce((max, item) => (item.id > max ? item.id : max), 0n) + 1n;
}

function ChecklistEditor({
  title,
  description,
  items,
  onChange,
  ocid,
  showItemType = false,
}: {
  title: string;
  description: string;
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  ocid: string;
  showItemType?: boolean;
}) {
  const c = useAdminCopy();

  const updateItem = (id: bigint, patch: Partial<ChecklistItem>) => {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (id: bigint) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const addItem = () => {
    onChange([
      ...items,
      {
        id: nextItemId(items),
        text: "",
        requiresAlcoholCert: false,
        minorOnly: false,
        itemType: UniformItemType.checkbox,
      },
    ]);
  };

  return (
    <div data-ocid={ocid} className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          <p
            className="mt-0.5 text-xs text-muted-foreground"
            data-ocid={`${ocid}.toggle_hint`}
          >
            {c.checklistsToggleHint}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="touch-target shrink-0"
          data-ocid={`${ocid}.add_button`}
          onClick={addItem}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {c.checklistsAddItem}
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">{c.checklistsEmpty}</p>
      )}

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={item.id.toString()}
            data-ocid={`${ocid}.item.${index + 1}`}
            className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center"
          >
            <Input
              aria-label={c.checklistsItemText}
              data-ocid={`${ocid}.text.input.${index + 1}`}
              className="touch-target flex-1"
              value={item.text}
              onChange={(event) =>
                updateItem(item.id, { text: event.target.value })
              }
            />
            <div className="flex flex-wrap items-center gap-4">
              {showItemType && (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Select
                    value={item.itemType}
                    onValueChange={(value) =>
                      updateItem(item.id, {
                        itemType: value as UniformItemType,
                      })
                    }
                  >
                    <SelectTrigger
                      aria-label={c.checklistsItemType}
                      data-ocid={`${ocid}.type.select.${index + 1}`}
                      className="touch-target w-32"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UniformItemType.checkbox}>
                        {c.checklistsItemTypeCheckbox}
                      </SelectItem>
                      <SelectItem value={UniformItemType.count}>
                        {c.checklistsItemTypeCount}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </span>
              )}
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  aria-label={c.checklistsRequiresAlcoholCert}
                  data-ocid={`${ocid}.alcohol.switch.${index + 1}`}
                  checked={item.requiresAlcoholCert}
                  onCheckedChange={(checked) =>
                    updateItem(item.id, { requiresAlcoholCert: checked })
                  }
                />
                {c.checklistsRequiresAlcoholCert}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  aria-label={c.checklistsMinorOnly}
                  data-ocid={`${ocid}.minor.switch.${index + 1}`}
                  checked={item.minorOnly}
                  onCheckedChange={(checked) =>
                    updateItem(item.id, { minorOnly: checked })
                  }
                />
                {c.checklistsMinorOnly}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={c.checklistsRemoveItem}
                data-ocid={`${ocid}.remove_button.${index + 1}`}
                className="touch-target text-destructive"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChecklistsPanel() {
  const c = useAdminCopy();
  const demo = useDemo();
  const checklists = useChecklists();
  const updateChecklists = useUpdateChecklists();
  const retention = useRetentionSettings();
  const updateRetention = useUpdateRetentionSettings();
  const [draft, setDraft] = useState<ChecklistDraft | null>(null);
  const [retentionDraft, setRetentionDraft] =
    useState<RetentionSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (checklists.data && draft === null) {
      setDraft(toDraft(checklists.data));
    }
  }, [checklists.data, draft]);

  useEffect(() => {
    if (retention.data && retentionDraft === null) {
      setRetentionDraft({ ...retention.data });
    }
  }, [retention.data, retentionDraft]);

  const onSaveChecklists = () => {
    if (!draft) return;
    updateChecklists.mutate(
      {
        orientationUniform: draft.orientationUniform.filter((item) =>
          item.text.trim(),
        ),
        paperwork: draft.paperwork.filter((item) => item.text.trim()),
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  const onSaveRetention = () => {
    if (!retentionDraft) return;
    updateRetention.mutate(retentionDraft, { onSuccess: () => setSaved(true) });
  };

  const setRetentionDays = (key: keyof RetentionSettings, value: string) => {
    setSaved(false);
    setRetentionDraft((current) =>
      current
        ? { ...current, [key]: BigInt(Math.max(0, Number(value) || 0)) }
        : current,
    );
  };

  // While demo mode is on the checklist and retention edit controls are hidden:
  // they change real settings, which demo mode must not touch.
  if (demo.enabled) {
    return (
      <div className="space-y-6">
        <AdminSection
          title={c.checklistsTitle}
          description={c.checklistsDescription}
          ocid="admin.checklists.section"
        >
          <DemoSettingsNote />
        </AdminSection>
        <AdminSection
          title={c.retentionTitle}
          description={c.retentionDescription}
          ocid="admin.retention.section"
        >
          <DemoSettingsNote />
        </AdminSection>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminSection
        title={c.checklistsTitle}
        description={c.checklistsDescription}
        ocid="admin.checklists.section"
      >
        {checklists.isLoading || !draft ? (
          <p className="text-sm text-muted-foreground">{c.checklistsLoading}</p>
        ) : checklists.isError ? (
          <p className="text-sm text-destructive">{c.checklistsError}</p>
        ) : (
          <div className="space-y-6">
            <ChecklistEditor
              title={c.checklistsOrientationUniform}
              description={c.checklistsOrientationUniformHint}
              items={draft.orientationUniform}
              ocid="admin.checklists.uniform"
              showItemType
              onChange={(items) => {
                setSaved(false);
                setDraft((current) =>
                  current ? { ...current, orientationUniform: items } : current,
                );
              }}
            />
            <ChecklistEditor
              title={c.checklistsPaperwork}
              description={c.checklistsPaperworkHint}
              items={draft.paperwork}
              ocid="admin.checklists.paperwork"
              onChange={(items) => {
                setSaved(false);
                setDraft((current) =>
                  current ? { ...current, paperwork: items } : current,
                );
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="touch-target"
                data-ocid="admin.checklists.save_button"
                disabled={updateChecklists.isPending}
                onClick={onSaveChecklists}
              >
                {updateChecklists.isPending ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {c.checklistsSave}
              </Button>
              {updateChecklists.isError && (
                <p
                  className="text-sm font-medium text-destructive"
                  data-ocid="admin.checklists.error_state"
                >
                  {c.checklistsSaveError}
                </p>
              )}
            </div>
          </div>
        )}
      </AdminSection>

      <AdminSection
        title={c.retentionTitle}
        description={c.retentionDescription}
        ocid="admin.retention.section"
      >
        {retention.isLoading || !retentionDraft ? (
          <p className="text-sm text-muted-foreground">{c.retentionLoading}</p>
        ) : retention.isError ? (
          <p className="text-sm text-destructive">{c.retentionError}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                label={c.retentionArchivedContactSet}
                htmlFor="retention-contact"
              >
                <Input
                  id="retention-contact"
                  type="number"
                  min={0}
                  data-ocid="admin.retention.contact_days.input"
                  className="touch-target"
                  value={retentionDraft.archivedContactSetDays.toString()}
                  onChange={(event) =>
                    setRetentionDays(
                      "archivedContactSetDays",
                      event.target.value,
                    )
                  }
                />
              </FormField>
              <FormField label={c.retentionNotes} htmlFor="retention-notes">
                <Input
                  id="retention-notes"
                  type="number"
                  min={0}
                  data-ocid="admin.retention.notes_days.input"
                  className="touch-target"
                  value={retentionDraft.notesDays.toString()}
                  onChange={(event) =>
                    setRetentionDays("notesDays", event.target.value)
                  }
                />
              </FormField>
              <FormField
                label={c.retentionArchivedPhoto}
                htmlFor="retention-photo"
              >
                <Input
                  id="retention-photo"
                  type="number"
                  min={0}
                  data-ocid="admin.retention.photo_days.input"
                  className="touch-target"
                  value={retentionDraft.archivedPhotoDays.toString()}
                  onChange={(event) =>
                    setRetentionDays("archivedPhotoDays", event.target.value)
                  }
                />
              </FormField>
              <FormField label={c.retentionChangeLog} htmlFor="retention-log">
                <Input
                  id="retention-log"
                  type="number"
                  min={0}
                  data-ocid="admin.retention.change_log_days.input"
                  className="touch-target"
                  value={retentionDraft.changeLogDays.toString()}
                  onChange={(event) =>
                    setRetentionDays("changeLogDays", event.target.value)
                  }
                />
              </FormField>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="touch-target"
                data-ocid="admin.retention.save_button"
                disabled={updateRetention.isPending}
                onClick={onSaveRetention}
              >
                {updateRetention.isPending ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {c.retentionSave}
              </Button>
              {updateRetention.isError && (
                <p
                  className="text-sm font-medium text-destructive"
                  data-ocid="admin.retention.error_state"
                >
                  {c.retentionSaveError}
                </p>
              )}
            </div>
          </div>
        )}
      </AdminSection>

      {saved && (
        <p
          className="text-sm font-medium text-accent"
          data-ocid="admin.checklists.success_state"
        >
          {c.checklistsSaved}
        </p>
      )}
    </div>
  );
}
