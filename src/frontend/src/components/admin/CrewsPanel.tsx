import {
  type Crew,
  type LeaderSummary,
  type Roadie,
  RoadieStatus,
  Role,
} from "@/backend";
import { AdminSection, FormField } from "@/components/admin/FormField";
import { fill } from "@/components/admin/copy";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
import {
  type CardEntry,
  FullProfileLink,
  RoadieCardModal,
} from "@/components/roadie/RoadieCardModal";
import { RoadieTile } from "@/components/roadie/RoadieTile";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/hooks/useI18n";
import {
  useCreateCrew,
  useCrews,
  useDeleteCrew,
  useLeaders,
  usePositions,
  useRoadies,
  useUpdateCrew,
} from "@/hooks/useQueries";
import { refToDataUrl, staffDisplayName } from "@/lib/format";
import type { Principal } from "@icp-sdk/core/principal";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Roles whose holders may lead a crew. The backend accepts any principal, but
 * the picker only offers approved leaders so a crew is never led by a roadie or
 * an unapproved account.
 */
const LEADER_ROLES: Role[] = [
  Role.admin,
  Role.storeManager,
  Role.trainingManager,
  Role.visitingManager,
];

/** A leader's initials for the no-photo placeholder, at most two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** The preferred or first name used to suggest a crew name. */
function leaderFirstName(leader: LeaderSummary): string {
  const profile = leader.staffProfile;
  const preferred = profile?.preferredName?.trim();
  if (preferred) return preferred;
  const full = profile?.fullName?.trim();
  if (full) return full.split(/\s+/)[0];
  return "";
}

/** The suggested crew name for a leader, e.g. "Jordan's Crew". */
function suggestedCrewName(leader: LeaderSummary): string {
  const first = leaderFirstName(leader);
  return first ? `${first}'s Crew` : "";
}

/** A leader's photo, resolved from their staff profile with an initials fallback. */
function LeaderAvatar({ leader }: { leader: LeaderSummary }) {
  const { t } = useI18n();
  const name = staffDisplayName(leader.staffProfile, t("profile.unnamed"));
  const photoUrl = useMemo(
    () => refToDataUrl(leader.staffProfile?.photo),
    [leader.staffProfile?.photo],
  );

  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-muted"
      data-ocid="admin.crews.leader.photo"
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={t("admin.crews.photoAlt")}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          aria-hidden="true"
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}

/** One crew row: leader identity, member count, member tiles, and actions. */
function CrewRow({
  crew,
  leader,
  members,
  positionNames,
  expanded,
  onToggle,
  onOpenMember,
  onEdit,
  onDelete,
}: {
  crew: Crew;
  leader: LeaderSummary | undefined;
  members: Roadie[];
  positionNames: Map<string, string>;
  expanded: boolean;
  onToggle: () => void;
  onOpenMember: (index: number) => void;
  onEdit: (crew: Crew) => void;
  onDelete: (crew: Crew) => void;
}) {
  const { t } = useI18n();
  const c = useAdminCopy();
  const leaderName = leader
    ? staffDisplayName(leader.staffProfile, t("profile.unnamed"))
    : t("admin.crews.noLeader");
  const memberCount = members.length;
  const memberLabel =
    memberCount === 0
      ? t("admin.crews.members.none")
      : memberCount === 1
        ? t("admin.crews.members.one")
        : t("admin.crews.members", { count: memberCount });

  return (
    <li
      data-ocid="admin.crews.item"
      className="flex flex-col gap-3 rounded-md border border-border bg-background p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {leader ? (
            <LeaderAvatar leader={leader} />
          ) : (
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <Users className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold uppercase tracking-wide">
              {crew.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {leaderName}
            </p>
            <p
              className="mt-0.5 text-xs text-muted-foreground"
              data-ocid="admin.crews.member_count"
            >
              {memberLabel}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="admin.crews.edit_button"
            onClick={() => onEdit(crew)}
          >
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            {c.actionEdit}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="touch-target text-destructive"
            data-ocid="admin.crews.delete_button"
            onClick={() => onDelete(crew)}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {c.actionDelete}
          </Button>
        </div>
      </div>

      {memberCount > 0 && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            className="touch-target w-full justify-between"
            aria-expanded={expanded}
            data-ocid="admin.crews.members.toggle"
            onClick={onToggle}
          >
            <span className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {memberLabel}
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          {expanded && (
            <ul
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              data-ocid="admin.crews.members.list"
            >
              {members.map((roadie, index) => (
                <RoadieTile
                  key={roadie.id.toString()}
                  roadie={roadie}
                  positionName={
                    positionNames.get(roadie.mainPositionId.toString()) ??
                    t("roadie.field.none")
                  }
                  onOpen={() => onOpenMember(index)}
                  ocid="admin.crews.members.item"
                  statusOcid="admin.crews.members.item.status"
                  photoOcid="admin.crews.members.item.photo"
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

interface CrewDraft {
  /** The crew being edited, or null while adding a new crew. */
  id: bigint | null;
  name: string;
  leaderPrincipal: string;
}

export function CrewsPanel() {
  const { t } = useI18n();
  const c = useAdminCopy();
  const crews = useCrews();
  const leaders = useLeaders(true);
  const roadies = useRoadies();
  const positions = usePositions();
  const create = useCreateCrew();
  const update = useUpdateCrew();
  const remove = useDeleteCrew();

  const [draft, setDraft] = useState<CrewDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Crew | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expandedCrew, setExpandedCrew] = useState<string | null>(null);
  const [card, setCard] = useState<{ crewId: string; index: number } | null>(
    null,
  );

  const isEditing = draft !== null && draft.id !== null;
  // Creating a crew with a leader runs createCrew then updateCrew, so the
  // dialog's pending and error state must cover both mutations.
  const isSaving = create.isPending || update.isPending;
  const saveFailed = create.isError || update.isError;

  /** Approved leaders eligible to lead a crew, keyed by principal text. */
  const leaderByPrincipal = useMemo(() => {
    const map = new Map<string, LeaderSummary>();
    for (const leader of leaders.data ?? []) {
      if (LEADER_ROLES.includes(leader.role)) {
        map.set(leader.principal.toString(), leader);
      }
    }
    return map;
  }, [leaders.data]);

  const eligibleLeaders = useMemo(
    () => Array.from(leaderByPrincipal.values()),
    [leaderByPrincipal],
  );

  /** Active roadies per crew id, in list order, for the member tiles. */
  const membersByCrew = useMemo(() => {
    const map = new Map<string, Roadie[]>();
    for (const roadie of roadies.data ?? []) {
      if (roadie.crewId === undefined) continue;
      if (roadie.status === RoadieStatus.archived) continue;
      const key = roadie.crewId.toString();
      const list = map.get(key);
      if (list) list.push(roadie);
      else map.set(key, [roadie]);
    }
    return map;
  }, [roadies.data]);

  /** Position names by id, so a member tile can show the roadie's position. */
  const positionNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const position of positions.data ?? []) {
      map.set(position.id.toString(), position.name);
    }
    return map;
  }, [positions.data]);

  const cardEntries: CardEntry[] = useMemo(() => {
    if (!card) return [];
    return (membersByCrew.get(card.crewId) ?? []).map((roadie) => ({
      key: roadie.id.toString(),
      roadie,
    }));
  }, [card, membersByCrew]);

  const set = <K extends keyof CrewDraft>(key: K, value: CrewDraft[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const openAdd = () => {
    setDraft({ id: null, name: "", leaderPrincipal: "" });
  };

  const openEdit = (crew: Crew) => {
    setDraft({
      id: crew.id,
      name: crew.name,
      leaderPrincipal: crew.leaderPrincipal?.toString() ?? "",
    });
  };

  /** Selecting a leader suggests a crew name while the name is still empty. */
  const chooseLeader = (principalText: string) => {
    setDraft((current) => {
      if (!current) return current;
      const leader = leaderByPrincipal.get(principalText);
      const suggested = leader ? suggestedCrewName(leader) : "";
      const keepName = current.name.trim() !== "";
      return {
        ...current,
        leaderPrincipal: principalText,
        name: keepName ? current.name : suggested,
      };
    });
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !draft.name.trim()) return;
    const name = draft.name.trim();
    const leaderPrincipal: Principal | null = draft.leaderPrincipal
      ? (leaderByPrincipal.get(draft.leaderPrincipal)?.principal ?? null)
      : null;
    if (draft.id !== null) {
      update.mutate(
        { id: draft.id, name, leaderPrincipal },
        { onSuccess: () => setDraft(null) },
      );
      return;
    }
    // createCrew only takes a name, so a chosen leader is persisted with a
    // follow-up updateCrew on the id the create returns.
    void create
      .mutateAsync(name)
      .then((id) =>
        leaderPrincipal
          ? update.mutateAsync({ id, name, leaderPrincipal })
          : undefined,
      )
      .then(() => setDraft(null))
      .catch(() => {
        // Errors surface through the mutation state below; keep the draft so
        // the user can retry.
      });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    remove.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: () => setDeleteError(t("admin.crews.deleteBlocked")),
    });
  };

  return (
    <AdminSection
      title={t("admin.section.crews")}
      description={t("admin.crews.description")}
      ocid="admin.crews.section"
      action={
        <Button
          type="button"
          className="touch-target"
          data-ocid="admin.crews.add_button"
          onClick={openAdd}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("admin.crews.add")}
        </Button>
      }
    >
      {crews.isLoading && (
        <p className="text-sm text-muted-foreground">
          {t("admin.crews.loading")}
        </p>
      )}
      {crews.isError && (
        <p className="text-sm text-destructive">{t("admin.crews.error")}</p>
      )}
      {!crews.isLoading &&
        !crews.isError &&
        (crews.data?.length ?? 0) === 0 && (
          <p
            className="text-sm text-muted-foreground"
            data-ocid="admin.crews.empty_state"
          >
            {t("admin.crews.empty")}
          </p>
        )}

      {(crews.data?.length ?? 0) > 0 && (
        <ul className="space-y-2" data-ocid="admin.crews.list">
          {crews.data?.map((crew) => (
            <CrewRow
              key={crew.id.toString()}
              crew={crew}
              leader={
                crew.leaderPrincipal
                  ? leaderByPrincipal.get(crew.leaderPrincipal.toString())
                  : undefined
              }
              members={membersByCrew.get(crew.id.toString()) ?? []}
              positionNames={positionNames}
              expanded={expandedCrew === crew.id.toString()}
              onToggle={() =>
                setExpandedCrew((current) =>
                  current === crew.id.toString() ? null : crew.id.toString(),
                )
              }
              onOpenMember={(index) =>
                setCard({ crewId: crew.id.toString(), index })
              }
              onEdit={openEdit}
              onDelete={(target) => {
                setDeleteError(null);
                setDeleteTarget(target);
              }}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? t("admin.crews.editTitle")
                : t("admin.crews.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.crews.formDescription")}
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField label={t("admin.crews.leader")} htmlFor="crew-leader">
                <Select
                  value={draft.leaderPrincipal || "none"}
                  onValueChange={(value) =>
                    chooseLeader(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger
                    id="crew-leader"
                    data-ocid="admin.crews.leader.select"
                    className="touch-target"
                  >
                    <SelectValue
                      placeholder={t("admin.crews.leader.noneOption")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("admin.crews.leader.noneOption")}
                    </SelectItem>
                    {eligibleLeaders.map((leader) => (
                      <SelectItem
                        key={leader.principal.toString()}
                        value={leader.principal.toString()}
                      >
                        {staffDisplayName(
                          leader.staffProfile,
                          t("profile.unnamed"),
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                label={t("admin.crews.name")}
                htmlFor="crew-name"
                hint={t("admin.crews.formDescription")}
              >
                <Input
                  id="crew-name"
                  data-ocid="admin.crews.name.input"
                  className="touch-target"
                  value={draft.name}
                  onChange={(event) => set("name", event.target.value)}
                />
              </FormField>

              {saveFailed && (
                <p
                  className="text-sm font-medium text-destructive"
                  data-ocid="admin.crews.error_state"
                >
                  {t("admin.crews.saveError")}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="touch-target"
                  data-ocid="admin.crews.cancel_button"
                  onClick={() => setDraft(null)}
                >
                  {c.actionCancel}
                </Button>
                <Button
                  type="submit"
                  className="touch-target"
                  data-ocid="admin.crews.save_button"
                  disabled={isSaving || !draft.name.trim()}
                >
                  {isSaving && (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {t("admin.crews.save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.crews.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {fill(t("admin.crews.deleteBody"), {
                name: deleteTarget?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p
              className="text-sm font-medium text-destructive"
              role="alert"
              data-ocid="admin.crews.delete_error_state"
            >
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="admin.crews.delete_cancel_button"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError(null);
              }}
            >
              {c.actionCancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="touch-target"
              data-ocid="admin.crews.delete_confirm_button"
              disabled={remove.isPending}
              onClick={confirmDelete}
            >
              {remove.isPending && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {c.actionDelete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RoadieCardModal
        entries={cardEntries}
        index={card?.index ?? 0}
        open={card !== null}
        onOpenChange={(next) => {
          if (!next) setCard(null);
        }}
        onIndexChange={(index) =>
          setCard((current) => (current ? { ...current, index } : current))
        }
        renderFullProfile={(entry) => <FullProfileLink entry={entry} />}
      />
    </AdminSection>
  );
}
