import { createActor } from "@/backend";
import { SignOutButton } from "@/components/InternetIdentity";
import { LoadingState } from "@/components/States";
import { StoreLogo } from "@/components/StoreLogo";
import { Button } from "@/components/ui/button";
import { useAccessState } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import { useBootstrapAdmin, useRequestAccess } from "@/hooks/useQueries";
import { useActor } from "@caffeineai/core-infrastructure";
import { Clock, ShieldAlert } from "lucide-react";
import { useEffect, useRef } from "react";

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
 */
export function ApprovalGate({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n();
  const access = useAccessState();
  const requestAccess = useRequestAccess();
  const bootstrapAdmin = useBootstrapAdmin();
  const { actor } = useActor(createActor);
  const requested = useRef(false);
  const bootstrapped = useRef(false);
  const bootstrapAttempts = useRef(0);

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

  useEffect(() => {
    if (access.kind !== "pending" || requested.current) return;
    requested.current = true;
    requestAccess.mutate();
  }, [access.kind, requestAccess]);

  if (access.kind === "granted") {
    return <>{children}</>;
  }

  // While the access read is still in flight, show a neutral loading state so
  // the waiting screen never flashes before the grant is known.
  if (access.kind === "loading") {
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

  return (
    <section
      data-ocid="gate.pending_state"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <StoreLogo className="h-16 w-16" />
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
