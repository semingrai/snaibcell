# 🧠 Snaibcell
#### S.N.A.I.B: Surgical Neural Analysis Intelligent Biometrics

**How long can a surgeon safely operate before brain tissue begins to deteriorate?**

Snaibcell is a pre-operative clinical decision support tool that predicts the safe surgical window for stroke thrombectomy patients using machine learning. Built at RocketHacks 2026.

---

## The Problem
Surgeons currently rely on experience and general guidelines to determine how long they can safely operate during stroke thrombectomy. There is no patient-specific, data-driven tool to predict the safe surgical window before irreversible neurological deterioration begins — and every extra minute matters.

---

## The Solution
Describe or load a patient's pre-operative clinical profile. Snaibcell outputs:
- **Safe surgical duration** in minutes (ML-predicted, patient-specific)
- **Urgency tier** (RED / YELLOW / GREEN) with time window
- **Outcome probability S-curve** showing how risk escalates over time
- **AI clinical brief** (technical + family letter) via OpenBioLLM-70B
- **AI Emergency Triage** — describe a patient in plain language, get a full clinical profile in seconds
- **Multi-room pod scheduling** — assign patients to procedure rooms, drag-and-drop reordering, parallel Gantt timeline

---

## How It Works

### Two-Stage ML Pipeline

**Stage 1 — Bad Outcome Classifier (XGBoost)**
- Target: bad outcome = hemorrhagic transformation OR 30-day mortality OR mRS ≥ 3
- Duration sweep generates `total_procedure_time_min` — the point where bad outcome probability exceeds 30%
- Mutual information feature selection, stratified 70/30 split, `scale_pos_weight` for class imbalance

**Stage 2 — Safe Duration Regressor (XGBoost)**
- Trained on `total_procedure_time_min` derived from Stage 1
- 56 features: 28 original clinical variables + 28 engineered features
- 20-minute safety buffer applied: `safe = max(predicted − 20, 10)`

### Feature Engineering (28 engineered features)
Brain tolerance · Oxygen/metabolic tolerance · Imaging/clot burden · Hemodynamic/lab interactions · Comorbidity burden · Brain deterioration rate · Surgical risk · Experience/severity

### Data Pipeline
- Post-operative leakage columns removed (`mrs_90day`, `recanalization_success`, `icu_days`, `number_of_passes`, `hemorrhagic_transformation`, `mortality_30day`)
- `SimpleImputer` (median / most_frequent)
- `OneHotEncoder` for categorical columns
- Sklearn `Pipeline` with XGBoost regressor

### AI Triage Validation
Input is validated against a clinical keyword ruleset before any LLM call — non-clinical input (greetings, test strings, names) is rejected instantly without consuming API tokens.

---

## Stack
| Component | Technology |
|-----------|------------|
| ML | XGBoost, scikit-learn, pandas, numpy |
| API | FastAPI + Uvicorn |
| AI Triage & Clinical Brief | Featherless.AI — Llama3-OpenBioLLM-70B |
| Frontend | React + Vite + TypeScript + Tailwind CSS + Recharts |
| Deployment | Docker + Vultr VPS |

---

## Project Structure
```
snaibcell/
├── backend/
│   ├── server.py               # FastAPI — /triage, /clinical-brief, /chat, /demo-patients
│   ├── featherless.py          # OpenBioLLM-70B clinical summarizer
│   ├── snaibcell_bridge.py     # Loads trained pkl, exposes predict_duration()
│   └── test_data.py            # Dev patient profiles
├── frontend/
│   └── src/
│       ├── App.tsx             # Pod state, localStorage, demo patient fetch
│       └── components/
│           ├── PatientLookup.tsx   # Triage UI, pod lanes, Gantt scheduler
│           ├── RiskDashboard.tsx   # Patient risk view
│           ├── RiskFactors.tsx     # Clinical brief + AI chat
│           └── RiskChart.tsx       # Outcome probability S-curve
├── testing_data/               # Red/yellow/green benchmark patients (CSV)
├── data_cleaning.ipynb         # Feature engineering + classifier
├── snaibcell.py                # Regressor training, saves snaibcell_model.pkl
├── test_predictions.py         # Run testing_data/ through the trained model
├── data_cleaned_version.csv
└── stroke_thrombectomy_dataset.csv
```

---

## Run Locally

```bash
# Train the model first (from project root)
python snaibcell.py

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn xgboost scikit-learn pandas numpy python-dotenv openai pydantic
uvicorn server:app --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend
npm install && npm run dev
```

Add a `backend/.env` file:
```
FEATHERLESS_API_KEY=your_key_here
```

Test model predictions against benchmark patients:
```bash
python test_predictions.py
```

---

## Deploy (Docker)

```bash
docker-compose up -d --build
```

The frontend is served by Nginx on port 80. The backend runs on port 8000 internally and is proxied via Nginx.

---

Built at RocketHacks 2026 — University of Toledo
