import sys
import time
from datetime import datetime, timedelta, timezone

import requests

import config

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000").rstrip("/") + "/api"
step_number = 0


def step(label):
    global step_number
    step_number += 1
    print(f"{step_number:>2}. {label}")


def call(method, path, token=None, expected=200, **kwargs):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    response = requests.request(method, BASE + path, headers=headers, timeout=10, **kwargs)
    assert response.status_code == expected, f"{method} {path} -> {response.status_code} {response.text}"
    return response.json()


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    step("health")
    assert call("GET", "/health")["status"] == "ok"

    email = f"e2e{int(time.time())}@smartpark.dz"
    step(f"register {email}")
    call("POST", "/auth/register", expected=201,
         json={"name": "Client E2E", "email": email, "password": "Secret123!"})
    step("login")
    login = call("POST", "/auth/login", json={"email": email, "password": "Secret123!"})
    token = login["token"]
    assert login["user"]["role"] == "client"

    offset = timedelta(hours=config.PARKING_UTC_OFFSET_HOURS)
    local_day = (datetime.now(timezone.utc) + offset).replace(hour=0, minute=0, second=0, microsecond=0)
    start = local_day + timedelta(days=2, hours=11) - offset
    end = start + timedelta(hours=2)
    range_query = f"?start={iso(start)}&end={iso(end)}"

    step("availability now and for the chosen range")
    now = call("GET", "/availability", token)
    assert now["total_spots"] > 0
    before = call("GET", "/availability" + range_query, token)
    assert before["free_spots"] > 0
    print(f"      {before['free_spots']}/{before['total_spots']} free, total {before['total_price']} {config.CURRENCY}")

    step("reserve + simulated payment")
    reservation = call("POST", "/reservations", token, expected=201,
                       json={"start_time": iso(start), "end_time": iso(end), "card_last4": "4242"})["reservation"]
    assert reservation["total_price"] == before["total_price"]
    assert reservation["payment_status"] == "paid"
    assert call("GET", "/availability" + range_query, token)["free_spots"] == before["free_spots"] - 1

    step("history shows the reservation and the payment")
    assert call("GET", "/reservations", token)["reservations"][0]["id"] == reservation["id"]
    payment = call("GET", "/payments", token)["payments"][0]
    assert payment["reservation_id"] == reservation["id"] and payment["status"] == "paid"

    step("cancel -> spot freed, payment refunded")
    cancelled = call("POST", f"/reservations/{reservation['id']}/cancel", token)["reservation"]
    assert cancelled["status"] == "cancelled" and cancelled["payment_status"] == "refunded"
    assert call("GET", "/availability" + range_query, token)["free_spots"] == before["free_spots"]
    assert call("GET", "/payments", token)["payments"][0]["status"] == "refunded"

    step("a client is refused on admin routes")
    call("GET", "/admin/dashboard", token, expected=403)

    step("admin login")
    admin = call("POST", "/auth/login",
                 json={"email": "admin@smartpark.dz", "password": "Admin123!"})["token"]

    step("dashboard")
    dashboard = call("GET", "/admin/dashboard?days=30", admin)
    assert len(dashboard["series"]) == 30 and dashboard["period"]["revenue"] > 0
    print(f"      today: {dashboard['today']}")

    step("recommendations")
    data = call("GET", "/admin/recommendations", admin)
    print(f"      source: {data['prediction_source']}, {len(data['recommendations'])} slots")
    target = next(r for r in data["recommendations"]
                  if r["status"] == "pending" and r["kind"] != "base")
    slot_query = f"?start={target['slot_start']}&end={target['slot_end']}"
    assert call("GET", "/availability" + slot_query, token)["price_per_hour"] == target["current_price"]

    step(f"apply: {target['slot_start']}  {target['current_price']} -> {target['recommended_price']}"
         f"  ({target['reason']})")
    applied = call("POST", "/admin/recommendations/decision", admin,
                   json={"slot_start": target["slot_start"], "action": "apply"})["recommendation"]
    assert applied["status"] == "applied"

    step("the client now sees the new price")
    seen = call("GET", "/availability" + slot_query, token)
    assert seen["price_per_hour"] == target["recommended_price"], seen

    call("POST", "/admin/recommendations/decision", admin,
         json={"slot_start": target["slot_start"], "action": "reset"})
    clients = call("GET", "/admin/clients", admin)["clients"]
    call("DELETE", f"/admin/clients/{next(c['id'] for c in clients if c['email'] == email)}", admin)

    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
