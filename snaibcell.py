import pandas as pd
import numpy as np

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor


# ── 1. Train ──────────────────────────────────────────────────────────────────

df = pd.read_csv("data_cleaned_version.csv")

y = df["total_procedure_time_min"]

FEATURES = [
    # Original columns
    "age", "gender", "bmi", "nihss_score", "gcs_score",
    "systolic_bp", "blood_glucose", "oxygen_saturation",
    "inr", "hemoglobin", "creatinine", "clot_location",
    "clot_length_mm", "aspects_score", "collateral_score",
    "penumbra_volume_ml", "core_infarct_volume_ml", "mismatch_ratio",
    "hypertension", "diabetes", "atrial_fibrillation", "prior_stroke",
    "smoking_history", "onset_to_door_min", "door_to_ct_min",
    "ct_to_puncture_min", "tpa_given", "interventionist_experience_years",
    # Engineered columns
    "arrvial_imaging_efficiency", "brain_reserve", "age_adjusted_penumbra",
    "age_weighted_core", "aspects_penumbra_interaction", "cerebral_oxygen_reserve",
    "metabolic_infarct_burden", "hemorrhagic_risk", "oxygen_per_deficit",
    "penumbra_salvageable_ratio", "salvageable_tissue", "clot_burden",
    "weighted_mismatch", "oxygen_delivery", "metabolic_pressure_ratio",
    "coagulation_renal", "hemo_renal_ratio", "comorbidity_count",
    "age_severity", "age_burden", "cardiovascular_load",
    "experience_adjusted_difficulty", "deficit_per_viable_brain",
    "core_to_penumbra_ratio", "case_difficulty", "consciousness_deficit_ratio",
    "bmi_severity", "collateral_penumbra",
]
FEATURES = [c for c in FEATURES if c in df.columns]

X = df[FEATURES]

categorical_cols = [c for c in X.columns if X[c].dtype == "object"]
numerical_cols   = [c for c in X.columns if c not in categorical_cols]

preprocessor = ColumnTransformer(transformers=[
    ("num", SimpleImputer(strategy="median"), numerical_cols),
    ("cat", Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ]), categorical_cols),
])

model = Pipeline(steps=[
    ("preprocess", preprocessor),
    ("model", XGBRegressor(
        n_estimators=400, learning_rate=0.05, max_depth=4,
        subsample=0.8, colsample_bytree=0.8, min_child_weight=3,
        objective="reg:squarederror", n_jobs=-1, random_state=0,
    )),
])

model.fit(X, y)


# ── 2. Predict from upload ────────────────────────────────────────────────────
# FILE FROM THE WEB
patient_df = pd.read_csv()
X_input    = patient_df.reindex(columns=FEATURES)
predicted  = model.predict(X_input)
safe       = np.maximum(predicted - 20, 10)

results = patient_df[["patient_id"]].copy() if "patient_id" in patient_df.columns else pd.DataFrame()
results["predicted_duration_min"] = predicted.round(1)
results["safe_duration_min"]      = safe.round(1)
results.to_csv("results.csv", index=False)