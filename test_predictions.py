"""
Run all CSVs in testing_data/ through the trained snaibcell model.
Usage: python test_predictions.py  (from project root)
"""
import os
import sys
import glob
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from snaibcell_bridge import predict_duration, _available  # type: ignore

DATA_DIR = os.path.join(os.path.dirname(__file__), "testing_data")

if not _available:
    print("ERROR: snaibcell_model.pkl not found. Run `python snaibcell.py` first.")
    sys.exit(1)

csv_files = sorted(glob.glob(os.path.join(DATA_DIR, "*.csv")))
if not csv_files:
    print(f"No CSV files found in {DATA_DIR}")
    sys.exit(1)

print(f"{'Patient':<12} {'Predicted (min)':<18} {'Safe window (min)'}")
print("-" * 50)

for path in csv_files:
    df = pd.read_csv(path)
    for _, row in df.iterrows():
        patient_dict = row.to_dict()
        result = predict_duration(patient_dict)
        pid = patient_dict.get("patient_id", os.path.basename(path))
        print(f"{pid:<12} {result['predicted_duration_min']:<18} {result['safe_duration_min']}")
