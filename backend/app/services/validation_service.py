import re
from datetime import datetime, timezone
from typing import Any, Dict, Tuple
import dns.resolver
from email_validator import validate_email, EmailNotValidError

# Common disposable email provider domains
DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
    "throwawaymail.com", "sharklasers.com", "dispostable.com", "yopmail.com",
    "trashmail.com", "fakeinbox.com", "getairmail.com", "mytemp.email"
}

# Role-based prefixes that can be risky or generic
ROLE_PREFIXES = {
    "admin", "support", "info", "sales", "contact", "help", "billing",
    "marketing", "jobs", "careers", "security", "press"
}

class ValidationService:
    @staticmethod
    def validate_single_email(email_str: str) -> Tuple[str, Dict[str, Any]]:
        """
        Performs multi-step non-intrusive email validation:
        1. Syntax validation (RFC compliance)
        2. Disposable domain check
        3. DNS host / MX record lookup
        Returns: (status, details_dict)
        Status values: 'mx_valid', 'domain_valid', 'valid_format', 'risky', 'invalid', 'unknown'
        """
        details: Dict[str, Any] = {
            "email": email_str,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "syntax_valid": False,
            "is_disposable": False,
            "is_role_account": False,
            "has_mx": False,
            "mx_records": [],
            "message": "",
        }

        if not email_str or "@" not in email_str:
            details["message"] = "Invalid format: missing '@'"
            return "invalid", details

        # 1. Syntax check
        try:
            valid = validate_email(email_str, check_deliverability=False)
            normalized = valid.normalized
            domain = valid.domain.lower()
            local_part = valid.local_part.lower()
            details["syntax_valid"] = True
            details["normalized"] = normalized
            details["domain"] = domain
        except EmailNotValidError as e:
            details["message"] = f"Syntax error: {str(e)}"
            return "invalid", details

        # 2. Disposable check
        if domain in DISPOSABLE_DOMAINS:
            details["is_disposable"] = True
            details["message"] = "Disposable or temporary email address detected"
            return "risky", details

        # 3. Role account check
        if local_part in ROLE_PREFIXES:
            details["is_role_account"] = True

        # 4. DNS MX record check
        try:
            resolver = dns.resolver.Resolver()
            resolver.timeout = 3.0
            resolver.lifetime = 3.0
            
            # Try MX record
            try:
                answers = resolver.resolve(domain, "MX")
                mx_hosts = [str(r.exchange).rstrip(".") for r in answers]
                if mx_hosts:
                    details["has_mx"] = True
                    details["mx_records"] = mx_hosts
                    details["message"] = f"Valid MX records found ({len(mx_hosts)} exchanges)"
                    if details["is_role_account"]:
                        return "risky", details
                    return "mx_valid", details
            except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
                # No MX record, check A record fallback
                try:
                    a_answers = resolver.resolve(domain, "A")
                    if a_answers:
                        details["message"] = "Domain exists (A record found) but no MX record configured"
                        return "domain_valid", details
                except Exception:
                    details["message"] = "Domain not found or has no DNS records"
                    return "invalid", details
            except dns.resolver.Timeout:
                details["message"] = "DNS query timed out"
                return "unknown", details
        except Exception as e:
            details["message"] = f"DNS lookup failed: {str(e)}"
            return "unknown", details

        details["message"] = "Valid email syntax"
        return "valid_format", details

validation_service = ValidationService()
