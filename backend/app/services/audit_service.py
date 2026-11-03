from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from backend.app.database.models import AuditEvent, utc_now

def log_audit_event(
    db: Session,
    event_type: str,
    actor: str,
    details: str,
    claim_id: Optional[int] = None,
    previous_status: Optional[str] = None,
    new_status: Optional[str] = None
) -> AuditEvent:
    """
    Appends an immutable audit event record into the audit log.
    """
    event = AuditEvent(
        claim_id=claim_id,
        event_type=event_type,
        actor=actor,
        previous_status=previous_status,
        new_status=new_status,
        details=details,
        timestamp=utc_now()
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

