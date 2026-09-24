import pytest
from app.core.ssrf import is_safe_url

def test_ssrf_blocks_localhost():
    safe, msg = is_safe_url("http://localhost/admin")
    assert not safe
    assert "Blocked host" in msg or "forbidden" in msg or "resolve" in msg

def test_ssrf_blocks_loopback_ip():
    safe, msg = is_safe_url("http://127.0.0.1/secret")
    assert not safe
    assert "non-public/private IP" in msg or "forbidden" in msg

def test_ssrf_blocks_cloud_metadata():
    safe, msg = is_safe_url("http://169.254.169.254/latest/meta-data/")
    assert not safe
    assert "metadata" in msg or "private" in msg or "forbidden" in msg

def test_ssrf_blocks_private_subnets():
    # 10.0.0.1
    safe1, _ = is_safe_url("http://10.0.0.1/status")
    assert not safe1

    # 192.168.1.1
    safe2, _ = is_safe_url("http://192.168.1.1/")
    assert not safe2

    # 172.16.0.1
    safe3, _ = is_safe_url("http://172.16.0.1/")
    assert not safe3

def test_ssrf_blocks_invalid_schemes():
    safe1, msg1 = is_safe_url("file:///etc/passwd")
    assert not safe1
    assert "Unsupported scheme" in msg1

    safe2, msg2 = is_safe_url("ftp://ftp.example.com")
    assert not safe2
    assert "Unsupported scheme" in msg2

def test_ssrf_blocks_weird_ports():
    safe, msg = is_safe_url("http://example.com:22/")
    assert not safe
    assert "Port 22 is not allowed" in msg
