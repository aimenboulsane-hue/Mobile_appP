from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

import config
from extensions import db
from models import User

OFFSET = timedelta(hours=config.PARKING_UTC_OFFSET_HOURS)


class ApiError(Exception):
    """Raised anywhere in the code; turned into a JSON response {"error": "..."}."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


def parse_iso(value, field="date") -> datetime:
    """Parse an ISO 8601 string into a naive UTC datetime."""
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        raise ApiError(f"Le champ « {field} » n'est pas une date valide.")
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def to_local(dt_utc: datetime) -> datetime:
    """UTC -> parking-local time (used for opening hours and ML features)."""
    return dt_utc + OFFSET


def to_utc(dt_local: datetime) -> datetime:
    return dt_local - OFFSET


def hour_start(dt: datetime) -> datetime:
    return dt.replace(minute=0, second=0, microsecond=0)


def current_user() -> User:
    """The user behind the JWT. A deleted account is treated like a bad token."""
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        raise ApiError("Session expirée. Veuillez vous reconnecter.", 401)
    return user


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        current_user()
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    """Server-side role check: every admin endpoint uses this decorator."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = current_user()
        if get_jwt().get("role") != "admin" or user.role != "admin":
            return jsonify(error="Accès réservé aux administrateurs."), 403
        return fn(*args, **kwargs)
    return wrapper


def get_number(data, field, label, minimum=0.0):
    try:
        value = float(data.get(field))
    except (TypeError, ValueError):
        raise ApiError(f"Le champ « {label} » doit être un nombre.")
    if value < minimum:
        raise ApiError(f"Le champ « {label} » doit être supérieur ou égal à {minimum:g}.")
    return value
