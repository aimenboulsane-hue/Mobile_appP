import io
import json
import os
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402
from ml.features import FEATURES, build_features  # noqa: E402
from ml.generate_synthetic import SYNTHETIC_CSV, generate  # noqa: E402

ML_DIR = os.path.dirname(os.path.abspath(__file__))
REAL_CSV = os.path.join(ML_DIR, "data", "parking_birmingham.csv")
DATASET_URL = "https://archive.ics.uci.edu/static/public/482/parking+birmingham.zip"
MODEL_PATH = os.path.join(ML_DIR, "model.joblib")
METRICS_PATH = os.path.join(ML_DIR, "metrics.json")


def load_data():
    """Return (dataframe, source) where source is "real" or "synthetic"."""
    if not os.path.exists(REAL_CSV):
        try:
            print("Downloading the Parking Birmingham dataset from UCI...")
            with urllib.request.urlopen(DATASET_URL, timeout=30) as response:
                archive = zipfile.ZipFile(io.BytesIO(response.read()))
            os.makedirs(os.path.dirname(REAL_CSV), exist_ok=True)
            with open(REAL_CSV, "wb") as f:
                f.write(archive.read("dataset.csv"))
        except Exception as error:
            print(f"Download failed ({error}). Falling back to a synthetic dataset.")
    if os.path.exists(REAL_CSV):
        return pd.read_csv(REAL_CSV), "real"
    if not os.path.exists(SYNTHETIC_CSV):
        generate()
    return pd.read_csv(SYNTHETIC_CSV), "synthetic"


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    df = df.dropna().drop_duplicates().copy()
    df = df[df["Capacity"] > 0]
    df["LastUpdated"] = pd.to_datetime(df["LastUpdated"])
    df["slot"] = df["LastUpdated"].dt.round("30min")
    df["rate"] = (df["Occupancy"] / df["Capacity"]).clip(0, 1)
    df = df[(df["slot"].dt.hour >= config.OPEN_HOUR) & (df["slot"].dt.hour < config.CLOSE_HOUR)]
    return df.sort_values("slot").reset_index(drop=True)


def pick_reference_car_park(df: pd.DataFrame) -> str:
    """Our parking has no history of its own, so it borrows the profile of one
    car park of the dataset: the one whose typical week has both quiet slots
    (<= 35 %) and busy slots (>= 85 %), so the pricing rules have work to do."""
    weekly = (df.assign(dow=df["slot"].dt.day_of_week, hour=df["slot"].dt.hour)
                .groupby(["SystemCodeNumber", "dow", "hour"])["rate"].mean().reset_index())
    quiet = weekly[weekly["rate"] <= config.LOW_OCCUPANCY].groupby("SystemCodeNumber").size()
    busy = weekly[weekly["rate"] >= config.HIGH_OCCUPANCY].groupby("SystemCodeNumber").size()
    score = pd.concat([quiet, busy], axis=1).fillna(0).min(axis=1)
    return score.idxmax() if len(score) else df["SystemCodeNumber"].iloc[0]


def evaluate(model, X_test, y_test) -> dict:
    predictions = np.clip(model.predict(X_test), 0, 1)
    return {
        "mae": round(float(mean_absolute_error(y_test, predictions)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_test, predictions))), 4),
    }


def main():
    raw, source = load_data()
    df = prepare(raw)

    print("\n=== Data inspection ===")
    print(f"Source           : {source}")
    print(f"Rows             : {len(df)}  (car parks: {df['SystemCodeNumber'].nunique()})")
    print(f"Dates            : {df['slot'].min().date()} -> {df['slot'].max().date()}")
    print(f"Hours covered    : {df['slot'].dt.strftime('%H:%M').min()} -> {df['slot'].dt.strftime('%H:%M').max()}")
    print(f"App opening hours: {config.OPEN_HOUR:02d}:00 -> {config.CLOSE_HOUR:02d}:00")

    codes = {name: i for i, name in enumerate(sorted(df["SystemCodeNumber"].unique()))}
    X = build_features(df["slot"], df["SystemCodeNumber"].map(codes))
    y = df["rate"]

    cutoff = df["slot"].quantile(0.8)
    train, test = (df["slot"] <= cutoff).values, (df["slot"] > cutoff).values
    print(f"Train            : {train.sum()} rows up to {cutoff}")
    print(f"Test             : {test.sum()} rows after")

    models = {
        "Random Forest": RandomForestRegressor(n_estimators=100, min_samples_leaf=5,
                                               random_state=42, n_jobs=-1),
        "XGBoost": XGBRegressor(n_estimators=300, max_depth=6, learning_rate=0.05,
                                subsample=0.9, random_state=42),
    }
    results = {}
    for name, model in models.items():
        model.fit(X[train], y[train])
        results[name] = evaluate(model, X[test], y[test])

    print("\n=== Model comparison (test set) ===")
    print(f"{'Model':<16}{'MAE':>10}{'RMSE':>10}")
    for name, m in results.items():
        print(f"{name:<16}{m['mae']:>10.4f}{m['rmse']:>10.4f}")
    best = min(results, key=lambda name: results[name]["mae"])
    print(f"Best model: {best}")

    reference = pick_reference_car_park(df)
    print(f"Reference car park for SmartPark: {reference}")

    final_model = models[best].fit(X, y)
    joblib.dump({"model": final_model, "features": FEATURES, "car_park_codes": codes,
                 "reference_car_park": reference, "car_park_code": codes[reference]},
                MODEL_PATH, compress=3)
    metrics = {
        "best_model": best,
        "models": results,
        "dataset": source,
        "rows": int(len(df)),
        "car_parks": int(df["SystemCodeNumber"].nunique()),
        "date_from": str(df["slot"].min().date()),
        "date_to": str(df["slot"].max().date()),
        "train_rows": int(train.sum()),
        "test_rows": int(test.sum()),
        "reference_car_park": reference,
        "features": FEATURES,
        "trained_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"\nSaved {MODEL_PATH}\nSaved {METRICS_PATH}")


if __name__ == "__main__":
    main()
