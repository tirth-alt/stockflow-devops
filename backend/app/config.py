from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "StockFlow API"
    database_url: str = "postgresql+psycopg://stockflow:stockflow@localhost:5432/stockflow"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
