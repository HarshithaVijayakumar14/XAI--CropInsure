from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.app.database.session import get_db
from backend.app.config import settings
from backend.app.database.models import Claim, TrainedModel

router = APIRouter()

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    claims_count = db.query(Claim).count() if db_ok else 0
    models_count = db.query(TrainedModel).count() if db_ok else 0

    return {
        "status": "healthy" if db_ok else "degraded",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database_connected": db_ok,
        "demo_mode": settings.DEMO_MODE,
        "claims_registered": claims_count,
        "models_trained": models_count
    }

