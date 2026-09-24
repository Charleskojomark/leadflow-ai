import os
from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator
from cryptography.fernet import Fernet

class Settings(BaseSettings):
    PROJECT_NAME: str = "LeadFlow AI"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "leadflow-ai-super-secret-production-key-change-in-prod-xyz789"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Credential Encryption Key for SMTP passwords (Fernet 32-byte base64)
    ENCRYPTION_KEY: str = "gAAAAABl-LeadFlowKeyDemo32BytesSecretDefaultString12="
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./leadflow.db"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]
    
    # Public app URL for unsubscribe links and asset resolution
    APP_URL: str = "http://localhost:3000"
    API_URL: str = "http://localhost:8000"
    
    # Extraction policy limits
    DEFAULT_MAX_PAGES_PER_DOMAIN: int = 5
    ABSOLUTE_MAX_PAGES_PER_DOMAIN: int = 15
    DEFAULT_MAX_CONTACTS_PER_DOMAIN: int = 3
    ABSOLUTE_MAX_CONTACTS_PER_DOMAIN: int = 10
    CRAWL_TIMEOUT_SECONDS: int = 12
    
    # Environment
    ENVIRONMENT: str = "development"
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "allow"

    @property
    def valid_fernet_key(self) -> bytes:
        """Ensure the encryption key is valid Fernet 32 url-safe base64 bytes."""
        try:
            k = self.ENCRYPTION_KEY.encode()
            Fernet(k)
            return k
        except Exception:
            import base64
            import hashlib
            key_32 = hashlib.sha256(self.ENCRYPTION_KEY.encode()).digest()
            return base64.urlsafe_b64encode(key_32)

settings = Settings()
