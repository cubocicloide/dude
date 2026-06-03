"""Users by ID router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_db
from app.models.user import User
from app.queries.users import UsersQueries

router = APIRouter(tags=["users"])
_users = UsersQueries()


@router.get("/users/{id}", response_model=User)
def get_users__id(id: int, db: Session = Depends(get_db)) -> User:
    """Return a single user by ID."""
    user = _users.get_by_id(db, id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user
