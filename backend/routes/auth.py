import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token

from extensions import db
from models import User
from utils import ApiError, current_user, login_required

auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_user_fields(data, require_password=True, existing=None):
    """Shared by registration and by the admin client form. Returns clean values."""
    name = str(data.get("name") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    phone = str(data.get("phone") or "").strip()
    password = str(data.get("password") or "")
    if len(name) < 2:
        raise ApiError("Le nom doit contenir au moins 2 caractères.")
    if not EMAIL_RE.match(email):
        raise ApiError("Adresse e-mail invalide.")
    if (require_password or password) and len(password) < 8:
        raise ApiError("Le mot de passe doit contenir au moins 8 caractères.")
    other = User.query.filter_by(email=email).first()
    if other is not None and (existing is None or other.id != existing.id):
        raise ApiError("Cette adresse e-mail est déjà utilisée.", 409)
    return name, email, phone, password


def token_response(user: User, status=200):
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    return jsonify(token=token, user=user.to_dict()), status


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    name, email, phone, password = validate_user_fields(data)
    user = User(name=name, email=email, phone=phone, role="client")
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return token_response(user, 201)


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first()
    if user is None or not user.check_password(str(data.get("password") or "")):
        raise ApiError("E-mail ou mot de passe incorrect.", 401)
    return token_response(user)


@auth_bp.get("/me")
@login_required
def me():
    return jsonify(user=current_user().to_dict())


@auth_bp.put("/me")
@login_required
def update_me():
    user = current_user()
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    if len(name) < 2:
        raise ApiError("Le nom doit contenir au moins 2 caractères.")
    user.name = name
    user.phone = str(data.get("phone") or "").strip()
    db.session.commit()
    return jsonify(user=user.to_dict())
