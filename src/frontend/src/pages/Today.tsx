import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/hooks/useI18n";

/** Placeholder for the future daily view. */
export default function TodayPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6" data-ocid="today.page">
      <PageHeader title={t("today.title")} subtitle={t("app.tagline")} />
      <section
        data-ocid="today.placeholder"
        className="rounded-lg border border-dashed border-border bg-card p-8 text-center"
      >
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          {t("today.placeholder.title")}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {t("today.placeholder.body")}
        </p>
      </section>
    </div>
  );
}
