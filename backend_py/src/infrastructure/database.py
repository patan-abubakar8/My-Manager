from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend_py.src.config.config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Import all models so their metadata is registered, then create tables."""
    from backend_py.src.domain.models import Base  # noqa: F401 — triggers model registration
    Base.metadata.create_all(bind=engine)
