from datetime import datetime, timedelta

import config
from extensions import db
from models import Payment, Plan, PricingSettings, Reservation, SlotPrice, Spot, Subscription
from utils import ApiError, hour_start, to_local, utcnow

HALF_HOUR = timedelta(minutes=30)


def get_settings() -> PricingSettings:
    settings = db.session.get(PricingSettings, 1)
    if settings is None:
        settings = PricingSettings(id=1)
        db.session.add(settings)
        db.session.flush()
    return settings


def hourly_prices(start: datetime, end: datetime) -> dict:
    """Price per hour for every hourly slot touched by [start, end).

    A slot costs the base price unless the admin applied an AI recommendation to it.
    """
    base = get_settings().base_price
    first = hour_start(start)
    applied = SlotPrice.query.filter(
        SlotPrice.slot_start >= first, SlotPrice.slot_start < end, SlotPrice.status == "applied"
    ).all()
    prices = {row.slot_start: row.price for row in applied}
    result = {}
    slot = first
    while slot < end:
        result[slot] = prices.get(slot, base)
        slot += timedelta(hours=1)
    return result


def quote(start: datetime, end: datetime) -> dict:
    """Total price of a reservation, summed half-hour by half-hour."""
    base = get_settings().base_price
    prices = hourly_prices(start, end)
    total = 0.0
    promo = False
    t = start
    while t < end:
        price = prices[hour_start(t)]
        total += price / 2
        promo = promo or price < base
        t += HALF_HOUR
    hours = (end - start).total_seconds() / 3600
    return {
        "hours": hours,
        "total_price": round(total, 2),
        "price_per_hour": round(total / hours, 2),
        "base_price": base,
        "promo_applied": promo,
    }


def validate_range(start: datetime, end: datetime, must_be_future: bool = True):
    """A reservation is on 30-minute boundaries, in the future, inside opening hours."""
    for dt in (start, end):
        if dt.minute not in (0, 30) or dt.second or dt.microsecond:
            raise ApiError("Les horaires doivent être des multiples de 30 minutes.")
    if end <= start:
        raise ApiError("L'heure de fin doit être après l'heure de début.")
    if must_be_future and start <= utcnow():
        raise ApiError("La réservation doit commencer dans le futur.")
    local_start, local_end = to_local(start), to_local(end)
    opening = local_start.replace(hour=config.OPEN_HOUR, minute=0)
    closing = local_start.replace(hour=config.CLOSE_HOUR, minute=0)
    if local_start < opening or local_end > closing:
        raise ApiError(
            f"Le parking est ouvert de {config.OPEN_HOUR:02d}h00 à {config.CLOSE_HOUR:02d}h00."
        )


def overlapping(start: datetime, end: datetime):
    """Active reservations that overlap [start, end)."""
    return Reservation.query.filter(
        Reservation.status == "active",
        Reservation.start_time < end,
        Reservation.end_time > start,
    )


def free_spots(start: datetime, end: datetime, ignore_reservation_id=None, lock=False) -> list:
    """Spots in service minus spots with an overlapping active reservation."""
    busy = overlapping(start, end)
    if ignore_reservation_id is not None:
        busy = busy.filter(Reservation.id != ignore_reservation_id)
    busy_ids = {r.spot_id for r in busy.all()}
    spots = Spot.query.filter(Spot.status == "available").order_by(Spot.number)
    if lock:
        spots = spots.with_for_update()
    return [s for s in spots.all() if s.id not in busy_ids]


def availability(start: datetime, end: datetime) -> dict:
    total = Spot.query.filter(Spot.status == "available").count()
    free = len(free_spots(start, end))
    if free == 0:
        level = "full"
    elif total and free / total <= 0.2:
        level = "limited"
    else:
        level = "free"
    return {"total_spots": total, "free_spots": free, "level": level}


def active_subscription(user_id: int):
    return Subscription.query.filter(
        Subscription.user_id == user_id,
        Subscription.status == "active",
        Subscription.end_date > utcnow(),
    ).first()


def create_subscription(user, plan_id, method="card", card_last4="") -> Subscription:
    plan = db.session.get(Plan, plan_id) if plan_id else None
    if plan is None:
        raise ApiError("Formule d'abonnement introuvable.", 404)
    if active_subscription(user.id) is not None:
        raise ApiError("Ce client a déjà un abonnement actif.", 409)
    now = utcnow()
    sub = Subscription(user_id=user.id, plan_id=plan.id, start_date=now,
                       end_date=now + timedelta(days=plan.duration_days))
    db.session.add(sub)
    db.session.flush()
    db.session.add(Payment(user_id=user.id, subscription_id=sub.id, amount=plan.price,
                           method=method, card_last4=card_last4))
    db.session.commit()
    return sub


def create_reservation(user, start, end, spot_id=None, method="card", card_last4="") -> Reservation:
    """Create a reservation and its payment in ONE transaction.

    The overlap check and the insert happen in the same transaction, so two
    people can never get the same spot for overlapping times.
    """
    validate_range(start, end)

    spots = free_spots(start, end, lock=True)
    if spot_id is not None:
        spots = [s for s in spots if s.id == spot_id]
    if not spots:
        db.session.rollback()
        raise ApiError(
            "Désolé, ce créneau vient d'être réservé : plus aucune place disponible. "
            "Choisissez un autre horaire.", 409)
    spot = spots[0]

    price = quote(start, end)
    sub = active_subscription(user.id)
    covered = sub is not None and sub.end_date > start

    reservation = Reservation(
        user_id=user.id, spot_id=spot.id, start_time=start, end_time=end,
        price_per_hour=0 if covered else price["price_per_hour"],
        total_price=0 if covered else price["total_price"],
        promo_applied=False if covered else price["promo_applied"],
        paid_with_subscription=covered,
    )
    db.session.add(reservation)
    db.session.flush()
    if not covered:
        db.session.add(Payment(user_id=user.id, reservation_id=reservation.id,
                               amount=reservation.total_price, method=method,
                               card_last4=card_last4))
    db.session.commit()
    return reservation


def cancel_reservation(reservation: Reservation):
    """Cancelling a future reservation frees the spot and refunds the payment."""
    if reservation.status != "active":
        raise ApiError("Cette réservation est déjà annulée.")
    if reservation.start_time <= utcnow():
        raise ApiError("Seules les réservations à venir peuvent être annulées.")
    reservation.status = "cancelled"
    if reservation.payment is not None:
        reservation.payment.status = "refunded"
    db.session.commit()


def card_last4(data) -> str:
    """The app only sends the last 4 digits of the fake card. Nothing else is accepted."""
    last4 = str(data.get("card_last4") or "")
    if len(last4) != 4 or not last4.isdigit():
        raise ApiError("Paiement refusé : informations de carte invalides.")
    return last4
