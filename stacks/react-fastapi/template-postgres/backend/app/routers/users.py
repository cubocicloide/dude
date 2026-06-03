"""Users router."""

from typing import Sequence

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_db
from app.models.user import User
from app.queries.users import UserQueries

router = APIRouter(prefix="/users", tags=["users"])
_users = UserQueries()


@router.get("/", response_model=list[User])
def list_users(db: Session = Depends(get_db)) -> Sequence[User]:
    """Return all users."""
    return _users.get_all(db)


@router.get("/{user_id}", response_model=User)
def get_user(user_id: int, db: Session = Depends(get_db)) -> User:
    """Return a single user by ID."""
    user = _users.get_by_id(db, user_id)
    if user is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="User not found")
    return user
