import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

CURRENCY = "DA"

PARKING_NAME = "SmartPark Centre"
PARKING_UTC_OFFSET_HOURS = 1
OPEN_HOUR = 8
CLOSE_HOUR = 17

HIGH_OCCUPANCY = 0.85
LOW_OCCUPANCY = 0.35
PROMOTION_RATE = 0.20
REFERENCE_OCCUPANCY = 0.75

RECOMMENDATION_DAYS = 7


def database_url() -> str:
    """SQLite by default, PostgreSQL when DATABASE_URL is set."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        return "sqlite:///" + os.path.join(BASE_DIR, "smartpark.db")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


class Config:
    SQLALCHEMY_DATABASE_URI = database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "smartpark-dev-secret-change-me-in-production")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=12)
    JSON_AS_ASCII = False
