"""
Database engine + session setup.

Reads DATABASE_URL from the environment (set via docker-compose.yml / .env),
so the exact same code works whether the app is running inside Docker
(host=db) or a developer is running it locally (host=localhost).
"""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://welfare_admin:changeme_dev_only@localhost:5432/welfare_db",
)

# If host is 'db' but cannot be resolved on host outside docker, fallback to localhost
if "@db:" in DATABASE_URL:
    import socket
    try:
        socket.gethostbyname("db")
    except (socket.gaierror, Exception):
        DATABASE_URL = DATABASE_URL.replace("@db:", "@localhost:")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session, closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
