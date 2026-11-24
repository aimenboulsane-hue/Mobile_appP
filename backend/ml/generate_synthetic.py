import os

import numpy as np
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
SYNTHETIC_CSV = os.path.join(DATA_DIR, "parking_synthetic.csv")


def generate(path: str = SYNTHETIC_CSV, car_parks: int = 12, days: int = 77, seed: int = 42) -> str:
    rng = np.random.default_rng(seed)
    times = pd.date_range("2016-10-04 08:00", periods=days * 48, freq="30min")
    times = times[(times.hour >= 8) & ((times.hour < 16) | ((times.hour == 16) & (times.minute <= 30)))]
    hour = times.hour + times.minute / 60

    rows = []
    for i in range(car_parks):
        capacity = int(rng.integers(300, 2000))
        peak = rng.uniform(0.45, 1.0)
        peak_hour = rng.uniform(12.5, 14.5)
        weekend = rng.uniform(0.5, 0.9)
        shape = np.exp(-((hour - peak_hour) ** 2) / (2 * 3.0 ** 2))
        day_factor = np.where(times.day_of_week >= 5, weekend, 1.0)
        rate = np.clip(peak * shape * day_factor + rng.normal(0, 0.04, len(times)), 0, 1)
        rows.append(pd.DataFrame({
            "SystemCodeNumber": f"SYNTH{i + 1:02d}",
            "Capacity": capacity,
            "Occupancy": (rate * capacity).round().astype(int),
            "LastUpdated": times.strftime("%Y-%m-%d %H:%M:%S"),
        }))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pd.concat(rows).to_csv(path, index=False)
    return path


if __name__ == "__main__":
    print("Synthetic dataset written to", generate())
