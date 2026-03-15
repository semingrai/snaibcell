import { useState } from "react";
import { Search, Zap, Loader2 } from "lucide-react";
import { demoChips, patients, predictions } from "../data/patients";
import type { PatientData, PredictionOutput } from "../data/patients";

interface Props {
  isDark: boolean;
  onSelect: (id: string) => void;
  onTriage: (patient: PatientData, prediction: PredictionOutput) => void;
  extraPatients: Record<string, PatientData>;
  extraPredictions: Record<string, PredictionOutput>;
}

const urgencyOrder = { red: 0, amber: 1, green: 2 } as const;

const urgencyStyle = {
  red:   { indicator: "bg-red-500",   label: "text-red-500",   badge: "bg-red-500/10 text-red-500"   },
  amber: { indicator: "bg-amber-400", label: "text-amber-400", badge: "bg-amber-400/10 text-amber-400" },
  green: { indicator: "bg-green-500", label: "text-green-500", badge: "bg-green-500/10 text-green-500" },
};

const urgencyBar     = { red: "bg-red-500",    amber: "bg-amber-400",    green: "bg-green-500"    };
const urgencyWindow  = { red: "bg-red-500/10", amber: "bg-amber-400/10", green: "bg-green-500/10" };

type Color = "red" | "amber" | "green";

function tierToColor(tier: string): Color {
  if (tier === "RED")    return "red";
  if (tier === "YELLOW") return "amber";
  return "green";
}

export default function PatientLookup({ isDark, onSelect, onTriage, extraPatients, extraPredictions }: Props) {
  const [query, setQuery]             = useState("");
  const [queryError, setQueryError]   = useState("");
  const [triageText, setTriageText]   = useState("");
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [triageSuccess, setTriageSuccess] = useState<string | null>(null);

  const allPatients    = { ...patients,    ...extraPatients    };
  const allPredictions = { ...predictions, ...extraPredictions };

  // Build chip list: hardcoded demo chips + triage chips, sorted by urgency
  const triageChips = Object.keys(extraPatients).map(id => ({
    id,
    label: "AI Triage",
    color: tierToColor(extraPredictions[id]?.urgency_tier ?? "RED"),
    isAI: true,
  }));

  const allChips = [
    ...demoChips.map(c => ({ ...c, isAI: false })),
    ...triageChips,
  ].sort((a, b) => (urgencyOrder[a.color] ?? 3) - (urgencyOrder[b.color] ?? 3));

  // Build sequential Gantt schedule
  let cursor = 0;
  const schedule = allChips.map(chip => {
    const pred  = allPredictions[chip.id];
    const start = cursor;
    const end   = cursor + (pred?.predicted_duration_min ?? 90);
    cursor = end;
    return { chip, pred, patient: allPatients[chip.id], start, end };
  });
  const totalScheduleMin = schedule[schedule.length - 1]?.end ?? 360;

  const ticks: number[] = [];
  for (let t = 0; t <= totalScheduleMin; t += 60) ticks.push(t);

  const handleLookupSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const id = query.trim().toUpperCase();
    if (allPatients[id]) {
      setQueryError("");
      onSelect(id);
    } else {
      setQueryError(`Patient "${id}" not found.`);
    }
  };

  const handleTriageSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const text = triageText.trim();
    if (!text) return;
    setTriageLoading(true);
    setTriageError(null);
    setTriageSuccess(null);
    try {
      const res = await fetch("/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setTriageError(typeof err.detail === "string" ? err.detail : "Triage failed — please retry.");
        return;
      }
      const data = await res.json();
      onTriage(data.patient, data.prediction);
      setTriageSuccess(`${data.patient.patient_id} added as ${data.prediction.urgency_tier}`);
      setTriageText("");
    } catch {
      setTriageError("Network error — check your connection.");
    } finally {
      setTriageLoading(false);
    }
  };

  const bg          = isDark ? "bg-dark-bg"      : "bg-gray-50";
  const surface     = isDark ? "bg-dark-surface" : "bg-white";
  const border      = isDark ? "border-dark-card" : "border-gray-200";
  const textPrimary = isDark ? "text-txt-primary" : "text-gray-900";
  const textMuted   = isDark ? "text-txt-muted"   : "text-gray-500";
  const inputBg     = isDark ? "bg-dark-input"    : "bg-gray-100";
  const cardHover   = isDark ? "hover:bg-dark-input" : "hover:bg-gray-50";
  const divider     = isDark ? "bg-dark-border"   : "bg-gray-200";
  const trackBg     = isDark ? "bg-dark-input"    : "bg-gray-100";
  const textareaBg  = isDark ? "bg-dark-input border-dark-border" : "bg-gray-100 border-gray-300";

  return (
    <div className={`flex flex-col lg:flex-row flex-1 gap-5 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden ${bg}`}>

      {/* ── Column 1: Patient Management ── */}
      <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-3">

        {/* Add by ID */}
        <div className={`flex flex-col gap-4 rounded border p-5 ${surface} ${border}`}>
          <div>
            <h2 className={`text-sm font-semibold ${textPrimary}`}>Add Patient</h2>
            <p className={`text-xs mt-0.5 ${textMuted}`}>Enter ID to load risk profile</p>
          </div>
          <form onSubmit={handleLookupSubmit} className="flex flex-col gap-3">
            <div className={`flex items-center gap-2 h-10 px-3 border ${inputBg} ${isDark ? "border-brand-blue/20" : "border-gray-300"}`}>
              <Search size={14} className={textMuted} />
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setQueryError(""); }}
                placeholder="e.g. ST0001"
                className={`flex-1 bg-transparent outline-none text-sm font-mono placeholder:opacity-40 ${textPrimary}`}
              />
            </div>
            {queryError && <p className="text-red-500 text-xs font-mono">{queryError}</p>}
            <button
              type="submit"
              className="h-9 bg-brand-blue text-white text-sm font-semibold hover:bg-blue-500 transition-colors"
            >
              Load Patient
            </button>
          </form>
          <div className={`h-px w-full ${divider}`} />
          <div>
            <p className={`text-xs ${textMuted} mb-2`}>Available IDs</p>
            <div className="flex flex-wrap gap-1">
              {Object.keys(allPatients).map(id => (
                <span key={id} className={`text-xs font-mono px-1.5 py-0.5 ${inputBg} ${textMuted}`}>{id}</span>
              ))}
            </div>
          </div>
        </div>

        {/* AI Emergency Triage */}
        <div className={`flex flex-col gap-3 rounded border p-5 ${surface} ${border}`}>
          <div>
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-brand-blue" />
              <h2 className={`text-sm font-semibold ${textPrimary}`}>AI Emergency Triage</h2>
            </div>
            <p className={`text-xs mt-0.5 ${textMuted}`}>Describe a patient — AI estimates clinical profile</p>
          </div>
          <form onSubmit={handleTriageSubmit} className="flex flex-col gap-3">
            <textarea
              value={triageText}
              onChange={e => { setTriageText(e.target.value); setTriageError(null); setTriageSuccess(null); }}
              placeholder={"e.g. 300lb 65 year old man, sudden left-side weakness, BP 210/120, unresponsive"}
              rows={4}
              className={`w-full px-3 py-2 text-xs border resize-none outline-none placeholder:opacity-40 ${textareaBg} ${textPrimary}`}
            />
            {triageError   && <p className="text-xs text-brand-red">{triageError}</p>}
            {triageSuccess && <p className="text-xs text-brand-green">{triageSuccess}</p>}
            <button
              type="submit"
              disabled={triageLoading || !triageText.trim()}
              className="flex items-center justify-center gap-2 h-9 bg-brand-blue text-white text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-60"
            >
              {triageLoading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              {triageLoading ? "AI reasoning..." : "Triage → Queue"}
            </button>
          </form>
        </div>
      </div>

      {/* ── Column 2: Current Patients ── */}
      <div className="w-full lg:w-52 flex-shrink-0 flex flex-col gap-3">
        <h2 className={`text-sm font-semibold ${textPrimary}`}>Current Patients</h2>
        <div className="flex flex-col gap-2 overflow-y-auto">
          {allChips.map(chip => {
            const p     = allPatients[chip.id];
            const style = urgencyStyle[chip.color];
            return (
              <button
                key={chip.id}
                onClick={() => onSelect(chip.id)}
                className={`w-full text-left border p-3 flex items-center gap-3 transition-colors ${surface} ${border} ${cardHover}`}
              >
                <div className={`w-1 self-stretch flex-shrink-0 ${style.indicator}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className={`text-xs font-mono font-semibold ${textPrimary}`}>{chip.id}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-px ${style.badge}`}>{chip.label}</span>
                    {chip.isAI && (
                      <span className="text-[9px] font-bold px-1 py-px bg-brand-blue/20 text-brand-blue">AI</span>
                    )}
                  </div>
                  {p && (
                    <div className={`text-[10px] ${textMuted}`}>
                      {p.age}y · NIHSS {p.nihss_score} · {p.clot_location}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Column 3: Procedure Queue / Gantt ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-baseline justify-between">
          <h2 className={`text-sm font-semibold ${textPrimary}`}>Procedure Queue</h2>
          <span className={`text-xs ${textMuted}`}>Sequential scheduling · {totalScheduleMin} min total</span>
        </div>

        <div className={`flex-1 rounded border p-5 flex flex-col gap-4 ${surface} ${border}`}>
          {/* Tick labels */}
          <div className="relative h-4 ml-28">
            {ticks.map(t => (
              <span
                key={t}
                className={`absolute text-[10px] ${textMuted} -translate-x-1/2`}
                style={{ left: `${(t / totalScheduleMin) * 100}%` }}
              >
                {t}m
              </span>
            ))}
          </div>

          {/* Patient rows */}
          <div className="flex flex-col gap-3">
            {schedule.map(({ chip, pred, start, end }) => {
              const style      = urgencyStyle[chip.color];
              const startPct   = (start / totalScheduleMin) * 100;
              const widthPct   = ((end - start) / totalScheduleMin) * 100;
              const windowMin  = pred?.time_window_minutes ?? 60;
              const windowPct  = Math.min((windowMin / totalScheduleMin) * 100, 100);
              const pastWindow = start >= windowMin;

              return (
                <div key={chip.id} className="flex items-center gap-3">
                  {/* Label */}
                  <div className="w-28 flex-shrink-0 flex items-center gap-2">
                    <div className={`w-1 h-8 flex-shrink-0 ${style.indicator}`} />
                    <div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs font-mono font-semibold ${textPrimary}`}>{chip.id}</span>
                        {chip.isAI && (
                          <span className="text-[9px] font-bold px-1 py-px bg-brand-blue/20 text-brand-blue leading-none">AI</span>
                        )}
                      </div>
                      <div className={`text-[10px] ${style.label}`}>{chip.label}</div>
                    </div>
                  </div>

                  {/* Track */}
                  <div className={`relative flex-1 h-8 ${trackBg}`}>
                    <div
                      className={`absolute top-0 h-full ${urgencyWindow[chip.color]}`}
                      style={{ left: 0, width: `${windowPct}%` }}
                      title={`Window: ${windowMin} min`}
                    />
                    <div
                      className={`absolute top-1 h-6 ${urgencyBar[chip.color]} ${pastWindow ? "opacity-40" : "opacity-90"}`}
                      style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                      title={`${start}–${end} min`}
                    />
                    {ticks.filter(t => t > 0).map(t => (
                      <div
                        key={t}
                        className={`absolute top-0 h-full w-px ${divider}`}
                        style={{ left: `${(t / totalScheduleMin) * 100}%` }}
                      />
                    ))}
                    <div
                      className={`absolute top-0 h-full w-px ${style.indicator} opacity-60`}
                      style={{ left: `${windowPct}%` }}
                      title={`Window closes at ${windowMin} min`}
                    />
                  </div>

                  {/* Timing info */}
                  <div className={`w-28 flex-shrink-0 text-[10px] ${textMuted}`}>
                    <div>{start}–{end} min</div>
                    <div className={pastWindow ? "text-red-500" : style.label}>
                      {pastWindow ? "⚠ outside window" : `window: ${windowMin}m`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className={`h-px w-full ${divider}`} />
          <div className={`flex gap-5 text-[10px] ${textMuted}`}>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 bg-red-500/10" />
              <span>Time window available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 bg-red-500 opacity-90" />
              <span>Procedure duration</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-px h-3 bg-red-500 opacity-60" />
              <span>Window closes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 bg-red-500 opacity-40" />
              <span>Outside window (critical)</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
