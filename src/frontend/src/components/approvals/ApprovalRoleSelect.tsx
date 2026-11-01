import { Role } from "@/backend";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/hooks/useI18n";
import { roleLabel } from "@/lib/format";

/** Roles an admin may grant. No role is pre-selected. */
export const ASSIGNABLE_ROLES: Role[] = [
  Role.storeManager,
  Role.trainingManager,
  Role.leadership,
  Role.visitingManager,
  Role.trainer,
  Role.kiosk,
  Role.admin,
];

/** Roles that require an explicit confirmation before granting. */
export const CONFIRM_ROLES: Role[] = [Role.storeManager, Role.admin];

/** Whether granting this role needs a confirmation step. */
export function needsConfirmation(role: Role | ""): boolean {
  return role !== "" && CONFIRM_ROLES.includes(role);
}

/** Role picker for the approval form. */
export function ApprovalRoleSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: Role | "";
  onChange: (role: Role) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t("approvals.role.label")}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as Role)}>
        <SelectTrigger
          id={id}
          data-ocid="approvals.role.select"
          className="touch-target w-full"
        >
          <SelectValue placeholder={t("approvals.role.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {ASSIGNABLE_ROLES.map((option) => (
            <SelectItem key={option} value={option}>
              {roleLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
