import { useGroupsCopy } from "@/components/groups/copy";
import type { ShiftOption } from "@/components/groups/shiftOptions";
import { shiftOptionLabel } from "@/components/groups/shiftOptions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Eraser, Wand2 } from "lucide-react";
import { useState } from "react";

/**
 * The board toolbar: "Copy from…" picks another shift and, after confirming it
 * replaces the current board, copies groups, capacities and Off; "Make groups
 * for me" fills empty capacity from Unassigned; "Clear board" empties the
 * current shift's board. Only rendered for editors.
 */
export function BoardToolbar({
  sourceOptions,
  onCopy,
  onAutoFill,
  onClear,
  pending,
  error,
}: {
  sourceOptions: ShiftOption[];
  onCopy: (source: ShiftOption) => void;
  onAutoFill: () => void;
  onClear: () => void;
  pending: boolean;
  error: boolean;
}) {
  const { t } = useGroupsCopy();
  const [copyOpen, setCopyOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [sourceKey, setSourceKey] = useState<string | null>(null);

  const selectedSource = sourceOptions.find(
    (option) => `${option.eventId.toString()}:${option.shift}` === sourceKey,
  );

  return (
    <div
      data-ocid="groups.toolbar"
      aria-label={t("groups.board.toolbarLabel")}
      className="flex flex-wrap items-center gap-2"
    >
      <Button
        type="button"
        variant="outline"
        className="touch-target"
        data-ocid="groups.toolbar.copy_button"
        disabled={pending || sourceOptions.length === 0}
        onClick={() => {
          setSourceKey(null);
          setCopyOpen(true);
        }}
      >
        <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
        {t("groups.board.copyFrom")}
      </Button>

      <Button
        type="button"
        variant="outline"
        className="touch-target"
        data-ocid="groups.toolbar.auto_fill_button"
        disabled={pending}
        onClick={onAutoFill}
      >
        <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" />
        {t("groups.board.autoFill")}
      </Button>

      <Button
        type="button"
        variant="outline"
        className="touch-target text-destructive"
        data-ocid="groups.toolbar.clear_button"
        disabled={pending}
        onClick={() => setClearOpen(true)}
      >
        <Eraser className="mr-2 h-4 w-4" aria-hidden="true" />
        {t("groups.board.clear")}
      </Button>

      {error && (
        <p
          role="alert"
          data-ocid="groups.toolbar.error_state"
          className="text-sm font-medium text-destructive"
        >
          {t("groups.toolbar.actionError")}
        </p>
      )}

      <Dialog
        open={copyOpen}
        onOpenChange={(next) => {
          if (!next) setSourceKey(null);
          setCopyOpen(next);
        }}
      >
        <DialogContent
          data-ocid="groups.toolbar.copy_dialog"
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>{t("groups.board.copyTitle")}</DialogTitle>
            <DialogDescription>{t("groups.board.copyBody")}</DialogDescription>
          </DialogHeader>

          {sourceOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("groups.board.copyNoSources")}
            </p>
          ) : (
            <div className="space-y-1.5">
              <label
                htmlFor="groups-copy-source"
                className="text-sm font-medium text-foreground"
              >
                {t("groups.board.copySourceLabel")}
              </label>
              <Select
                value={sourceKey ?? undefined}
                onValueChange={(value) => setSourceKey(value)}
              >
                <SelectTrigger
                  id="groups-copy-source"
                  data-ocid="groups.toolbar.copy_source_select"
                  className="touch-target w-full"
                >
                  <SelectValue
                    placeholder={t("groups.board.copySourcePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((option) => {
                    const key = `${option.eventId.toString()}:${option.shift}`;
                    return (
                      <SelectItem key={key} value={key}>
                        {shiftOptionLabel(option, t)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="groups.toolbar.copy_cancel_button"
              onClick={() => {
                setSourceKey(null);
                setCopyOpen(false);
              }}
            >
              {t("groups.board.cancel")}
            </Button>
            <Button
              type="button"
              className="touch-target"
              data-ocid="groups.toolbar.copy_confirm_button"
              disabled={!selectedSource || pending}
              onClick={() => {
                if (selectedSource) {
                  onCopy(selectedSource);
                  setSourceKey(null);
                  setCopyOpen(false);
                }
              }}
            >
              {t("groups.board.copyConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent
          data-ocid="groups.toolbar.clear_dialog"
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>{t("groups.board.clearTitle")}</DialogTitle>
            <DialogDescription>{t("groups.board.clearBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="groups.toolbar.clear_cancel_button"
              onClick={() => setClearOpen(false)}
            >
              {t("groups.board.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="touch-target"
              data-ocid="groups.toolbar.clear_confirm_button"
              disabled={pending}
              onClick={() => {
                onClear();
                setClearOpen(false);
              }}
            >
              {t("groups.board.clearConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
