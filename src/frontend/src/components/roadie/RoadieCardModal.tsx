import type { Crew, LeaderSummary, Position, Roadie } from "@/backend";
import { useDashboardCopy } from "@/components/dashboard/copy";
import { FlipCard } from "@/components/roadie/FlipCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCrews, usePositions, useRoadiePhoto } from "@/hooks/useQueries";
import { staffDisplayName } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";

/** One card in the pop-up: a roadie or a leader, keyed by a stable id. */
export interface CardEntry {
  key: string;
  roadie?: Roadie;
  leader?: LeaderSummary;
}

/** The query-param key that records an open card in the URL. */
const CARD_PARAM = "card";

/**
 * Push a history entry carrying `?card=<key>` when the pop-up opens, and pop it
 * when the pop-up closes, so the phone's back button closes the modal and
 * returns the user exactly where they were. The listener is registered once and
 * reports a back-navigation through `onBack`.
 */
function useCardHistory(open: boolean, key: string | null, onBack: () => void) {
  const pushed = useRef(false);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePop = () => {
      if (pushed.current) {
        pushed.current = false;
        onBackRef.current();
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (open && key && !pushed.current) {
      const url = new URL(window.location.href);
      url.searchParams.set(CARD_PARAM, key);
      window.history.pushState({ [CARD_PARAM]: key }, "", url);
      pushed.current = true;
    }
  }, [open, key]);

  // Close through the UI: close immediately, then step back over our own entry
  // so the history stays clean. The popstate handler ignores this step because
  // `pushed.current` is already false, so the back button still works.
  const close = useCallback(() => {
    if (typeof window === "undefined") {
      onBackRef.current();
      return;
    }
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      const url = new URL(window.location.href);
      if (url.searchParams.has(CARD_PARAM)) {
        url.searchParams.delete(CARD_PARAM);
        window.history.replaceState({}, "", url);
      }
    }
    onBackRef.current();
  }, []);

  return close;
}

/** Preload a roadie's photo so a neighbour renders instantly on swipe. */
function usePreloadRoadiePhoto(roadie: Roadie | undefined) {
  useRoadiePhoto(roadie?.id);
}

/**
 * The manager-only "Open full profile" link for a card entry. A roadie links to
 * their card page (with Edit, Manager tab and Archive); a leader links to their
 * leader card page.
 */
export function FullProfileLink({ entry }: { entry: CardEntry }) {
  const { t } = useDashboardCopy();
  const label = (
    <>
      <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
      {t("roadie.card.modal.fullProfile")}
    </>
  );
  if (entry.roadie) {
    return (
      <Button asChild variant="ghost" className="touch-target w-full">
        <Link to="/roster/$roadieId" params={{ roadieId: entry.key }}>
          {label}
        </Link>
      </Button>
    );
  }
  if (entry.leader) {
    return (
      <Button asChild variant="ghost" className="touch-target w-full">
        <Link to="/leaders/$leaderId" params={{ leaderId: entry.key }}>
          {label}
        </Link>
      </Button>
    );
  }
  return null;
}

/**
 * The shared card pop-up. It opens over the current screen with a dimmed
 * background and shows the existing FlipCard centered at a max width of 420px.
 * Tapping the card or the Flip button flips it. It closes with the X button, a
 * tap outside, Esc, or the phone's back button. Swipe left/right, the left and
 * right arrow keys and the prev/next buttons move through the same list without
 * closing, a "3 of 12" counter shows the current position, and the neighbouring
 * roadies' photos are preloaded. Managers see an "Open full profile" link under
 * the card; everyone else sees just the card. The card never shows contact
 * information.
 */
export function RoadieCardModal({
  entries,
  index,
  open,
  onOpenChange,
  onIndexChange,
  renderFullProfile,
}: {
  entries: CardEntry[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
  /**
   * Renders the manager-only "Open full profile" link for the current entry.
   * Omitted for viewers who may not open a full profile, so they see just the
   * card.
   */
  renderFullProfile?: (entry: CardEntry) => ReactNode;
}) {
  const { t } = useDashboardCopy();
  const { data: positions } = usePositions();
  const { data: crews } = useCrews();

  const current = entries[index];
  const total = entries.length;
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  const close = useCardHistory(open, current?.key ?? null, () =>
    onOpenChange(false),
  );

  // Preload the neighbours so a swipe or arrow key shows the next photo at once.
  usePreloadRoadiePhoto(entries[index - 1]?.roadie);
  usePreloadRoadiePhoto(entries[index + 1]?.roadie);

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);
  const goNext = useCallback(() => {
    if (index < total - 1) onIndexChange(index + 1);
  }, [index, total, onIndexChange]);

  // Left/right arrow keys move through the list without closing.
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goPrev, goNext]);

  // Swipe left/right on the card moves to the next/previous entry.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  const positionById = useMemo(() => {
    const map = new Map<string, Position>();
    for (const position of positions ?? []) {
      map.set(position.id.toString(), position);
    }
    return map;
  }, [positions]);

  const crewById = useMemo(() => {
    const map = new Map<string, Crew>();
    for (const crew of crews ?? []) {
      map.set(crew.id.toString(), crew);
    }
    return map;
  }, [crews]);

  const roadie = current?.roadie;
  const leader = current?.leader;
  const title = roadie
    ? roadie.profile.preferredName || roadie.profile.name
    : leader
      ? staffDisplayName(leader.staffProfile, t("profile.unnamed"))
      : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        data-ocid="roadie.card_modal"
        showCloseButton={false}
        className="max-h-[92dvh] w-[calc(100vw-2rem)] max-w-[420px] overflow-y-auto p-4"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("roadie.card.modal.description")}
        </DialogDescription>

        <div className="flex items-center justify-between gap-2">
          <span
            className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            data-ocid="roadie.card_modal.counter"
          >
            {t("roadie.card.modal.counter", { index: index + 1, total })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="touch-target"
            aria-label={t("common.close")}
            data-ocid="roadie.card_modal.close_button"
            onClick={close}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        <div
          className="mt-2"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {roadie && (
            <FlipCard
              roadie={roadie}
              position={positionById.get(roadie.mainPositionId.toString())}
              secondPosition={
                roadie.secondPositionId === undefined
                  ? undefined
                  : positionById.get(roadie.secondPositionId.toString())
              }
              crossTrainedPosition={
                roadie.crossTrainedPositionId === undefined
                  ? undefined
                  : positionById.get(roadie.crossTrainedPositionId.toString())
              }
              crew={
                roadie.crewId === undefined
                  ? undefined
                  : crewById.get(roadie.crewId.toString())
              }
            />
          )}
          {leader && <FlipCard leader={leader} />}
        </div>

        {total > 1 && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="roadie.card_modal.prev_button"
              disabled={!hasPrev}
              onClick={goPrev}
            >
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              {t("roadie.card.modal.prev")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="roadie.card_modal.next_button"
              disabled={!hasNext}
              onClick={goNext}
            >
              {t("roadie.card.modal.next")}
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}

        {current && renderFullProfile && (
          <div className="mt-2" data-ocid="roadie.card_modal.full_profile_link">
            {renderFullProfile(current)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
