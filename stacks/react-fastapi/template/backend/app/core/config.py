"""Centralised settings — all environment variables are read here."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Add your environment variables below, in alphabetical order.
    # Example:
    #   DATABASE_URL: str
    #   DEBUG: bool = False
    #   SECRET_KEY: str

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
