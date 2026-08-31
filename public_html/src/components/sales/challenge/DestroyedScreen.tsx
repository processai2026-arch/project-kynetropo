import type { ChallengeReport } from "@/types/sales";

interface DestroyedScreenProps {
  /** Report fields the BACKEND actually returned. Nothing here is invented. */
  report?: ChallengeReport;
  challengeTitle?: string;
  challengeCode?: string;
  /** Enabled only once a "create a new challenge" action is available to this user. */
  onSignNewPact?: () => void;
  onDismiss: () => void;
}

/** Rows are only rendered for values the server actually provided. */
function Row({ label, value, ember }: { label: string; value?: string | null; ember?: boolean }) {
  if (!value) return null;
  return (
    <div className="kyn-destroy__row">
      <dt>{label}</dt>
      <dd className={ember ? "is-ember" : undefined}>{value}</dd>
    </div>
  );
}

function formatStamp(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The final destroyed state (spec §34–§36).
 *
 * The receipt shows only what the backend can prove. There is no streak, no
 * completion percentage and no "witnesses notified" line, because none of
 * those features exist — the CTA is likewise disabled until a real
 * new-challenge action is wired to it.
 */
export function DestroyedScreen({
  report,
  challengeTitle,
  challengeCode,
  onSignNewPact,
  onDismiss,
}: DestroyedScreenProps) {
  return (
    <div className="kyn-destroy__destroyed" role="alertdialog" aria-labelledby="kyn-destroyed-title">
      <div className="kyn-destroy__remnant" aria-hidden="true" />

      <button type="button" className="kyn-destroy__dismiss" onClick={onDismiss}>
        Close
      </button>

      <div className="kyn-destroy__title" id="kyn-destroyed-title">
        Challenge <em>Destroyed</em>
      </div>
      <p className="kyn-destroy__subtitle">
        {challengeCode ? `${challengeCode} — ` : ""}
        Challenge expired
      </p>

      <dl className="kyn-destroy__receipt">
        <div className="kyn-destroy__receipt-head">Challenge report</div>
        {challengeTitle && <Row label="Challenge" value={challengeTitle} />}
        <Row label="Contract" value={report?.contract} ember />
        <Row label="Deadline" value={formatStamp(report?.deadline)} />
        <Row label="Time left" value={report?.time_left} ember />
        <Row label="Accepted by" value={report?.accepted_by} />
        <Row label="Accepted at" value={formatStamp(report?.accepted_at)} />
        <Row label="Held for" value={report?.held_for} />
        <Row label="Expired at" value={formatStamp(report?.expired_at)} />
        <Row label="Status" value={report?.status} ember />
      </dl>

      <button
        type="button"
        className="kyn-destroy__cta"
        onClick={onSignNewPact}
        disabled={!onSignNewPact}
        title={onSignNewPact ? undefined : "Available to users who can create challenges"}
      >
        Sign a new pact
      </button>

      {!onSignNewPact && (
        <p className="kyn-destroy__note">
          Creating a new challenge requires the sales.challenges.create permission.
        </p>
      )}
    </div>
  );
}

export default DestroyedScreen;
