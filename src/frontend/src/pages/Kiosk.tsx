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
import { dateToDateOnly } from "@/lib/format";
import { useActor } from "@caffeineai/core-infrastructure";
import { ExternalBlob } from "@caffeineai/object-storage";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { useCallback, useState } from "react";

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
  signature: File | null,
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
    availabilitySignature: signature ? signature.name : undefined,
    availabilitySignedAt: signature
      ? BigInt(Date.now()) * 1_000_000n
      : undefined,
    availabilityResignPending: false,
  };
}

/** Upload a browser `File` to object storage and return its reference. */
async function uploadFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const blob = ExternalBlob.fromBytes(bytes, file.type, file.name);
  return blob.getDirectURL();
}

/** The kiosk self-service sign-up flow. */
export default function KioskPage() {
  const t = useKioskCopy();
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
  }, []);

  const submit = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      const photoRef = photo ? await uploadFile(photo) : null;
      const signatureRef = signature ? await uploadFile(signature) : null;
      return actor.submitSignup(
        toProfile(details),
        photoRef,
        signatureRef,
        toContactSet(contact, availability, signature),
      );
    },
    onSuccess: () => {
      resetAll();
      setPhase("success");
    },
  });

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
    }
    if (index === 2) {
      if (!EMAIL_RE.test(contact.email.trim()))
        next.email = t("error.emailInvalid");
      if (!contact.phone.trim()) next.phone = t("error.phoneRequired");
      if (!contact.dateOfBirth) next.dateOfBirth = t("error.dobRequired");
      if (!contact.emergencyContactName.trim())
        next.emergencyContactName = t("error.emergencyRequired");
      if (!contact.emergencyContactPhone.trim())
        next.emergencyContactPhone = t("error.emergencyPhoneRequired");
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
            onClear={() => setSignature(null)}
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
