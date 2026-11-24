from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(30), default="")
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(10), nullable=False, default="client")
    created_at = db.Column(db.DateTime, default=_now)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone or "",
            "role": self.role,
            "created_at": _iso(self.created_at),
        }


class Spot(db.Model):
    __tablename__ = "spots"
    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.String(10), unique=True, nullable=False)
    zone = db.Column(db.String(30), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="available")

    def to_dict(self):
        return {"id": self.id, "number": self.number, "zone": self.zone, "status": self.status}


class Reservation(db.Model):
    __tablename__ = "reservations"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    spot_id = db.Column(db.Integer, db.ForeignKey("spots.id"), nullable=True, index=True)
    start_time = db.Column(db.DateTime, nullable=False, index=True)
    end_time = db.Column(db.DateTime, nullable=False, index=True)
    status = db.Column(db.String(12), nullable=False, default="active")
    price_per_hour = db.Column(db.Float, nullable=False, default=0)
    total_price = db.Column(db.Float, nullable=False, default=0)
    promo_applied = db.Column(db.Boolean, default=False)
    paid_with_subscription = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=_now)

    user = db.relationship("User")
    spot = db.relationship("Spot")
    payment = db.relationship("Payment", uselist=False, back_populates="reservation")

    def to_dict(self):
        now = _now()
        if self.status == "cancelled":
            state = "cancelled"
        elif self.end_time <= now:
            state = "completed"
        elif self.start_time <= now:
            state = "ongoing"
        else:
            state = "upcoming"
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "spot_id": self.spot_id,
            "spot_number": self.spot.number if self.spot else None,
            "zone": self.spot.zone if self.spot else None,
            "start_time": _iso(self.start_time),
            "end_time": _iso(self.end_time),
            "status": self.status,
            "state": state,
            "price_per_hour": self.price_per_hour,
            "total_price": self.total_price,
            "promo_applied": bool(self.promo_applied),
            "paid_with_subscription": bool(self.paid_with_subscription),
            "payment_status": self.payment.status if self.payment else None,
            "created_at": _iso(self.created_at),
        }


class Payment(db.Model):
    """A simulated payment. No real card data is ever stored (only the last 4 fake digits)."""
    __tablename__ = "payments"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    reservation_id = db.Column(db.Integer, db.ForeignKey("reservations.id"), nullable=True)
    subscription_id = db.Column(db.Integer, db.ForeignKey("subscriptions.id"), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    method = db.Column(db.String(20), nullable=False, default="card")
    card_last4 = db.Column(db.String(4), default="")
    status = db.Column(db.String(12), nullable=False, default="paid")
    created_at = db.Column(db.DateTime, default=_now, index=True)

    reservation = db.relationship("Reservation", back_populates="payment")
    subscription = db.relationship("Subscription", back_populates="payment")

    def to_dict(self):
        if self.subscription is not None:
            label = f"Abonnement {self.subscription.plan.name.lower()}"
        elif self.reservation is not None and self.reservation.spot is not None:
            label = f"Réservation place {self.reservation.spot.number}"
        else:
            label = "Réservation"
        return {
            "id": self.id,
            "user_id": self.user_id,
            "reservation_id": self.reservation_id,
            "subscription_id": self.subscription_id,
            "label": label,
            "amount": self.amount,
            "method": self.method,
            "card_last4": self.card_last4 or "",
            "status": self.status,
            "created_at": _iso(self.created_at),
        }


class Plan(db.Model):
    __tablename__ = "plans"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(50), nullable=False)
    duration_days = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {"id": self.id, "code": self.code, "name": self.name,
                "duration_days": self.duration_days, "price": self.price}


class Subscription(db.Model):
    __tablename__ = "subscriptions"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    plan_id = db.Column(db.Integer, db.ForeignKey("plans.id"), nullable=False)
    start_date = db.Column(db.DateTime, nullable=False, default=_now)
    end_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(12), nullable=False, default="active")

    user = db.relationship("User")
    plan = db.relationship("Plan")
    payment = db.relationship("Payment", uselist=False, back_populates="subscription")

    @property
    def is_active(self) -> bool:
        """Active = not cancelled and not expired."""
        return self.status == "active" and self.end_date > _now()

    def to_dict(self):
        if self.status == "cancelled":
            state = "cancelled"
        elif self.end_date <= _now():
            state = "expired"
        else:
            state = "active"
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "plan_id": self.plan_id,
            "plan_code": self.plan.code,
            "plan_name": self.plan.name,
            "price": self.plan.price,
            "start_date": _iso(self.start_date),
            "end_date": _iso(self.end_date),
            "status": self.status,
            "state": state,
        }


class PricingSettings(db.Model):
    """Single row (id = 1): the prices the admin can edit."""
    __tablename__ = "pricing_settings"
    id = db.Column(db.Integer, primary_key=True)
    base_price = db.Column(db.Float, nullable=False, default=100)
    min_price = db.Column(db.Float, nullable=False, default=60)
    max_price = db.Column(db.Float, nullable=False, default=150)

    def to_dict(self):
        return {"base_price": self.base_price, "min_price": self.min_price, "max_price": self.max_price}


class SlotPrice(db.Model):
    """The admin's decision on the AI recommendation for one hourly slot.

    status "applied": `price` is what clients pay for that hour.
    status "ignored": the slot stays at the base price.
    No row: the recommendation is still pending (base price).
    """
    __tablename__ = "slot_prices"
    id = db.Column(db.Integer, primary_key=True)
    slot_start = db.Column(db.DateTime, unique=True, nullable=False, index=True)
    price = db.Column(db.Float, nullable=False)
    predicted_occupancy = db.Column(db.Float, nullable=False, default=0)
    reason = db.Column(db.String(120), default="")
    status = db.Column(db.String(10), nullable=False, default="applied")
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)
