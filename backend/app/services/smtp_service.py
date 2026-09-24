import smtplib
import ssl
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid
from typing import Any, Dict, Optional, Tuple
from app.core.encryption import decrypt_credential

class SMTPService:
    @staticmethod
    def test_connection(
        host: str,
        port: int,
        encryption: str,
        username: str,
        password_or_encrypted: str,
        is_already_encrypted: bool = False,
        timeout: int = 10,
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Tests connection and authentication to an SMTP server securely.
        Returns: (success, message, diagnostics)
        """
        diagnostics: Dict[str, Any] = {
            "host": host,
            "port": port,
            "encryption": encryption,
            "connected": False,
            "authenticated": False,
        }

        # Resolve password
        plain_password = (
            decrypt_credential(password_or_encrypted)
            if is_already_encrypted
            else password_or_encrypted
        )

        server = None
        try:
            ssl_context = ssl.create_default_context()

            if encryption.lower() == "ssl":
                server = smtplib.SMTP_SSL(host=host, port=port, context=ssl_context, timeout=timeout)
                server.ehlo()
                diagnostics["connected"] = True
            else:
                server = smtplib.SMTP(host=host, port=port, timeout=timeout)
                server.ehlo()
                diagnostics["connected"] = True

                if encryption.lower() == "tls":
                    server.starttls(context=ssl_context)
                    server.ehlo()

            # Attempt Authentication
            if username and plain_password:
                server.login(username, plain_password)
                diagnostics["authenticated"] = True

            return True, f"Successfully connected and authenticated to {host}:{port}", diagnostics

        except smtplib.SMTPAuthenticationError as e:
            return False, f"Authentication failed: Check username and password/app password ({e.smtp_code})", diagnostics
        except smtplib.SMTPConnectError as e:
            return False, f"Could not connect to {host}:{port}: {e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else str(e)}", diagnostics
        except ssl.SSLError as e:
            return False, f"SSL/TLS handshake error: {str(e)}", diagnostics
        except (smtplib.SMTPException, OSError) as e:
            return False, f"SMTP Connection error: {str(e)}", diagnostics
        except Exception as e:
            return False, f"Unexpected error during SMTP test: {str(e)}", diagnostics
        finally:
            if server:
                try:
                    server.quit()
                except Exception:
                    pass

    @staticmethod
    def send_email(
        host: str,
        port: int,
        encryption: str,
        username: str,
        password_or_encrypted: str,
        from_name: str,
        from_email: str,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        reply_to: Optional[str] = None,
        unsubscribe_url: Optional[str] = None,
        is_already_encrypted: bool = True,
        timeout: int = 15,
    ) -> Tuple[bool, str, Optional[int]]:
        """
        Sends an email message via SMTP with secure headers and MIME multipart structure.
        Returns: (success, message_or_error, smtp_code)
        """
        plain_password = (
            decrypt_credential(password_or_encrypted)
            if is_already_encrypted
            else password_or_encrypted
        )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = Header(subject, "utf-8")
        msg["From"] = formataddr((from_name, from_email))
        msg["To"] = to_email
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain=from_email.split("@")[-1] if "@" in from_email else None)
        msg["X-Mailer"] = "LeadFlow-AI/1.0"

        if reply_to:
            msg["Reply-To"] = reply_to

        if unsubscribe_url:
            msg["List-Unsubscribe"] = f"<{unsubscribe_url}>"
            msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

        # Attach text and HTML parts
        if not body_text:
            # Fallback simple text conversion
            import re
            body_text = re.sub(r"<[^>]+>", "", body_html)

        msg.attach(MIMEText(body_text, "plain", "utf-8"))
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        server = None
        try:
            ssl_context = ssl.create_default_context()

            if encryption.lower() == "ssl":
                server = smtplib.SMTP_SSL(host=host, port=port, context=ssl_context, timeout=timeout)
                server.ehlo()
            else:
                server = smtplib.SMTP(host=host, port=port, timeout=timeout)
                server.ehlo()
                if encryption.lower() == "tls":
                    server.starttls(context=ssl_context)
                    server.ehlo()

            if username and plain_password:
                server.login(username, plain_password)

            server.sendmail(from_email, [to_email], msg.as_string())
            return True, "Email successfully sent", 250

        except smtplib.SMTPRecipientsRefused as e:
            code = list(e.recipients.values())[0][0] if e.recipients else 550
            return False, f"Recipient refused: {str(e)}", code
        except smtplib.SMTPResponseException as e:
            return False, f"SMTP Error ({e.smtp_code}): {e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else str(e.smtp_error)}", e.smtp_code
        except Exception as e:
            return False, f"Failed to deliver email: {str(e)}", 500
        finally:
            if server:
                try:
                    server.quit()
                except Exception:
                    pass

smtp_service = SMTPService()
