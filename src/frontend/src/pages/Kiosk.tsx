import {
  type AvailabilitySlot,
  type ContactSet,
  type RoadieProfile,
  type Shift,
  type Weekday,
  createActor,
} from "@/backend";
import {
  KioskAvailabilityStep,
  slotKey,
} from "@/components/kiosk/KioskAvailabilityStep";
import {
  EMPTY_CONTACT,
  type KioskContact,
  KioskContactStep,
} from "@/components/kiosk/KioskContactStep";
import {
  EMPTY_DETAILS,
  type KioskDetails,
  KioskDetailsStep,
} from "@/components/kiosk/KioskDetailsStep";
import { KioskPhotoStep } from "@/components/kiosk/KioskPhotoStep";
import { KioskProgress } from "@/components/kiosk/KioskProgress";
import { KioskReviewStep } from "@/components/kiosk/KioskReviewStep";
import { KioskSignatureStep } from "@/components/kiosk/KioskSignatureStep";
import { KioskSuccess } from "@/components/kiosk/KioskSuccess";
import { KioskWelcome } from "@/components/kiosk/KioskWelcome";
import { useKioskCopy } from "@/components/kiosk/copy";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";
import { dateToDateOnly, fileToRef } from "@/lib/format";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "welcome" | "form" | "success";

const STEP_KEYS = [
  "step.photo",
  "step.details",
  "step.contact",
  "step.availability",
  "step.signature",
  "step.review",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** A basic phone format: at least 7 digits, optional +, spaces, dashes, parens. */
const PHONE_RE = /^\+?[\d\s().-]{7,}$/;
const MIN_AGE = 14;
const MAX_AGE = 100;
const MAX_SHIFTS = 7;

/** The success screen clears itself after this long. */
const SUCCESS_RESET_MS = 10_000;
/** Any step with no input for this long resets the whole kiosk. */
const IDLE_RESET_MS = 90_000;

/** Whole years between a date of birth and today, in UTC. */
function ageInYears(dateOfBirth: string): number | null {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

/** Build the backend `RoadieProfile` from the collected details. */
function toProfile(details: KioskDetails): RoadieProfile {
  const shifts = Number.parseInt(details.shiftsWantedPerWeek, 10);
  return {
    name: details.name.trim(),
    preferredName: details.preferredName.trim() || undefined,
    hometown: details.hometown.trim() || undefined,
    hobbies: details.hobbies.trim() || undefined,
    favoriteMovie: details.favoriteMovie.trim() || undefined,
    favoriteSnack: details.favoriteSnack.trim() || undefined,
    funFact: details.funFact.trim() || undefined,
    goalHere: details.goalHere.trim() || undefined,
    positionAppliedFor: details.positionAppliedFor.trim() || undefined,
    shirtSize: details.shirtSize || undefined,
    hatSize: details.hatSize || undefined,
    shiftsWantedPerWeek: Number.isNaN(shifts) ? undefined : BigInt(shifts),
    weekdayLunch:
      details.weekdayLunch === "" ? undefined : details.weekdayLunch === "yes",
  };
}

/** Build the backend `ContactSet` from the collected contact + availability. */
function toContactSet(
  contact: KioskContact,
  availability: Set<string>,
  signatureRef: Uint8Array | null,
): ContactSet {
  const slots: AvailabilitySlot[] = [];
  for (const key of availability) {
    const [day, shift] = key.split("-") as [Weekday, Shift];
    slots.push({ day, shift });
  }
  return {
    email: contact.email.trim(),
    phone: contact.phone.trim(),
    dateOfBirth: dateToDateOnly(new Date(`${contact.dateOfBirth}T00:00:00Z`)),
    emergencyContactName: contact.emergencyContactName.trim(),
    emergencyContactPhone: contact.emergencyContactPhone.trim(),
    availability: slots,
    availabilitySignature: signatureRef ?? undefined,
    availabilitySignedAt: signatureRef
      ? BigInt(Date.now()) * 1_000_000n
      : undefined,
    availabilityResignPending: false,
  };
}

/** The kiosk self-service sign-up flow. */
export default function KioskPage() {
  const t = useKioskCopy();
  const { setLocale } = useI18n();
  const { actor } = useActor(createActor);

  const [phase, setPhase] = useState<Phase>("welcome");
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [details, setDetails] = useState<KioskDetails>(EMPTY_DETAILS);
  const [contact, setContact] = useState<KioskContact>(EMPTY_CONTACT);
  const [availability, setAvailability] = useState<Set<string>>(new Set());
  const [signature, setSignature] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetAll = useCallback(() => {
    setPhase("welcome");
    setStep(0);
    setPhoto(null);
    setDetails(EMPTY_DETAILS);
    setContact(EMPTY_CONTACT);
    setAvailability(new Set());
    setSignature(null);
    setErrors({});
    setLocale("en");
  }, [setLocale]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      const photoRef = photo ? await fileToRef(photo) : null;
      const signatureRef = signature ? await fileToRef(signature) : null;
      return actor.submitSignup(
        toProfile(details),
        photoRef,
        signatureRef,
        toContactSet(contact, availability, signatureRef),
      );
    },
    onSuccess: () => {
      resetAll();
      setPhase("success");
    },
  });

  const { reset: resetSubmit } = submit;

  // Auto-reset: the success screen clears after 10 seconds, and any step with
  // no input for 90 seconds returns the kiosk to the welcome screen.
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current !== null) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (phase === "success") {
      const timer = setTimeout(resetAll, SUCCESS_RESET_MS);
      return () => clearTimeout(timer);
    }
    if (phase !== "form") return;

    const arm = () => {
      clearIdleTimer();
      idleTimer.current = setTimeout(() => {
        resetSubmit();
        resetAll();
      }, IDLE_RESET_MS);
    };
    arm();
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "input",
      "touchstart",
    ];
    for (const event of events) window.addEventListener(event, arm);
    return () => {
      clearIdleTimer();
      for (const event of events) window.removeEventListener(event, arm);
    };
  }, [phase, resetAll, resetSubmit, clearIdleTimer]);

  const toggleSlot = (day: Weekday, shift: Shift) => {
    setAvailability((current) => {
      const next = new Set(current);
      const key = slotKey(day, shift);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const validateStep = (index: number): boolean => {
    const next: Record<string, string> = {};
    if (index === 1) {
      if (!details.name.trim()) next.name = t("error.nameRequired");
      if (!details.positionAppliedFor.trim())
        next.positionAppliedFor = t("error.positionRequired");
      if (details.shiftsWantedPerWeek.trim() !== "") {
        const shifts = Number.parseInt(details.shiftsWantedPerWeek, 10);
        if (Number.isNaN(shifts) || shifts < 0 || shifts > MAX_SHIFTS) {
          next.shiftsWantedPerWeek = t("error.shiftsRange");
        }
      }
    }
    if (index === 2) {
      if (!EMAIL_RE.test(contact.email.trim()))
        next.email = t("error.emailInvalid");
      if (!contact.phone.trim()) next.phone = t("error.phoneRequired");
      else if (!PHONE_RE.test(contact.phone.trim()))
        next.phone = t("error.phoneInvalid");
      if (!contact.dateOfBirth) {
        next.dateOfBirth = t("error.dobRequired");
      } else {
        const dob = new Date(`${contact.dateOfBirth}T00:00:00Z`);
        const age = ageInYears(contact.dateOfBirth);
        if (Number.isNaN(dob.getTime()) || age === null) {
          next.dateOfBirth = t("error.dobInvalid");
        } else if (dob.getTime() >= Date.now()) {
          next.dateOfBirth = t("error.dobPast");
        } else if (age < MIN_AGE || age > MAX_AGE) {
          next.dateOfBirth = t("error.dobAge");
        }
      }
      if (!contact.emergencyContactName.trim())
        next.emergencyContactName = t("error.emergencyRequired");
      if (!contact.emergencyContactPhone.trim())
        next.emergencyContactPhone = t("error.emergencyPhoneRequired");
      else if (!PHONE_RE.test(contact.emergencyContactPhone.trim()))
        next.emergencyContactPhone = t("error.emergencyPhoneInvalid");
    }
    if (index === 3 && availability.size === 0) {
      next.availability = t("error.availabilityRequired");
    }
    if (index === 4 && !signature) {
      next.signature = t("error.signatureRequired");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(current + 1, STEP_KEYS.length - 1));
  };

  const goBack = () => {
    setErrors({});
    setStep((current) => Math.max(current - 1, 0));
  };

  const clearSignature = useCallback(() => setSignature(null), []);

  if (phase === "welcome") {
    return (
      <div data-ocid="kiosk.page">
        <KioskWelcome onStart={() => setPhase("form")} />
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div data-ocid="kiosk.page">
        <KioskSuccess onReset={resetAll} />
      </div>
    );
  }

  const isLast = step === STEP_KEYS.length - 1;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" data-ocid="kiosk.page">
      <KioskProgress
        steps={STEP_KEYS.map((key) => t(key))}
        current={step}
        label={t("progressLabel")}
      />

      <div className="rounded-lg border border-border bg-card p-5 shadow-subtle md:p-8">
        {step === 0 && (
          <KioskPhotoStep
            photo={photo}
            onCapture={setPhoto}
            onClear={() => setPhoto(null)}
          />
        )}
        {step === 1 && (
          <KioskDetailsStep
            value={details}
            onChange={setDetails}
            errors={errors}
          />
        )}
        {step === 2 && (
          <KioskContactStep
            value={contact}
            onChange={setContact}
            errors={errors}
          />
        )}
        {step === 3 && (
          <KioskAvailabilityStep
            selected={availability}
            onToggle={toggleSlot}
            error={errors.availability}
          />
        )}
        {step === 4 && (
          <KioskSignatureStep
            hasSignature={!!signature}
            onSigned={setSignature}
            onClear={clearSignature}
            error={errors.signature}
          />
        )}
        {step === 5 && (
          <KioskReviewStep
            details={details}
            contact={contact}
            availability={availability}
            hasPhoto={!!photo}
            hasSignature={!!signature}
          />
        )}
      </div>

      {submit.isError && (
        <p
          role="alert"
          data-ocid="kiosk.submit.error_state"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {t("error.submit")}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          data-ocid="kiosk.back_button"
          onClick={step === 0 ? resetAll : goBack}
          disabled={submit.isPending}
          className="touch-target h-12 rounded-full px-6 font-display uppercase tracking-wider"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {step === 0 ? t("cancel") : t("back")}
        </Button>

        {isLast ? (
          <Button
            type="button"
            data-ocid="kiosk.submit_button"
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            className="touch-target h-12 rounded-full px-8 font-display uppercase tracking-wider"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {submit.isPending ? t("submitting") : t("submit")}
          </Button>
        ) : (
          <Button
            type="button"
            data-ocid="kiosk.next_button"
            onClick={goNext}
            className="touch-target h-12 rounded-full px-8 font-display uppercase tracking-wider"
          >
            {t("next")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
