from cryptography.fernet import Fernet
from app.config import settings

def _get_fernet() -> Fernet:
    return Fernet(settings.valid_fernet_key)

def encrypt_credential(plain_text: str) -> str:
    """Encrypt a sensitive string (e.g. SMTP password) using Fernet AES-256."""
    if not plain_text:
        return ""
    f = _get_fernet()
    token = f.encrypt(plain_text.encode("utf-8"))
    return token.decode("utf-8")

def decrypt_credential(cipher_text: str) -> str:
    """Decrypt an encrypted credential string back to plain text."""
    if not cipher_text:
        return ""
    f = _get_fernet()
    try:
        decrypted = f.decrypt(cipher_text.encode("utf-8"))
        return decrypted.decode("utf-8")
    except Exception:
        # If decryption fails (e.g. key changed), return empty to avoid crashes
        return ""
