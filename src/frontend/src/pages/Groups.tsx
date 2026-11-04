import type {
  EventId,
  GroupChangeNotice,
  LeaderSummary,
  Roadie,
  Shift,
  ShiftBoardRoadie,
  ShiftBoardView,
} from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { AddTrainerDialog } from "@/components/groups/AddTrainerDialog";
import { BoardToolbar } from "@/components/groups/BoardToolbar";
import { GroupChangeNoticeCard } from "@/components/groups/GroupChangeNoticeCard";
import {
  type MoveDestination,
  type MoveShiftTarget,
  MoveToDialog,
  type MoveTrainerTarget,
} from "@/components/groups/MoveToDialog";
import { type PhoneGroup, PhoneList } from "@/components/groups/PhoneList";
import { ShiftPicker } from "@/components/groups/ShiftPicker";
import { TrainerColumn } from "@/components/groups/TrainerColumn";
import { type StationOption, Tray } from "@/components/groups/Tray";
import { WarningsBanner } from "@/components/groups/WarningsBanner";
import { useGroupsCopy } from "@/components/groups/copy";
import {
  type ShiftOption,
  buildShiftOptions,
  defaultShiftOption,
  effectiveNow,
  shiftOptionKey,
  shiftOptionLabel,
} from "@/components/groups/shiftOptions";
import { useBoardEditor } from "@/components/groups/useBoardEditor";
import {
  type CardEntry,
  FullProfileLink,
  RoadieCardModal,
} from "@/components/roadie/RoadieCardModal";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { canEditGroups, useAccessState } from "@/hooks/useAccess";
import { useDemo } from "@/hooks/useDemo";
import {
  useAutoFillShiftBoard,
  useClearShiftBoard,
  useCopyShiftBoard,
  useGroupChangeNotices,
  useLeaders,
  usePositions,
  useRoadies,
  useSchedule,
  useShiftBoard,
  useStoreInfo,
} from "@/hooks/useQueries";
import { staffDisplayName } from "@/lib/format";
import { useMemo, useState } from "react";

/** The board breakpoint: at or above this width the drag-and-drop board shows. */
const BOARD_BREAKPOINT = 900;

/** A roadie chip's roadie id as a string, for selection state. */
function chipKey(roadie: ShiftBoardRoadie): string {
  return roadie.roadieId.toString();
}

export default function GroupsPage() {
  const { t } = useGroupsCopy();
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : undefined;
  const canView = !!role;
  const editable = canEditGroups(role);
  const isMobile = useIsMobile(BOARD_BREAKPOINT);
  const demo = useDemo();

  const schedule = useSchedule();
  const storeInfo = useStoreInfo();
  const positions = usePositions();
  const roadies = useRoadies();
  const leaders = useLeaders(canView);
  const notices = useGroupChangeNotices();

  const shiftOptions = useMemo(
    () => buildShiftOptions(schedule.data ?? []),
    [schedule.data],
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedOption = useMemo<ShiftOption | undefined>(() => {
    if (selectedKey) {
      const found = shiftOptions.find(
        (option) => shiftOptionKey(option) === selectedKey,
      );
      if (found) return found;
    }
    return defaultShiftOption(shiftOptions, effectiveNow(demo.pretendDate));
  }, [selectedKey, shiftOptions, demo.pretendDate]);

  const eventId: EventId | undefined = selectedOption?.eventId;
  const shift: Shift | undefined = selectedOption?.shift;

  const board = useShiftBoard(eventId, shift, canView);
  const editor = useBoardEditor(board.data ?? null, eventId, shift);

  const copyBoard = useCopyShiftBoard();
  const autoFill = useAutoFillShiftBoard();
  const clearBoard = useClearShiftBoard();

  const [selectedRoadieId, setSelectedRoadieId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [addTrainerOpen, setAddTrainerOpen] = useState(false);
  const [stationFilter, setStationFilter] = useState("all");
  const [card, setCard] = useState<{
    entries: CardEntry[];
    index: number;
  } | null>(null);

  const positionById = useMemo(() => {
    const map = new Map<string, { name: string; code: string }>();
    for (const position of positions.data ?? []) {
      map.set(position.id.toString(), {
        name: position.name,
        code: position.code,
      });
    }
    return map;
  }, [positions.data]);

  const leaderByPrincipal = useMemo(() => {
    const map = new Map<string, LeaderSummary>();
    for (const leader of leaders.data ?? []) {
      map.set(leader.principal.toString(), leader);
    }
    return map;
  }, [leaders.data]);

  const roadieById = useMemo(() => {
    const map = new Map<string, Roadie>();
    for (const roadie of roadies.data ?? []) {
      map.set(roadie.id.toString(), roadie);
    }
    return map;
  }, [roadies.data]);

  const stationOptions = useMemo<StationOption[]>(
    () =>
      (positions.data ?? []).map((position) => ({
        id: position.id,
        name: position.name,
      })),
    [positions.data],
  );

  const view: ShiftBoardView | null = board.data ?? null;
  const editableBoard = editor.board;

  // The roadie chips for the card pop-up, in board order.
  const allChips = useMemo<ShiftBoardRoadie[]>(() => {
    if (!view) return [];
    return [
      ...view.groups.flatMap((group) => group.roadies),
      ...view.offThisShift,
      ...view.unassigned,
    ];
  }, [view]);

  const openCard = (chip: ShiftBoardRoadie) => {
    const entries: CardEntry[] = [];
    for (const candidate of allChips) {
      const roadie = roadieById.get(candidate.roadieId.toString());
      if (roadie) entries.push({ key: candidate.roadieId.toString(), roadie });
    }
    const index = entries.findIndex((entry) => entry.key === chipKey(chip));
    setCard({ entries, index: index >= 0 ? index : 0 });
  };

  const toggleSelect = (chip: ShiftBoardRoadie) => {
    setSelectedRoadieId((current) =>
      current === chipKey(chip) ? null : chipKey(chip),
    );
  };

  const moveTo = (roadieId: bigint, destination: MoveDestination) => {
    if (destination.kind === "trainer") {
      editor.moveRoadie(roadieId, {
        kind: "group",
        trainerPrincipalText: destination.principalText,
      });
    } else if (destination.kind === "off") {
      editor.moveRoadie(roadieId, { kind: "off" });
    } else {
      // The same day's other shift: removing the roadie from this board's
      // groups and Off list returns them to the other shift's Unassigned pool,
      // because Unassigned is every active roadie not placed on that board.
      editor.moveRoadie(roadieId, { kind: "unassigned" });
    }
    setSelectedRoadieId(null);
    setMoveOpen(false);
  };

  const moveTrainerTargets = useMemo<MoveTrainerTarget[]>(() => {
    if (!editableBoard) return [];
    return editableBoard.groups.map((group) => {
      const leader = leaderByPrincipal.get(group.trainerPrincipalText);
      return {
        principalText: group.trainerPrincipalText,
        name: leader
          ? staffDisplayName(
              leader.staffProfile,
              t("groups.board.unnamedTrainer"),
            )
          : t("groups.board.unnamedTrainer"),
      };
    });
  }, [editableBoard, leaderByPrincipal, t]);

  const otherShiftTargets = useMemo<MoveShiftTarget[]>(() => {
    if (!selectedOption) return [];
    return shiftOptions
      .filter(
        (option) =>
          option.eventId === selectedOption.eventId &&
          option.shift !== selectedOption.shift,
      )
      .map((option) => ({
        key: shiftOptionKey(option),
        label: shiftOptionLabel(option, t),
      }));
  }, [shiftOptions, selectedOption, t]);

  const selectedChip = useMemo<ShiftBoardRoadie | null>(() => {
    if (!selectedRoadieId) return null;
    return allChips.find((chip) => chipKey(chip) === selectedRoadieId) ?? null;
  }, [allChips, selectedRoadieId]);

  const existingPrincipals = useMemo(
    () =>
      new Set(
        (editableBoard?.groups ?? []).map(
          (group) => group.trainerPrincipalText,
        ),
      ),
    [editableBoard],
  );

  const shiftDate = useMemo(() => {
    if (!selectedOption) return undefined;
    const event = (schedule.data ?? []).find(
      (candidate) => candidate.id === selectedOption.eventId,
    );
    return event?.start;
  }, [schedule.data, selectedOption]);

  // Warnings: unassigned active roadies, trainers over capacity, roadies
  // scheduled while unavailable.
  const warnings = useMemo(() => {
    if (!editableBoard) {
      return { unassigned: 0, overCapacity: 0, unavailable: 0 };
    }
    const unassigned = editableBoard.unassigned.length;
    const overCapacity = editableBoard.groups.filter(
      (group) => group.roadieIds.length > group.capacity,
    ).length;
    const unavailable = allChips.filter(
      (chip) => chip.markedUnavailable,
    ).length;
    return { unassigned, overCapacity, unavailable };
  }, [editableBoard, allChips]);

  const phoneGroups = useMemo<PhoneGroup[]>(() => {
    if (!editableBoard) return [];
    const groups: PhoneGroup[] = editableBoard.groups.map((group) => {
      const leader = leaderByPrincipal.get(group.trainerPrincipalText);
      const name = leader
        ? staffDisplayName(
            leader.staffProfile,
            t("groups.board.unnamedTrainer"),
          )
        : t("groups.board.unnamedTrainer");
      const stations = (leader?.trainerPositionIds ?? [])
        .map((id) => positionById.get(id.toString())?.name)
        .filter((value): value is string => !!value);
      return {
        key: group.trainerPrincipalText,
        title: name,
        subtitle:
          stations.length > 0
            ? stations.join(", ")
            : t("groups.board.noStations"),
        roadies: group.roadieIds
          .map((id) => allChips.find((chip) => chip.roadieId === id))
          .filter((chip): chip is ShiftBoardRoadie => !!chip),
      };
    });
    groups.push({
      key: "unassigned",
      title: t("groups.board.phoneUnassigned"),
      roadies: editableBoard.unassigned,
    });
    groups.push({
      key: "off",
      title: t("groups.board.phoneOff"),
      roadies: editableBoard.offRoadieIds
        .map((id) => allChips.find((chip) => chip.roadieId === id))
        .filter((chip): chip is ShiftBoardRoadie => !!chip),
    });
    return groups;
  }, [editableBoard, leaderByPrincipal, positionById, allChips, t]);

  const isLoading = schedule.isLoading || board.isLoading;
  const isError = schedule.isError || board.isError;

  const noticeList: GroupChangeNotice[] = notices.data ?? [];

  return (
    <div className="space-y-6" data-ocid="groups.page">
      <PageHeader title={t("groups.title")} subtitle={t("groups.subtitle")} />

      {noticeList.map((notice) => (
        <GroupChangeNoticeCard
          key={notice.id.toString()}
          notice={notice}
          timeZone={storeInfo.data?.timeZone}
        />
      ))}

      <ShiftPicker
        options={shiftOptions}
        selected={selectedOption}
        onSelect={(option) => {
          setSelectedKey(shiftOptionKey(option));
          setSelectedRoadieId(null);
        }}
      />

      {!editable && canView && (
        <p
          data-ocid="groups.read_only"
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
        >
          {t("groups.readOnly")}
        </p>
      )}

      {isLoading && <LoadingState label={t("groups.loading")} />}
      {isError && (
        <ErrorState
          message={t("groups.error")}
          onRetry={() => {
            void schedule.refetch();
            void board.refetch();
          }}
        />
      )}

      {!isLoading && !isError && !view && (
        <EmptyState title={t("groups.empty")} />
      )}

      {!isLoading && !isError && view && editableBoard && (
        <>
          <WarningsBanner
            unassignedCount={warnings.unassigned}
            overCapacityCount={warnings.overCapacity}
            unavailableCount={warnings.unavailable}
          />

          {editable && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <BoardToolbar
                sourceOptions={shiftOptions.filter(
                  (option) =>
                    !selectedOption ||
                    shiftOptionKey(option) !== shiftOptionKey(selectedOption),
                )}
                onCopy={(source) => {
                  if (eventId === undefined || shift === undefined) return;
                  copyBoard.mutate({
                    eventId,
                    shift,
                    fromEventId: source.eventId,
                    fromShift: source.shift,
                  });
                }}
                onAutoFill={() => {
                  if (eventId === undefined || shift === undefined) return;
                  autoFill.mutate({ eventId, shift });
                }}
                onClear={() => {
                  if (eventId === undefined || shift === undefined) return;
                  clearBoard.mutate({ eventId, shift });
                }}
                pending={
                  copyBoard.isPending ||
                  autoFill.isPending ||
                  clearBoard.isPending
                }
                error={
                  copyBoard.isError || autoFill.isError || clearBoard.isError
                }
              />

              <div className="flex items-center gap-2">
                {editor.dirty && (
                  <span
                    data-ocid="groups.board.unsaved"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("groups.board.unsaved")}
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="touch-target"
                  data-ocid="groups.board.discard_button"
                  disabled={!editor.dirty || editor.isSaving}
                  onClick={editor.discard}
                >
                  {t("groups.board.discardButton")}
                </Button>
                <Button
                  type="button"
                  className="touch-target"
                  data-ocid="groups.board.save_button"
                  disabled={!editor.dirty || editor.isSaving}
                  onClick={() => editor.saveBoard()}
                >
                  {editor.isSaving
                    ? t("groups.board.saving")
                    : t("groups.board.saveButton")}
                </Button>
              </div>
            </div>
          )}

          {editor.saveError && (
            <p
              role="alert"
              data-ocid="groups.board.save_error_state"
              className="text-sm font-medium text-destructive"
            >
              {t("groups.board.saveError")}
            </p>
          )}

          {isMobile ? (
            <PhoneList
              groups={phoneGroups}
              editable={editable}
              selectedId={selectedRoadieId}
              onOpenCard={openCard}
              onToggleSelect={toggleSelect}
              onMoveSelected={() => setMoveOpen(true)}
              ocid="groups.phone"
            />
          ) : (
            <div
              data-ocid="groups.board"
              className="flex gap-4 overflow-x-auto pb-4"
            >
              {editableBoard.groups.map((group) => {
                const leader = leaderByPrincipal.get(
                  group.trainerPrincipalText,
                );
                const stationNames = (leader?.trainerPositionIds ?? [])
                  .map((id) => positionById.get(id.toString())?.name)
                  .filter((value): value is string => !!value);
                const chips = group.roadieIds
                  .map((id) => allChips.find((chip) => chip.roadieId === id))
                  .filter((chip): chip is ShiftBoardRoadie => !!chip);
                return (
                  <TrainerColumn
                    key={group.trainerPrincipalText}
                    roadies={chips}
                    capacity={group.capacity}
                    leader={leader}
                    stationNames={stationNames}
                    editable={editable}
                    selectedId={selectedRoadieId}
                    onOpenCard={openCard}
                    onToggleSelect={toggleSelect}
                    onDropRoadie={(roadieId) =>
                      editor.moveRoadie(roadieId, {
                        kind: "group",
                        trainerPrincipalText: group.trainerPrincipalText,
                      })
                    }
                    onDragStart={(chip) => setDraggingId(chipKey(chip))}
                    onDragEnd={() => setDraggingId(null)}
                    onCapacityChange={(capacity) =>
                      editor.setCapacity(
                        group.trainerPrincipalText,
                        Number(capacity),
                      )
                    }
                    onRemoveTrainer={() =>
                      editor.removeTrainer(group.trainerPrincipalText)
                    }
                    ocid={`groups.board.trainer.${group.trainerPrincipalText}`}
                  />
                );
              })}

              <Tray
                title={t("groups.board.unassigned")}
                hint={t("groups.board.unassignedHint")}
                roadies={editableBoard.unassigned}
                editable={editable}
                selectedId={selectedRoadieId}
                onOpenCard={openCard}
                onToggleSelect={toggleSelect}
                onDropRoadie={(roadieId) =>
                  editor.moveRoadie(roadieId, { kind: "unassigned" })
                }
                onDragStart={(chip) => setDraggingId(chipKey(chip))}
                onDragEnd={() => setDraggingId(null)}
                stationFilter={stationFilter}
                onStationFilterChange={setStationFilter}
                stationOptions={stationOptions}
                ocid="groups.board.unassigned"
              />

              <Tray
                title={t("groups.board.offThisShift")}
                hint={t("groups.board.offThisShiftHint")}
                roadies={editableBoard.offRoadieIds
                  .map((id) => allChips.find((chip) => chip.roadieId === id))
                  .filter((chip): chip is ShiftBoardRoadie => !!chip)}
                editable={editable}
                selectedId={selectedRoadieId}
                onOpenCard={openCard}
                onToggleSelect={toggleSelect}
                onDropRoadie={(roadieId) =>
                  editor.moveRoadie(roadieId, { kind: "off" })
                }
                onDragStart={(chip) => setDraggingId(chipKey(chip))}
                onDragEnd={() => setDraggingId(null)}
                ocid="groups.board.off"
              />
            </div>
          )}

          {editable && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="touch-target"
                data-ocid="groups.board.add_trainer_button"
                onClick={() => setAddTrainerOpen(true)}
              >
                {t("groups.board.addTrainer")}
              </Button>
              {selectedChip && (
                <Button
                  type="button"
                  className="touch-target"
                  data-ocid="groups.board.move_selected_button"
                  onClick={() => setMoveOpen(true)}
                >
                  {t("groups.roadie.moveTo")}
                </Button>
              )}
              {draggingId && (
                <span className="text-xs text-muted-foreground">
                  {t("groups.board.dragging", {
                    name:
                      allChips.find((chip) => chipKey(chip) === draggingId)
                        ?.name ?? "",
                  })}
                </span>
              )}
            </div>
          )}
        </>
      )}

      <MoveToDialog
        roadie={selectedChip}
        trainers={moveTrainerTargets}
        otherShifts={otherShiftTargets}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        onConfirm={(destination) => {
          if (selectedChip) moveTo(selectedChip.roadieId, destination);
        }}
        pending={false}
        error={false}
      />

      <AddTrainerDialog
        leaders={leaders.data ?? []}
        existingPrincipals={existingPrincipals}
        shiftDate={shiftDate}
        open={addTrainerOpen}
        onOpenChange={setAddTrainerOpen}
        onConfirm={(leader) => {
          editor.addTrainer(
            leader.principal.toString(),
            Number(storeInfo.data?.trainingGroupSize ?? 4n),
          );
          setAddTrainerOpen(false);
        }}
        pending={false}
        error={false}
      />

      <RoadieCardModal
        entries={card?.entries ?? []}
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
    </div>
  );
}
