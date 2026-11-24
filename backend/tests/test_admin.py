from conftest import book, slot


def admin_routes(app):
    """Every (method, url) registered under /api/admin, found automatically."""
    routes = []
    for rule in app.url_map.iter_rules():
        if rule.rule.startswith("/api/admin"):
            url = rule.rule.replace("<int:", "<").split("<")[0] + ("1" if "<" in rule.rule else "")
            routes += [(m, url) for m in rule.methods if m in ("GET", "POST", "PUT", "DELETE")]
    return routes


def test_admin_routes_exist(app):
    assert len(admin_routes(app)) >= 20


def test_admin_routes_refuse_clients(app, client, client_auth):
    for method, url in admin_routes(app):
        response = client.open(url, method=method, headers=client_auth, json={})
        assert response.status_code == 403, f"{method} {url}"
        assert response.get_json()["error"] == "Accès réservé aux administrateurs."


def test_admin_routes_refuse_anonymous_requests(app, client):
    for method, url in admin_routes(app):
        assert client.open(url, method=method, json={}).status_code == 401, f"{method} {url}"


def test_spot_crud(client, admin_auth):
    response = client.post("/api/admin/spots", headers=admin_auth,
                           json={"number": "b-01", "zone": "Zone B"})
    assert response.status_code == 201
    spot = response.get_json()["spot"]
    assert spot["number"] == "B-01" and spot["status"] == "available"

    duplicate = client.post("/api/admin/spots", headers=admin_auth,
                            json={"number": "B-01", "zone": "Zone B"})
    assert duplicate.status_code == 409

    response = client.put(f"/api/admin/spots/{spot['id']}", headers=admin_auth,
                          json={"number": "B-01", "zone": "Zone C", "status": "out_of_service"})
    assert response.get_json()["spot"]["zone"] == "Zone C"

    assert client.delete(f"/api/admin/spots/{spot['id']}", headers=admin_auth).status_code == 200
    assert len(client.get("/api/admin/spots", headers=admin_auth).get_json()["spots"]) == 3


def test_spot_with_upcoming_reservation_cannot_be_deleted(client, client_auth, admin_auth):
    reservation = book(client, client_auth, slot(hour=10), slot(hour=12)).get_json()["reservation"]
    response = client.delete(f"/api/admin/spots/{reservation['spot_id']}", headers=admin_auth)
    assert response.status_code == 409
    assert "réservations à venir" in response.get_json()["error"]


def test_client_crud(client, admin_auth):
    body = {"name": "Samir Test", "email": "samir@test.dz", "password": "Secret123", "phone": "0555"}
    created = client.post("/api/admin/clients", headers=admin_auth, json=body)
    assert created.status_code == 201
    client_id = created.get_json()["client"]["id"]

    updated = client.put(f"/api/admin/clients/{client_id}", headers=admin_auth,
                         json={"name": "Samir Modifié", "email": "samir@test.dz"})
    assert updated.get_json()["client"]["name"] == "Samir Modifié"

    names = [c["name"] for c in client.get("/api/admin/clients", headers=admin_auth).get_json()["clients"]]
    assert "Samir Modifié" in names and "Admin" not in names

    assert client.delete(f"/api/admin/clients/{client_id}", headers=admin_auth).status_code == 200


def test_deleting_a_client_removes_their_data(client, client_auth, admin_auth):
    book(client, client_auth, slot(hour=10), slot(hour=12))
    clients = client.get("/api/admin/clients", headers=admin_auth).get_json()["clients"]
    assert clients[0]["reservations_count"] == 1
    assert client.delete(f"/api/admin/clients/{clients[0]['id']}", headers=admin_auth).status_code == 200
    assert client.get("/api/admin/reservations", headers=admin_auth).get_json()["reservations"] == []
    assert client.get("/api/auth/me", headers=client_auth).status_code == 401


def test_admin_reservation_crud(client, admin_auth):
    user = client.get("/api/admin/clients", headers=admin_auth).get_json()["clients"][0]
    spots = client.get("/api/admin/spots", headers=admin_auth).get_json()["spots"]
    body = {"user_id": user["id"], "spot_id": spots[1]["id"],
            "start_time": slot(hour=9), "end_time": slot(hour=11)}
    created = client.post("/api/admin/reservations", headers=admin_auth, json=body)
    assert created.status_code == 201
    reservation = created.get_json()["reservation"]
    assert reservation["spot_id"] == spots[1]["id"] and reservation["total_price"] == 200

    assert client.post("/api/admin/reservations", headers=admin_auth, json=body).status_code == 409

    moved = client.put(f"/api/admin/reservations/{reservation['id']}", headers=admin_auth,
                       json={"spot_id": spots[2]["id"], "start_time": slot(hour=9),
                             "end_time": slot(hour=12)})
    assert moved.status_code == 200
    assert moved.get_json()["reservation"]["spot_id"] == spots[2]["id"]
    assert moved.get_json()["reservation"]["total_price"] == 300

    cancelled = client.put(f"/api/admin/reservations/{reservation['id']}", headers=admin_auth,
                           json={"status": "cancelled"})
    assert cancelled.get_json()["reservation"]["payment_status"] == "refunded"
    listed = client.get("/api/admin/reservations?scope=cancelled", headers=admin_auth).get_json()
    assert len(listed["reservations"]) == 1

    assert client.delete(f"/api/admin/reservations/{reservation['id']}", headers=admin_auth).status_code == 200


def test_admin_cannot_move_a_reservation_onto_a_taken_spot(client, client_auth, admin_auth):
    first = book(client, client_auth, slot(hour=10), slot(hour=12)).get_json()["reservation"]
    second = book(client, client_auth, slot(hour=10), slot(hour=12)).get_json()["reservation"]
    response = client.put(f"/api/admin/reservations/{second['id']}", headers=admin_auth,
                          json={"spot_id": first["spot_id"]})
    assert response.status_code == 409


def test_admin_subscription_crud(client, admin_auth):
    user = client.get("/api/admin/clients", headers=admin_auth).get_json()["clients"][0]
    plans = client.get("/api/plans", headers=admin_auth).get_json()["plans"]
    body = {"user_id": user["id"], "plan_id": plans[0]["id"]}
    created = client.post("/api/admin/subscriptions", headers=admin_auth, json=body)
    assert created.status_code == 201
    sub = created.get_json()["subscription"]
    assert sub["state"] == "active"
    assert client.post("/api/admin/subscriptions", headers=admin_auth, json=body).status_code == 409

    updated = client.put(f"/api/admin/subscriptions/{sub['id']}", headers=admin_auth,
                         json={"plan_id": plans[2]["id"], "status": "cancelled"})
    assert updated.get_json()["subscription"]["plan_code"] == "annual"
    assert updated.get_json()["subscription"]["state"] == "cancelled"

    assert client.delete(f"/api/admin/subscriptions/{sub['id']}", headers=admin_auth).status_code == 200
    assert client.get("/api/admin/subscriptions", headers=admin_auth).get_json()["subscriptions"] == []


def test_pricing_settings_validation(client, admin_auth):
    bad = client.put("/api/admin/pricing", headers=admin_auth,
                     json={"base_price": 100, "min_price": 120, "max_price": 150})
    assert bad.status_code == 400
    good = client.put("/api/admin/pricing", headers=admin_auth,
                      json={"base_price": 120, "min_price": 80, "max_price": 200})
    assert good.get_json()["pricing"] == {"base_price": 120, "min_price": 80, "max_price": 200}


def test_dashboard_numbers(client, client_auth, admin_auth):
    book(client, client_auth, slot(days_ahead=1, hour=10), slot(days_ahead=1, hour=12))
    data = client.get("/api/admin/dashboard?days=7", headers=admin_auth).get_json()
    assert len(data["series"]) == 7
    assert data["today"]["revenue"] == 200
    assert data["today"]["active_reservations"] == 1
    assert data["today"]["active_subscribers"] == 0
    assert data["period"]["revenue"] == 200
