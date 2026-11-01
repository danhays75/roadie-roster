import { Role } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { FlipCard } from "@/components/roadie/FlipCard";
import { ManagerTab } from "@/components/roadie/ManagerTab";
import { RoadieActions } from "@/components/roadie/RoadieActions";
import { useIsMinor } from "@/components/roadie/useRoadieActions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canArchive, useAccessState } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import { useCrews, usePositions, useRoadie } from "@/hooks/useQueries";
import { roadieStatusLabel } from "@/lib/format";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/** Roles allowed to see the manager-only tab. */
const MANAGER_ROLES: Role[] = [Role.admin, Role.storeManager];

export default function RoadieCardPage() {
  const { t } = useI18n();
  const { roadieId } = useParams({ from: "/roster/$roadieId" });
  const id = roadieId ? BigInt(roadieId) : undefined;
  const { data: roadie, isLoading, isError, refetch } = useRoadie(id);
  const { data: positions } = usePositions();
  const { data: crews } = useCrews();
  const { data: isMinor } = useIsMinor(id);
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : undefined;

  const isManager = role !== undefined && MANAGER_ROLES.includes(role);
  const mayArchive = canArchive(role);

  const positionList = positions ?? [];
  const positionById = (positionId: bigint | undefined) =>
    positionId === undefined
      ? undefined
      : positionList.find((position) => position.id === positionId);

  return (
    <div className="space-y-6" data-ocid="roadie.page">
      <Button
        asChild
        variant="ghost"
        className="touch-target -ml-2"
        data-ocid="roadie.back_button"
      >
        <Link to="/roster">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("roadie.back")}
        </Link>
      </Button>

      {isLoading && <LoadingState label={t("roadie.loading")} />}
      {isError && (
        <ErrorState
          message={t("roadie.error")}
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && !roadie && (
        <EmptyState title={t("roadie.notFound")} />
      )}

      {roadie && (
        <>
          <PageHeader
            title={roadie.profile.preferredName || roadie.profile.name}
            subtitle={positionById(roadie.mainPositionId)?.name}
            action={
              <StatusBadge tone="hired" ocid="roadie.status">
                {roadieStatusLabel(roadie.status)}
              </StatusBadge>
            }
          />

          <RoadieActions
            roadie={roadie}
            positions={positionList}
            crews={crews ?? []}
            canArchive={mayArchive}
          />

          <Tabs defaultValue="card" data-ocid="roadie.tabs">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
              <TabsTrigger
                value="card"
                className="touch-target"
                data-ocid="roadie.card.tab"
              >
                {t("roadie.section.card")}
              </TabsTrigger>
              {isManager && (
                <TabsTrigger
                  value="manager"
                  className="touch-target"
                  data-ocid="roadie.manager.tab"
                >
                  {t("roadie.section.manager")}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="card" className="mt-4">
              <FlipCard
                roadie={roadie}
                position={positionById(roadie.mainPositionId)}
                secondPosition={positionById(roadie.secondPositionId)}
                crossTrainedPosition={positionById(
                  roadie.crossTrainedPositionId,
                )}
                crew={
                  roadie.crewId === undefined
                    ? undefined
                    : crews?.find((crew) => crew.id === roadie.crewId)
                }
                isMinor={isMinor ?? false}
              />
            </TabsContent>

            {isManager && (
              <TabsContent value="manager" className="mt-4">
                <ManagerTab roadie={roadie} />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}
