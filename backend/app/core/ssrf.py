import socket
import ipaddress
from urllib.parse import urlparse
from typing import Tuple, List

# Cloud metadata IP addresses to explicitly ban
BLOCKED_IPS = {
    "169.254.169.254", # AWS / Azure / OpenStack metadata
    "fd00:ec2::254",    # AWS IPv6 metadata
    "100.100.100.200",  # Alibaba Cloud metadata
}

BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "instance-data",
}

def is_safe_url(target_url: str) -> Tuple[bool, str]:
    """
    Validate that target_url uses http/https, does not contain userinfo,
    and resolves strictly to public, non-private, non-metadata IP addresses.
    Returns (is_safe, error_or_reason).
    """
    if not target_url or not isinstance(target_url, str):
        return False, "Target URL must be a non-empty string"
        
    target_url = target_url.strip()
    
    try:
        parsed = urlparse(target_url)
    except Exception as e:
        return False, f"Malformed URL: {str(e)}"
        
    if parsed.scheme not in ("http", "https"):
        return False, f"Unsupported scheme '{parsed.scheme}'. Only http and https are permitted."
        
    hostname = parsed.hostname
    if not hostname:
        return False, "URL does not contain a valid hostname"
        
    hostname_lower = hostname.lower().strip()
    
    # Check explicitly blocked hostnames
    if hostname_lower in BLOCKED_HOSTNAMES or hostname_lower.endswith(".local") or hostname_lower.endswith(".internal"):
        return False, f"Blocked host '{hostname}'. Local and internal domains are forbidden."
        
    # Check if port is specified and unusual
    if parsed.port and parsed.port not in (80, 443, 8080, 8443):
        return False, f"Port {parsed.port} is not allowed. Only standard web ports (80, 443, 8080, 8443) are permitted."
        
    # Userinfo in URL (e.g. http://user:pass@host)
    if parsed.username or parsed.password:
        return False, "URLs with embedded credentials are not allowed"
        
    # Resolve hostname to all associated IP addresses
    try:
        addr_infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        return False, f"Could not resolve host '{hostname}': {str(e)}"
    except Exception as e:
        return False, f"DNS resolution error for '{hostname}': {str(e)}"
        
    if not addr_infos:
        return False, f"No IP addresses found for '{hostname}'"
        
    for addr in addr_infos:
        ip_str = addr[4][0]
        
        # Check against hardcoded blocked metadata IPs
        if ip_str in BLOCKED_IPS:
            return False, f"Host '{hostname}' resolves to blocked cloud metadata IP {ip_str}"
            
        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            return False, f"Invalid resolved IP '{ip_str}'"
            
        # Check private, loopback, link-local, reserved
        if (
            ip_obj.is_private or
            ip_obj.is_loopback or
            ip_obj.is_link_local or
            ip_obj.is_multicast or
            ip_obj.is_reserved or
            ip_obj.is_unspecified
        ):
            return False, f"Host '{hostname}' resolves to non-public/private IP {ip_str}. Access forbidden."
            
    return True, "URL is safe"
