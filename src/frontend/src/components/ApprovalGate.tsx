import { createActor } from "@/backend";
import { DemoBanner } from "@/components/DemoBanner";
import { SignOutButton } from "@/components/InternetIdentity";
import { StaffProfileForm } from "@/components/StaffProfileForm";
import { LoadingState } from "@/components/States";
import { StoreLogo } from "@/components/StoreLogo";
import { Button } from "@/components/ui/button";
import { canLeaders, useAccessState } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import {
  useBootstrapAdmin,
  useRequestAccess,
  useSubmitStaffProfile,
  useUpdateMyStaffProfile,
} from "@/hooks/useQueries";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import { Clock, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Narrow an actor to its optional `getMyPendingRequest` read. Older actors and
 * test mocks may not expose the method, so it is looked up structurally and
 * only invoked when the running actor actually provides it.
 */
function readOptionalPendingRequest(
  actor: unknown,
): (() => Promise<{ requestedAt: bigint; hasProfile: boolean } | null>) | null {
  if (typeof actor !== "object" || actor === null) return null;
  const candidate = (actor as { getMyPendingRequest?: unknown })
    .getMyPendingRequest;
  if (typeof candidate !== "function") return null;
  return () =>
    (
      candidate as () => Promise<{
        requestedAt: bigint;
        hasProfile: boolean;
      } | null>
    ).call(actor);
}

/**
 * The caller's own pending access request. Returns null when the caller has no
 * pending request, or when the running actor does not expose the read (older
 * actors and test mocks), so the gate falls back to showing the profile form.
 * `hasProfile` is true once the caller has submitted a staff profile on their
 * pending request, which lets a reload skip the form and go straight to the
 * waiting screen.
 */
function useMyPendingRequest() {
  const { actor, isFetching } = useActor(createActor);
  const enabled = !!actor && !isFetching;
  return useQuery({
    queryKey: ["myPendingRequest"],
    queryFn: async () => {
      if (!actor) return null;
      const read = readOptionalPendingRequest(actor);
      if (!read) return null;
      return read();
    },
    enabled,
  });
}

/**
 * The access gate. Anyone who signs in without an access grant lands here until
 * an admin approves them with a role. On first arrival the caller registers
 * themselves for approval so an admin can see the request.
 *
 * The first platform admin is made an admin by the platform's shared
 * authorization mixin, but that grant is not persisted to the app's own access
 * model until `bootstrapAdmin` runs. This gate calls it for every signed-in
 * caller (idempotent) so the first admin's grant is persisted and their admin
 * operations stop trapping. Once the caller holds a grant, the gate renders
 * `children` — the app chrome.
 *
 * The demo banner is mounted above every gate screen (waiting, profile, error)
 * so demo mode is visible before the caller reaches the app chrome.
 */
export function ApprovalGate({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <DemoBanner />
      <ApprovalGateInner>{children}</ApprovalGateInner>
    </>
  );
}

function ApprovalGateInner({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n();
  const access = useAccessState();
  const requestAccess = useRequestAccess();
  const bootstrapAdmin = useBootstrapAdmin();
  const submitProfile = useSubmitStaffProfile();
  const updateProfile = useUpdateMyStaffProfile();
  const pendingRequest = useMyPendingRequest();
  const { actor } = useActor(createActor);
  const requested = useRef(false);
  const bootstrapped = useRef(false);
  const bootstrapAttempts = useRef(0);
  const requestAttempts = useRef(0);
  // A pending caller has no readable profile, so the gate tracks whether the
  // profile form was completed in this session. Once it is, the caller goes
  // straight to the waiting screen.
  const [profileSubmitted, setProfileSubmitted] = useState(false);
  // An already-approved caller whose grant carries no profile fills it in on
  // this sign-in without losing access; once saved they continue into the app.
  const [grantProfileSaved, setGrantProfileSaved] = useState(false);

  // Persist the first platform admin's app grant. Safe for every signed-in
  // caller: the backend only acts while no app Admin exists and the caller is
  // already a platform admin. Wait for the actor to be ready so the call is not
  // lost while the backend connection is still initializing, and retry once if
  // it failed for that reason.
  useEffect(() => {
    if (!actor) return;
    if (access.kind === "loading" || access.kind === "error") return;
    if (bootstrapped.current && !bootstrapAdmin.isError) return;
    if (bootstrapAttempts.current >= 2) return;
    bootstrapped.current = true;
    bootstrapAttempts.current += 1;
    bootstrapAdmin.mutate();
  }, [actor, access.kind, bootstrapAdmin]);

  // Register the caller for approval once the actor is ready. Waiting for the
  // actor keeps the call from being lost while the backend connection is still
  // initializing; if it failed for that reason, retry a bounded number of times
  // instead of leaving the caller permanently unregistered.
  useEffect(() => {
    if (!actor) return;
    if (access.kind !== "pending") return;
    if (requested.current && !requestAccess.isError) return;
    if (requestAttempts.current >= 3) return;
    requested.current = true;
    requestAttempts.current += 1;
    requestAccess.mutate();
  }, [actor, access.kind, requestAccess]);

  if (access.kind === "granted") {
    // Only leader roles fill in a staff profile. A granted kiosk or integration
    // user has no profile to give, so they go straight into the app (the kiosk
    // welcome screen with its PIN sign-out) instead of seeing the form. A demo
    // grant never shows the form: the caller is impersonating a role against
    // demo data, not completing their own profile.
    const needsProfile =
      !access.demo &&
      !access.grant.staffProfile &&
      !grantProfileSaved &&
      canLeaders(access.grant.role);
    if (needsProfile) {
      return (
        <section
          data-ocid="gate.profile_state"
          className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-5 px-6 py-10"
        >
          <div className="text-center">
            <StoreLogo className="mx-auto h-20 w-20" />
            <h1 className="mt-4 font-display text-3xl font-bold uppercase tracking-tight">
              {t("profile.title")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {t("profile.description")}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5 shadow-subtle">
            <StaffProfileForm
              submitLabel={t("profile.continue")}
              pending={updateProfile.isPending}
              error={updateProfile.isError ? t("profile.error") : null}
              onSubmit={(profile) =>
                updateProfile.mutate(profile, {
                  onSuccess: () => setGrantProfileSaved(true),
                })
              }
            />
          </div>
          <div className="flex justify-center">
            <SignOutButton
              label={t("gate.signOut")}
              ocid="gate.sign_out_button"
              className="touch-target rounded-md border border-input bg-card px-4 py-2 font-display text-sm font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-muted"
            />
          </div>
        </section>
      );
    }
    return <>{children}</>;
  }

  // While the backend actor is still initializing the access read has not run,
  // so the grant is unknown. Render the waiting screen rather than a spinner:
  // the caller is signed in and awaiting approval, and the pending screen is the
  // correct neutral state until the connection is ready.
  const actorReady = !!actor;

  // Once the actor is ready, a still-in-flight read shows a neutral loading
  // state so the waiting screen never flashes before the grant is known.
  if (access.kind === "loading" && actorReady) {
    return (
      <div
        data-ocid="gate.loading_state"
        className="flex min-h-dvh items-center justify-center bg-background px-6"
      >
        <LoadingState label={t("common.loading")} />
      </div>
    );
  }

  if (access.kind === "error") {
    return (
      <section
        data-ocid="gate.error_state"
        className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center"
      >
        <ShieldAlert
          className="h-10 w-10 text-destructive"
          aria-hidden="true"
        />
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
          {t("gate.error.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("gate.error.body")}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            className="touch-target"
            data-ocid="gate.retry_button"
            onClick={() => window.location.reload()}
          >
            {t("gate.retry")}
          </Button>
          <SignOutButton
            label={t("gate.signOut")}
            ocid="gate.sign_out_button"
            className="touch-target rounded-md border border-input bg-card px-4 py-2 font-display text-sm font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-muted"
          />
        </div>
      </section>
    );
  }

  // A pending caller who has not yet supplied a profile sees the profile form
  // before the waiting screen. The form is only shown once the access request
  // has settled, because `submitStaffProfile` traps without a pending request.
  // A caller whose pending request already carries a profile (for example after
  // a reload) skips the form and goes straight to the waiting screen.
  const requestSettled = requestAccess.isSuccess || requested.current;
  const alreadyHasProfile = pendingRequest.data?.hasProfile === true;
  if (
    access.kind === "pending" &&
    requestSettled &&
    !profileSubmitted &&
    !alreadyHasProfile
  ) {
    return (
      <section
        data-ocid="gate.profile_state"
        className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-5 px-6 py-10"
      >
        <div className="text-center">
          <StoreLogo className="mx-auto h-20 w-20" />
          <h1 className="mt-4 font-display text-3xl font-bold uppercase tracking-tight">
            {t("profile.title")}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t("profile.description")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-subtle">
          <StaffProfileForm
            submitLabel={t("profile.continue")}
            pending={submitProfile.isPending}
            error={submitProfile.isError ? t("profile.error") : null}
            onSubmit={(profile) =>
              submitProfile.mutate(profile, {
                onSuccess: () => setProfileSubmitted(true),
              })
            }
          />
        </div>
        <div className="flex justify-center">
          <SignOutButton
            label={t("gate.signOut")}
            ocid="gate.sign_out_button"
            className="touch-target rounded-md border border-input bg-card px-4 py-2 font-display text-sm font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-muted"
          />
        </div>
      </section>
    );
  }

  return (
    <section
      data-ocid="gate.pending_state"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <StoreLogo className="h-32 w-32" />
      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 font-display text-xs font-semibold uppercase tracking-widest text-primary">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {t("gate.pending.title")}
      </span>
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
        {t("gate.pending.title")}
      </h1>
      <p className="text-sm text-muted-foreground">{t("gate.pending.body")}</p>
      <p className="text-xs text-muted-foreground">{t("gate.pending.hint")}</p>
      <SignOutButton
        label={t("gate.signOut")}
        ocid="gate.sign_out_button"
        className="touch-target rounded-md border border-input bg-card px-4 py-2 font-display text-sm font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-muted"
      />
    </section>
  );
}
