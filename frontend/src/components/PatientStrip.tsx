import { ArrowLeft } from 'lucide-react'
import type { PatientData, PredictionOutput } from '../data/patients'

interface Props {
  patient: PatientData
  prediction: PredictionOutput
  isDark: boolean
  onNewPatient: () => void
}

export default function PatientStrip({ patient, prediction, isDark, onNewPatient }: Props) {
  const border  = isDark ? 'border-dark-border' : 'border-gray-200'
  const surface = isDark ? 'bg-dark-surface'    : 'bg-white'
  const textP   = isDark ? 'text-txt-primary'   : 'text-gray-900'
  const textM   = isDark ? 'text-txt-muted'     : 'text-gray-500'
  const divider = isDark ? 'bg-dark-border'     : 'bg-gray-200'

  const tierColor = {
    RED:    'text-brand-red',
    YELLOW: 'text-brand-amber',
    GREEN:  'text-brand-green',
  }[prediction.urgency_tier]

  const tierBg = {
    RED:    isDark ? 'bg-red-500/10'    : 'bg-red-50',
    YELLOW: isDark ? 'bg-amber-500/10'  : 'bg-amber-50',
    GREEN:  isDark ? 'bg-green-500/10'  : 'bg-green-50',
  }[prediction.urgency_tier]

  const stats: { label: string; value: React.ReactNode }[] = [
    { label: 'PATIENT ID',     value: <span className="font-mono">{patient.patient_id}</span> },
    { label: 'AGE',            value: `${patient.age} yrs` },
    {
      label: 'NIHSS SCORE',
      value: (
        <span className="flex items-center gap-2">
          <span className={`text-xl font-bold ${tierColor}`}>{patient.nihss_score}</span>
          <span className={`text-[9px] font-bold px-2 py-0.5 ${tierBg} ${tierColor}`}>
            {prediction.urgency_tier}
          </span>
        </span>
      ),
    },
    { label: 'CLOT LOCATION',  value: patient.clot_location },
    { label: 'ASPECTS',        value: <span className={tierColor}>{patient.aspects_score} / 10</span> },
    { label: 'ONSET TO DOOR',  value: <span className="text-brand-amber">{patient.onset_to_door_min} min</span> },
  ]

  return (
    <div className={`flex flex-wrap items-center justify-between min-h-[72px] lg:h-[88px] px-4 lg:px-10 py-3 lg:py-0 gap-y-2 border-b shrink-0 ${surface} ${border}`}>
      {/* Stat cards */}
      <div className="flex flex-wrap items-center gap-y-2">
        {stats.map((s, i) => (
          <div key={s.label} className="flex items-center">
            {i > 0 && <div className={`w-px h-10 mx-0 ${divider}`} />}
            <div className={`flex flex-col gap-1 justify-center ${i === 0 ? 'pr-7' : 'px-7'}`}>
              <span className={`text-[10px] font-semibold tracking-widest ${textM}`}>{s.label}</span>
              <div className={`text-xl font-bold ${textP}`}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* New Patient button */}
      <button
        onClick={onNewPatient}
        className={`flex items-center gap-2 px-5 py-2.5 border text-sm font-medium transition-colors
          ${isDark
            ? 'border-dark-border text-txt-muted hover:text-txt-primary'
            : 'border-gray-200 text-gray-500 hover:text-gray-900'
          }`}
      >
        <ArrowLeft size={16} />
        New Patient
      </button>
    </div>
  )
}
