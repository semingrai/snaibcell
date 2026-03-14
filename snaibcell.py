import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from xgboost import XGBRegressor


# load cleaned data
df = pd.read_csv("data_cleaned_version.csv")

# target: actual procedure duration in minutes
y = df["puncture_to_recanalization_min"]

# choose pre‑procedure features only
features = [
    "age",
    "gender",
    "bmi",
    "nihss_score",
    "gcs_score",
    "systolic_bp",
    "blood_glucose",
    "oxygen_saturation",
    "inr",
    "hemoglobin",
    "creatinine",
    "clot_location",
    "clot_length_mm",
    "aspects_score",
    "collateral_score",
    "penumbra_volume_ml",
    "core_infarct_volume_ml",
    "mismatch_ratio",
    "hypertension",
    "diabetes",
    "atrial_fibrillation",
    "prior_stroke",
    "smoking_history",
    "onset_to_door_min",
    "door_to_ct_min",
    "ct_to_puncture_min",
    "tpa_given",
    "interventionist_experience_years",
]

# columns that exist in the cleaned CSV
features = [c for c in features if c in df.columns]

X = df[features]

# train / validation split
X_train, X_valid, y_train, y_valid = train_test_split(
    X, y, test_size=0.3, random_state=0
)

# columns by type
categorical_cols = [c for c in X_train.columns if X_train[c].dtype == "object"]
numerical_cols = [c for c in X_train.columns if c not in categorical_cols]

# preprocessing
numeric_transformer = SimpleImputer(strategy="median")

categorical_transformer = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ]
)

preprocessor = ColumnTransformer(
    transformers=[
        ("num", numeric_transformer, numerical_cols),
        ("cat", categorical_transformer, categorical_cols),
    ]
)

# model
model = Pipeline(
    steps=[
        ("preprocess", preprocessor),
        (
            "model",
            XGBRegressor(
                n_estimators=400,
                learning_rate=0.05,
                max_depth=4,
                subsample=0.8,
                colsample_bytree=0.8,
                min_child_weight=3,
                objective="reg:squarederror",
                n_jobs=-1,
                random_state=0,
            ),
        ),
    ]
)

# fit
model.fit(X_train, y_train)

# evaluate
preds = model.predict(X_valid)

mae = mean_absolute_error(y_valid, preds)
rmse = mean_squared_error(y_valid, preds, squared=False)
r2 = r2_score(y_valid, preds)

print("Surgery duration prediction model (target: puncture_to_recanalization_min)")
print(f"Validation MAE  (minutes): {mae:.2f}")
print(f"Validation RMSE (minutes): {rmse:.2f}")
print(f"Validation R^2           : {r2:.3f}")

