import os
from datetime import datetime

import pytest

from conftest import slot
from ml.predictor import MODEL_PATH, Predictor, next_hour_slots


def recommendations(client, admin_auth):
    response = client.get("/api/admin/recommendations", headers=admin_auth)
    assert response.status_code == 200
    return response.get_json()


def test_api_works_without_a_model_file(client, admin_auth):
    """The test app has no model file: the fallback must answer."""
    data = recommendations(client, admin_auth)
    assert data["prediction_source"] == "fallback"
    assert data["metrics"] is None
    assert len(data["recommendations"]) > 40
    first = data["recommendations"][0]
    assert 0 <= first["predicted_occupancy"] <= 1
    assert first["status"] == "pending" and first["current_price"] == 100
    assert first["reason"]


def test_apply_a_recommendation_changes_the_price_clients_see(client, client_auth, admin_auth):
    start, end = slot(hour=10), slot(hour=11)
    url = f"/api/availability?start={start}&end={end}"
    before = client.get(url, headers=client_auth).get_json()
    assert before["price_per_hour"] == 100 and before["promo_applied"] is False

    response = client.post("/api/admin/recommendations/decision", headers=admin_auth,
                           json={"slot_start": start, "action": "apply"})
    assert response.status_code == 200
    applied = response.get_json()["recommendation"]
    assert applied["status"] == "applied" and applied["current_price"] == 80

    after = client.get(url, headers=client_auth).get_json()
    assert after["price_per_hour"] == 80 and after["promo_applied"] is True
    promotions = client.get("/api/promotions", headers=client_auth).get_json()["promotions"]
    assert promotions[0]["start"] == start and promotions[0]["discount_percent"] == 20

    two_hours = client.get(f"/api/availability?start={start}&end={slot(hour=12)}",
                           headers=client_auth).get_json()
    assert two_hours["total_price"] == 180

    client.post("/api/admin/recommendations/decision", headers=admin_auth,
                json={"slot_start": start, "action": "ignore"})
    assert client.get(url, headers=client_auth).get_json()["price_per_hour"] == 100


def test_decision_validation(client, admin_auth):
    bad_action = client.post("/api/admin/recommendations/decision", headers=admin_auth,
                             json={"slot_start": slot(hour=10), "action": "boost"})
    assert bad_action.status_code == 400
    closed = client.post("/api/admin/recommendations/decision", headers=admin_auth,
                         json={"slot_start": slot(hour=3), "action": "apply"})
    assert closed.status_code == 400


def test_next_hour_slots_skips_the_past():
    now = datetime(2026, 1, 5, 14, 20)
    slots = next_hour_slots(now, days=2, open_hour=8, close_hour=17)
    assert slots[0] == datetime(2026, 1, 5, 15, 0)
    assert len(slots) == 2 + 9


@pytest.mark.skipif(not os.path.exists(MODEL_PATH), reason="run `python ml/train.py` first")
def test_trained_model_predicts_rates_between_0_and_1():
    predictor = Predictor()
    assert predictor.source == "model"
    hours = [datetime(2026, 1, 5 + d, h) for d in range(7) for h in range(8, 17)]
    predictions = predictor.predict_hours(hours)
    assert len(predictions) == len(hours)
    assert all(0 <= p <= 1 for p in predictions)
    assert max(predictions) - min(predictions) > 0.2
    assert predictor.metrics["best_model"] in ("Random Forest", "XGBoost")
