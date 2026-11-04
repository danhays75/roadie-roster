import type {
  EventId,
  RoadieId,
  Shift,
  ShiftBoard,
  ShiftBoardGroup,
  ShiftBoardRoadie,
  ShiftBoardView,
} from "@/backend";
import { useSaveShiftBoard } from "@/hooks/useQueries";
import { Principal } from "@icp-sdk/core/principal";
import { useCallback, useEffect, useMemo, useState } from "react";

/** A group in the editable board state. */
export interface EditableGroup {
  trainerPrincipalText: string;
  capacity: number;
  roadieIds: bigint[];
}

/** The editable board state: groups, the Off list and the Unassigned pool. */
export interface EditableBoard {
  groups: EditableGroup[];
  offRoadieIds: bigint[];
  unassigned: ShiftBoardRoadie[];
}

/** The destination of a move. */
export type MoveTarget =
  | { kind: "group"; trainerPrincipalText: string }
  | { kind: "off" }
  | { kind: "unassigned" };

/** Build the editable board state from a read view. */
function toEditable(view: ShiftBoardView): EditableBoard {
  return {
    groups: view.groups.map((group) => ({
      trainerPrincipalText: group.trainerPrincipal.toString(),
      capacity: Number(group.capacity),
      roadieIds: group.roadies.map((roadie) => roadie.roadieId),
    })),
    offRoadieIds: view.offThisShift.map((roadie) => roadie.roadieId),
    unassigned: view.unassigned,
  };
}

/** A stable signature of the board's placement, for dirty tracking. */
function boardSignature(board: EditableBoard): string {
  const groups = board.groups
    .map(
      (group) =>
        `${group.trainerPrincipalText}:${group.capacity}:${group.roadieIds
          .map((id) => id.toString())
          .join(",")}`,
    )
    .join("|");
  const off = board.offRoadieIds.map((id) => id.toString()).join(",");
  return `${groups}||${off}`;
}

/** Remove a roadie id from every group and the Off list. */
function removeFromAll(board: EditableBoard, roadieId: bigint): EditableBoard {
  return {
    groups: board.groups.map((group) => ({
      ...group,
      roadieIds: group.roadieIds.filter((id) => id !== roadieId),
    })),
    offRoadieIds: board.offRoadieIds.filter((id) => id !== roadieId),
    unassigned: board.unassigned,
  };
}

/** Find a roadie chip by id across the board. */
export function findRoadie(
  view: ShiftBoardView | null,
  roadieId: bigint,
): ShiftBoardRoadie | undefined {
  if (!view) return undefined;
  for (const group of view.groups) {
    const found = group.roadies.find((roadie) => roadie.roadieId === roadieId);
    if (found) return found;
  }
  const off = view.offThisShift.find((roadie) => roadie.roadieId === roadieId);
  if (off) return off;
  return view.unassigned.find((roadie) => roadie.roadieId === roadieId);
}

/**
 * The board editor: holds the local, editable copy of a shift board, applies
 * drag/move operations optimistically, tracks whether it differs from the
 * saved board, and saves through `saveShiftBoard`. The local state resets when
 * the selected shift changes or the saved board is refetched.
 */
export function useBoardEditor(
  view: ShiftBoardView | null,
  eventId: EventId | undefined,
  shift: Shift | undefined,
) {
  const save = useSaveShiftBoard();
  const [board, setBoard] = useState<EditableBoard | null>(null);
  const [savedSignature, setSavedSignature] = useState<string>("");

  // Reset the local board when the shift changes or the saved board arrives.
  useEffect(() => {
    if (!view) {
      setBoard(null);
      setSavedSignature("");
      return;
    }
    const next = toEditable(view);
    setBoard(next);
    setSavedSignature(boardSignature(next));
  }, [view]);

  const dirty = useMemo(
    () => (board ? boardSignature(board) !== savedSignature : false),
    [board, savedSignature],
  );

  /** Move a roadie to a destination, updating the local board. */
  const moveRoadie = useCallback((roadieId: bigint, target: MoveTarget) => {
    setBoard((current) => {
      if (!current) return current;
      const cleared = removeFromAll(current, roadieId);
      if (target.kind === "group") {
        return {
          ...cleared,
          groups: cleared.groups.map((group) =>
            group.trainerPrincipalText === target.trainerPrincipalText
              ? { ...group, roadieIds: [...group.roadieIds, roadieId] }
              : group,
          ),
        };
      }
      if (target.kind === "off") {
        return {
          ...cleared,
          offRoadieIds: [...cleared.offRoadieIds, roadieId],
        };
      }
      // Unassigned: the chip returns to the pool. The pool is rebuilt from the
      // saved view on the next refetch, so it is left as-is here.
      return cleared;
    });
  }, []);

  /** Change one group's capacity. */
  const setCapacity = useCallback(
    (trainerPrincipalText: string, capacity: number) => {
      setBoard((current) =>
        current
          ? {
              ...current,
              groups: current.groups.map((group) =>
                group.trainerPrincipalText === trainerPrincipalText
                  ? { ...group, capacity: Math.max(0, capacity) }
                  : group,
              ),
            }
          : current,
      );
    },
    [],
  );

  /** Add a trainer as a new empty group. */
  const addTrainer = useCallback(
    (trainerPrincipalText: string, capacity: number) => {
      setBoard((current) => {
        if (!current) return current;
        if (
          current.groups.some(
            (group) => group.trainerPrincipalText === trainerPrincipalText,
          )
        ) {
          return current;
        }
        return {
          ...current,
          groups: [
            ...current.groups,
            { trainerPrincipalText, capacity, roadieIds: [] },
          ],
        };
      });
    },
    [],
  );

  /** Remove a trainer's group, returning its roadies to Unassigned. */
  const removeTrainer = useCallback((trainerPrincipalText: string) => {
    setBoard((current) =>
      current
        ? {
            ...current,
            groups: current.groups.filter(
              (group) => group.trainerPrincipalText !== trainerPrincipalText,
            ),
          }
        : current,
    );
  }, []);

  /** Discard local changes back to the saved board. */
  const discard = useCallback(() => {
    if (!view) return;
    const next = toEditable(view);
    setBoard(next);
    setSavedSignature(boardSignature(next));
  }, [view]);

  /** Save the local board through the backend. */
  const saveBoard = useCallback(
    (onSaved?: () => void) => {
      if (!board || eventId === undefined || shift === undefined) return;
      const payload: ShiftBoard = {
        eventId,
        shift,
        groups: board.groups.map(
          (group): ShiftBoardGroup => ({
            trainerPrincipal: principalFromText(group.trainerPrincipalText),
            capacity: BigInt(group.capacity),
            roadieIds: group.roadieIds,
          }),
        ),
        offRoadieIds: board.offRoadieIds,
        editedAt: 0n,
        isDemo: false,
      };
      save.mutate(payload, {
        onSuccess: () => {
          setSavedSignature(boardSignature(board));
          onSaved?.();
        },
      });
    },
    [board, eventId, shift, save],
  );

  return {
    board,
    dirty,
    moveRoadie,
    setCapacity,
    addTrainer,
    removeTrainer,
    discard,
    saveBoard,
    isSaving: save.isPending,
    saveError: save.isError,
  };
}

/**
 * Rebuild a `Principal` from its text form. The generated bindings expose
 * `Principal.fromText`; the board only ever round-trips principals that came
 * from the backend, so this is safe.
 */
function principalFromText(text: string): ShiftBoardGroup["trainerPrincipal"] {
  return Principal.fromText(text);
}

/** A roadie id list as a stable string, for memo keys. */
export function roadieIdsKey(ids: RoadieId[]): string {
  return ids.map((id) => id.toString()).join(",");
}
