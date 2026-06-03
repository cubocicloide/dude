"""User queries."""

from typing import Sequence

from sqlmodel import Session, select

from app.models.user import User


class UserQueries:
    def get_all(self, db: Session) -> Sequence[User]:
        return db.exec(select(User)).all()

    def get_by_id(self, db: Session, user_id: int) -> User | None:
        return db.get(User, user_id)

    def get_by_email(self, db: Session, email: str) -> User | None:
        return db.exec(select(User).where(User.email == email)).first()
