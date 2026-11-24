import os
import sys
from datetime import timedelta

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402
from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from models import Plan, PricingSettings, Spot, User  # noqa: E402
from utils import to_iso, to_local, to_utc, utcnow  # noqa: E402


@pytest.fixture
def app(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(tmp_path / "test.db").replace("\\", "/"),
        "PREDICTOR_PATHS": {"model_path": str(tmp_path / "missing.joblib")},
    })
    with app.app_context():
        admin = User(name="Admin", email="admin@test.dz", role="admin")
        admin.set_password("Admin123!")
        client = User(name="Client Test", email="client@test.dz", role="client")
        client.set_password("Client123!")
        db.session.add_all([admin, client])
        db.session.add_all([Spot(number=f"A-{n:02d}", zone="Zone A") for n in range(1, 4)])
        db.session.add_all([
            Plan(code="monthly", name="Mensuel", duration_days=30, price=6000),
            Plan(code="quarterly", name="Trimestriel", duration_days=90, price=15000),
            Plan(code="annual", name="Annuel", duration_days=365, price=50000),
        ])
        db.session.add(PricingSettings(id=1, base_price=100, min_price=60, max_price=150))
        db.session.commit()
    yield app
    with app.app_context():
        db.engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()


def login(client, email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.get_json()
    return {"Authorization": "Bearer " + response.get_json()["token"]}


@pytest.fixture
def client_auth(client):
    return login(client, "client@test.dz", "Client123!")


@pytest.fixture
def admin_auth(client):
    return login(client, "admin@test.dz", "Admin123!")


def slot(days_ahead=1, hour=10, minute=0):
    """ISO string (UTC) for a parking-local time some days ahead."""
    local_day = to_local(utcnow()).replace(hour=0, minute=0, second=0, microsecond=0)
    return to_iso(to_utc(local_day + timedelta(days=days_ahead, hours=hour, minutes=minute)))


def book(client, auth, start, end, **extra):
    body = {"start_time": start, "end_time": end, "card_last4": "4242", **extra}
    return client.post("/api/reservations", json=body, headers=auth)


assert config.OPEN_HOUR <= 10 < config.CLOSE_HOUR
