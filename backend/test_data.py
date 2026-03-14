# Mock patient profiles for frontend development
# Replace with real model calls when partner finishes

test_patients = {
    "critical": {
        "patient_id": "ST0001",
        "age": 72,
        "gender": "Female",
        "nihss_score": 31,
        "gcs_score": 14,
        "aspects_score": 2,
        "clot_location": "Basilar",
        "clot_length_mm": 17.3,
        "penumbra_volume_ml": 97.8,
        "core_infarct_volume_ml": 4.5,
        "mismatch_ratio": 21.7,
        "systolic_bp": 205,
        "blood_glucose": 121,
        "onset_to_door_min": 99,
        "hypertension": 1,
        "diabetes": 0,
        "atrial_fibrillation": 0,
        "interventionist_experience_years": 23.0
    },
    "moderate": {
        "patient_id": "ST0009",
        "age": 61,
        "gender": "Female", 
        "nihss_score": 37,
        "gcs_score": 6,
        "aspects_score": 10,
        "clot_location": "MCA-M1",
        "clot_length_mm": 10.3,
        "penumbra_volume_ml": 36.9,
        "core_infarct_volume_ml": 4.5,
        "mismatch_ratio": 6.71,
        "systolic_bp": 174,
        "blood_glucose": 118,
        "onset_to_door_min": 66,
        "hypertension": 1,
        "diabetes": 0,
        "atrial_fibrillation": 0,
        "interventionist_experience_years": 2.0
    },
    "favorable": {
        "patient_id": "ST0045",
        "age": 49,
        "gender": "Female",
        "nihss_score": 1,
        "gcs_score": 7,
        "aspects_score": 3,
        "clot_location": "Basilar",
        "clot_length_mm": 18.5,
        "penumbra_volume_ml": 42.3,
        "core_infarct_volume_ml": 1.4,
        "mismatch_ratio": 17.62,
        "systolic_bp": 185,
        "blood_glucose": 68,
        "onset_to_door_min": 10,
        "hypertension": 0,
        "diabetes": 0,
        "atrial_fibrillation": 0,
        "interventionist_experience_years": 3.0
    }
}

# Mock prediction outputs — replace when model is ready
test_predictions = {
    "critical": {
        "predicted_mrs": 4,
        "independence_prob": 23,
        "urgency_tier": "RED",
        "time_window_minutes": 45,
        "mrs_plain_english": "moderate-severe disability, likely needs daily assistance",
        "top_features": [
            "High stroke severity (NIHSS 31)",
            "Basilar artery location",
            "Low ASPECTS score (2)"
        ],
        "time_curve": [
            {"minutes": 0,  "independence_prob": 23},
            {"minutes": 30, "independence_prob": 18},
            {"minutes": 60, "independence_prob": 12},
            {"minutes": 90, "independence_prob": 8},
            {"minutes": 120,"independence_prob": 4}
        ]
    },
    "moderate": {
        "predicted_mrs": 2,
        "independence_prob": 61,
        "urgency_tier": "YELLOW",
        "time_window_minutes": 90,
        "mrs_plain_english": "slight disability, lives independently",
        "top_features": [
            "High penumbra volume (salvageable tissue)",
            "Good ASPECTS score (10)",
            "Moderate onset time"
        ],
        "time_curve": [
            {"minutes": 0,  "independence_prob": 61},
            {"minutes": 30, "independence_prob": 52},
            {"minutes": 60, "independence_prob": 41},
            {"minutes": 90, "independence_prob": 29},
            {"minutes": 120,"independence_prob": 18}
        ]
    },
    "favorable": {
        "predicted_mrs": 1,
        "independence_prob": 84,
        "urgency_tier": "GREEN",
        "time_window_minutes": 120,
        "mrs_plain_english": "no significant disability",
        "top_features": [
            "Low core infarct volume",
            "High mismatch ratio",
            "Fast onset-to-door time"
        ],
        "time_curve": [
            {"minutes": 0,  "independence_prob": 84},
            {"minutes": 30, "independence_prob": 76},
            {"minutes": 60, "independence_prob": 65},
            {"minutes": 90, "independence_prob": 51},
            {"minutes": 120,"independence_prob": 38}
        ]
    }
}