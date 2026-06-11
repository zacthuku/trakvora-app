from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    secret_key: str = ""

    @field_validator("database_url", "secret_key", mode="before")
    @classmethod
    def must_be_set(cls, v: str, info) -> str:
        if not v:
            raise ValueError(
                f"{info.field_name} must be set via environment variable — "
                "check your .env file or container environment"
            )
        return v
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    environment: str = "development"
    cors_origins: str = "http://localhost:5173"

    intasend_public_key: str = ""
    intasend_secret_key: str = ""
    intasend_webhook_secret: str = ""
    intasend_redirect_url: str = ""
    intasend_webhook_url: str = ""

    @property
    def intasend_base_url(self) -> str:
        if self.environment == "production":
            return "https://payment.intasend.com"
        return "https://sandbox.intasend.com"
    smile_identity_api_key: str = ""
    smile_identity_partner_id: str = ""
    africastalking_api_key: str = ""
    africastalking_username: str = "sandbox"

    google_client_id: str = ""

    resend_api_key: str = ""

    # YourVerify — Kenyan vehicle plate & driver licence verification
    yourverify_api_key: str = ""
    yourverify_base_url: str = "https://api.youverify.co"

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@trakvora.com"
    smtp_tls: bool = True

    support_whatsapp: str = "+254700000000"
    support_email: str = "support@trakvora.com"

    # Google Maps server-side API key (Distance Matrix for ETA)
    google_maps_server_api_key: str = ""

    # Firebase Admin SDK — JSON string (stringified service account key)
    firebase_service_account_key: str = ""

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"

    # AWS S3 (file storage — falls back to local filesystem if not set)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket: str = ""
    aws_region: str = "af-south-1"

    @property
    def s3_enabled(self) -> bool:
        return bool(self.aws_access_key_id and self.aws_secret_access_key and self.aws_s3_bucket)

    # KRA eTIMS (Electronic Tax Invoice Management System)
    kra_pin: str = ""                        # Trakvora's KRA PIN e.g. P000000000A
    etims_username: str = ""                 # eTIMS portal username
    etims_password: str = ""                 # eTIMS portal password
    etims_branch_id: str = "00"             # Branch ID (00 = HQ)
    etims_sandbox: bool = True               # Set False in production
    vat_rate: float = 0.16                  # Kenya standard VAT 16%

    @property
    def etims_base_url(self) -> str:
        if self.etims_sandbox:
            return "https://etims-api-sbx.kra.go.ke"
        return "https://etims-api.kra.go.ke"

    @property
    def etims_enabled(self) -> bool:
        return bool(self.kra_pin and self.etims_username and self.etims_password)

    @field_validator("database_url", mode="before")
    @classmethod
    def strip_database_url(cls, v: str) -> str:
        return str(v).strip()

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
