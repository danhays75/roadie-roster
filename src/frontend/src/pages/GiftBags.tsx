import type {
  GiftBagCategory,
  GiftBagFilter,
  GiftBagGroup,
  GiftBagLabel,
  GiftBagsData,
  PositionId,
} from "@/backend";
import { createActor } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/hooks/useI18n";
import { usePositions } from "@/hooks/useQueries";
import {
  LABEL_FIELDS,
  SHOPPING_CATEGORY_ORDER,
  downloadGiftBags,
  groupForCategory,
  labelValue,
  sortAnswers,
} from "@/lib/giftBags";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";

/** The active filter choice: a house, a group, a position, or everything. */
type FilterChoice = "all" | "foh" | "boh" | "roadies" | "leaders" | "position";

/** The copy key for each shopping-list category. */
const CATEGORY_LABEL_KEY: Record<GiftBagCategory, string> = {
  candySnack: "giftBags.category.candySnack",
  drink: "giftBags.category.drink",
  sportsTeam: "giftBags.category.sportsTeam",
  color: "giftBags.category.color",
  shirtSize: "giftBags.category.shirtSize",
  hatSize: "giftBags.category.hatSize",
};

/** Read the Gift Bags shopping list and labels for the selected filter. */
function useGiftBags(filter: GiftBagFilter) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["giftBags", JSON.stringify(filter)],
    queryFn: async (): Promise<GiftBagsData> => {
      if (!actor) return { groups: [], labels: [] };
      return actor.getGiftBags(filter);
    },
    enabled: !!actor && !isFetching,
  });
}

/** One category's answer-to-count table, sorted highest count first. */
function ShoppingListTable({
  category,
  group,
}: {
  category: GiftBagCategory;
  group: GiftBagGroup | undefined;
}) {
  const { t } = useI18n();
  const rows = group ? sortAnswers(group) : [];
  const noAnswer = group ? Number(group.noAnswer) : 0;

  return (
    <section
      data-ocid={`gift_bags.shopping.${category}`}
      className="rounded-lg border border-border bg-card p-4 shadow-subtle"
    >
      <h3 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
        {t(CATEGORY_LABEL_KEY[category])}
      </h3>
      {rows.length === 0 && noAnswer === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("giftBags.empty")}
        </p>
      ) : (
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-1.5 pr-2 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("giftBags.section.shoppingList")}
              </th>
              <th className="py-1.5 pl-2 text-right font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Count
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.answer}
                data-ocid={`gift_bags.shopping.${category}.row`}
                className="border-b border-border/60 last:border-0"
              >
                <td className="py-1.5 pr-2 text-foreground">{row.answer}</td>
                <td className="py-1.5 pl-2 text-right font-mono tabular-nums text-foreground">
                  {row.count}
                </td>
              </tr>
            ))}
            <tr
              data-ocid={`gift_bags.shopping.${category}.no_answer`}
              className="border-t border-border"
            >
              <td className="py-1.5 pr-2 italic text-muted-foreground">
                {t("giftBags.noAnswer")}
              </td>
              <td className="py-1.5 pl-2 text-right font-mono tabular-nums text-muted-foreground">
                {noAnswer}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

/** One printable Avery 5163 label (2in x 4in). */
function BagLabel({ label }: { label: GiftBagLabel }) {
  return (
    <div
      data-ocid="gift_bags.label.item"
      className="avery-label flex flex-col justify-center"
    >
      <p className="truncate font-display text-[15px] font-bold uppercase leading-tight">
        {label.name}
      </p>
      <p className="truncate text-[11px] uppercase tracking-wide">
        {label.positionName}
      </p>
      <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] leading-snug">
        {LABEL_FIELDS.filter(
          (field) => field.key !== "name" && field.key !== "positionName",
        ).map((field) => (
          <div key={field.key} className="flex min-w-0 gap-1">
            <dt className="shrink-0 font-semibold">{field.header}:</dt>
            <dd className="min-w-0 truncate">
              {labelValue(label, field.key) || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function GiftBagsPage() {
  const { t } = useI18n();
  const positions = usePositions();
  const [choice, setChoice] = useState<FilterChoice>("all");
  const [positionId, setPositionId] = useState<PositionId | undefined>(
    undefined,
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const filter: GiftBagFilter = useMemo(() => {
    if (choice === "foh") return { __kind__: "foh", foh: null };
    if (choice === "boh") return { __kind__: "boh", boh: null };
    if (choice === "roadies") return { __kind__: "roadies", roadies: null };
    if (choice === "leaders") return { __kind__: "leaders", leaders: null };
    if (choice === "position" && positionId !== undefined) {
      return { __kind__: "position", position: positionId };
    }
    return { __kind__: "all", all: null };
  }, [choice, positionId]);

  const giftBags = useGiftBags(filter);
  const data = giftBags.data;
  const labels = data?.labels ?? [];
  const groups = data?.groups ?? [];

  const filterOptions: Array<{ value: FilterChoice; label: string }> = [
    { value: "all", label: t("giftBags.filter.all") },
    { value: "foh", label: t("giftBags.filter.foh") },
    { value: "boh", label: t("giftBags.filter.boh") },
    { value: "roadies", label: t("giftBags.filter.roadies") },
    { value: "leaders", label: t("giftBags.filter.leaders") },
    { value: "position", label: t("giftBags.filter.position") },
  ];

  async function handleDownload() {
    if (!data) return;
    setIsDownloading(true);
    setDownloadError(false);
    try {
      await downloadGiftBags(data, "roadie-gift-bags.xlsx");
    } catch {
      setDownloadError(true);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-6" data-ocid="gift_bags.page">
      <div className="print-hide">
        <PageHeader
          title={t("giftBags.title")}
          subtitle={t("giftBags.subtitle")}
          action={
            <>
              <Button
                type="button"
                variant="outline"
                className="touch-target"
                data-ocid="gift_bags.print_button"
                disabled={labels.length === 0}
                onClick={() => window.print()}
              >
                <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("giftBags.action.print")}
              </Button>
              <Button
                type="button"
                className="touch-target"
                data-ocid="gift_bags.download_button"
                disabled={!data || isDownloading}
                onClick={() => void handleDownload()}
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                {isDownloading
                  ? t("common.loading")
                  : t("giftBags.action.download")}
              </Button>
            </>
          }
        />

        {downloadError && (
          <p
            data-ocid="gift_bags.download_error"
            className="mt-3 text-sm text-destructive"
          >
            {t("giftBags.error")}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-subtle sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="gift-bags-filter">
              {t("giftBags.filter.label")}
            </Label>
            <Select
              value={choice}
              onValueChange={(value) => setChoice(value as FilterChoice)}
            >
              <SelectTrigger
                id="gift-bags-filter"
                data-ocid="gift_bags.filter.select"
                className="touch-target w-full sm:w-56"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    data-ocid={`gift_bags.filter.${option.value}`}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {choice === "position" && (
            <div className="space-y-1.5">
              <Label htmlFor="gift-bags-position">
                {t("giftBags.filter.position")}
              </Label>
              <Select
                value={positionId?.toString() ?? ""}
                onValueChange={(value) => setPositionId(BigInt(value))}
              >
                <SelectTrigger
                  id="gift-bags-position"
                  data-ocid="gift_bags.filter.position_select"
                  className="touch-target w-full sm:w-56"
                >
                  <SelectValue
                    placeholder={t("giftBags.filter.positionPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(positions.data ?? []).map((position) => (
                    <SelectItem
                      key={position.id.toString()}
                      value={position.id.toString()}
                      data-ocid="gift_bags.filter.position_option"
                    >
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {giftBags.isLoading && (
        <LoadingState
          label={t("giftBags.loading")}
          ocid="gift_bags.loading_state"
        />
      )}

      {giftBags.isError && (
        <ErrorState
          message={t("giftBags.error")}
          onRetry={() => void giftBags.refetch()}
          ocid="gift_bags.error_state"
        />
      )}

      {data && (
        <>
          <section
            data-ocid="gift_bags.shopping.section"
            className="space-y-4"
            aria-labelledby="gift-bags-shopping-heading"
          >
            <h2
              id="gift-bags-shopping-heading"
              className="font-display text-xl font-bold uppercase tracking-wide text-foreground"
            >
              {t("giftBags.section.shoppingList")}
            </h2>
            {groups.length === 0 ? (
              <EmptyState
                title={t("giftBags.empty")}
                ocid="gift_bags.shopping.empty_state"
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {SHOPPING_CATEGORY_ORDER.map((category) => (
                  <ShoppingListTable
                    key={category}
                    category={category}
                    group={groupForCategory(groups, category)}
                  />
                ))}
              </div>
            )}
          </section>

          <section
            data-ocid="gift_bags.labels.section"
            className="space-y-4"
            aria-labelledby="gift-bags-labels-heading"
          >
            <h2
              id="gift-bags-labels-heading"
              className="font-display text-xl font-bold uppercase tracking-wide text-foreground print-hide"
            >
              {t("giftBags.section.labels")}
            </h2>
            {labels.length === 0 ? (
              <EmptyState
                title={t("giftBags.labels.empty")}
                ocid="gift_bags.labels.empty_state"
              />
            ) : (
              <div className="print-area overflow-x-auto">
                <div className="avery-sheet">
                  {labels.map((label, index) => (
                    <BagLabel
                      key={`${label.roadieId.toString()}-${label.name}-${label.positionName}-${index}`}
                      label={label}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
