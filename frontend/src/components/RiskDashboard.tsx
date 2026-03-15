import { useEffect, useState } from "react";
import type { PatientData, PredictionOutput } from "../data/patients";
import PatientStrip from "./PatientStrip";
import RiskChart from "./RiskChart";
import RiskFactors from "./RiskFactors";

interface Props {
  patient: PatientData;
  prediction: PredictionOutput;
  isDark: boolean;
  onNewPatient: () => void;
}

export default function RiskDashboard({
  patient,
  prediction,
  isDark,
  onNewPatient,
}: Props) {
  // Procedure timer: starts at 0, ticks every minute (simulated via seconds/60 for demo)
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    // In demo: 1 real second = 1 simulated minute for visible effect
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [patient.patient_id]);

  const elapsedMin = elapsedSec; // 1s per min for visible demo ticker

  const bg = isDark ? "bg-dark-bg" : "bg-gray-50";
  const rp = isDark ? "bg-dark-panel" : "bg-gray-50";
  const rpBdr = isDark ? "border-dark-border" : "border-gray-200";
  const textP = isDark ? "text-txt-primary" : "text-gray-900";
  const urgBg = {
    RED: isDark ? "bg-red-500/8 border-red-500/20" : "bg-red-50 border-red-200",
    YELLOW: isDark
      ? "bg-amber-500/8 border-amber-500/20"
      : "bg-amber-50 border-amber-200",
    GREEN: isDark
      ? "bg-green-500/8 border-green-500/20"
      : "bg-green-50 border-green-200",
  }[prediction.urgency_tier];
  const urgText = {
    RED: "text-brand-red",
    YELLOW: "text-brand-amber",
    GREEN: "text-brand-green",
  }[prediction.urgency_tier];
  const urgMsg = {
    RED: "RED ALERT — Treat Immediately",
    YELLOW: "YELLOW — Monitor Closely",
    GREEN: "GREEN — Stable Window",
  }[prediction.urgency_tier];

  return (
    <div className={`flex flex-col flex-1 overflow-hidden ${bg}`}>
      {/* Patient strip */}
      <PatientStrip
        patient={patient}
        prediction={prediction}
        isDark={isDark}
        onNewPatient={onNewPatient}
      />

      {/* Body */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
        {/* Left / centre panel */}
        <div className="flex flex-col gap-7 flex-1 px-4 sm:px-8 lg:px-12 py-6 lg:py-9 overflow-y-auto">
          {/* Chart header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={`text-base font-semibold ${textP}`}>
              Outcome Risk vs Procedure Duration
            </h2>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 border ${urgBg}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${urgText.replace("text", "bg")} animate-pulse`}
              />
              <span className={`text-[11px] font-semibold ${urgText}`}>
                {urgMsg}
              </span>
            </div>
          </div>

          {/* Chart */}
          <RiskChart
            prediction={prediction}
            elapsedMin={Math.min(elapsedMin, 180)}
            isDark={isDark}
          />
        </div>

        {/* Right panel */}
        <aside
          className={`w-full lg:w-[380px] shrink-0 flex flex-col p-5 lg:p-8 border-t lg:border-t-0 lg:border-l overflow-y-auto ${rp} ${rpBdr}`}
        >
          <RiskFactors
            patient={patient}
            prediction={prediction}
            isDark={isDark}
          />
        </aside>
      </div>
    </div>
  );
}
