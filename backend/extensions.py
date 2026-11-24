from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine

db = SQLAlchemy()
jwt = JWTManager()


@event.listens_for(Engine, "connect")
def _sqlite_connect(dbapi_connection, _record):
    if dbapi_connection.__class__.__module__.startswith("sqlite3"):
        dbapi_connection.isolation_level = None
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=10000")
        cursor.close()


@event.listens_for(Engine, "begin")
def _sqlite_begin(conn):
    if conn.dialect.name == "sqlite":
        conn.exec_driver_sql("BEGIN IMMEDIATE")
