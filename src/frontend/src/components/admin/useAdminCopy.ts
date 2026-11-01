import { adminCopy } from "@/components/admin/copy";
import { useI18n } from "@/hooks/useI18n";

/** The admin-surface copy for the active locale. */
export function useAdminCopy() {
  const { locale } = useI18n();
  return adminCopy[locale] ?? adminCopy.en;
}
