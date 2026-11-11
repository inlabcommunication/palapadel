import { formatSets } from "../lib/standingsEngine";
import { EMPTY_SET, evaluateDraft, isEmpty, needsThirdSet, type DraftSet } from "../lib/matchSetsDraft";

/**
 * Inserimento dei game set per set (es. 6-1, 4-6, 6-2). Il terzo set compare solo se
 * dopo due set la partita è 1-1. Il risultato in set (2-0, 2-1...) si ricava da solo.
 */
export function SetsInput({
  team1Name,
  team2Name,
  value,
  onChange,
  compact = false,
}: {
  team1Name: string;
  team2Name: string;
  value: DraftSet[];
  onChange: (next: DraftSet[]) => void;
  compact?: boolean;
}) {
  const evaluation = evaluateDraft(value);
  const showThird = needsThirdSet(value) || !isEmpty(value[2]);

  const update = (index: number, side: "team1" | "team2", games: number | "") => {
    const next = value.map((set, i) => (i === index ? { ...set, [side]: games } : set));
    // Se dopo la modifica il terzo set non serve più, lo svuota.
    if (index < 2 && !needsThirdSet(next)) next[2] = { ...EMPTY_SET };
    onChange(next);
  };

  const columns = compact ? "grid-cols-[44px_56px_12px_56px]" : "grid-cols-[52px_64px_16px_64px]";

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`grid ${columns} items-end gap-1.5 text-[10.5px] font-semibold text-[rgba(251,243,222,0.58)]`}>
        <span />
        <span className="truncate text-center" title={team1Name}>{team1Name}</span>
        <span />
        <span className="truncate text-center" title={team2Name}>{team2Name}</span>
      </div>
      {value.slice(0, showThird ? 3 : 2).map((set, index) => (
        <div key={index} className={`grid ${columns} items-center gap-1.5`}>
          <span className="text-[11px] font-bold text-[rgba(251,243,222,0.72)]">Set {index + 1}</span>
          <GamesSelect
            label={`Game di ${team1Name} nel set ${index + 1}`}
            value={set.team1}
            onChange={(games) => update(index, "team1", games)}
            compact={compact}
          />
          <span className="text-center font-bold">-</span>
          <GamesSelect
            label={`Game di ${team2Name} nel set ${index + 1}`}
            value={set.team2}
            onChange={(games) => update(index, "team2", games)}
            compact={compact}
          />
        </div>
      ))}
      {evaluation.state === "valid" && (
        <p className="text-[11px] text-[#BBFF5E]">
          Risultato: <strong>{evaluation.result}</strong> ({formatSets(evaluation.sets)})
        </p>
      )}
      {evaluation.state === "invalid" && <p className="text-[11px] text-[#FF9B6B]">{evaluation.error}.</p>}
    </div>
  );
}

function GamesSelect({
  label,
  value,
  onChange,
  compact,
}: {
  label: string;
  value: number | "";
  onChange: (value: number | "") => void;
  compact: boolean;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
      className={`${compact ? "h-9 text-base" : "h-11 text-lg"} w-full rounded-lg border border-[rgba(251,243,222,0.18)] bg-[#0A0B08] text-center font-bold text-[#FBF3DE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#BBFF5E]`}
    >
      <option value="">-</option>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((games) => (
        <option key={games} value={games}>{games}</option>
      ))}
    </select>
  );
}
