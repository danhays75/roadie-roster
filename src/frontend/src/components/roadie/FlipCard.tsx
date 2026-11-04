import {
  type Crew,
  type LeaderSummary,
  type Position,
  type Roadie,
  RoadieStatus,
  Role,
  RosterState,
} from "@/backend";
import { hatSizeLabel } from "@/components/kiosk/copy";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";
import { useRoadiePhoto, useStoreInfo, useStoreLogo } from "@/hooks/useQueries";
import {
  formatDateOnly,
  formatDateOnlyMonthDay,
  formatTimestampDateOnly,
  refToDataUrl,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import "./roadieCard.css";

/** The roadie's initials for the no-photo placeholder, at most two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * The inline SVG store seal that replaces the uploaded logo in the card's top
 * banner. A red disc with a cream ring carries the store number and three white
 * stars, matching the reference card. The store number is the accessible name,
 * so assistive tech reads the seal as the store number rather than as an image.
 */
function StoreSeal({
  storeNumber,
  label,
}: {
  storeNumber: string;
  label: string;
}) {
  return (
    <svg className="seal" viewBox="0 0 100 100" role="img" aria-label={label}>
      <path
        d="M50.0,2.0 L55.8,5.9 L62.4,3.6 L67.0,8.9 L74.0,8.4 L77.1,14.7 L83.9,16.1 L85.3,22.9 L91.6,26.0 L91.1,33.0 L96.4,37.6 L94.1,44.2 L98.0,50.0 L94.1,55.8 L96.4,62.4 L91.1,67.0 L91.6,74.0 L85.3,77.1 L83.9,83.9 L77.1,85.3 L74.0,91.6 L67.0,91.1 L62.4,96.4 L55.8,94.1 L50.0,98.0 L44.2,94.1 L37.6,96.4 L33.0,91.1 L26.0,91.6 L22.9,85.3 L16.1,83.9 L14.7,77.1 L8.4,74.0 L8.9,67.0 L3.6,62.4 L5.9,55.8 L2.0,50.0 L5.9,44.2 L3.6,37.6 L8.9,33.0 L8.4,26.0 L14.7,22.9 L16.1,16.1 L22.9,14.7 L26.0,8.4 L33.0,8.9 L37.6,3.6 L44.2,5.9Z"
        fill="#B22234"
      />
      <circle cx="50" cy="50" r="38" fill="#9E1C2C" />
      <circle
        cx="50"
        cy="50"
        r="36.5"
        fill="none"
        stroke="#C9A45C"
        strokeWidth="1"
        strokeDasharray="1.5 2"
        opacity=".7"
      />
      <text x="50" y="27" textAnchor="middle" fontSize="12" fill="#C9A45C">
        ★ ★ ★
      </text>
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fontFamily='"Archivo Black", sans-serif'
        fontSize="27"
        fill="#F4EFE3"
      >
        {storeNumber}
      </text>
      <text x="50" y="80" textAnchor="middle" fontSize="12" fill="#C9A45C">
        ★ ★ ★
      </text>
    </svg>
  );
}

/**
 * The front-face top-banner badge. An uploaded secondary logo wins, then the
 * uploaded main logo, and only when neither exists does the drawn bottle-cap
 * store seal stand in. The uploaded logos keep their own aspect ratio; the
 * bottle-cap is square.
 */
function StoreBadge({ storeNumber }: { storeNumber: string }) {
  const { t } = useI18n();
  const { data: logos } = useStoreLogo();
  const secondaryUrl = useMemo(
    () => refToDataUrl(logos?.secondaryLogo),
    [logos?.secondaryLogo],
  );
  const mainUrl = useMemo(() => refToDataUrl(logos?.logo), [logos?.logo]);

  if (secondaryUrl) {
    return (
      <img
        src={secondaryUrl}
        alt="Store secondary logo"
        data-ocid="store.logo.secondary"
        className="h-full w-auto max-w-full object-contain"
      />
    );
  }
  if (mainUrl) {
    return (
      <img
        src={mainUrl}
        alt="Store logo"
        data-ocid="store.logo"
        className="h-full w-auto max-w-full object-contain"
      />
    );
  }
  return <StoreSeal storeNumber={storeNumber} label={t("roadie.card.badge")} />;
}

/**
 * One ROADIE STATS bar. A bar with a known value fills proportionally; a bar
 * with no data yet shows the "Coming soon" label instead of an empty track.
 */
function StatBar({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const { t } = useI18n();
  return (
    <div className="stat">
      <span>{label}</span>
      {value === null ? (
        <span className="text-[3.4cqw] normal-case">
          {t("roadie.card.comingSoon")}
        </span>
      ) : (
        <span className="bar">
          <i style={{ width: `${Math.round(value * 100)}%` }} />
        </span>
      )}
    </div>
  );
}

/**
 * The sixteen scattered stars on the front face, positioned per the spec: a
 * three-and-three top row, three down each side, and two in each bottom corner.
 */
const STARS: {
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
  size?: string;
}[] = [
  // Top row: left 3% / 12% / 21%, right 3% / 12% / 21%, all at top 2.5%.
  { left: "3%", top: "2.5%" },
  { left: "12%", top: "2.5%", size: "4cqw" },
  { left: "21%", top: "2.5%" },
  { right: "3%", top: "2.5%" },
  { right: "12%", top: "2.5%", size: "4cqw" },
  { right: "21%", top: "2.5%" },
  // Left and right sides at top 30% / 38% / 46%.
  { left: "1.5%", top: "30%", size: "3.6cqw" },
  { left: "1.5%", top: "38%", size: "3.6cqw" },
  { left: "1.5%", top: "46%", size: "3.6cqw" },
  { right: "1.5%", top: "30%", size: "3.6cqw" },
  { right: "1.5%", top: "38%", size: "3.6cqw" },
  { right: "1.5%", top: "46%", size: "3.6cqw" },
  // Bottom corners: 3% and 11% on each side at bottom 2.5%.
  { left: "3%", bottom: "2.5%", size: "4.6cqw" },
  { left: "11%", bottom: "2.5%", size: "3.6cqw" },
  { right: "3%", bottom: "2.5%", size: "4.6cqw" },
  { right: "11%", bottom: "2.5%", size: "3.6cqw" },
];

/** One row of the back-face profile table. */
function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** The tier ribbon label and variant class for a leader role. */
function leaderTier(role: Role): { variant: string; labelKey: string } {
  switch (role) {
    case Role.trainer:
      return { variant: "gold", labelKey: "roadie.card.tier.gold" };
    case Role.trainingManager:
      return { variant: "plat", labelKey: "roadie.card.tier.plat.training" };
    case Role.visitingManager:
      return { variant: "plat", labelKey: "roadie.card.tier.plat.visiting" };
    case Role.leadership:
      return {
        variant: "legend",
        labelKey: "roadie.card.tier.legend.leadership",
      };
    case Role.storeManager:
      return { variant: "plat", labelKey: "roadie.card.tier.plat" };
    default:
      return { variant: "legend", labelKey: "roadie.card.tier.legend" };
  }
}

/** The plate font size for a name, shrinking long names without truncation. */
function plateFontSize(name: string): string | undefined {
  if (name.length > 18) return "6.2cqw";
  if (name.length > 14) return "7.5cqw";
  return undefined;
}

/**
 * The collectible trading card. It renders a roadie or a leader on the same
 * front and back faces, flip, store seal and stars. The front shows the TLC
 * banner, the inline store seal, the tier ribbon, the shield photo window, the
 * nameplate, the position/title pills and the footer. The back shows the
 * two-line name with a headshot, the About Me table (every non-empty field plus
 * the home store and, for a trainer, the travel dates), the MY GOAL ticket and
 * the footer.
 *
 * The card never renders the contact set: phone, email and date of birth are
 * deliberately absent. The Minor badge comes from the roadie's non-sensitive
 * `isMinor` field.
 */
export function FlipCard({
  roadie,
  leader,
  position,
  secondPosition,
  crossTrainedPosition,
  crew,
  trainerPositions,
}: {
  roadie?: Roadie;
  leader?: LeaderSummary;
  position?: Position;
  secondPosition?: Position;
  crossTrainedPosition?: Position;
  crew?: Crew;
  trainerPositions?: Position[];
}) {
  const { t } = useI18n();
  const [flipped, setFlipped] = useState(false);
  const { data: storeInfo } = useStoreInfo();
  const { data: photo } = useRoadiePhoto(roadie?.id);

  // A leader has no roadie id, so their photo comes from the staff profile
  // instead of the roadie photo query. Both faces share the resolved data URL.
  const leaderPhotoUrl = useMemo(
    () => refToDataUrl(leader?.staffProfile?.photo),
    [leader?.staffProfile?.photo],
  );
  const photoUrl = useMemo(
    () => (leader ? leaderPhotoUrl : refToDataUrl(photo)),
    [leader, leaderPhotoUrl, photo],
  );

  const isLeader = !!leader;
  const leaderProfile = leader?.staffProfile;
  const roadieProfile = roadie?.profile;
  const name = isLeader
    ? leaderProfile?.preferredName?.trim() ||
      leaderProfile?.fullName?.trim() ||
      ""
    : roadieProfile?.preferredName?.trim() || roadieProfile?.name?.trim() || "";
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? name;
  const lastName = nameParts.slice(1).join(" ");
  const initials = initialsOf(name);
  const isMinor = roadie?.isMinor ?? false;

  // The About Me answers shared by both profile shapes.
  const about = isLeader ? leaderProfile : roadieProfile;
  const homeStoreNumber = leaderProfile?.homeStoreNumber ?? "";
  const homeStoreCity = leaderProfile?.homeStoreCity ?? "";

  const storeCity = storeInfo?.locationName;
  const storeNumber = storeInfo?.storeNumber;
  // The opening date is a date-only value (a calendar day), so it is formatted
  // in UTC and never shifts with the device or store time zone.
  const openingDate =
    storeInfo?.openingDate !== undefined
      ? formatDateOnly(storeInfo.openingDate)
      : null;

  // The hire date is the roadie's own hireDate, falling back to the record's
  // hiredAt so the footer is never blank. It is a date-only value, so it is
  // formatted as its UTC calendar day rather than in the store time zone.
  const hireTimestamp = roadie?.hireDate ?? roadie?.hiredAt;
  const hireDate =
    hireTimestamp !== undefined ? formatTimestampDateOnly(hireTimestamp) : null;

  const isTrainer = leader?.role === Role.trainer;
  const tier = leader
    ? leaderTier(leader.role)
    : { variant: "roadie", labelKey: "roadie.card.tier.roadie" };

  // The front main pill: a leader's title, or the roadie's main position.
  const mainPill = isLeader
    ? leader?.title || t("roadie.field.none")
    : (position?.name ?? t("roadie.field.none"));

  // Trainers list the stations they train in a small pill, joined by " · ".
  const stationNames = (trainerPositions ?? [])
    .map((station) => station.name)
    .filter(Boolean);
  const stationsPill = isTrainer ? stationNames.join(" · ") : "";

  // The roadie's second pill: a cross-trained or second position.
  const secondPill = crossTrainedPosition ?? secondPosition;

  // The front footer: a trainer's travel range, or the opening-team line.
  const arrival = leader?.arrivalDate
    ? formatDateOnlyMonthDay(leader.arrivalDate)
    : null;
  const departure = leader?.departureDate
    ? formatDateOnlyMonthDay(leader.departureDate)
    : null;
  const trainerFooter =
    isTrainer && (arrival || departure)
      ? `${t("roadie.card.from")} #${homeStoreNumber} ${homeStoreCity} ★ ${
          arrival ?? "—"
        } – ${departure ?? "—"}`
      : null;
  const openingTeamFooter = `${t("roadie.card.openingTeam")} ★ ${
    storeNumber ? `#${storeNumber} ` : ""
  }${storeCity ?? t("roadie.field.none")}`;

  // A leader keeps the new footers; a roadie keeps the original front
  // "Roadie since" line and the back opening-crew line with the opening date.
  const leaderFooter = trainerFooter ?? openingTeamFooter;
  const roadieBackFooter = `${storeNumber ? `#${storeNumber} ` : ""}${t(
    "roadie.card.openingCrew",
  ).toUpperCase()}${openingDate ? ` · ${openingDate.toUpperCase()}` : ""}`;

  // ROADIE STATS: a roadie's orientation bar fills once they are checked in
  // (rosterState active), the certified bar fills once their status is
  // certified, and the training bar has no data source yet so it always shows
  // "Coming soon". A leader has no roadie stats, so the section is roadie-only.
  const orientationProgress =
    roadie?.rosterState === RosterState.active ? 1 : null;
  const certifiedProgress =
    roadie?.status === RoadieStatus.certified ? 1 : null;
  const trainingProgress: number | null = null;

  const profileRows = [
    { label: t("roadie.field.hometown"), value: about?.hometown },
    { label: t("roadie.field.crew"), value: crew?.name },
    { label: t("roadie.field.dayOff"), value: about?.hobbies },
    { label: t("roadie.field.favoriteTeam"), value: about?.favoriteTeam },
    { label: t("roadie.field.favoriteSnack"), value: about?.favoriteSnack },
    {
      label: t("roadie.field.favoriteMovie"),
      value: roadieProfile?.favoriteMovie,
    },
    { label: t("roadie.field.favoriteDrink"), value: about?.favoriteDrink },
    { label: t("roadie.field.favoriteColor"), value: about?.favoriteColor },
    { label: t("roadie.field.funFact"), value: about?.funFact },
    {
      label: t("roadie.field.shirtSize"),
      value: about?.shirtSize,
    },
    {
      label: t("roadie.field.hatSize"),
      value: about?.hatSize
        ? hatSizeLabel(about.hatSize, t, {
            "One size": "profile.hat.oneSize",
            "S/M": "profile.hat.sm",
            "L/XL": "profile.hat.lxl",
          })
        : undefined,
    },
    { label: t("roadie.field.hiredAt"), value: hireDate },
  ].filter((row) => !!row.value);

  const toggle = () => setFlipped((value) => !value);

  return (
    <div className="space-y-3" data-ocid="roadie.flip_card">
      <button
        type="button"
        className={cn("rc", tier.variant, flipped && "flipped")}
        tabIndex={0}
        aria-label={
          flipped ? t("roadie.action.flipBack") : t("roadie.action.showBack")
        }
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <div className="rc-inner">
          {/* FRONT */}
          <div className="rc-face" aria-hidden={flipped}>
            <div className="frame">
              <div className="f-top">
                <div className="wordmark">{t("roadie.card.tlc")}</div>
                <div className="cap">
                  <StoreBadge storeNumber={storeNumber ?? ""} />
                </div>
              </div>

              <div className="f-stage">
                <span className={cn("tier", tier.variant)}>
                  {t(tier.labelKey)}
                </span>

                <div className="stars" aria-hidden="true">
                  {STARS.map((star, index) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative star set
                      key={index}
                      style={{
                        left: star.left,
                        right: star.right,
                        top: star.top,
                        bottom: star.bottom,
                        fontSize: star.size,
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>

                {isMinor && (
                  <span className="tag minor" data-ocid="roadie.minor_badge">
                    MINOR
                  </span>
                )}

                {isMinor && roadie?.birthdayMonthDay && (
                  <span
                    className="tag birthday"
                    data-ocid="roadie.birthday_badge"
                    aria-label={t("roadie.card.birthdayBadge")}
                  >
                    {roadie.birthdayMonthDay}
                  </span>
                )}

                <div className="shield">
                  <div className="cream" />
                  <div
                    className="ph"
                    data-ocid="roadie.card.photo"
                    style={
                      photoUrl
                        ? { backgroundImage: `url(${photoUrl})` }
                        : undefined
                    }
                  >
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-[16cqw] text-[#f4efe3]"
                        style={{ fontFamily: '"Archivo Black", sans-serif' }}
                      >
                        {initials}
                      </span>
                    )}
                  </div>
                </div>

                <div className="plate">
                  <b
                    style={
                      plateFontSize(name)
                        ? { fontSize: plateFontSize(name) }
                        : undefined
                    }
                  >
                    {name}
                  </b>
                </div>

                <div className="pills">
                  <span className="pill">{mainPill}</span>
                  {stationsPill && (
                    <span className="pill sm">{stationsPill}</span>
                  )}
                  {!isLeader && secondPill && (
                    <span className="pill sm">{secondPill.name}</span>
                  )}
                </div>
              </div>

              <div className="f-foot">
                {isLeader ? (
                  <span>{leaderFooter}</span>
                ) : (
                  <>
                    <span>
                      {t("roadie.card.roadieSince")} {hireDate}
                    </span>
                    <span className="star">★</span>
                    <span>{storeCity ?? t("roadie.field.none")}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="rc-face rc-back" aria-hidden={!flipped}>
            <div className="frame">
              <div className="b-top">
                <h2 className="b-name">
                  {firstName}
                  {lastName ? (
                    <>
                      <br />
                      {lastName}
                    </>
                  ) : null}
                </h2>
                <div
                  className="b-head"
                  data-ocid="roadie.card.headshot"
                  style={
                    photoUrl
                      ? { backgroundImage: `url(${photoUrl})` }
                      : undefined
                  }
                />
              </div>

              <div className="b-body">
                {profileRows.length > 0 && (
                  <div className={cn("tbl", profileRows.length > 7 && "dense")}>
                    {profileRows.map((row) => (
                      <ProfileRow
                        key={row.label}
                        label={row.label}
                        value={row.value ?? ""}
                      />
                    ))}
                  </div>
                )}

                {isLeader && (
                  <div className="tbl">
                    <ProfileRow
                      label={t("roadie.card.homeStore")}
                      value={`#${homeStoreNumber} ${homeStoreCity}`.trim()}
                    />
                    {isTrainer && (arrival || departure) && (
                      <ProfileRow
                        label={t("roadie.card.here")}
                        value={`${arrival ?? "—"} – ${departure ?? "—"}`}
                      />
                    )}
                  </div>
                )}

                {!isLeader && (
                  <div className="stats">
                    <h3 className="h">{t("roadie.card.stats")}</h3>
                    <StatBar
                      label={t("roadie.card.stat.orientation")}
                      value={orientationProgress}
                    />
                    <StatBar
                      label={t("roadie.card.stat.training")}
                      value={trainingProgress}
                    />
                    <StatBar
                      label={t("roadie.card.stat.certified")}
                      value={certifiedProgress}
                    />
                  </div>
                )}

                {about?.goalHere && (
                  <div className="quote">
                    <small>{t("roadie.card.goal")}</small>
                    &ldquo;{about.goalHere}&rdquo;
                  </div>
                )}
              </div>

              <div className="b-foot">
                <span>{isLeader ? leaderFooter : roadieBackFooter}</span>
              </div>
            </div>
          </div>
        </div>
      </button>

      <Button
        type="button"
        variant="outline"
        className="touch-target mx-auto flex w-full max-w-[420px]"
        data-ocid="roadie.flip_button"
        aria-pressed={flipped}
        onClick={toggle}
      >
        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
        {flipped ? t("roadie.action.flipBack") : t("roadie.action.flip")}
      </Button>
    </div>
  );
}
