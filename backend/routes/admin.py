from datetime import timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func

import config
from extensions import db
from models import Payment, Plan, Reservation, Spot, Subscription, User
from routes.auth import validate_user_fields
from services import booking
from utils import (ApiError, admin_required, get_number, parse_iso, to_local, to_utc, utcnow)

admin_bp = Blueprint("admin", __name__)


def get_or_404(model, object_id, message):
    obj = db.session.get(model, object_id)
    if obj is None:
        raise ApiError(message, 404)
    return obj


def read_spot_fields(data, existing=None):
    number = str(data.get("number") or "").strip().upper()
    zone = str(data.get("zone") or "").strip()
    status = data.get("status") or "available"
    if not number:
        raise ApiError("Le numéro de la place est obligatoire.")
    if not zone:
        raise ApiError("La zone est obligatoire.")
    if status not in ("available", "out_of_service"):
        raise ApiError("Statut de place invalide.")
    other = Spot.query.filter_by(number=number).first()
    if other is not None and (existing is None or other.id != existing.id):
        raise ApiError("Ce numéro de place existe déjà.", 409)
    return number, zone, status


@admin_bp.get("/spots")
@admin_required
def list_spots():
    return jsonify(spots=[s.to_dict() for s in Spot.query.order_by(Spot.number).all()])


@admin_bp.post("/spots")
@admin_required
def create_spot():
    number, zone, status = read_spot_fields(request.get_json(silent=True) or {})
    spot = Spot(number=number, zone=zone, status=status)
    db.session.add(spot)
    db.session.commit()
    return jsonify(spot=spot.to_dict()), 201


@admin_bp.put("/spots/<int:spot_id>")
@admin_required
def update_spot(spot_id):
    spot = get_or_404(Spot, spot_id, "Place introuvable.")
    spot.number, spot.zone, spot.status = read_spot_fields(request.get_json(silent=True) or {}, spot)
    db.session.commit()
    return jsonify(spot=spot.to_dict())


@admin_bp.delete("/spots/<int:spot_id>")
@admin_required
def delete_spot(spot_id):
    spot = get_or_404(Spot, spot_id, "Place introuvable.")
    upcoming = Reservation.query.filter(Reservation.spot_id == spot.id,
                                        Reservation.status == "active",
                                        Reservation.end_time > utcnow()).count()
    if upcoming:
        raise ApiError("Impossible de supprimer cette place : elle a des réservations à venir.", 409)
    Reservation.query.filter_by(spot_id=spot.id).update({"spot_id": None})
    db.session.delete(spot)
    db.session.commit()
    return jsonify(message="Place supprimée.")


@admin_bp.get("/clients")
@admin_required
def list_clients():
    counts = dict(db.session.query(Reservation.user_id, func.count(Reservation.id))
                  .group_by(Reservation.user_id).all())
    subscribers = {s.user_id for s in Subscription.query.filter(
        Subscription.status == "active", Subscription.end_date > utcnow()).all()}
    clients = User.query.filter_by(role="client").order_by(User.name).all()
    return jsonify(clients=[{**c.to_dict(),
                             "reservations_count": counts.get(c.id, 0),
                             "has_subscription": c.id in subscribers} for c in clients])


@admin_bp.post("/clients")
@admin_required
def create_client():
    name, email, phone, password = validate_user_fields(request.get_json(silent=True) or {})
    client = User(name=name, email=email, phone=phone, role="client")
    client.set_password(password)
    db.session.add(client)
    db.session.commit()
    return jsonify(client=client.to_dict()), 201


def get_client(client_id) -> User:
    client = db.session.get(User, client_id)
    if client is None or client.role != "client":
        raise ApiError("Client introuvable.", 404)
    return client


@admin_bp.put("/clients/<int:client_id>")
@admin_required
def update_client(client_id):
    client = get_client(client_id)
    name, email, phone, password = validate_user_fields(
        request.get_json(silent=True) or {}, require_password=False, existing=client)
    client.name, client.email, client.phone = name, email, phone
    if password:
        client.set_password(password)
    db.session.commit()
    return jsonify(client=client.to_dict())


@admin_bp.delete("/clients/<int:client_id>")
@admin_required
def delete_client(client_id):
    client = get_client(client_id)
    Payment.query.filter_by(user_id=client.id).delete()
    Reservation.query.filter_by(user_id=client.id).delete()
    Subscription.query.filter_by(user_id=client.id).delete()
    db.session.delete(client)
    db.session.commit()
    return jsonify(message="Client supprimé.")


@admin_bp.get("/reservations")
@admin_required
def list_reservations():
    """?scope=upcoming (default) | past | cancelled"""
    scope = request.args.get("scope", "upcoming")
    now = utcnow()
    query = Reservation.query
    if scope == "past":
        query = query.filter(Reservation.status == "active", Reservation.end_time <= now) \
                     .order_by(Reservation.start_time.desc())
    elif scope == "cancelled":
        query = query.filter(Reservation.status == "cancelled").order_by(Reservation.start_time.desc())
    else:
        query = query.filter(Reservation.status == "active", Reservation.end_time > now) \
                     .order_by(Reservation.start_time)
    return jsonify(reservations=[r.to_dict() for r in query.limit(100).all()])


@admin_bp.post("/reservations")
@admin_required
def create_reservation():
    """The admin books for a client (for example at the desk, paid in cash)."""
    data = request.get_json(silent=True) or {}
    client = get_client(data.get("user_id") or 0)
    start = parse_iso(data.get("start_time"), "début")
    end = parse_iso(data.get("end_time"), "fin")
    spot_id = data.get("spot_id") or None
    reservation = booking.create_reservation(client, start, end, spot_id=spot_id, method="cash")
    return jsonify(reservation=reservation.to_dict()), 201


@admin_bp.put("/reservations/<int:reservation_id>")
@admin_required
def update_reservation(reservation_id):
    """Move a reservation (spot and/or times) or cancel it."""
    reservation = get_or_404(Reservation, reservation_id, "Réservation introuvable.")
    data = request.get_json(silent=True) or {}

    if data.get("status") == "cancelled":
        if reservation.status == "active":
            reservation.status = "cancelled"
            if reservation.payment is not None:
                reservation.payment.status = "refunded"
            db.session.commit()
        return jsonify(reservation=reservation.to_dict())

    if reservation.status != "active":
        raise ApiError("Une réservation annulée ne peut pas être modifiée.")
    start = parse_iso(data.get("start_time"), "début") if data.get("start_time") else reservation.start_time
    end = parse_iso(data.get("end_time"), "fin") if data.get("end_time") else reservation.end_time
    spot_id = data.get("spot_id") or reservation.spot_id
    booking.validate_range(start, end)

    free = booking.free_spots(start, end, ignore_reservation_id=reservation.id, lock=True)
    if spot_id not in {s.id for s in free}:
        raise ApiError("Cette place n'est pas disponible sur ce créneau.", 409)

    reservation.spot_id, reservation.start_time, reservation.end_time = spot_id, start, end
    hours = (end - start).total_seconds() / 3600
    reservation.total_price = round(reservation.price_per_hour * hours, 2)
    if reservation.payment is not None:
        reservation.payment.amount = reservation.total_price
    db.session.commit()
    return jsonify(reservation=reservation.to_dict())


@admin_bp.delete("/reservations/<int:reservation_id>")
@admin_required
def delete_reservation(reservation_id):
    reservation = get_or_404(Reservation, reservation_id, "Réservation introuvable.")
    Payment.query.filter_by(reservation_id=reservation.id).delete()
    db.session.delete(reservation)
    db.session.commit()
    return jsonify(message="Réservation supprimée.")


@admin_bp.get("/subscriptions")
@admin_required
def list_subscriptions():
    rows = Subscription.query.order_by(Subscription.end_date.desc()).all()
    return jsonify(subscriptions=[s.to_dict() for s in rows])


@admin_bp.post("/subscriptions")
@admin_required
def create_subscription():
    data = request.get_json(silent=True) or {}
    client = get_client(data.get("user_id") or 0)
    sub = booking.create_subscription(client, data.get("plan_id"), method="cash")
    return jsonify(subscription=sub.to_dict()), 201


@admin_bp.put("/subscriptions/<int:subscription_id>")
@admin_required
def update_subscription(subscription_id):
    """Change the plan (the end date is recomputed) and/or the status."""
    sub = get_or_404(Subscription, subscription_id, "Abonnement introuvable.")
    data = request.get_json(silent=True) or {}
    status = data.get("status") or sub.status
    if status not in ("active", "cancelled"):
        raise ApiError("Statut d'abonnement invalide.")
    if data.get("plan_id") and data["plan_id"] != sub.plan_id:
        plan = get_or_404(Plan, data["plan_id"], "Formule d'abonnement introuvable.")
        sub.plan_id = plan.id
        sub.end_date = sub.start_date + timedelta(days=plan.duration_days)
    if status == "active" and sub.status != "active":
        other = booking.active_subscription(sub.user_id)
        if other is not None and other.id != sub.id:
            raise ApiError("Ce client a déjà un abonnement actif.", 409)
    sub.status = status
    db.session.commit()
    return jsonify(subscription=sub.to_dict())


@admin_bp.delete("/subscriptions/<int:subscription_id>")
@admin_required
def delete_subscription(subscription_id):
    sub = get_or_404(Subscription, subscription_id, "Abonnement introuvable.")
    Payment.query.filter_by(subscription_id=sub.id).delete()
    db.session.delete(sub)
    db.session.commit()
    return jsonify(message="Abonnement supprimé.")


@admin_bp.get("/pricing")
@admin_required
def get_pricing():
    return jsonify(pricing=booking.get_settings().to_dict(), currency=config.CURRENCY)


@admin_bp.put("/pricing")
@admin_required
def update_pricing():
    data = request.get_json(silent=True) or {}
    base = get_number(data, "base_price", "prix de base", 1)
    minimum = get_number(data, "min_price", "prix minimum", 1)
    maximum = get_number(data, "max_price", "prix maximum", 1)
    if not minimum <= base <= maximum:
        raise ApiError("Les prix doivent respecter : minimum ≤ base ≤ maximum.")
    settings = booking.get_settings()
    settings.base_price, settings.min_price, settings.max_price = base, minimum, maximum
    db.session.commit()
    return jsonify(pricing=settings.to_dict())


@admin_bp.get("/dashboard")
@admin_required
def dashboard():
    """Key numbers for today + revenue and occupancy per day (?days=7|30|90)."""
    days = min(90, max(7, request.args.get("days", 30, type=int)))
    now = utcnow()
    today = to_local(now).replace(hour=0, minute=0, second=0, microsecond=0)
    first_day = today - timedelta(days=days - 1)
    period_start = to_utc(first_day)
    period_end = to_utc(today + timedelta(days=1))

    spots = max(1, Spot.query.filter(Spot.status == "available").count())
    capacity_hours = spots * (config.CLOSE_HOUR - config.OPEN_HOUR)

    revenue = {}
    payments = Payment.query.filter(Payment.status == "paid", Payment.created_at >= period_start,
                                    Payment.created_at < period_end).all()
    for p in payments:
        day = to_local(p.created_at).date()
        revenue[day] = revenue.get(day, 0) + p.amount

    reserved_hours = {}
    reservations = Reservation.query.filter(Reservation.status == "active",
                                            Reservation.start_time >= period_start,
                                            Reservation.start_time < period_end).all()
    for r in reservations:
        day = to_local(r.start_time).date()
        hours = (r.end_time - r.start_time).total_seconds() / 3600
        reserved_hours[day] = reserved_hours.get(day, 0) + hours

    series = []
    for i in range(days):
        day = (first_day + timedelta(days=i)).date()
        series.append({
            "date": day.isoformat(),
            "revenue": round(revenue.get(day, 0), 2),
            "occupancy": round(min(1.0, reserved_hours.get(day, 0) / capacity_hours), 3),
        })

    active_reservations = Reservation.query.filter(Reservation.status == "active",
                                                   Reservation.end_time > now).count()
    active_subscribers = Subscription.query.filter(Subscription.status == "active",
                                                   Subscription.end_date > now).count()
    return jsonify(
        currency=config.CURRENCY,
        today={
            "revenue": series[-1]["revenue"],
            "occupancy": series[-1]["occupancy"],
            "active_reservations": active_reservations,
            "active_subscribers": active_subscribers,
        },
        period={
            "days": days,
            "revenue": round(sum(d["revenue"] for d in series), 2),
            "occupancy": round(sum(d["occupancy"] for d in series) / days, 3),
        },
        series=series,
    )
