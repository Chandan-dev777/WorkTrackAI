"""Auth router: register, login, SSO, /me, set-password, change-password."""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from backend.config import IS_APP_SERVICE
from backend.database import get_db
from backend.models.user import User
from backend.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserProfile,
)
from backend.services.auth_service import (
    authenticate_user,
    create_access_token,
    decode_access_token,
    get_user_by_email,
    get_user_by_id,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer_scheme = HTTPBearer()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _token_response(user: User) -> TokenResponse:
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        employee_id=user.employee_id,
    )
    return TokenResponse(
        access_token=token,
        has_password=user.hashed_password is not None,
    )


# ── Dependency: current authenticated user ────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        token_data = decode_access_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user_by_id(db, token_data.user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def require_role(*roles: str):
    """Dependency factory: raises 403 if user role is not in the allowed list."""
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not permitted for this action",
            )
        return current_user
    return _check


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/sso", response_model=TokenResponse)
def sso_login(request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    """SSO auto-login using Uptimize App Service identity headers.

    Only enabled when running on App Service (APP_SERVICE_TS env var present).
    Headers are injected by VouchProxy after SSO — cannot be spoofed by clients.
    Auto-creates the user on first visit.
    """
    # Log everything useful for debugging SSO
    logger.info(
        "SSO attempt — IS_APP_SERVICE=%s | X-Appservice-Email=%s | X-Appservice-Muid=%s | X-Appservice-Firstname=%s",
        IS_APP_SERVICE,
        request.headers.get("X-Appservice-Email", "<not present>"),
        request.headers.get("X-Appservice-Muid", "<not present>"),
        request.headers.get("X-Appservice-Firstname", "<not present>"),
    )

    if not IS_APP_SERVICE:
        logger.info("SSO rejected: APP_SERVICE_TS env var not set (local dev mode)")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="SSO is only available on Uptimize App Service",
        )

    email = request.headers.get("X-Appservice-Email")
    if not email:
        logger.warning("SSO rejected: IS_APP_SERVICE=True but X-Appservice-Email header missing — VouchProxy may not be injecting headers")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="SSO identity headers not present",
        )

    firstname = request.headers.get("X-Appservice-Firstname", "")
    lastname = request.headers.get("X-Appservice-Lastname", "")
    muid = request.headers.get("X-Appservice-Muid", "")

    full_name = f"{firstname} {lastname}".strip() or email.split("@")[0]
    employee_id = muid or email.split("@")[0]

    user = get_user_by_email(db, email)
    if user is None:
        logger.info("SSO: new user — auto-creating account for %s (muid=%s)", email, muid)
        user = User(
            id=str(uuid.uuid4()),
            employee_id=employee_id,
            full_name=full_name,
            email=email,
            hashed_password=None,
            role="employee",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        logger.info("SSO: existing user found — %s (role=%s)", email, user.role)

    logger.info("SSO: login successful for %s", email)
    return _token_response(user)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        employee_id=payload.employee_id,
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        team_name=payload.team_name,
        department=payload.department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = get_user_by_email(db, payload.email)
    if user is not None and user.hashed_password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses SSO. Please access via the App Service URL, or set a password first.",
        )
    user = authenticate_user(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _token_response(user)


@router.get("/me", response_model=UserProfile)
def me(current_user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile(
        id=current_user.id,
        employee_id=current_user.employee_id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        team_name=current_user.team_name,
        department=current_user.department,
        is_active=current_user.is_active,
        has_password=current_user.hashed_password is not None,
        onboarding_complete=current_user.onboarding_complete,
        manager_id=current_user.manager_id,
    )


class OnboardingRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None          # "employee" | "manager"
    manager_id: Optional[str] = None    # None = top-level / no manager
    team_name: Optional[str] = None
    department: Optional[str] = None


@router.post("/onboarding")
def complete_onboarding(
    payload: OnboardingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Save onboarding choices (role, manager, team) for first-time SSO users."""
    if payload.full_name:
        current_user.full_name = payload.full_name.strip()
    if payload.role in ("employee", "manager"):
        current_user.role = payload.role
    current_user.manager_id = payload.manager_id  # None is valid (top-level)
    if payload.team_name is not None:
        current_user.team_name = payload.team_name or None
    if payload.department is not None:
        current_user.department = payload.department or None
    current_user.onboarding_complete = True
    db.commit()
    db.refresh(current_user)
    logger.info(
        "Onboarding complete for %s — role=%s manager_id=%s",
        current_user.email, current_user.role, current_user.manager_id,
    )
    return {
        "message": "Onboarding complete",
        "role": current_user.role,
        "manager_id": current_user.manager_id,
        "onboarding_complete": current_user.onboarding_complete,
    }


class SetPasswordRequest(BaseModel):
    password: str


@router.post("/set-password")
def set_password(
    payload: SetPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Set a password for the first time (SSO users who have no password yet).

    Use /change-password to update an existing password.
    """
    if current_user.hashed_password is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password already set. Use /change-password to update it.",
        )
    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )
    current_user.hashed_password = hash_password(payload.password)
    db.commit()
    return {"message": "Password set successfully. You can now log in with email and password as a fallback."}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Change the authenticated user's existing password."""
    if current_user.hashed_password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No password set. Use /set-password first.",
        )
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters",
        )
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully."}
