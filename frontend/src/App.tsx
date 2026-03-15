import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import PatientLookup from './components/PatientLookup'
import RiskDashboard from './components/RiskDashboard'
import { patients, predictions } from './data/patients'
import type { PatientData, PredictionOutput, Pod } from './data/patients'
import './index.css'

const DEFAULT_PODS: Pod[] = [
  { id: 'pod-a', name: 'Pod A', patientIds: ['ST0001', 'ST0009'] },
  { id: 'pod-b', name: 'Pod B', patientIds: ['ST0014', 'ST0045'] },
]

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function tierToUrgencyOrder(tier: string): number {
  if (tier === 'RED')    return 0
  if (tier === 'YELLOW') return 1
  return 2
}

export default function App() {
  const [isDark, setIsDark] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [extraPatients, setExtraPatients] = useState<Record<string, PatientData>>(
    () => loadFromStorage('snaibcell_extra_patients', {})
  )
  const [extraPredictions, setExtraPredictions] = useState<Record<string, PredictionOutput>>(
    () => loadFromStorage('snaibcell_extra_predictions', {})
  )
  const [pods, setPods] = useState<Pod[]>(
    () => loadFromStorage('snaibcell_pods', DEFAULT_PODS)
  )

  useEffect(() => {
    localStorage.setItem('snaibcell_extra_patients', JSON.stringify(extraPatients))
  }, [extraPatients])

  useEffect(() => {
    localStorage.setItem('snaibcell_extra_predictions', JSON.stringify(extraPredictions))
  }, [extraPredictions])

  useEffect(() => {
    localStorage.setItem('snaibcell_pods', JSON.stringify(pods))
  }, [pods])

  useEffect(() => {
    fetch('/demo-patients')
      .then(r => r.json())
      .then((data: { patient: PatientData; prediction: PredictionOutput }[]) => {
        const newPatients: Record<string, PatientData> = {}
        const newPredictions: Record<string, PredictionOutput> = {}
        data.forEach(({ patient, prediction }) => {
          newPatients[patient.patient_id]    = patient
          newPredictions[patient.patient_id] = prediction
        })
        setExtraPatients(prev => ({ ...newPatients, ...prev }))
        setExtraPredictions(prev => ({ ...newPredictions, ...prev }))
        setPods(prev => {
          const allAssigned = new Set(prev.flatMap(p => p.patientIds))
          const unassigned = Object.keys(newPatients).filter(id => !allAssigned.has(id))
          if (unassigned.length === 0) return prev
          const updated = prev.map(p => ({ ...p, patientIds: [...p.patientIds] }))
          unassigned.forEach(id => {
            const targetIdx = updated
              .map((p, i) => ({ i, load: p.patientIds.length }))
              .sort((a, b) => a.load - b.load)[0].i
            updated[targetIdx].patientIds.push(id)
          })
          return updated
        })
      })
      .catch(() => {})
  }, [])

  const allPatients    = { ...patients,    ...extraPatients    }
  const allPredictions = { ...predictions, ...extraPredictions }

  const patient    = selectedId ? allPatients[selectedId]    : null
  const prediction = selectedId ? allPredictions[selectedId] : null

  const handleTriage = (p: PatientData, pred: PredictionOutput) => {
    const newPredictions = { ...allPredictions, [p.patient_id]: pred }

    setExtraPatients(prev => ({ ...prev, [p.patient_id]: p }))
    setExtraPredictions(prev => ({ ...prev, [p.patient_id]: pred }))

    setPods(prev => {
      const updated = prev.map(pod => ({ ...pod, patientIds: [...pod.patientIds] }))
      const newOrder = tierToUrgencyOrder(pred.urgency_tier)

      // Assign to the pod with fewest patients (load balance)
      const targetIdx = updated
        .map((pod, idx) => ({ idx, load: pod.patientIds.length }))
        .sort((a, b) => a.load - b.load)[0].idx

      // Insert in urgency order within the target pod
      const ids = updated[targetIdx].patientIds
      const insertAt = ids.findIndex(id => {
        const tier = newPredictions[id]?.urgency_tier ?? 'RED'
        return tierToUrgencyOrder(tier) > newOrder
      })
      if (insertAt === -1) {
        ids.push(p.patient_id)
      } else {
        ids.splice(insertAt, 0, p.patient_id)
      }

      return updated
    })

    setSelectedId(p.patient_id)
  }

  const bg = isDark ? 'bg-dark-bg' : 'bg-gray-50'

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${bg} ${isDark ? 'dark' : ''}`}>
      <Navbar
        title={patient ? 'Live Risk Analysis' : 'Patient Lookup'}
        isDark={isDark}
        onToggleDark={() => setIsDark(d => !d)}
        onHome={() => setSelectedId(null)}
        showTimer={!!patient}
        elapsedMin={patient ? undefined : undefined}
      />

      {patient && prediction ? (
        <RiskDashboard
          patient={patient}
          prediction={prediction}
          isDark={isDark}
          onNewPatient={() => setSelectedId(null)}
        />
      ) : (
        <PatientLookup
          isDark={isDark}
          onSelect={setSelectedId}
          onTriage={handleTriage}
          extraPatients={extraPatients}
          extraPredictions={extraPredictions}
          pods={pods}
          setPods={setPods}
          allPatients={allPatients}
          allPredictions={allPredictions}
        />
      )}
    </div>
  )
}
