import pytest
from app.core.encryption import decrypt_credential, encrypt_credential
from app.core.security import get_password_hash, verify_password
from app.api.v1.leads import sanitize_csv_cell

def test_password_hashing():
    raw_pass = "MySecretSecurePassword123!"
    hashed = get_password_hash(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed)
    assert not verify_password("WrongPassword!", hashed)

def test_smtp_credential_encryption():
    secret_smtp_key = "SG.987654321_SecretApiTokenValue"
    encrypted = encrypt_credential(secret_smtp_key)
    
    # Encrypted token must not contain the raw secret in plain text
    assert secret_smtp_key not in encrypted
    
    # Decrypting returns original secret
    decrypted = decrypt_credential(encrypted)
    assert decrypted == secret_smtp_key

def test_csv_injection_sanitization():
    # Formulas starting with =, +, -, @ must be prefixed with '
    assert sanitize_csv_cell("=SUM(A1:A10)") == "'=SUM(A1:A10)"
    assert sanitize_csv_cell("+cmd|' /C calc'!A0") == "'+cmd|' /C calc'!A0"
    assert sanitize_csv_cell("-12345") == "'-12345"
    assert sanitize_csv_cell("@SUM(1+1)") == "'@SUM(1+1)"
    
    # Normal text should remain unchanged
    assert sanitize_csv_cell("Sarah Chen") == "Sarah Chen"
    assert sanitize_csv_cell("sarah@company.com") == "sarah@company.com"
