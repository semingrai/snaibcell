# 🧠 Snaibcell 
#### S.N.A.I.B: Surgical Neural Analysis Biometrics

**How long can a surgeon safely operate before brain tissue begins to deteriorate?**

Snaibcell is a pre-operative clinical decision support tool that predicts the safe surgical window for stroke thrombectomy patients using machine learning. Built at RocketHacks 2026.

---

## The Problem
Surgeons currently rely on experience and general guidelines to determine how long they can safely operate during stroke thrombectomy. There is no patient-specific, data-driven tool to predict the safe surgical window before neurological deterioration begins.

---

## The Solution
Input a patient's pre-operative clinical profile. Snaibcell outputs:
- **Safe surgical duration** in minutes
- **AI clinical brief** identifying abnormal values and key risk factors
- **Urgency tier** (RED / YELLOW / GREEN)
- **Outcome probability curve** showing how risk increases over time

---

## How It Works

### Two-Stage ML Pipeline

**Stage 1 — Bad Outcome Classifier (XGBoost)**
- Target: bad outcome = hemorrhagic transformation OR 30-day mortality OR mRS ≥ 3
- Duration sweep generates `total_procedure_time_min` — the point where bad outcome probability exceeds 30%
- Mutual information feature selection, stratified 70/30 split, scale_pos_weight for class imbalance

**Stage 2 — Safe Duration Regressor (XGBoost)**
- Trained on `total_procedure_time_min` from Stage 1
- 56 features: 28 original clinical variables + 28 engineered features
- 20-minute safety buffer applied: `safe = max(predicted - 20, 10)`

### Feature Engineering (28 engineered features)
Brain tolerance · Oxygen/metabolic tolerance · Imaging/clot burden · Hemodynamic/lab interactions · Comorbidity burden · Brain deterioration rate · Surgical risk · Experience/severity

### Data Pipeline
- Post-operative leakage columns removed (mrs_90day, recanalization_success, icu_days, number_of_passes, hemorrhagic_transformation, mortality_30day)
- SimpleImputer (median / most_frequent)
- OneHotEncoder for categorical columns
- Mutual information selection (top 30 features)

---

## Stack
| Component | Technology |
|-----------|------------|
| ML | XGBoost, scikit-learn |
| API | FastAPI |
| AI Summarizer | Featherless.AI — OpenBioLLM-70B |
| Deployment | Vultr VPS |
| Frontend | React + Vite + TypeScript + Tailwind + Recharts |

---

## Project Structure
```
-snaibcell/
├── backend/
│   ├── snaibcell.py        # Regressor training + prediction
│   ├── data_cleaning.ipynb # Feature engineering + classifier
│   ├── featherless.py      # AI clinical summarizer
│   ├── server.py           # Flask API
│   └── test_data.py        # Mock profiles for frontend dev
└── frontend/
    └── src/components/     # React dashboard
```

---

## Run Locally
```bash
# Backend
pip install -r requirements.txt
python backend/server.py

# Frontend
cd frontend && npm install && npm run dev

# Test AI summarizer
python backend/featherless.py --patient critical
python backend/featherless.py --patient moderate
python backend/featherless.py --patient favorable
```

---

Built at RocketHacks 2026 — University of Toledo