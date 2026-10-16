def test_health(client):
    assert client.get("/health").json() == {"status": "UP"}


def test_ready_checks_database(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "READY"}


def test_create_and_get_product(client, product):
    assert product["id"] > 0
    assert product["unit_price"] == 4.5
    response = client.get(f"/api/products/{product['id']}")
    assert response.status_code == 200
    assert response.json()["sku"] == "CAB-001"


def test_list_products(client, product):
    response = client.get("/api/products")
    assert response.status_code == 200
    assert [p["sku"] for p in response.json()] == ["CAB-001"]


def test_duplicate_sku_is_rejected(client, product):
    duplicate = {"name": "Other cable", "sku": "CAB-001", "category": "Accessories", "unit_price": 1}
    assert client.post("/api/products", json=duplicate).status_code == 409


def test_negative_quantity_is_rejected(client):
    bad = {"name": "Mouse", "sku": "MOU-1", "category": "Peripherals", "quantity": -5, "unit_price": 10}
    assert client.post("/api/products", json=bad).status_code == 422


def test_update_product(client, product):
    response = client.put(f"/api/products/{product['id']}", json={"quantity": 3})
    assert response.status_code == 200
    assert response.json()["quantity"] == 3
    assert response.json()["name"] == "USB-C Cable"


def test_delete_product(client, product):
    assert client.delete(f"/api/products/{product['id']}").status_code == 204
    assert client.get(f"/api/products/{product['id']}").status_code == 404


def test_missing_product_returns_404(client):
    assert client.put("/api/products/999", json={"quantity": 1}).status_code == 404


def test_stats(client, product):
    client.post("/api/products", json={"name": "Keyboard", "sku": "KEY-1", "category": "Peripherals", "quantity": 2, "reorder_level": 5, "unit_price": 25})
    client.post("/api/products", json={"name": "Monitor", "sku": "MON-1", "category": "Displays", "quantity": 0, "unit_price": 150})
    stats = client.get("/api/products/stats").json()
    assert stats == {"total_products": 3, "total_units": 42, "low_stock": 1, "out_of_stock": 1, "inventory_value": 230.0}


def test_metrics_endpoint(client):
    client.get("/health")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text
