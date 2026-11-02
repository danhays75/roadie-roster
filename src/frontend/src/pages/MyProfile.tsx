import { PageHeader } from "@/components/PageHeader";
import { StaffProfileForm } from "@/components/StaffProfileForm";
import { LoadingState } from "@/components/States";
import { useAccessState } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import { useUpdateMyStaffProfile } from "@/hooks/useQueries";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

/**
 * The signed-in user's own profile page. It reuses the shared
 * `StaffProfileForm` and saves through `updateMyStaffProfile`, so a user can
 * keep their name, title and contact details up to date after approval. The
 * grant is already loaded by the access gate, so the form is seeded from it
 * without an extra read.
 */
export default function MyProfilePage() {
  const { t } = useI18n();
  const access = useAccessState();
  const updateProfile = useUpdateMyStaffProfile();
  const [saved, setSaved] = useState(false);

  const grant = access.kind === "granted" ? access.grant : undefined;

  return (
    <div className="space-y-6" data-ocid="my_profile.page">
      <PageHeader
        title={t("profile.editTitle")}
        subtitle={t("profile.editDescription")}
      />

      {!grant ? (
        <LoadingState
          label={t("common.loading")}
          ocid="my_profile.loading_state"
        />
      ) : (
        <section
          data-ocid="my_profile.card"
          className="rounded-lg border border-border bg-card p-5 shadow-subtle md:p-6"
        >
          <StaffProfileForm
            initialProfile={grant.staffProfile}
            submitLabel={t("profile.submit")}
            pending={updateProfile.isPending}
            error={updateProfile.isError ? t("profile.error") : null}
            ocidPrefix="my_profile"
            onSubmit={(profile) =>
              updateProfile.mutate(profile, {
                onSuccess: () => setSaved(true),
              })
            }
          />

          {saved && !updateProfile.isPending && !updateProfile.isError && (
            <output
              data-ocid="my_profile.success_state"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {t("profile.saved")}
            </output>
          )}
        </section>
      )}
    </div>
  );
}
