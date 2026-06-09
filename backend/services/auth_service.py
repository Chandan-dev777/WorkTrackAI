"""Auth service: JWT creation/validation and bcrypt password hashing."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models.user import User
from backend.schemas.auth import TokenData

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(
    user_id: str,
    email: str,
    role: str,
    employee_id: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "employee_id": employee_id,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> TokenData:
    """
    Decodes and validates a JWT.
    Raises jose.JWTError on invalid/expired tokens.
    """
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    return TokenData(
        user_id=payload["sub"],
        email=payload["email"],
        role=payload["role"],
        employee_id=payload["employee_id"],
    )


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if user is None:
        return None
    if user.hashed_password is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
