import hashlib
import hmac
import secrets
from typing import Optional
from backend.app.config import settings

def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Secure password hashing using SHA-256 with cryptographic salt."""
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    return f"{salt}${hashed}"

def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verifies a plain password against stored salt$hash format."""
    try:
        salt, _ = stored_hash.split('$', 1)
        expected = hash_password(plain_password, salt=salt)
        return hmac.compare_digest(expected, stored_hash)
    except Exception:
        return False

def generate_session_token() -> str:
    """Generates a secure random session token."""
    return secrets.token_urlsafe(32)

