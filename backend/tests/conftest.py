import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app

# Isolated in-memory SQLite database: tests never touch the real PostgreSQL.
engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    Base.metadata.create_all(engine)
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)


@pytest.fixture
def product(client):
    payload = {"name": "USB-C Cable", "sku": "CAB-001", "category": "Accessories", "quantity": 40, "reorder_level": 10, "unit_price": "4.50"}
    return client.post("/api/products", json=payload).json()
