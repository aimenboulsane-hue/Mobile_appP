from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

import config
from extensions import db
from models import Payment, Plan, Reservation, SlotPrice, Spot, Subscription
from services import booking
from utils import (ApiError, current_user, hour_start, login_required, parse_iso, to_iso,
                   to_local, to_utc, utcnow)

client_bp = Blueprint("client", __name__)


@client_bp.get("/parking")
@login_required
def parking_info():
    """Static information the app needs to build its screens."""
    return jsonify(
        name=config.PARKING_NAME,
        open_hour=config.OPEN_HOUR,
        close_hour=config.CLOSE_HOUR,
        utc_offset_hours=config.PARKING_UTC_OFFSET_HOURS,
        currency=config.CURRENCY,
        base_price=booking.get_settings().base_price,
        total_spots=Spot.query.filter(Spot.status == "available").count(),
    )


@client_bp.get("/availability")
@login_required
def availability():
    """Free spots and price, now (no parameters) or for ?start=...&end=..."""
    user = current_user()
    sub = booking.active_subscription(user.id)

    if request.args.get("start") and request.args.get("end"):
        start = parse_iso(request.args["start"], "début")
        end = parse_iso(request.args["end"], "fin")
        booking.validate_range(start, end)
        result = booking.availability(start, end)
        result.update(booking.quote(start, end))
        result["subscription_covered"] = sub is not None and sub.end_date > start
        if result["subscription_covered"]:
            result["total_price"] = 0
        return jsonify(result)

    now = utcnow()
    local = to_local(now)
    result = booking.availability(now, now + timedelta(minutes=1))
    price = booking.hourly_prices(now, now + timedelta(minutes=1))[hour_start(now)]
    base = booking.get_settings().base_price
    result.update(
        price_per_hour=price,
        base_price=base,
        promo_applied=price < base,
        is_open=config.OPEN_HOUR <= local.hour < config.CLOSE_HOUR,
        subscription_covered=sub is not None,
    )
    return jsonify(result)


@client_bp.get("/availability/day")
@login_required
def availability_day():
    """Hour-by-hour free spots and price for one day (?date=YYYY-MM-DD, parking-local)."""
    try:
        day = datetime.strptime(request.args.get("date", ""), "%Y-%m-%d")
    except ValueError:
        raise ApiError("Date invalide.")
    day_start = to_utc(day.replace(hour=config.OPEN_HOUR))
    day_end = to_utc(day.replace(hour=config.CLOSE_HOUR))

    spot_ids = {s.id for s in Spot.query.filter(Spot.status == "available").all()}
    reservations = booking.overlapping(day_start, day_end).all()
    prices = booking.hourly_prices(day_start, day_end)
    base = booking.get_settings().base_price
    now = utcnow()

    slots = []
    slot = day_start
    while slot < day_end:
        slot_end = slot + timedelta(hours=1)
        busy = {r.spot_id for r in reservations if r.start_time < slot_end and r.end_time > slot}
        free = len(spot_ids - busy)
        slots.append({
            "start": to_iso(slot),
            "end": to_iso(slot_end),
            "free_spots": free,
            "level": "full" if free == 0 else "limited" if free / max(1, len(spot_ids)) <= 0.2 else "free",
            "price_per_hour": prices[slot],
            "promo_applied": prices[slot] < base,
            "past": slot_end <= now,
        })
        slot = slot_end
    return jsonify(total_spots=len(spot_ids), base_price=base, slots=slots)


@client_bp.get("/plans")
@login_required
def plans():
    return jsonify(plans=[p.to_dict() for p in Plan.query.order_by(Plan.duration_days).all()])


@client_bp.post("/reservations")
@login_required
def create_reservation():
    """Reserve + simulated payment in one call (one transaction on the server)."""
    user = current_user()
    data = request.get_json(silent=True) or {}
    start = parse_iso(data.get("start_time"), "début")
    end = parse_iso(data.get("end_time"), "fin")
    sub = booking.active_subscription(user.id)
    covered = sub is not None and sub.end_date > start
    last4 = "" if covered else booking.card_last4(data)
    reservation = booking.create_reservation(user, start, end, card_last4=last4)
    return jsonify(reservation=reservation.to_dict()), 201


@client_bp.get("/reservations")
@login_required
def my_reservations():
    rows = (Reservation.query.filter_by(user_id=current_user().id)
            .order_by(Reservation.start_time.desc()).limit(100).all())
    return jsonify(reservations=[r.to_dict() for r in rows])


@client_bp.post("/reservations/<int:reservation_id>/cancel")
@login_required
def cancel_reservation(reservation_id):
    reservation = db.session.get(Reservation, reservation_id)
    if reservation is None or reservation.user_id != current_user().id:
        raise ApiError("Réservation introuvable.", 404)
    booking.cancel_reservation(reservation)
    return jsonify(reservation=reservation.to_dict())


@client_bp.get("/payments")
@login_required
def my_payments():
    rows = (Payment.query.filter_by(user_id=current_user().id)
            .order_by(Payment.created_at.desc()).limit(100).all())
    return jsonify(payments=[p.to_dict() for p in rows])


@client_bp.get("/subscriptions/me")
@login_required
def my_subscription():
    user = current_user()
    active = booking.active_subscription(user.id)
    history = (Subscription.query.filter_by(user_id=user.id)
               .order_by(Subscription.start_date.desc()).all())
    return jsonify(active=active.to_dict() if active else None,
                   history=[s.to_dict() for s in history])


@client_bp.post("/subscriptions")
@login_required
def subscribe():
    data = request.get_json(silent=True) or {}
    last4 = booking.card_last4(data)
    sub = booking.create_subscription(current_user(), data.get("plan_id"), card_last4=last4)
    return jsonify(subscription=sub.to_dict()), 201


@client_bp.get("/promotions")
@login_required
def promotions():
    """Coming slots where an applied recommendation made the price lower than the base."""
    base = booking.get_settings().base_price
    rows = (SlotPrice.query
            .filter(SlotPrice.status == "applied", SlotPrice.price < base,
                    SlotPrice.slot_start >= hour_start(utcnow()))
            .order_by(SlotPrice.slot_start).limit(30).all())
    return jsonify(promotions=[{
        "id": row.id,
        "start": to_iso(row.slot_start),
        "end": to_iso(row.slot_start + timedelta(hours=1)),
        "price_per_hour": row.price,
        "base_price": base,
        "discount_percent": round((1 - row.price / base) * 100),
        "reason": row.reason,
    } for row in rows])
