import pandas as pd

FEATURES = ["hour", "minute", "day_of_week", "is_weekend", "month", "car_park"]


def build_features(timestamps, car_park_codes) -> pd.DataFrame:
    """timestamps: datetimes in local time. car_park_codes: integer code of each car park."""
    ts = pd.to_datetime(pd.Series(list(timestamps)))
    return pd.DataFrame({
        "hour": ts.dt.hour,
        "minute": ts.dt.minute,
        "day_of_week": ts.dt.day_of_week,
        "is_weekend": (ts.dt.day_of_week >= 5).astype(int),
        "month": ts.dt.month,
        "car_park": list(car_park_codes),
    })[FEATURES]
