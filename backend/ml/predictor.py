import json
import os
from datetime import datetime, timedelta

import joblib

from ml.features import build_features

ML_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(ML_DIR, "model.joblib")
METRICS_PATH = os.path.join(ML_DIR, "metrics.json")


class Predictor:
    def __init__(self, model_path=MODEL_PATH, metrics_path=METRICS_PATH):
        self.bundle = None
        self.metrics = None
        self._fallback = None
        try:
            self.bundle = joblib.load(model_path)
            with open(metrics_path, encoding="utf-8") as f:
                self.metrics = json.load(f)
        except Exception as error:
            self.bundle = None
            print(f"[ml] Model not loaded ({error}). Using the weekday/hour average fallback.")

    @property
    def source(self) -> str:
        return "model" if self.bundle else "fallback"

    def predict_hours(self, local_hours: list) -> list:
        """Predicted occupancy (0..1) for hourly slots given in parking-local time."""
        if not local_hours:
            return []
        if self.bundle is None:
            table = self._fallback_table()
            return [table.get((h.weekday(), h.hour), 0.5) for h in local_hours]
        stamps = []
        for h in local_hours:
            stamps += [h, h + timedelta(minutes=30)]
        X = build_features(stamps, [self.bundle["car_park_code"]] * len(stamps))
        y = self.bundle["model"].predict(X)
        return [float(min(1.0, max(0.0, (y[i] + y[i + 1]) / 2))) for i in range(0, len(y), 2)]

    def _fallback_table(self) -> dict:
        """Average occupancy by (weekday, hour) over the last 8 weeks of reservations."""
        if self._fallback is not None:
            return self._fallback
        import config
        from models import Reservation, Spot
        from utils import to_local, utcnow

        weeks = 8
        since = utcnow() - timedelta(weeks=weeks)
        spots = max(1, Spot.query.filter(Spot.status == "available").count())
        hours = {}
        rows = Reservation.query.filter(Reservation.status == "active",
                                        Reservation.start_time >= since,
                                        Reservation.end_time <= utcnow()).all()
        for r in rows:
            t = to_local(r.start_time)
            end = to_local(r.end_time)
            while t < end:
                key = (t.weekday(), t.hour)
                hours[key] = hours.get(key, 0) + 0.5
                t += timedelta(minutes=30)
        self._fallback = {
            (d, h): min(1.0, hours.get((d, h), 0) / (spots * weeks))
            for d in range(7) for h in range(config.OPEN_HOUR, config.CLOSE_HOUR)
        }
        return self._fallback


def next_hour_slots(now_local: datetime, days: int, open_hour: int, close_hour: int) -> list:
    """Hourly slots (local time) still to come, from today for `days` days."""
    slots = []
    day = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    for d in range(days):
        for hour in range(open_hour, close_hour):
            slot = day + timedelta(days=d, hours=hour)
            if slot > now_local:
                slots.append(slot)
    return slots
