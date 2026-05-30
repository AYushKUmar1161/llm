from __future__ import annotations

import httpx
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_api_key,
)
from app.models.user import User
from app.models.memory import ApiKey
from app.schemas.user import (
    UserCreate,
    UserResponse,
    LoginRequest,
    Token,
    TokenRefresh,
    ApiKeyCreate,
    ApiKeyResponse,
    ApiKeyCreated,
)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user with email and password."""
    # Check if user already exists
    stmt = select(User).where(User.email == user_in.email)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Create new user
    user = User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=hash_password(user_in.password),
        role="member",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user with email and password, returning JWT access and refresh tokens."""
    stmt = select(User).where(User.email == credentials.email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password.",
        )

    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account.",
        )

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(token_in: TokenRefresh, db: AsyncSession = Depends(get_db)):
    """Refresh an access token using a valid refresh token."""
    try:
        payload = decode_token(token_in.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token sub claim is missing",
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
        )

    stmt = select(User).where(User.id == uuid.UUID(user_id))
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    access_token = create_access_token(subject=str(user.id))
    new_refresh_token = create_refresh_token(subject=str(user.id))

    return Token(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/github")
async def github_login():
    """Redirect to GitHub OAuth authorization screen."""
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="GitHub OAuth is not configured on this server.",
        )
    redirect_uri = f"https://github.com/login/oauth/authorize?client_id={settings.GITHUB_CLIENT_ID}&scope=user,repo"
    return {"url": redirect_uri}


@router.get("/github/callback", response_model=Token)
async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Callback for GitHub OAuth authentication flow."""
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="GitHub OAuth is not configured on this server.",
        )

    # 1. Exchange the OAuth code for a GitHub access token
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
        )
        if token_res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code with GitHub.",
            )
        token_data = token_res.json()
        github_token = token_data.get("access_token")
        if not github_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GitHub OAuth error: {token_data.get('error_description', 'No token returned')}",
            )

        # 2. Retrieve user profile info from GitHub
        user_res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {github_token}"},
        )
        if user_res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch user info from GitHub.",
            )
        github_user = user_res.json()

    # 3. Create or update user details in DB
    github_id = str(github_user["id"])
    github_username = github_user.get("login")
    email = github_user.get("email") or f"{github_username}@github.cf.local"
    name = github_user.get("name") or github_username

    stmt = select(User).where(User.github_id == github_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        # Fallback check by email to link GitHub to existing manual account if they match
        stmt_email = select(User).where(User.email == email)
        res_email = await db.execute(stmt_email)
        user = res_email.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            name=name,
            github_id=github_id,
            github_username=github_username,
            github_token=github_token,
            avatar_url=github_user.get("avatar_url"),
            role="member",
            is_active=True,
        )
        db.add(user)
    else:
        # Update GitHub fields
        user.github_id = github_id
        user.github_username = github_username
        user.github_token = github_token
        if github_user.get("avatar_url"):
            user.avatar_url = github_user.get("avatar_url")

    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Invalidate current user session."""
    return {"detail": "Successfully logged out."}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Fetch profile details for the currently logged in user."""
    return current_user


# ---------------------------------------------------------------------------
# API Key Endpoints
# ---------------------------------------------------------------------------


@router.post("/api-keys", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    key_in: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new personal API key for programmatic access."""
    full_key, key_prefix, key_hash = generate_api_key()

    api_key = ApiKey(
        user_id=current_user.id,
        name=key_in.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        is_active=True,
        expires_at=key_in.expires_at,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    # Attach the full key to response schema (only shown once on creation)
    setattr(api_key, "full_key", full_key)
    response_data = ApiKeyCreated.model_validate(api_key)
    return response_data


@router.get("/api-keys", response_model=List[ApiKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all API keys belonging to the current user."""
    stmt = select(ApiKey).where(ApiKey.user_id == current_user.id).order_by(ApiKey.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke/delete an API key."""
    stmt = select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == current_user.id)
    res = await db.execute(stmt)
    api_key = res.scalar_one_or_none()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API Key not found or does not belong to you.",
        )

    await db.delete(api_key)
    await db.commit()
    return None
