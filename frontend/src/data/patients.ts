export interface Pod {
  id: string
  name: string
  patientIds: string[]
}

export interface PatientData {
  patient_id: string
  age: number
  gender: string
  nihss_score: number
  gcs_score: number
  aspects_score: number
  clot_location: string
  clot_length_mm: number
  penumbra_volume_ml: number
  core_infarct_volume_ml: number
  mismatch_ratio: number
  systolic_bp: number
  blood_glucose: number
  onset_to_door_min: number
  hypertension: number
  diabetes: number
  atrial_fibrillation: number
  interventionist_experience_years: number
}

export interface TimeCurvePoint {
  minutes: number
  bad_outcome_prob: number
}

export interface PredictionOutput {
  predicted_mrs: number
  independence_prob: number
  urgency_tier: 'RED' | 'YELLOW' | 'GREEN'
  time_window_minutes: number
  mrs_plain_english: string
  predicted_duration_min: number
  safe_duration_min: number
  top_features: { label: string; direction: 'up' | 'down'; weight: number }[]
  time_curve: TimeCurvePoint[]
}

// S-curve: bad_outcome_prob = f(procedure_duration_min), 0–180 min
// Derived from: 100 - independence_prob, extended with clinical S-curve logic
function buildSCurve(
  baseProb: number,
  _safePredicted: number,
  maxProb: number
): TimeCurvePoint[] {
  const points: TimeCurvePoint[] = []
  for (let m = 0; m <= 180; m += 5) {
    const t = m / 180
    // Sigmoid centred at ~80 min (0.44 of range), stretched to maxProb
    const sig = 1 / (1 + Math.exp(-10 * (t - 0.44)))
    const prob = baseProb + (maxProb - baseProb) * sig
    points.push({ minutes: m, bad_outcome_prob: Math.min(99, Math.round(prob)) })
  }
  return points
}

// Consequence text by bad-outcome threshold
export function consequenceText(pct: number): string {
  if (pct >= 90) return 'Near-certain severe disability or death'
  if (pct >= 75) return 'Severe disability — dependent care very likely'
  if (pct >= 60) return 'Moderate-severe disability — limited recovery'
  if (pct >= 45) return 'Moderate disability — partial independence possible'
  if (pct >= 30) return 'Mild-moderate disability — good recovery likely'
  return 'Good functional outcome expected'
}

export const patients: Record<string, PatientData> = {
  ST0001: {
    patient_id: 'ST0001',
    age: 72,
    gender: 'Female',
    nihss_score: 31,
    gcs_score: 14,
    aspects_score: 2,
    clot_location: 'Basilar',
    clot_length_mm: 17.3,
    penumbra_volume_ml: 97.8,
    core_infarct_volume_ml: 4.5,
    mismatch_ratio: 21.7,
    systolic_bp: 205,
    blood_glucose: 121,
    onset_to_door_min: 99,
    hypertension: 1,
    diabetes: 0,
    atrial_fibrillation: 0,
    interventionist_experience_years: 23.0,
  },
  ST0009: {
    patient_id: 'ST0009',
    age: 61,
    gender: 'Female',
    nihss_score: 37,
    gcs_score: 6,
    aspects_score: 10,
    clot_location: 'MCA-M1',
    clot_length_mm: 10.3,
    penumbra_volume_ml: 36.9,
    core_infarct_volume_ml: 4.5,
    mismatch_ratio: 6.71,
    systolic_bp: 174,
    blood_glucose: 118,
    onset_to_door_min: 66,
    hypertension: 1,
    diabetes: 0,
    atrial_fibrillation: 0,
    interventionist_experience_years: 2.0,
  },
  ST0014: {
    patient_id: 'ST0014',
    age: 44,
    gender: 'Male',
    nihss_score: 31,
    gcs_score: 10,
    aspects_score: 5,
    clot_location: 'ICA',
    clot_length_mm: 14.2,
    penumbra_volume_ml: 72.4,
    core_infarct_volume_ml: 8.1,
    mismatch_ratio: 8.94,
    systolic_bp: 192,
    blood_glucose: 134,
    onset_to_door_min: 78,
    hypertension: 1,
    diabetes: 1,
    atrial_fibrillation: 1,
    interventionist_experience_years: 5.0,
  },
  ST0045: {
    patient_id: 'ST0045',
    age: 49,
    gender: 'Female',
    nihss_score: 1,
    gcs_score: 7,
    aspects_score: 3,
    clot_location: 'Basilar',
    clot_length_mm: 18.5,
    penumbra_volume_ml: 42.3,
    core_infarct_volume_ml: 1.4,
    mismatch_ratio: 17.62,
    systolic_bp: 185,
    blood_glucose: 68,
    onset_to_door_min: 10,
    hypertension: 0,
    diabetes: 0,
    atrial_fibrillation: 0,
    interventionist_experience_years: 3.0,
  },
}

export const predictions: Record<string, PredictionOutput> = {
  ST0001: {
    predicted_mrs: 4,
    independence_prob: 23,
    urgency_tier: 'RED',
    time_window_minutes: 45,
    mrs_plain_english: 'moderate-severe disability, likely needs daily assistance',
    predicted_duration_min: 100,
    safe_duration_min: 80,
    top_features: [
      { label: 'High NIHSS Score (31)', direction: 'up', weight: 96 },
      { label: 'Basilar Artery Location', direction: 'up', weight: 83 },
      { label: 'Low ASPECTS Score (2)', direction: 'up', weight: 72 },
      { label: 'Large Penumbra (97.8 ml)', direction: 'up', weight: 61 },
      { label: 'Onset to Door (99 min)', direction: 'up', weight: 48 },
    ],
    time_curve: buildSCurve(22, 80, 96),
  },
  ST0009: {
    predicted_mrs: 2,
    independence_prob: 61,
    urgency_tier: 'YELLOW',
    time_window_minutes: 90,
    mrs_plain_english: 'slight disability, lives independently',
    predicted_duration_min: 75,
    safe_duration_min: 55,
    top_features: [
      { label: 'High Penumbra Volume (36.9 ml)', direction: 'up', weight: 74 },
      { label: 'Good ASPECTS Score (10)', direction: 'down', weight: 65 },
      { label: 'Junior Interventionist (2 yrs)', direction: 'up', weight: 58 },
      { label: 'Moderate Onset Time (66 min)', direction: 'up', weight: 40 },
      { label: 'Normal Glucose (118)', direction: 'down', weight: 28 },
    ],
    time_curve: buildSCurve(12, 55, 88),
  },
  ST0014: {
    predicted_mrs: 3,
    independence_prob: 41,
    urgency_tier: 'RED',
    time_window_minutes: 60,
    mrs_plain_english: 'moderate disability, requires some assistance',
    predicted_duration_min: 115,
    safe_duration_min: 95,
    top_features: [
      { label: 'High NIHSS Score (31)', direction: 'up', weight: 91 },
      { label: 'ICA Occlusion', direction: 'up', weight: 78 },
      { label: 'Diabetes + Hypertension', direction: 'up', weight: 68 },
      { label: 'Atrial Fibrillation', direction: 'up', weight: 55 },
      { label: 'Elevated Glucose (134)', direction: 'up', weight: 44 },
    ],
    time_curve: buildSCurve(28, 95, 97),
  },
  ST0045: {
    predicted_mrs: 1,
    independence_prob: 84,
    urgency_tier: 'GREEN',
    time_window_minutes: 120,
    mrs_plain_english: 'no significant disability',
    predicted_duration_min: 65,
    safe_duration_min: 45,
    top_features: [
      { label: 'Low Core Infarct (1.4 ml)', direction: 'down', weight: 82 },
      { label: 'High Mismatch Ratio (17.6)', direction: 'down', weight: 71 },
      { label: 'Fast Onset-to-Door (10 min)', direction: 'down', weight: 63 },
      { label: 'Young Age (49)', direction: 'down', weight: 50 },
      { label: 'No Comorbidities', direction: 'down', weight: 38 },
    ],
    time_curve: buildSCurve(8, 45, 82),
  },
}

export const demoChips = [
  { id: 'ST0001', label: 'Critical',  color: 'red'   },
  { id: 'ST0009', label: 'Moderate',  color: 'amber' },
  { id: 'ST0014', label: 'Severe',    color: 'red'   },
  { id: 'ST0045', label: 'Favorable', color: 'green' },
] as const
