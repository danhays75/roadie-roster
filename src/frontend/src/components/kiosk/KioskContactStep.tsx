import { KioskField } from "@/components/kiosk/KioskField";
import { useKioskCopy } from "@/components/kiosk/copy";
import { Input } from "@/components/ui/input";

export interface KioskContact {
  email: string;
  phone: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export const EMPTY_CONTACT: KioskContact = {
  email: "",
  phone: "",
  dateOfBirth: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
};

/** Contact step: reachability and emergency details. */
export function KioskContactStep({
  value,
  onChange,
  errors,
}: {
  value: KioskContact;
  onChange: (next: KioskContact) => void;
  errors: Partial<Record<keyof KioskContact, string>>;
}) {
  const t = useKioskCopy();
  const set = <K extends keyof KioskContact>(key: K, next: KioskContact[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="space-y-6" data-ocid="kiosk.contact_step">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          {t("contact.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("contact.body")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KioskField
          id="kiosk-email"
          label={t("field.email")}
          required
          error={errors.email}
        >
          <Input
            id="kiosk-email"
            data-ocid="kiosk.email.input"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={value.email}
            aria-invalid={!!errors.email}
            onChange={(e) => set("email", e.target.value)}
            className="touch-target"
          />
        </KioskField>

        <KioskField
          id="kiosk-phone"
          label={t("field.phone")}
          required
          error={errors.phone}
        >
          <Input
            id="kiosk-phone"
            data-ocid="kiosk.phone.input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={value.phone}
            aria-invalid={!!errors.phone}
            onChange={(e) => set("phone", e.target.value)}
            className="touch-target"
          />
        </KioskField>

        <KioskField
          id="kiosk-dob"
          label={t("field.dateOfBirth")}
          required
          error={errors.dateOfBirth}
          hint={t("field.dateOfBirthHint")}
        >
          <Input
            id="kiosk-dob"
            data-ocid="kiosk.date_of_birth.input"
            type="date"
            value={value.dateOfBirth}
            aria-invalid={!!errors.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
            className="touch-target"
          />
        </KioskField>

        <KioskField
          id="kiosk-emergency-name"
          label={t("field.emergencyContact")}
          required
          error={errors.emergencyContactName}
        >
          <Input
            id="kiosk-emergency-name"
            data-ocid="kiosk.emergency_contact_name.input"
            value={value.emergencyContactName}
            aria-invalid={!!errors.emergencyContactName}
            onChange={(e) => set("emergencyContactName", e.target.value)}
            className="touch-target"
          />
        </KioskField>

        <KioskField
          id="kiosk-emergency-phone"
          label={t("field.emergencyPhone")}
          required
          error={errors.emergencyContactPhone}
        >
          <Input
            id="kiosk-emergency-phone"
            data-ocid="kiosk.emergency_contact_phone.input"
            type="tel"
            inputMode="tel"
            value={value.emergencyContactPhone}
            aria-invalid={!!errors.emergencyContactPhone}
            onChange={(e) => set("emergencyContactPhone", e.target.value)}
            className="touch-target"
          />
        </KioskField>
      </div>
    </div>
  );
}
