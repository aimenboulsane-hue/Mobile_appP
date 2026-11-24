import threading
from datetime import timedelta

from conftest import book, login, slot
from extensions import db
from models import Payment, PricingSettings, Reservation, Subscription
from utils import utcnow


def availability(client, auth, start, end):
    return client.get(f"/api/availability?start={start}&end={end}", headers=auth).get_json()


def test_reserve_computes_and_stores_the_price(client, client_auth, app):
    response = book(client, client_auth, slot(hour=10), slot(hour=12))
    assert response.status_code == 201
    reservation = response.get_json()["reservation"]
    assert reservation["total_price"] == 200
    assert reservation["price_per_hour"] == 100
    assert reservation["payment_status"] == "paid"
    with app.app_context():
        payment = Payment.query.one()
        assert (payment.amount, payment.method, payment.status) == (200, "card", "paid")
        assert payment.card_last4 == "4242"


def test_price_sent_by_the_client_is_ignored(client, client_auth):
    response = book(client, client_auth, slot(hour=10), slot(hour=11),
                    total_price=1, price_per_hour=1)
    assert response.get_json()["reservation"]["total_price"] == 100


def test_later_price_changes_do_not_alter_a_reservation(client, client_auth, admin_auth):
    reservation = book(client, client_auth, slot(hour=10), slot(hour=12)).get_json()["reservation"]
    client.put("/api/admin/pricing", headers=admin_auth,
               json={"base_price": 300, "min_price": 100, "max_price": 500})
    mine = client.get("/api/reservations", headers=client_auth).get_json()["reservations"]
    assert mine[0]["id"] == reservation["id"]
    assert mine[0]["total_price"] == 200
    assert book(client, client_auth, slot(hour=14), slot(hour=15)).get_json()["reservation"]["total_price"] == 300


def test_times_must_be_on_30_minute_boundaries(client, client_auth):
    response = book(client, client_auth, slot(hour=10, minute=15), slot(hour=12))
    assert response.status_code == 400
    assert "30 minutes" in response.get_json()["error"]


def test_reservation_must_be_in_the_future(client, client_auth):
    response = book(client, client_auth, slot(days_ahead=-1, hour=10), slot(days_ahead=-1, hour=12))
    assert response.status_code == 400
    assert "futur" in response.get_json()["error"]


def test_end_must_be_after_start(client, client_auth):
    response = book(client, client_auth, slot(hour=12), slot(hour=10))
    assert response.status_code == 400
    assert "après" in response.get_json()["error"]


def test_reservation_must_be_inside_opening_hours(client, client_auth):
    response = book(client, client_auth, slot(hour=6), slot(hour=9))
    assert response.status_code == 400
    assert "ouvert" in response.get_json()["error"]
    assert book(client, client_auth, slot(hour=16), slot(hour=18)).status_code == 400


def test_payment_needs_card_digits(client, client_auth):
    response = client.post("/api/reservations", headers=client_auth,
                           json={"start_time": slot(hour=10), "end_time": slot(hour=11)})
    assert response.status_code == 400
    assert "Paiement refusé" in response.get_json()["error"]


def test_two_reservations_never_share_a_spot(client, client_auth):
    """3 spots: 3 overlapping reservations get 3 different spots, the 4th is refused."""
    spots = set()
    for _ in range(3):
        response = book(client, client_auth, slot(hour=10), slot(hour=12))
        assert response.status_code == 201
        spots.add(response.get_json()["reservation"]["spot_id"])
    assert len(spots) == 3

    response = book(client, client_auth, slot(hour=11), slot(hour=13))
    assert response.status_code == 409
    assert "vient d'être réservé" in response.get_json()["error"]

    assert book(client, client_auth, slot(hour=12), slot(hour=13)).status_code == 201


def test_availability_counts_overlapping_reservations(client, client_auth):
    assert availability(client, client_auth, slot(hour=10), slot(hour=12))["free_spots"] == 3
    book(client, client_auth, slot(hour=10), slot(hour=12))
    assert availability(client, client_auth, slot(hour=11), slot(hour=13))["free_spots"] == 2
    assert availability(client, client_auth, slot(hour=12), slot(hour=13))["free_spots"] == 3


def test_out_of_service_spots_are_not_available(client, client_auth, admin_auth):
    spot = client.get("/api/admin/spots", headers=admin_auth).get_json()["spots"][0]
    client.put(f"/api/admin/spots/{spot['id']}", headers=admin_auth,
               json={**spot, "status": "out_of_service"})
    result = availability(client, client_auth, slot(hour=10), slot(hour=12))
    assert (result["total_spots"], result["free_spots"]) == (2, 2)


def test_concurrent_requests_cannot_take_the_last_spot_twice(app, client, client_auth):
    """Two requests at the same time for the last free spot: exactly one succeeds."""
    book(client, client_auth, slot(hour=10), slot(hour=12))
    book(client, client_auth, slot(hour=10), slot(hour=12))
    statuses = []

    def attempt():
        response = book(app.test_client(), client_auth, slot(hour=10), slot(hour=12))
        statuses.append(response.status_code)

    threads = [threading.Thread(target=attempt) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(statuses) == [201, 409, 409, 409]
    with app.app_context():
        active = Reservation.query.filter_by(status="active").all()
        assert len({r.spot_id for r in active}) == len(active) == 3


def test_cancel_frees_the_spot_and_refunds(client, client_auth):
    reservation = book(client, client_auth, slot(hour=10), slot(hour=12)).get_json()["reservation"]
    assert availability(client, client_auth, slot(hour=10), slot(hour=12))["free_spots"] == 2

    response = client.post(f"/api/reservations/{reservation['id']}/cancel", headers=client_auth)
    assert response.status_code == 200
    assert response.get_json()["reservation"]["status"] == "cancelled"
    assert response.get_json()["reservation"]["payment_status"] == "refunded"
    assert availability(client, client_auth, slot(hour=10), slot(hour=12))["free_spots"] == 3
    payments = client.get("/api/payments", headers=client_auth).get_json()["payments"]
    assert payments[0]["status"] == "refunded"

    assert client.post(f"/api/reservations/{reservation['id']}/cancel",
                       headers=client_auth).status_code == 400


def test_cannot_cancel_a_past_reservation(client, client_auth, app):
    reservation = book(client, client_auth, slot(hour=10), slot(hour=12)).get_json()["reservation"]
    with app.app_context():
        row = db.session.get(Reservation, reservation["id"])
        row.start_time -= timedelta(days=3)
        row.end_time -= timedelta(days=3)
        db.session.commit()
    response = client.post(f"/api/reservations/{reservation['id']}/cancel", headers=client_auth)
    assert response.status_code == 400
    assert "à venir" in response.get_json()["error"]


def test_cannot_see_or_cancel_someone_elses_reservation(client, client_auth):
    reservation = book(client, client_auth, slot(hour=10), slot(hour=12)).get_json()["reservation"]
    client.post("/api/auth/register",
                json={"name": "Autre Client", "email": "autre@test.dz", "password": "Secret123"})
    other = login(client, "autre@test.dz", "Secret123")
    assert client.get("/api/reservations", headers=other).get_json()["reservations"] == []
    assert client.post(f"/api/reservations/{reservation['id']}/cancel", headers=other).status_code == 404


def subscribe(client, auth, code="monthly"):
    plans = client.get("/api/plans", headers=auth).get_json()["plans"]
    plan = next(p for p in plans if p["code"] == code)
    return client.post("/api/subscriptions", headers=auth,
                       json={"plan_id": plan["id"], "card_last4": "4242"})


def test_subscribe_computes_the_end_date_from_the_plan(client, client_auth, app):
    response = subscribe(client, client_auth, "quarterly")
    assert response.status_code == 201
    with app.app_context():
        sub = Subscription.query.one()
        assert (sub.end_date - sub.start_date).days == 90
        assert Payment.query.one().amount == 15000


def test_only_one_active_subscription(client, client_auth):
    assert subscribe(client, client_auth).status_code == 201
    response = subscribe(client, client_auth, "annual")
    assert response.status_code == 409
    assert "déjà un abonnement actif" in response.get_json()["error"]


def test_subscriber_reserves_without_paying(client, client_auth, app):
    subscribe(client, client_auth)
    assert availability(client, client_auth, slot(hour=10), slot(hour=12))["total_price"] == 0
    response = client.post("/api/reservations", headers=client_auth,
                           json={"start_time": slot(hour=10), "end_time": slot(hour=12)})
    assert response.status_code == 201
    reservation = response.get_json()["reservation"]
    assert reservation["total_price"] == 0 and reservation["paid_with_subscription"] is True
    with app.app_context():
        assert Payment.query.filter(Payment.reservation_id.isnot(None)).count() == 0


def test_expired_subscription_stops_giving_free_reservations(client, client_auth, app):
    subscribe(client, client_auth)
    with app.app_context():
        sub = Subscription.query.one()
        sub.start_date = utcnow() - timedelta(days=31)
        sub.end_date = utcnow() - timedelta(days=1)
        db.session.commit()
    assert client.get("/api/subscriptions/me", headers=client_auth).get_json()["active"] is None
    reservation = book(client, client_auth, slot(hour=10), slot(hour=12)).get_json()["reservation"]
    assert reservation["total_price"] == 200 and reservation["paid_with_subscription"] is False
    assert subscribe(client, client_auth).status_code == 201


def test_history_lists_reservations_and_payments(client, client_auth):
    book(client, client_auth, slot(hour=10), slot(hour=11))
    subscribe(client, client_auth)
    assert len(client.get("/api/reservations", headers=client_auth).get_json()["reservations"]) == 1
    payments = client.get("/api/payments", headers=client_auth).get_json()["payments"]
    assert sorted(p["amount"] for p in payments) == [100, 6000]


def test_settings_row_is_unique(app):
    with app.app_context():
        assert PricingSettings.query.count() == 1
