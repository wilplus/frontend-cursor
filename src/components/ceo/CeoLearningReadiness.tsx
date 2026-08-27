import type {
  LearningReadinessReport,
  LearningReadinessRow,
} from "@/lib/ceo/domain";

const LABELS: Record<string, string> = {
  confidence_classification: "Confident Voice classifier",
  correction_generation: "Verbal-correction wording",
  coach_comment_generation: "Coach-comment drafting",
  praise_generation: "Praise wording",
  praise_selection: "Praise selection",
  correction_selection: "Verbal-correction selection",
  ideal_text_generation: "Ideal Text generation",
};

const BLOCKERS: Record<string, string> = {
  no_canonical_takes: "No canonical successful Takes",
  no_production_presentations: "No production presentations",
  no_visible_exposure_receipts: "No confirmed visible exposures",
  incomplete_version_provenance: "Some packets lack version provenance",
  no_authorized_consent_release: "No release with authorized consent policy",
  contradiction_metric_not_defined: "Contradiction instrument not defined",
  language_coverage_not_captured: "Language coverage is not captured",
  device_coverage_not_captured: "Device coverage is not captured",
  recording_condition_coverage_not_captured:
    "Recording-condition coverage is not captured",
  semantic_duplicate_metric_not_defined:
    "Semantic duplicate check is not defined",
  speaker_split_incomplete: "Speaker-disjoint split assignments incomplete",
};

function count(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function metric(label: string, value: string) {
  return (
    <div>
      <dt className="text-[11px] leading-4 text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function ReadinessCard({ row }: { row: LearningReadinessRow }) {
  return (
    <article className="rounded-2xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {LABELS[row.learning_surface] ?? row.learning_surface}
          </h3>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {row.learning_surface}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {row.status.replaceAll("_", " ")}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-6">
        {metric("Takes covered", count(row.covered_take_count))}
        {metric("Owners", count(row.covered_owner_count))}
        {metric("Projects", count(row.covered_project_count))}
        {metric("Coaches", count(row.covered_coach_count))}
        {metric("Prepared", count(row.prepared_presentation_count))}
        {metric("Visible", count(row.shown_presentation_count))}
        {metric(
          "Answered",
          row.answer_instrument_defined
            ? count(row.answered_exposure_count ?? 0)
            : "Not defined",
        )}
        {metric(
          "Unanswered",
          row.answer_instrument_defined
            ? count(row.unanswered_exposure_count ?? 0)
            : "Not defined",
        )}
        {metric("Exposure coverage", percent(row.visible_coverage_ratio))}
        {metric("Version coverage", percent(row.version_coverage_ratio))}
        {metric("Shadow only", count(row.shadow_evaluation_count))}
        {metric("Exclusions", count(row.exclusion_count))}
        {metric("Eligible items", count(row.eligible_item_count))}
        {metric("Research only", count(row.research_only_item_count))}
        {metric(
          "Contradictions",
          row.contradictions_supported
            ? count(row.contradiction_count ?? 0)
            : "Not defined",
        )}
        {metric("Authorized releases", count(row.authorized_dataset_release_count))}
      </dl>

      {row.blockers.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Blockers
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {row.blockers.map((blocker) => (
              <li
                key={blocker}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {BLOCKERS[blocker] ?? blocker.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export default function CeoLearningReadiness({
  report,
}: {
  report: LearningReadinessReport;
}) {
  return (
    <section aria-labelledby="learning-readiness-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="learning-readiness-title" className="text-xl font-semibold tracking-tight">
            Learning-system readiness
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Aggregate production evidence for seven isolated future systems.
            A fetch is not exposure; only a confirmed visible render counts.
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Read-only · {report.contract_version}
        </span>
      </div>

      {report.unavailable ? (
        <p className="mt-5 rounded-2xl border border-border p-4 text-sm text-muted-foreground">
          Readiness aggregation is unavailable. Apply the current database
          migrations and reload; no missing data is being inferred.
        </p>
      ) : (
        <div className="mt-5 grid gap-3">
          {report.surfaces.map((row) => (
            <ReadinessCard key={row.learning_surface} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
