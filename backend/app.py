import os

from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

import config
from extensions import db, jwt
from ml.predictor import Predictor
from utils import ApiError, to_iso, utcnow


def create_app(overrides: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config.Config)
    app.config["SQLALCHEMY_DATABASE_URI"] = config.database_url()
    app.json.ensure_ascii = False
    if overrides:
        app.config.update(overrides)

    db.init_app(app)
    jwt.init_app(app)
    CORS(app)

    app.predictor = Predictor(**app.config.get("PREDICTOR_PATHS", {}))

    from routes.admin import admin_bp
    from routes.ai import ai_bp
    from routes.auth import auth_bp
    from routes.client import client_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(client_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(ai_bp, url_prefix="/api/admin")

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", service="SmartPark API", time=to_iso(utcnow()),
                       prediction_source=app.predictor.source)

    @app.errorhandler(ApiError)
    def handle_api_error(error):
        db.session.rollback()
        return jsonify(error=error.message), error.status

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        messages = {404: "Ressource introuvable.", 405: "Méthode non autorisée.",
                    400: "Requête invalide.", 415: "Format de requête invalide."}
        return jsonify(error=messages.get(error.code, "Une erreur est survenue.")), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        db.session.rollback()
        app.logger.exception(error)
        return jsonify(error="Erreur interne du serveur. Veuillez réessayer."), 500

    session_expired = "Session expirée. Veuillez vous reconnecter."
    jwt.expired_token_loader(lambda header, payload: (jsonify(error=session_expired), 401))
    jwt.invalid_token_loader(lambda reason: (jsonify(error=session_expired), 401))
    jwt.unauthorized_loader(lambda reason: (jsonify(error="Authentification requise."), 401))

    with app.app_context():
        db.create_all()
    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    print(f"SmartPark API -> http://0.0.0.0:{port}  (check http://<your-ip>:{port}/api/health)")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
