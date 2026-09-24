import pytest
from app.services.validation_service import validation_service

def test_validation_invalid_syntax():
    status, details = validation_service.validate_single_email("notanemail")
    assert status == "invalid"
    assert details["syntax_valid"] is False

    status2, details2 = validation_service.validate_single_email("missingdomain@")
    assert status2 == "invalid"

def test_validation_disposable_email():
    status, details = validation_service.validate_single_email("testing123@mailinator.com")
    assert status == "risky"
    assert details["is_disposable"] is True

def test_validation_role_account():
    # If MX check succeeds or falls back, role account is flagged
    status, details = validation_service.validate_single_email("support@google.com")
    assert details["is_role_account"] is True

def test_validation_valid_email_domain():
    status, details = validation_service.validate_single_email("alex@google.com")
    # Google.com definitely has MX records
    assert status == "mx_valid"
    assert details["has_mx"] is True
    assert len(details["mx_records"]) > 0
