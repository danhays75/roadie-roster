import type {
  ArchiveReason,
  Crew,
  Position,
  Roadie,
  RoadieProfile,
} from "@/backend";
import { RoadieStatus } from "@/backend";
import {
  ARCHIVE_REASONS,
  type ArchiveReasonValue,
  REHIRE_WARN_REASONS,
  archiveReasonLabel,
} from "@/components/roadie/constants";
import {
  useArchiveRoadie,
  useChangePosition,
  useRehireRoadie,
  useUpdateRoadieDetails,
} from "@/components/roadie/useRoadieActions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/hooks/useI18n";
import { Pencil, RefreshCw, Shuffle, UserMinus } from "lucide-react";
import { useState } from "react";

const NONE = "__none__";

function Feedback({
  state,
  success,
  error,
  ocid,
}: {
  state: "idle" | "success" | "error";
  success: string;
  error: string;
  ocid: string;
}) {
  if (state === "success") {
    return (
      <output
        data-ocid={`${ocid}.success_state`}
        className="text-sm text-accent"
      >
        {success}
      </output>
    );
  }
  if (state === "error") {
    return (
      <span
        role="alert"
        data-ocid={`${ocid}.error_state`}
        className="text-sm text-destructive"
      >
        {error}
      </span>
    );
  }
  return null;
}

/** Edit a roadie's non-contact profile details. */
function EditDetailsDialog({
  roadie,
  open,
  onOpenChange,
}: {
  roadie: Roadie;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const update = useUpdateRoadieDetails();
  const [draft, setDraft] = useState<RoadieProfile>(roadie.profile);

  const set = <K extends keyof RoadieProfile>(
    key: K,
    value: RoadieProfile[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const textFields: { key: keyof RoadieProfile; labelKey: string }[] = [
    { key: "name", labelKey: "roadie.field.preferredName" },
    { key: "preferredName", labelKey: "roadie.field.preferredName" },
    { key: "hometown", labelKey: "roadie.field.hometown" },
    { key: "hobbies", labelKey: "roadie.field.hobbies" },
    { key: "favoriteMovie", labelKey: "roadie.field.favoriteMovie" },
    { key: "favoriteSnack", labelKey: "roadie.field.favoriteSnack" },
    { key: "funFact", labelKey: "roadie.field.funFact" },
    { key: "goalHere", labelKey: "roadie.field.goalHere" },
    { key: "shirtSize", labelKey: "roadie.field.shirtSize" },
    { key: "hatSize", labelKey: "roadie.field.hatSize" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto"
        data-ocid="roadie.edit.dialog"
      >
        <DialogHeader>
          <DialogTitle>{t("roadie.edit.title")}</DialogTitle>
          <DialogDescription>{t("roadie.edit.description")}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate({ id: roadie.id, profile: draft });
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {textFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`edit-${field.key}`}>{t(field.labelKey)}</Label>
                <Input
                  id={`edit-${field.key}`}
                  value={(draft[field.key] as string | undefined) ?? ""}
                  onChange={(event) => set(field.key, event.target.value)}
                  data-ocid={`roadie.edit.${field.key}_input`}
                  className="touch-target"
                />
              </div>
            ))}
          </div>

          <DialogFooter className="items-center gap-3">
            <Feedback
              state={
                update.isSuccess ? "success" : update.isError ? "error" : "idle"
              }
              success={t("roadie.edit.saved")}
              error={t("roadie.edit.error")}
              ocid="roadie.edit"
            />
            <Button
              type="submit"
              className="touch-target"
              disabled={update.isPending}
              data-ocid="roadie.edit.save_button"
            >
              {t("roadie.edit.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Change a roadie's main position, second position or crew. */
function ChangePositionDialog({
  roadie,
  positions,
  crews,
  open,
  onOpenChange,
}: {
  roadie: Roadie;
  positions: Position[];
  crews: Crew[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const change = useChangePosition();
  const [mainPositionId, setMainPositionId] = useState(
    roadie.mainPositionId.toString(),
  );
  const [secondPositionId, setSecondPositionId] = useState(
    roadie.secondPositionId?.toString() ?? NONE,
  );
  const [crewId, setCrewId] = useState(roadie.crewId?.toString() ?? NONE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ocid="roadie.change_position.dialog">
        <DialogHeader>
          <DialogTitle>{t("roadie.changePosition.title")}</DialogTitle>
          <DialogDescription>
            {t("roadie.changePosition.description")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            change.mutate({
              id: roadie.id,
              mainPositionId: BigInt(mainPositionId),
              secondPositionId:
                secondPositionId === NONE ? null : BigInt(secondPositionId),
              crewId: crewId === NONE ? null : BigInt(crewId),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="change-main">
              {t("roadie.changePosition.main")}
            </Label>
            <Select value={mainPositionId} onValueChange={setMainPositionId}>
              <SelectTrigger
                id="change-main"
                className="touch-target w-full"
                data-ocid="roadie.change_position.main_select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {positions.map((position) => (
                  <SelectItem
                    key={position.id.toString()}
                    value={position.id.toString()}
                  >
                    {position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="change-second">
              {t("roadie.changePosition.second")}
            </Label>
            <Select
              value={secondPositionId}
              onValueChange={setSecondPositionId}
            >
              <SelectTrigger
                id="change-second"
                className="touch-target w-full"
                data-ocid="roadie.change_position.second_select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("common.none")}</SelectItem>
                {positions.map((position) => (
                  <SelectItem
                    key={position.id.toString()}
                    value={position.id.toString()}
                  >
                    {position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="change-crew">
              {t("roadie.changePosition.crew")}
            </Label>
            <Select value={crewId} onValueChange={setCrewId}>
              <SelectTrigger
                id="change-crew"
                className="touch-target w-full"
                data-ocid="roadie.change_position.crew_select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("common.none")}</SelectItem>
                {crews.map((crew) => (
                  <SelectItem
                    key={crew.id.toString()}
                    value={crew.id.toString()}
                  >
                    {crew.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="items-center gap-3">
            <Feedback
              state={
                change.isSuccess ? "success" : change.isError ? "error" : "idle"
              }
              success={t("roadie.changePosition.saved")}
              error={t("roadie.changePosition.error")}
              ocid="roadie.change_position"
            />
            <Button
              type="submit"
              className="touch-target"
              disabled={change.isPending}
              data-ocid="roadie.change_position.save_button"
            >
              {t("roadie.changePosition.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Archive a roadie with a required reason. */
function ArchiveDialog({
  roadie,
  open,
  onOpenChange,
}: {
  roadie: Roadie;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const archive = useArchiveRoadie();
  const [reason, setReason] = useState<ArchiveReasonValue | "">("");
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!reason) {
      setError(t("roadie.archive.reason.required"));
      return;
    }
    if (reason === "other" && other.trim() === "") {
      setError(t("roadie.archive.other.required"));
      return;
    }
    setError(null);
    const payload: ArchiveReason =
      reason === "other"
        ? { __kind__: "other", other: other.trim() }
        : reason === "noShow"
          ? { __kind__: "noShow", noShow: null }
          : reason === "quitDuringTraining"
            ? { __kind__: "quitDuringTraining", quitDuringTraining: null }
            : reason === "tookAnotherJob"
              ? { __kind__: "tookAnotherJob", tookAnotherJob: null }
              : { __kind__: "letGo", letGo: null };
    archive.mutate({ id: roadie.id, reason: payload });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ocid="roadie.archive.dialog">
        <DialogHeader>
          <DialogTitle>{t("roadie.archive.title")}</DialogTitle>
          <DialogDescription>
            {t("roadie.archive.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="archive-reason">{t("roadie.archive.reason")}</Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as ArchiveReasonValue)}
            >
              <SelectTrigger
                id="archive-reason"
                className="touch-target w-full"
                data-ocid="roadie.archive.reason_select"
              >
                <SelectValue placeholder={t("roadie.archive.reason")} />
              </SelectTrigger>
              <SelectContent>
                {ARCHIVE_REASONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === "other" && (
            <div className="space-y-1.5">
              <Label htmlFor="archive-other">{t("roadie.archive.other")}</Label>
              <Textarea
                id="archive-other"
                value={other}
                onChange={(event) => setOther(event.target.value)}
                data-ocid="roadie.archive.other_input"
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              data-ocid="roadie.archive.validation_error"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="items-center gap-3">
          <Feedback
            state={
              archive.isSuccess ? "success" : archive.isError ? "error" : "idle"
            }
            success={t("roadie.archive.saved")}
            error={t("roadie.archive.error")}
            ocid="roadie.archive"
          />
          <Button
            type="button"
            variant="destructive"
            className="touch-target"
            disabled={archive.isPending}
            data-ocid="roadie.archive.confirm_button"
            onClick={submit}
          >
            {t("roadie.archive.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Rehire an archived roadie; warns and requires a reason for no-show/let-go. */
function RehireDialog({
  roadie,
  open,
  onOpenChange,
}: {
  roadie: Roadie;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const rehire = useRehireRoadie();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const archivedReason = roadie.archivedReason?.__kind__;
  const needsReason =
    archivedReason !== undefined &&
    REHIRE_WARN_REASONS.includes(archivedReason as ArchiveReasonValue);

  const submit = () => {
    if (needsReason && reason.trim() === "") {
      setError(t("roadie.rehire.reason.required"));
      return;
    }
    setError(null);
    rehire.mutate({
      id: roadie.id,
      reason: reason.trim() === "" ? null : reason.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ocid="roadie.rehire.dialog">
        <DialogHeader>
          <DialogTitle>{t("roadie.rehire.title")}</DialogTitle>
          <DialogDescription>
            {t("roadie.rehire.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {needsReason && (
            <p
              data-ocid="roadie.rehire.warning"
              className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm text-foreground"
            >
              {t("roadie.rehire.warn", {
                reason: archiveReasonLabel(
                  archivedReason as ArchiveReasonValue,
                  t,
                ),
              })}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rehire-reason">{t("roadie.rehire.reason")}</Label>
            <Textarea
              id="rehire-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              data-ocid="roadie.rehire.reason_input"
            />
          </div>

          {error && (
            <p
              role="alert"
              data-ocid="roadie.rehire.validation_error"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="items-center gap-3">
          <Feedback
            state={
              rehire.isSuccess ? "success" : rehire.isError ? "error" : "idle"
            }
            success={t("roadie.rehire.saved")}
            error={t("roadie.rehire.error")}
            ocid="roadie.rehire"
          />
          <Button
            type="button"
            className="touch-target"
            disabled={rehire.isPending}
            data-ocid="roadie.rehire.confirm_button"
            onClick={submit}
          >
            {t("roadie.rehire.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The roadie card action bar. Edit and change-position are shown only to roles
 * that may use them; archive and rehire are Store Manager/Admin only.
 */
export function RoadieActions({
  roadie,
  positions,
  crews,
  canEdit,
  canArchive,
}: {
  roadie: Roadie;
  positions: Position[];
  crews: Crew[];
  canEdit: boolean;
  canArchive: boolean;
}) {
  const { t } = useI18n();
  const [editOpen, setEditOpen] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rehireOpen, setRehireOpen] = useState(false);

  const archived = roadie.status === RoadieStatus.archived;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-ocid="roadie.actions.panel"
    >
      {canEdit && (
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          data-ocid="roadie.edit_button"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("roadie.action.edit")}
        </Button>
      )}

      {canEdit && (
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          data-ocid="roadie.change_position_button"
          onClick={() => setPositionOpen(true)}
        >
          <Shuffle className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("roadie.action.changePosition")}
        </Button>
      )}

      {canArchive && !archived && (
        <Button
          type="button"
          variant="destructive"
          className="touch-target"
          data-ocid="roadie.archive_button"
          onClick={() => setArchiveOpen(true)}
        >
          <UserMinus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("roadie.action.archive")}
        </Button>
      )}

      {canArchive && archived && (
        <Button
          type="button"
          className="touch-target"
          data-ocid="roadie.rehire_button"
          onClick={() => setRehireOpen(true)}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("roadie.action.rehire")}
        </Button>
      )}

      {canEdit && (
        <EditDetailsDialog
          roadie={roadie}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {canEdit && (
        <ChangePositionDialog
          roadie={roadie}
          positions={positions}
          crews={crews}
          open={positionOpen}
          onOpenChange={setPositionOpen}
        />
      )}
      <ArchiveDialog
        roadie={roadie}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />
      <RehireDialog
        roadie={roadie}
        open={rehireOpen}
        onOpenChange={setRehireOpen}
      />
    </div>
  );
}
