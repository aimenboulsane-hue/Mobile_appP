from flask_jwt_extended import decode_token

from conftest import login


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"


def test_register_then_login(client):
    body = {"name": "Nouveau Client", "email": "New@Test.dz", "password": "Secret123"}
    response = client.post("/api/auth/register", json=body)
    assert response.status_code == 201
    assert response.get_json()["user"]["email"] == "new@test.dz"
    assert login(client, "new@test.dz", "Secret123")


def test_register_always_creates_a_client(client, app):
    body = {"name": "Pirate", "email": "pirate@test.dz", "password": "Secret123", "role": "admin"}
    data = client.post("/api/auth/register", json=body).get_json()
    assert data["user"]["role"] == "client"
    with app.app_context():
        assert decode_token(data["token"])["role"] == "client"


def test_register_validation_messages_are_french(client):
    response = client.post("/api/auth/register", json={"name": "A", "email": "x", "password": "1"})
    assert response.status_code == 400
    assert "nom" in response.get_json()["error"]
    response = client.post("/api/auth/register",
                           json={"name": "Client", "email": "client@test.dz", "password": "Secret123"})
    assert response.status_code == 409
    assert "déjà utilisée" in response.get_json()["error"]


def test_login_wrong_password(client):
    response = client.post("/api/auth/login", json={"email": "client@test.dz", "password": "nope"})
    assert response.status_code == 401
    assert response.get_json()["error"] == "E-mail ou mot de passe incorrect."


def test_password_is_hashed(app):
    from models import User
    with app.app_context():
        user = User.query.filter_by(email="client@test.dz").first()
        assert "Client123!" not in user.password_hash
        assert user.check_password("Client123!")


def test_token_contains_role(client, app):
    token = client.post("/api/auth/login",
                        json={"email": "admin@test.dz", "password": "Admin123!"}).get_json()["token"]
    with app.app_context():
        assert decode_token(token)["role"] == "admin"


def test_protected_route_needs_a_valid_token(client):
    assert client.get("/api/auth/me").status_code == 401
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert response.status_code == 401
    assert "Session expirée" in response.get_json()["error"]


def test_me_and_profile_update(client, client_auth):
    assert client.get("/api/auth/me", headers=client_auth).get_json()["user"]["role"] == "client"
    response = client.put("/api/auth/me", json={"name": "Nouveau Nom", "phone": "0555"},
                          headers=client_auth)
    assert response.get_json()["user"]["name"] == "Nouveau Nom"
