import re
import json
import math
import glob
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from featherless import generate_communication, client as fl_client
from snaibcell_bridge import predict_duration as _ml_predict_duration

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["Content-Type"],
)

_triage_counter = 0


def build_time_curve(base_bad: float, max_bad: float) -> list:
    """S-curve matching the frontend buildSCurve logic."""
    points = []
    for m in range(0, 181, 5):
        t = m / 180
        sig = 1 / (1 + math.exp(-10 * (t - 0.44)))
        prob = base_bad + (max_bad - base_bad) * sig
        points.append({"minutes": m, "bad_outcome_prob": min(99, round(prob))})
    return points


# ── Shared models ─────────────────────────────────────────────────────────────

class TopFeature(BaseModel):
    label: str
    direction: str
    weight: float


class PatientData(BaseModel):
    patient_id: str
    age: int
    gender: str
    nihss_score: int
    gcs_score: int
    aspects_score: int
    clot_location: str
    clot_length_mm: float
    penumbra_volume_ml: float
    core_infarct_volume_ml: float
    mismatch_ratio: float
    systolic_bp: int
    blood_glucose: int
    onset_to_door_min: int
    hypertension: int
    diabetes: int
    atrial_fibrillation: int
    interventionist_experience_years: float


class PredictionOutput(BaseModel):
    predicted_mrs: int
    independence_prob: int
    urgency_tier: str
    time_window_minutes: int
    mrs_plain_english: str
    predicted_duration_min: int
    safe_duration_min: int
    top_features: List[TopFeature]


class BriefRequest(BaseModel):
    patient_data: PatientData
    prediction_output: PredictionOutput


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]


class TriageRequest(BaseModel):
    description: str


# ── /clinical-brief ───────────────────────────────────────────────────────────

@app.post("/clinical-brief")
def clinical_brief(req: BriefRequest):
    patient = req.patient_data.model_dump()
    prediction = req.prediction_output.model_dump()
    prediction["top_features"] = [f["label"] for f in prediction["top_features"]]

    result = generate_communication(patient, prediction)

    tb = result.get("technical_brief", "")
    fl = result.get("family_letter", "")
    if tb.startswith("Error") or fl.startswith("Error"):
        raise HTTPException(status_code=502, detail=tb or fl or "AI service error")

    return result


# ── /chat ─────────────────────────────────────────────────────────────────────

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        response = fl_client.chat.completions.create(
            model="aaditya/Llama3-OpenBioLLM-70B",
            messages=[m.model_dump() for m in req.messages],
            max_tokens=400,
            temperature=0.3,
        )
        return {"content": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── /triage ───────────────────────────────────────────────────────────────────

_CLINICAL_KEYWORDS = {
    # symptoms
    "weakness", "paralysis", "hemiplegia", "hemiparesis", "aphasia", "dysarthria",
    "slurred", "speech", "facial", "droop", "numbness", "tingling", "vision",
    "headache", "dizzy", "dizziness", "vertigo", "nausea", "vomiting",
    "unconscious", "unresponsive", "confused", "lethargic", "seizure", "stroke",
    # demographics
    "male", "female", "man", "woman", "year", "old", "yo", "y/o", "patient",
    "obese", "diabetic", "hypertensive",
    # vitals / scores
    "bp", "blood", "pressure", "pulse", "hr", "glucose", "oxygen", "sat",
    "nihss", "gcs", "aspects", "inr",
    # clinical
    "history", "hypertension", "diabetes", "afib", "atrial", "fibrillation",
    "onset", "symptom", "deficit", "mca", "ica", "basilar", "artery", "clot",
    "tpa", "thrombectomy", "ischemic", "hemorrhagic", "ct", "mri",
    # weight/size (common in descriptions)
    "lb", "lbs", "kg", "bmi", "overweight",
}

def _is_clinical(text: str) -> bool:
    lower = text.lower()
    words = set(re.findall(r"[a-z]+", lower))
    has_number = bool(re.search(r"\d", text))
    has_keyword = bool(words & _CLINICAL_KEYWORDS)
    long_enough = len(text.strip()) >= 15
    # Must have length + (a number AND a keyword, or multiple keywords)
    keyword_count = len(words & _CLINICAL_KEYWORDS)
    return long_enough and (has_number and has_keyword or keyword_count >= 2)


@app.post("/triage")
def triage(req: TriageRequest):
    global _triage_counter

    if not _is_clinical(req.description):
        raise HTTPException(
            status_code=422,
            detail="Please describe a real patient — include clinical details like age, symptoms, or vitals."
        )

    _triage_counter += 1
    counter = _triage_counter

    system_prompt = f"""You are SNAIBCELL, a strict clinical stroke triage AI deployed exclusively in interventional neurology units. You process input from licensed medical professionals only.

IDENTITY RULES — never break these:
- You are a medical triage tool. You do not chat, answer questions, or respond to non-clinical input.
- You do not greet, explain yourself, or acknowledge the user personally.
- If the input is not a legitimate clinical patient description, you output ONLY this exact JSON and nothing else:
  {{"error": "NOT_CLINICAL"}}
- A valid input must describe a real or hypothetical patient with at least one of: neurological symptoms, age/demographics with a medical context, vital signs, or a clinical finding.
- Greetings, names, test strings, questions, and anything without patient clinical context → output {{"error": "NOT_CLINICAL"}}
- When uncertain whether input is clinical → output {{"error": "NOT_CLINICAL"}}

INVALID EXAMPLES (always return the error JSON):
- "hi my name is ryan"
- "test"
- "hello"
- "what does this do"
- Any sentence with no medical/clinical content

VALID EXAMPLES (proceed with full triage JSON):
- "68yo male, sudden right arm weakness, slurred speech, BP 185/110"
- "300lb woman unresponsive, found down, last seen normal 2 hours ago"
- "65 year old with left sided hemiplegia and facial droop, NIHSS around 14"

If valid, output ONLY a valid JSON object with these fields. No markdown, no explanation, no code fences:

{{
  "patient_id": "P{counter:03d}",
  "age": <integer>,
  "gender": "<Male|Female|Unknown>",
  "nihss_score": <0-42>,
  "gcs_score": <3-15>,
  "aspects_score": <0-10, default 7 if unknown>,
  "clot_location": "<MCA-M1|MCA-M2|ICA|Basilar|Other>",
  "clot_length_mm": <float>,
  "penumbra_volume_ml": <float>,
  "core_infarct_volume_ml": <float>,
  "mismatch_ratio": <float>,
  "systolic_bp": <integer>,
  "blood_glucose": <integer, default 110>,
  "onset_to_door_min": <integer>,
  "hypertension": <0 or 1>,
  "diabetes": <0 or 1>,
  "atrial_fibrillation": <0 or 1>,
  "interventionist_experience_years": <float, default 5.0>,
  "urgency_tier": "<RED|YELLOW|GREEN>",
  "predicted_duration_min": <60-180>,
  "safe_duration_min": <predicted_duration_min minus 20>,
  "independence_prob": <0-100>,
  "predicted_mrs": <0-6>,
  "mrs_plain_english": "<brief disability description>",
  "time_window_minutes": <15-120>,
  "top_features": [
    {{"label": "<key clinical factor with value>", "direction": "up", "weight": <50-100>}},
    {{"label": "<key clinical factor with value>", "direction": "up", "weight": <30-85>}},
    {{"label": "<key clinical factor with value>", "direction": "<up|down>", "weight": <20-70>}}
  ]
}}

CLINICAL REASONING GUIDELINES (only apply when input is valid):
- "Unresponsive", "unconscious", low GCS, or "found down" → NIHSS 20-35, urgency RED
- "Weakness", "hemiplegia", "paralysis" on one side → NIHSS 12-20, likely MCA-M1
- "Speech difficulty" or "aphasia" alone → NIHSS 5-10, urgency YELLOW
- "Facial droop" alone → NIHSS 4-8
- Age > 65 → increase NIHSS estimate by 3, reduce independence_prob by 10%
- Obese / weight > 250 lbs / BMI > 35 → increase predicted_duration_min by 15
- Systolic BP > 180 → urgency RED, reduce time_window_minutes by 20
- Unknown onset time → set onset_to_door_min to 60
- When urgency uncertain → default to RED"""

    try:
        response = fl_client.chat.completions.create(
            model="aaditya/Llama3-OpenBioLLM-70B",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.description},
            ],
            max_tokens=900,
            temperature=0.1,
        )
        raw = response.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Extract JSON — handle markdown fences or raw object
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if fence_match:
        json_str = fence_match.group(1)
    else:
        start, end = raw.find("{"), raw.rfind("}")
        if start == -1 or end == -1:
            raise HTTPException(status_code=502, detail=f"Model did not return valid JSON. Got: {raw[:200]}")
        json_str = raw[start : end + 1]

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"JSON parse error: {e}")

    if data.get("error") == "NOT_CLINICAL":
        _triage_counter -= 1
        raise HTTPException(status_code=422, detail="Please describe a real patient — include clinical details like age, symptoms, or vitals.")

    def gi(key, default):
        try:
            return int(data.get(key, default))
        except (TypeError, ValueError):
            return default

    def gf(key, default):
        try:
            return float(data.get(key, default))
        except (TypeError, ValueError):
            return default

    independence_prob = gi("independence_prob", 40)
    base_bad = max(0, min(99, 100 - independence_prob))
    max_bad = min(99, base_bad + 28)

    pred_duration = gi("predicted_duration_min", 90)
    safe_duration = gi("safe_duration_min", max(pred_duration - 20, 10))

    urgency = str(data.get("urgency_tier", "RED")).upper()
    if urgency not in ("RED", "YELLOW", "GREEN"):
        urgency = "RED"

    patient = {
        "patient_id": f"P{counter:03d}",
        "age": gi("age", 60),
        "gender": str(data.get("gender", "Unknown")),
        "nihss_score": gi("nihss_score", 15),
        "gcs_score": gi("gcs_score", 12),
        "aspects_score": gi("aspects_score", 7),
        "clot_location": str(data.get("clot_location", "MCA-M1")),
        "clot_length_mm": gf("clot_length_mm", 12.0),
        "penumbra_volume_ml": gf("penumbra_volume_ml", 50.0),
        "core_infarct_volume_ml": gf("core_infarct_volume_ml", 8.0),
        "mismatch_ratio": gf("mismatch_ratio", 6.0),
        "systolic_bp": gi("systolic_bp", 160),
        "blood_glucose": gi("blood_glucose", 110),
        "onset_to_door_min": gi("onset_to_door_min", 60),
        "hypertension": gi("hypertension", 1),
        "diabetes": gi("diabetes", 0),
        "atrial_fibrillation": gi("atrial_fibrillation", 0),
        "interventionist_experience_years": gf("interventionist_experience_years", 5.0),
    }

    ml_durations = _ml_predict_duration(patient)
    if ml_durations:
        pred_duration = ml_durations["predicted_duration_min"]
        safe_duration = ml_durations["safe_duration_min"]

    prediction = {
        "predicted_mrs": gi("predicted_mrs", 3),
        "independence_prob": independence_prob,
        "urgency_tier": urgency,
        "time_window_minutes": gi("time_window_minutes", 60),
        "mrs_plain_english": str(data.get("mrs_plain_english", "moderate disability")),
        "predicted_duration_min": pred_duration,
        "safe_duration_min": safe_duration,
        "top_features": data.get("top_features", []),
        "time_curve": build_time_curve(base_bad, max_bad),
    }

    return {"patient": patient, "prediction": prediction}


# ── /demo-patients ─────────────────────────────────────────────────────────────

@app.get("/demo-patients")
def demo_patients():
    data_dir = os.path.join(os.path.dirname(__file__), "..", "testing_data")
    results = []

    for path in sorted(glob.glob(os.path.join(data_dir, "*.csv"))):
        import pandas as pd
        df = pd.read_csv(path)
        for _, row in df.iterrows():
            d = row.to_dict()

            raw_id = str(d.get("patient_id", "T000"))
            pid = raw_id.replace("ST_", "T_")

            nihss   = int(d.get("nihss_score", 15))
            gcs     = int(d.get("gcs_score", 12))
            aspects = int(d.get("aspects_score", 7))

            if nihss >= 25 or gcs <= 8 or aspects <= 3:
                urgency = "RED"
            elif nihss >= 15 or gcs <= 11 or aspects <= 6:
                urgency = "YELLOW"
            else:
                urgency = "GREEN"

            independence_prob = max(5, min(95, 100 - nihss * 2 - (10 - aspects) * 2))
            predicted_mrs = 4 if nihss >= 25 else 3 if nihss >= 15 else 2 if nihss >= 5 else 1
            time_window = {"RED": 45, "YELLOW": 90, "GREEN": 120}[urgency]

            ml = _ml_predict_duration(d)
            pred_duration = ml["predicted_duration_min"] if ml else 90
            safe_duration = ml["safe_duration_min"] if ml else 70

            base_bad = max(0, min(99, 100 - independence_prob))
            max_bad  = min(99, base_bad + 28)

            gender_raw = d.get("gender", 1)
            gender = "Male" if str(gender_raw) == "1" else "Female"

            patient = {
                "patient_id": pid,
                "age": int(d.get("age", 60)),
                "gender": gender,
                "nihss_score": nihss,
                "gcs_score": gcs,
                "aspects_score": aspects,
                "clot_location": str(d.get("clot_location", "MCA-M1")),
                "clot_length_mm": float(d.get("clot_length_mm", 10.0)),
                "penumbra_volume_ml": float(d.get("penumbra_volume_ml", 50.0)),
                "core_infarct_volume_ml": float(d.get("core_infarct_volume_ml", 8.0)),
                "mismatch_ratio": float(d.get("mismatch_ratio", 6.0)),
                "systolic_bp": int(d.get("systolic_bp", 160)),
                "blood_glucose": int(d.get("blood_glucose", 110)),
                "onset_to_door_min": int(d.get("onset_to_door_min", 60)),
                "hypertension": int(d.get("hypertension", 0)),
                "diabetes": int(d.get("diabetes", 0)),
                "atrial_fibrillation": int(d.get("atrial_fibrillation", 0)),
                "interventionist_experience_years": float(d.get("interventionist_experience_years", 5.0)),
            }

            prediction = {
                "predicted_mrs": predicted_mrs,
                "independence_prob": independence_prob,
                "urgency_tier": urgency,
                "time_window_minutes": time_window,
                "mrs_plain_english": ["no significant disability", "slight disability", "moderate disability", "moderate-severe disability", "severe disability"][predicted_mrs],
                "predicted_duration_min": pred_duration,
                "safe_duration_min": safe_duration,
                "top_features": [
                    {"label": f"NIHSS Score ({nihss})", "direction": "up", "weight": min(99, nihss * 2)},
                    {"label": f"ASPECTS Score ({aspects})", "direction": "up" if aspects < 7 else "down", "weight": abs(aspects - 10) * 8},
                    {"label": str(d.get("clot_location", "MCA-M1")), "direction": "up", "weight": 60},
                ],
                "time_curve": build_time_curve(base_bad, max_bad),
            }

            results.append({"patient": patient, "prediction": prediction})

    return results
