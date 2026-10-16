from fastapi import Depends, FastAPI, HTTPException, status
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import Product
from .schemas import ProductCreate, ProductOut, ProductUpdate, StatsOut

app = FastAPI(title=settings.app_name, version="1.0.0")
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/")
def root():
    return {"service": settings.app_name, "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
def health():
    # Liveness: the process is up. Deliberately does not touch the database.
    return {"status": "UP"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    # Readiness: only accept traffic when the database answers.
    db.execute(text("SELECT 1"))
    return {"status": "READY"}


@app.get("/api/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.scalars(select(Product).order_by(Product.updated_at.desc())).all()


@app.get("/api/products/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db)):
    total, units, value = db.execute(
        select(
            func.count(Product.id),
            func.coalesce(func.sum(Product.quantity), 0),
            func.coalesce(func.sum(Product.quantity * Product.unit_price), 0),
        )
    ).one()
    out = db.scalar(select(func.count()).where(Product.quantity == 0))
    low = db.scalar(select(func.count()).where(Product.quantity > 0, Product.quantity <= Product.reorder_level))
    return StatsOut(total_products=total, total_units=units, low_stock=low, out_of_stock=out, inventory_value=float(value))


def get_or_404(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def save(db: Session, product: Product) -> Product:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A product with this SKU already exists")
    db.refresh(product)
    return product


@app.get("/api/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, product_id)


@app.post("/api/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**payload.model_dump())
    db.add(product)
    return save(db, product)


@app.put("/api/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = get_or_404(db, product_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    return save(db, product)


@app.delete("/api/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, product_id))
    db.commit()
