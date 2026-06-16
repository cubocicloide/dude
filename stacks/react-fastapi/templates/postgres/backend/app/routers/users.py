"""Users list router."""

from typing import Sequence

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_db
from app.models.user import User
from app.queries.users import UsersQueries

router = APIRouter(tags=["users"])
_users = UsersQueries()


@router.get("/users", response_model=list[User])
def get_users(db: Session = Depends(get_db)) -> Sequence[User]:
    """Return all users."""
    return _users.get_all(db)
