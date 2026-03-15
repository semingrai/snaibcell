import { useState } from "react"
import { Search, Zap, Loader2, Plus, X, GripVertical } from "lucide-react"
import type { PatientData, PredictionOutput, Pod } from "../data/patients"

interface Props {
  isDark: boolean
  onSelect: (id: string) => void
  onTriage: (patient: PatientData, prediction: PredictionOutput) => void
  extraPatients: Record<string, PatientData>
  extraPredictions: Record<string, PredictionOutput>
  pods: Pod[]
  setPods: React.Dispatch<React.SetStateAction<Pod[]>>
  allPatients: Record<string, PatientData>
  allPredictions: Record<string, PredictionOutput>
}

const urgencyStyle = {
  red:   { indicator: "bg-red-500",   label: "text-red-500",   badge: "bg-red-500/10 text-red-500"   },
  amber: { indicator: "bg-amber-400", label: "text-amber-400", badge: "bg-amber-400/10 text-amber-400" },
  green: { indicator: "bg-green-500", label: "text-green-500", badge: "bg-green-500/10 text-green-500" },
}
const urgencyBar    = { red: "bg-red-500",    amber: "bg-amber-400",    green: "bg-green-500"    }
const urgencyWindow = { red: "bg-red-500/10", amber: "bg-amber-400/10", green: "bg-green-500/10" }

type Color = "red" | "amber" | "green"

function tierToColor(tier: string): Color {
  if (tier === "RED")    return "red"
  if (tier === "YELLOW") return "amber"
  return "green"
}

function urgencyOrder(color: Color): number {
  return { red: 0, amber: 1, green: 2 }[color]
}

function patientColor(id: string, allPredictions: Record<string, PredictionOutput>): Color {
  return tierToColor(allPredictions[id]?.urgency_tier ?? "RED")
}

export default function PatientLookup({
  isDark, onSelect, onTriage, extraPredictions,
  pods, setPods, allPatients, allPredictions,
}: Props) {
  const [query, setQuery]                 = useState("")
  const [queryError, setQueryError]       = useState("")
  const [triageText, setTriageText]       = useState("")
  const [triageLoading, setTriageLoading] = useState(false)
  const [triageError, setTriageError]     = useState<string | null>(null)
  const [triageSuccess, setTriageSuccess] = useState<string | null>(null)
  const [draggingId, setDraggingId]       = useState<string | null>(null)
  const [dragOverPod, setDragOverPod]     = useState<string | null>(null)

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const bg          = isDark ? "bg-dark-bg"      : "bg-gray-50"
  const surface     = isDark ? "bg-dark-surface" : "bg-white"
  const border      = isDark ? "border-dark-card" : "border-gray-200"
  const textPrimary = isDark ? "text-txt-primary" : "text-gray-900"
  const textMuted   = isDark ? "text-txt-muted"   : "text-gray-500"
  const inputBg     = isDark ? "bg-dark-input"    : "bg-gray-100"
  const cardHover   = isDark ? "hover:bg-dark-input" : "hover:bg-gray-50"
  const divider     = isDark ? "bg-dark-border"   : "bg-gray-200"
  const trackBg     = isDark ? "bg-dark-input"    : "bg-gray-100"
  const textareaBg  = isDark ? "bg-dark-input border-dark-border" : "bg-gray-100 border-gray-300"
  const subBorder   = isDark ? "border-dark-border" : "border-gray-100"

  // ── Pod actions ───────────────────────────────────────────────────────────
  const addPod = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    const name = `Pod ${letters[pods.length % 26]}`
    setPods(prev => [...prev, { id: `pod-${Date.now()}`, name, patientIds: [] }])
  }

  const removePod = (podId: string) => {
    if (pods.length <= 1) return
    setPods(prev => {
      const target = prev.find(p => p.id === podId)
      if (!target) return prev
      return prev
        .filter(p => p.id !== podId)
        .map((p, i) => i === 0 ? { ...p, patientIds: [...p.patientIds, ...target.patientIds] } : p)
    })
  }

  const updateName = (podId: string, name: string) =>
    setPods(prev => prev.map(p => p.id === podId ? { ...p, name } : p))

  // ── Drag and drop ─────────────────────────────────────────────────────────
  const movePatient = (patientId: string, toPodId: string) => {
    setPods(prev => prev.map(p => {
      if (p.patientIds.includes(patientId) && p.id !== toPodId)
        return { ...p, patientIds: p.patientIds.filter(id => id !== patientId) }
      if (p.id === toPodId && !p.patientIds.includes(patientId))
        return { ...p, patientIds: [...p.patientIds, patientId] }
      return p
    }))
  }

  // ── Gantt ─────────────────────────────────────────────────────────────────
  const podSchedules = pods.map(pod => {
    let cursor = 0
    const orderedIds = [...pod.patientIds].sort((a, b) =>
      urgencyOrder(patientColor(a, allPredictions)) - urgencyOrder(patientColor(b, allPredictions))
    )
    const rows = orderedIds.map(id => {
      const pred  = allPredictions[id]
      const start = cursor
      const end   = cursor + (pred?.predicted_duration_min ?? 90)
      cursor = end
      return { id, pred, start, end }
    })
    return { pod, rows, total: cursor }
  })
  const totalScheduleMin = Math.max(...podSchedules.map(ps => ps.total), 360)

  const ticks: number[] = []
  for (let t = 0; t <= totalScheduleMin; t += 60) ticks.push(t)

  // ── Forms ─────────────────────────────────────────────────────────────────
  const handleLookupSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    const id = query.trim().toUpperCase()
    if (allPatients[id]) { setQueryError(""); onSelect(id) }
    else setQueryError(`Patient "${id}" not found.`)
  }

  const handleTriageSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    const text = triageText.trim()
    if (!text) return
    setTriageLoading(true); setTriageError(null); setTriageSuccess(null)
    try {
      const res = await fetch("/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setTriageError(typeof err.detail === "string" ? err.detail : "Triage failed — please retry.")
        return
      }
      const data = await res.json()
      onTriage(data.patient, data.prediction)
      setTriageSuccess(`${data.patient.patient_id} added as ${data.prediction.urgency_tier}`)
      setTriageText("")
    } catch {
      setTriageError("Network error — check your connection.")
    } finally {
      setTriageLoading(false)
    }
  }

  return (
    <div className={`flex flex-col lg:flex-row flex-1 gap-5 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden ${bg}`}>

      {/* ── Column 1: Controls ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-3 lg:overflow-y-auto">
        <div className="hidden lg:block h-5 flex-shrink-0" />

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
                onChange={e => { setQuery(e.target.value); setQueryError("") }}
                placeholder="e.g. ST0001"
                className={`flex-1 bg-transparent outline-none text-sm font-mono placeholder:opacity-40 ${textPrimary}`}
              />
            </div>
            {queryError && <p className="text-red-500 text-xs font-mono">{queryError}</p>}
            <button type="submit" className="h-9 bg-brand-blue text-white text-sm font-semibold hover:bg-blue-500 transition-colors">
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
              onChange={e => { setTriageText(e.target.value); setTriageError(null); setTriageSuccess(null) }}
              placeholder="e.g. 300lb 65 year old man, sudden left-side weakness, BP 210/120, unresponsive"
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

        {/* Room Configuration */}
        <div className={`flex flex-col gap-3 rounded border p-5 ${surface} ${border}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-sm font-semibold ${textPrimary}`}>Room Configuration</h2>
            <button
              onClick={addPod}
              className={`flex items-center gap-1 text-xs px-2 py-1 border transition-colors ${
                isDark
                  ? "border-dark-border text-txt-muted hover:text-brand-blue hover:border-brand-blue/40"
                  : "border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200"
              }`}
            >
              <Plus size={11} /> Add Room
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {pods.map(pod => (
              <div key={pod.id} className={`flex items-center gap-2 px-2 py-1.5 border ${subBorder}`}>
                <input
                  value={pod.name}
                  onChange={e => updateName(pod.id, e.target.value)}
                  className={`flex-1 min-w-0 text-xs font-semibold bg-transparent outline-none ${textPrimary}`}
                />
                {pods.length > 1 && (
                  <button onClick={() => removePod(pod.id)} className={`flex-shrink-0 transition-colors ${isDark ? "text-txt-muted hover:text-red-400" : "text-gray-300 hover:text-red-400"}`}>
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Column 2: Pod Lanes ────────────────────────────────────────────── */}
      <div className="w-full lg:w-56 flex-shrink-0 flex flex-col gap-3 lg:overflow-y-auto lg:pr-1.5">
        <div className="flex items-center justify-between">
          <h2 className={`text-sm font-semibold ${textPrimary}`}>Current Patients</h2>
          <button
            onClick={() => setPods(prev => {
              const allIds = prev.flatMap(p => p.patientIds)
                .sort((a, b) => {
                  const tierDiff = urgencyOrder(patientColor(a, allPredictions)) - urgencyOrder(patientColor(b, allPredictions))
                  return tierDiff !== 0 ? tierDiff : a.localeCompare(b)
                })
              const newPods = prev.map(p => ({ ...p, patientIds: [] as string[] }))
              allIds.forEach((id, i) => newPods[i % newPods.length].patientIds.push(id))
              return newPods
            })}
            className={`text-[10px] px-2 py-1 border transition-colors ${
              isDark
                ? "border-dark-border text-txt-muted hover:text-brand-blue hover:border-brand-blue/40"
                : "border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200"
            }`}
          >
            Reset Order
          </button>
        </div>

        {pods.map(pod => {
          const isOver = dragOverPod === pod.id

          return (
            <div
              key={pod.id}
              onDragOver={e => { e.preventDefault(); setDragOverPod(pod.id) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverPod(null) }}
              onDrop={() => { if (draggingId) movePatient(draggingId, pod.id); setDraggingId(null); setDragOverPod(null) }}
              className={`flex flex-col rounded border transition-colors ${
                isOver
                  ? isDark ? "border-brand-blue/60 bg-brand-blue/5" : "border-blue-300 bg-blue-50/50"
                  : `${surface} ${border}`
              }`}
            >
              {/* Pod header */}
              <div className={`flex items-center justify-between px-3 py-2 border-b ${subBorder}`}>
                <span className={`text-xs font-semibold ${textPrimary}`}>{pod.name}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 ${isDark ? "bg-dark-input text-txt-muted" : "bg-gray-100 text-gray-500"}`}>
                  {pod.patientIds.length} queued
                </span>
              </div>

              {/* Patient cards */}
              <div className="flex flex-col">
                {pod.patientIds.length === 0 && (
                  <div className={`px-3 py-4 text-center text-[10px] ${textMuted}`}>
                    Drop patients here
                  </div>
                )}
                {pod.patientIds.map(id => {
                  const p         = allPatients[id]
                  const pred      = allPredictions[id]
                  const color     = patientColor(id, allPredictions)
                  const style     = urgencyStyle[color]
                  const isAI      = !!extraPredictions[id]
                  const isDragging = draggingId === id

                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={() => setDraggingId(id)}
                      onDragEnd={() => { setDraggingId(null); setDragOverPod(null) }}
                      onClick={() => onSelect(id)}
                      className={`border-b last:border-b-0 p-3 flex items-center gap-2 transition-all cursor-pointer select-none
                        ${subBorder} ${cardHover}
                        ${isDragging ? "opacity-30" : "opacity-100"}`}
                    >
                      <GripVertical size={12} className={`flex-shrink-0 ${textMuted} cursor-grab`} />
                      <div className={`w-1 self-stretch flex-shrink-0 ${style.indicator}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className={`text-xs font-mono font-semibold ${textPrimary}`}>{id}</span>
                          {pred && (
                            <span className={`text-[10px] font-medium px-1.5 py-px ${style.badge}`}>{pred.urgency_tier}</span>
                          )}
                          {isAI && (
                            <span className="text-[9px] font-bold px-1 py-px bg-brand-blue/20 text-brand-blue">AI</span>
                          )}
                        </div>
                        {p && (
                          <div className={`text-[10px] ${textMuted}`}>
                            {p.age}y · NIHSS {p.nihss_score} · {p.clot_location}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Column 3: Procedure Queue / Gantt ─────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-baseline justify-between">
          <h2 className={`text-sm font-semibold ${textPrimary}`}>Procedure Queue</h2>
          <span className={`text-xs ${textMuted}`}>Parallel rooms · {totalScheduleMin} min total</span>
        </div>

        <div className={`flex-1 rounded border p-5 flex flex-col gap-4 overflow-auto ${surface} ${border}`}>
          {/* Tick labels */}
          <div className="relative h-4 ml-28 min-w-[360px]">
            {ticks.map(t => (
              <span
                key={t}
                className={`absolute text-[10px] ${textMuted} -translate-x-1/2`}
                style={{ left: `${(t / totalScheduleMin) * 100}%` }}
              >{t}m</span>
            ))}
          </div>

          {/* Pod groups */}
          <div className="flex flex-col gap-6 min-w-[360px]">
            {podSchedules.map(({ pod, rows }) => (
              <div key={pod.id} className="flex flex-col gap-2">
                {/* Pod divider label */}
                <div className="flex items-center gap-2 ml-28">
                  <div className={`h-px flex-1 ${divider}`} />
                  <span className={`text-[10px] font-semibold tracking-widest uppercase flex-shrink-0 ${textMuted}`}>{pod.name}</span>
                  <div className={`h-px flex-1 ${divider}`} />
                </div>

                {rows.length === 0 && (
                  <div className={`ml-28 text-[10px] ${textMuted}`}>No patients assigned</div>
                )}

                {rows.map(({ id, pred, start, end }) => {
                  const color      = patientColor(id, allPredictions)
                  const style      = urgencyStyle[color]
                  const isAI       = !!extraPredictions[id]
                  const startPct   = (start / totalScheduleMin) * 100
                  const widthPct   = ((end - start) / totalScheduleMin) * 100
                  const windowMin  = pred?.time_window_minutes ?? 60
                  const windowPct  = Math.min((windowMin / totalScheduleMin) * 100, 100)
                  const pastWindow = start >= windowMin

                  return (
                    <div key={id} className="flex items-center gap-3">
                      <div className="w-28 flex-shrink-0 flex items-center gap-2">
                        <div className={`w-1 h-8 flex-shrink-0 ${style.indicator}`} />
                        <div>
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-mono font-semibold ${textPrimary}`}>{id}</span>
                            {isAI && <span className="text-[9px] font-bold px-1 py-px bg-brand-blue/20 text-brand-blue leading-none">AI</span>}
                          </div>
                          <div className={`text-[10px] ${style.label}`}>{pred?.urgency_tier}</div>
                        </div>
                      </div>

                      <div className={`relative flex-1 h-8 ${trackBg}`}>
                        <div
                          className={`absolute top-0 h-full ${urgencyWindow[color]}`}
                          style={{ left: 0, width: `${windowPct}%` }}
                          title={`Window: ${windowMin} min`}
                        />
                        <div
                          className={`absolute top-1 h-6 ${urgencyBar[color]} ${pastWindow ? "opacity-40" : "opacity-90"}`}
                          style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                          title={`${start}–${end} min`}
                        />
                        {ticks.filter(t => t > 0).map(t => (
                          <div key={t} className={`absolute top-0 h-full w-px ${divider}`} style={{ left: `${(t / totalScheduleMin) * 100}%` }} />
                        ))}
                        <div
                          className={`absolute top-0 h-full w-px ${style.indicator} opacity-60`}
                          style={{ left: `${windowPct}%` }}
                          title={`Window closes at ${windowMin} min`}
                        />
                      </div>

                      <div className={`w-28 flex-shrink-0 text-[10px] ${textMuted}`}>
                        <div>{start}–{end} min</div>
                        <div className={pastWindow ? "text-red-500" : style.label}>
                          {pastWindow ? "⚠ outside window" : `window: ${windowMin}m`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className={`h-px w-full ${divider}`} />
          <div className={`flex flex-wrap gap-5 text-[10px] ${textMuted}`}>
            <div className="flex items-center gap-1.5"><div className="w-4 h-3 bg-red-500/10" /><span>Time window available</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-3 bg-red-500 opacity-90" /><span>Procedure duration</span></div>
            <div className="flex items-center gap-1.5"><div className="w-px h-3 bg-red-500 opacity-60" /><span>Window closes</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-3 bg-red-500 opacity-40" /><span>Outside window (critical)</span></div>
          </div>
        </div>
      </div>

    </div>
  )
}
