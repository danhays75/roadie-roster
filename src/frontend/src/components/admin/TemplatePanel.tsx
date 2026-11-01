import { AdminSection, FormField } from "@/components/admin/FormField";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveStoreTemplate } from "@/hooks/useQueries";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { useState } from "react";

export function TemplatePanel() {
  const c = useAdminCopy();
  const save = useSaveStoreTemplate();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaved(false);
    save.mutate(trimmed, {
      onSuccess: () => {
        setSaved(true);
        setName("");
      },
    });
  };

  const includes = [
    c.templateIncludesSchedule,
    c.templateIncludesPositions,
    c.templateIncludesChecklists,
    c.templateIncludesLeaderTalk,
    c.templateIncludesNoPeople,
  ];

  return (
    <AdminSection
      title={c.templateTitle}
      description={c.templateDescription}
      ocid="admin.template.section"
    >
      <ul className="mb-5 space-y-2 text-sm text-muted-foreground">
        {includes.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              aria-hidden="true"
            />
            {item}
          </li>
        ))}
      </ul>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <FormField
          label={c.templateName}
          htmlFor="template-name"
          className="flex-1"
        >
          <Input
            id="template-name"
            data-ocid="admin.template.name.input"
            className="touch-target"
            placeholder={c.templateNamePlaceholder}
            value={name}
            onChange={(event) => {
              setSaved(false);
              setName(event.target.value);
            }}
          />
        </FormField>
        <Button
          type="submit"
          className="touch-target"
          data-ocid="admin.template.save_button"
          disabled={save.isPending || !name.trim()}
        >
          {save.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {c.templateSave}
        </Button>
      </form>

      {saved && (
        <p
          className="mt-3 text-sm font-medium text-accent"
          data-ocid="admin.template.success_state"
        >
          {c.templateSaved}
        </p>
      )}
      {save.isError && (
        <p
          className="mt-3 text-sm font-medium text-destructive"
          data-ocid="admin.template.error_state"
        >
          {c.templateSaveError}
        </p>
      )}
    </AdminSection>
  );
}
