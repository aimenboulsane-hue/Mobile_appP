import random
from datetime import timedelta

import config
from app import create_app
from extensions import db
from models import Payment, Plan, PricingSettings, Reservation, SlotPrice, Spot, Subscription, User
from utils import parse_iso, to_local, to_utc, utcnow

ADMIN = ("Administrateur SmartPark", "admin@smartpark.dz", "Admin123!")
CLIENT = ("Yacine Benali", "client@smartpark.dz", "Client123!")
OTHER_CLIENTS = [
    "Amine Khelifi", "Sarah Mansouri", "Karim Bouzid", "Lina Hamdi", "Mehdi Saadi",
    "Nadia Cherif", "Sofiane Belkacem", "Imane Rahmani", "Walid Ferhat", "Yasmine Djebbar",
    "Riad Meziane", "Amel Boudiaf", "Nassim Haddad", "Meriem Slimani", "Farid Zerrouki",
    "Samira Benaissa", "Anis Guerfi", "Hana Touati", "Mourad Lounis", "Ines Kaci",
]
BASE_PRICE, MIN_PRICE, MAX_PRICE = 100, 60, 150
HISTORY_DAYS = 90
FUTURE_DAYS = 3

HOUR_WEIGHTS = {8: 3, 9: 6, 10: 9, 11: 11, 12: 12, 13: 11, 14: 8, 15: 5, 16: 2}
WEEKDAY_FACTOR = [1.0, 1.05, 1.1, 1.05, 0.95, 0.6, 0.45]


def run():
    random.seed(42)
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()
        now = utcnow()
        today = to_local(now).replace(hour=0, minute=0, second=0, microsecond=0)

        admin = User(name=ADMIN[0], email=ADMIN[1], role="admin", phone="0550 00 00 00",
                     created_at=now - timedelta(days=120))
        admin.set_password(ADMIN[2])
        demo = User(name=CLIENT[0], email=CLIENT[1], role="client", phone="0661 23 45 67",
                    created_at=now - timedelta(days=100))
        demo.set_password(CLIENT[2])
        others = []
        for i, name in enumerate(OTHER_CLIENTS):
            first, last = name.lower().split()
            user = User(name=name, email=f"{first}.{last}@example.com", role="client",
                        phone=f"0770 {10 + i} {20 + i} {30 + i}",
                        password_hash=demo.password_hash,
                        created_at=now - timedelta(days=random.randint(92, 110)))
            others.append(user)
        db.session.add_all([admin, demo] + others)

        spots = [Spot(number=f"{zone}-{n:02d}", zone=f"Zone {zone}")
                 for zone, count in (("A", 20), ("B", 20), ("C", 10)) for n in range(1, count + 1)]
        spots[-1].status = "out_of_service"
        plans = [
            Plan(code="monthly", name="Mensuel", duration_days=30, price=6000),
            Plan(code="quarterly", name="Trimestriel", duration_days=90, price=15000),
            Plan(code="annual", name="Annuel", duration_days=365, price=50000),
        ]
        db.session.add_all(spots + plans)
        db.session.add(PricingSettings(id=1, base_price=BASE_PRICE, min_price=MIN_PRICE,
                                       max_price=MAX_PRICE))
        db.session.flush()
        usable_spots = [s for s in spots if s.status == "available"]

        def subscribe(user, plan, started_days_ago, status="active"):
            start = now - timedelta(days=started_days_ago)
            sub = Subscription(user_id=user.id, plan_id=plan.id, start_date=start,
                               end_date=start + timedelta(days=plan.duration_days), status=status)
            db.session.add(sub)
            db.session.flush()
            db.session.add(Payment(user_id=user.id, subscription_id=sub.id, amount=plan.price,
                                   method="card", card_last4="4242", created_at=start))
            return sub

        subscriptions = {
            others[0].id: subscribe(others[0], plans[0], 10),
            others[1].id: subscribe(others[1], plans[1], 40),
            others[2].id: subscribe(others[2], plans[2], 75),
            others[3].id: subscribe(others[3], plans[0], 60),
        }

        busy = {}

        def find_spot(day, start, end):
            candidates = usable_spots[:]
            random.shuffle(candidates)
            for spot in candidates:
                taken = busy.setdefault((spot.id, day.date()), [])
                if all(end <= s or start >= e for s, e in taken):
                    taken.append((start, end))
                    return spot
            return None

        def add_reservation(user, day, start_hour, hours, cancelled=False):
            """start_hour and hours are in parking-local time (multiples of 0.5)."""
            start_local = day + timedelta(hours=start_hour)
            end_local = min(start_local + timedelta(hours=hours),
                            day + timedelta(hours=config.CLOSE_HOUR))
            start, end = to_utc(start_local), to_utc(end_local)
            spot = find_spot(day, start, end)
            if spot is None:
                return
            if cancelled:
                busy[(spot.id, day.date())].remove((start, end))
            duration = (end - start).total_seconds() / 3600
            sub = subscriptions.get(user.id)
            covered = sub is not None and sub.start_date <= start < sub.end_date
            promo = not covered and start_hour in (8, 8.5, 15.5, 16) and random.random() < 0.5
            rate = 0 if covered else BASE_PRICE * (0.8 if promo else 1)
            created = min(start - timedelta(hours=random.randint(1, 30)),
                          now - timedelta(minutes=random.randint(5, 300)))
            reservation = Reservation(
                user_id=user.id, spot_id=spot.id, start_time=start, end_time=end,
                status="cancelled" if cancelled else "active", price_per_hour=rate,
                total_price=rate * duration, promo_applied=promo,
                paid_with_subscription=covered, created_at=created)
            db.session.add(reservation)
            if not covered:
                reservation.payment = Payment(
                    user_id=user.id, amount=rate * duration, method="card",
                    card_last4=str(random.randint(1000, 9999)),
                    status="refunded" if cancelled else "paid", created_at=created)

        hours_list = list(HOUR_WEIGHTS)
        weights = list(HOUR_WEIGHTS.values())
        for offset in range(-HISTORY_DAYS, FUTURE_DAYS + 1):
            day = today + timedelta(days=offset)
            growth = 0.8 + 0.3 * (offset + HISTORY_DAYS) / HISTORY_DAYS
            count = round(80 * WEEKDAY_FACTOR[day.weekday()] * growth * random.uniform(0.85, 1.15))
            if offset > 0:
                count = round(count * 0.4)
            for _ in range(count):
                start_hour = random.choices(hours_list, weights)[0] + random.choice((0, 0.5))
                duration = random.choice((1, 1.5, 2, 2, 2.5, 3, 4))
                is_past = to_utc(day + timedelta(hours=start_hour)) < now
                add_reservation(random.choice(others), day, start_hour, duration,
                                cancelled=is_past and random.random() < 0.04)

        for days_ago, start_hour, duration in ((84, 9, 2), (77, 10, 3), (70, 13, 2), (62, 9, 1.5),
                                               (55, 11, 2), (47, 14, 2), (40, 9, 3), (33, 10, 2),
                                               (26, 12, 1), (19, 9, 2.5), (12, 13, 3), (5, 10, 2)):
            add_reservation(demo, today - timedelta(days=days_ago), start_hour, duration,
                            cancelled=days_ago == 47)
        add_reservation(demo, today + timedelta(days=1), 10, 2)
        add_reservation(demo, today + timedelta(days=3), 14, 2)
        db.session.commit()

        from routes.ai import build_recommendations
        tomorrow = [to_utc(today + timedelta(days=1, hours=h))
                    for h in range(config.OPEN_HOUR, config.CLOSE_HOUR)]
        promotions = [r for r in build_recommendations(tomorrow) if r["kind"] == "promotion"][:3]
        for r in promotions:
            db.session.add(SlotPrice(slot_start=parse_iso(r["slot_start"]),
                                     price=r["recommended_price"],
                                     predicted_occupancy=r["predicted_occupancy"],
                                     reason=r["reason"], status="applied"))
        db.session.commit()

        print("Database seeded:")
        print(f"  users         : {User.query.count()}  (admin: {ADMIN[1]} / {ADMIN[2]},"
              f" client: {CLIENT[1]} / {CLIENT[2]})")
        print(f"  spots         : {Spot.query.count()}")
        print(f"  reservations  : {Reservation.query.count()}")
        print(f"  payments      : {Payment.query.count()}")
        print(f"  subscriptions : {Subscription.query.count()}")
        print(f"  promotions    : {SlotPrice.query.count()} applied for tomorrow"
              f" (prediction source: {app.predictor.source})")


if __name__ == "__main__":
    run()
