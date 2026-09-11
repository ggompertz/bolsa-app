"""
Endpoints de autenticación: login, perfil y gestión de usuarios.
"""
import time
from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import JWTError

from db.database import get_db
from db.models import User
from services.auth_service import verify_password, hash_password, create_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)

# Rate limit de /login en memoria — sin dependencia nueva (no hay slowapi en
# requirements.txt). Suficiente para un solo proceso; no sobrevive un restart
# ni se comparte entre múltiples instancias, aceptable para la escala actual.
_LOGIN_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
_LOGIN_MAX_ATTEMPTS = 10
_LOGIN_WINDOW_SECONDS = 300  # 5 minutos


def _check_login_rate_limit(ip: str) -> None:
    now = time.time()
    attempts = _LOGIN_ATTEMPTS[ip]
    attempts[:] = [t for t in attempts if now - t < _LOGIN_WINDOW_SECONDS]
    if len(attempts) >= _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Demasiados intentos. Espera unos minutos.")
    attempts.append(now)


# ─── Schemas ───────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    is_admin: bool = False


class UserOut(BaseModel):
    id: int
    username: str
    is_admin: bool
    is_active: bool
    model_config = {"from_attributes": True}


# ─── Dependency: usuario actual ────────────────────────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token requerido")
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o expirado")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario no encontrado")
    if not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario desactivado")
    return user


def require_admin(current: User = Depends(get_current_user)) -> User:
    if not current.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Se requieren permisos de administrador")
    return current


# ─── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/login")
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    _check_login_rate_limit(request.client.host if request.client else "unknown")
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario o contraseña incorrectos")
    token = create_token(user.id, user.username, user.is_admin)
    return {"access_token": token, "token_type": "bearer", "username": user.username, "is_admin": user.is_admin}


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return current


@router.get("/users", response_model=list[UserOut])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(400, f"El usuario '{body.username}' ya existe")
    user = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        is_admin=body.is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/active", response_model=UserOut)
def toggle_active(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if admin.id == user_id:
        raise HTTPException(400, "No puedes desactivarte a ti mismo")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if admin.id == user_id:
        raise HTTPException(400, "No puedes eliminar tu propio usuario")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    db.delete(user)
    db.commit()
