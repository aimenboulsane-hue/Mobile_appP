from datetime import timedelta

from flask import Blueprint, current_app, jsonify, request

import config
from extensions import db
from ml.predictor import next_hour_slots
from models import SlotPrice
from services import booking
from services.pricing import recommend_price
from utils import ApiError, admin_required, hour_start, parse_iso, to_iso, to_local, to_utc, utcnow

ai_bp = Blueprint("ai", __name__)


def build_recommendations(slots_utc: list) -> list:
    """One recommendation per hourly slot (UTC datetimes)."""
    if not slots_utc:
        return []
    settings = booking.get_settings()
    occupancies = current_app.predictor.predict_hours([to_local(s) for s in slots_utc])
    decisions = {row.slot_start: row for row in SlotPrice.query.filter(
        SlotPrice.slot_start >= slots_utc[0], SlotPrice.slot_start <= slots_utc[-1]).all()}

    result = []
    for slot, occupancy in zip(slots_utc, occupancies):
        advice = recommend_price(occupancy, settings.base_price, settings.min_price, settings.max_price)
        decision = decisions.get(slot)
        applied = decision is not None and decision.status == "applied"
        result.append({
            "slot_start": to_iso(slot),
            "slot_end": to_iso(slot + timedelta(hours=1)),
            "predicted_occupancy": round(occupancy, 3),
            "current_price": decision.price if applied else settings.base_price,
            "recommended_price": advice["price"],
            "kind": advice["kind"],
            "reason": advice["reason"],
            "status": decision.status if decision else "pending",
        })
    return result


@ai_bp.get("/recommendations")
@admin_required
def list_recommendations():
    slots_local = next_hour_slots(to_local(utcnow()), config.RECOMMENDATION_DAYS,
                                  config.OPEN_HOUR, config.CLOSE_HOUR)
    predictor = current_app.predictor
    return jsonify(
        recommendations=build_recommendations([to_utc(s) for s in slots_local]),
        pricing=booking.get_settings().to_dict(),
        currency=config.CURRENCY,
        prediction_source=predictor.source,
        metrics=predictor.metrics,
    )


@ai_bp.post("/recommendations/decision")
@admin_required
def decide():
    """Body: {"slot_start": ISO date, "action": "apply" | "ignore" | "reset"}.

    The price is recomputed on the server: the app never sends a price.
    """
    data = request.get_json(silent=True) or {}
    slot = parse_iso(data.get("slot_start"), "créneau")
    action = data.get("action")
    if action not in ("apply", "ignore", "reset"):
        raise ApiError("Action invalide.")
    local = to_local(slot)
    if slot != hour_start(slot) or not config.OPEN_HOUR <= local.hour < config.CLOSE_HOUR:
        raise ApiError("Créneau invalide.")
    if slot + timedelta(hours=1) <= utcnow():
        raise ApiError("Ce créneau est déjà passé.")

    recommendation = build_recommendations([slot])[0]
    decision = SlotPrice.query.filter_by(slot_start=slot).first()
    if action == "reset":
        if decision is not None:
            db.session.delete(decision)
            db.session.commit()
        return jsonify(recommendation=build_recommendations([slot])[0])
    if decision is None:
        decision = SlotPrice(slot_start=slot)
        db.session.add(decision)
    decision.status = "applied" if action == "apply" else "ignored"
    decision.price = recommendation["recommended_price"]
    decision.predicted_occupancy = recommendation["predicted_occupancy"]
    decision.reason = recommendation["reason"]
    db.session.commit()
    return jsonify(recommendation=build_recommendations([slot])[0])
