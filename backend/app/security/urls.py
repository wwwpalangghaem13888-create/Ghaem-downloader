import ipaddress
import socket
from urllib.parse import urlsplit

from fastapi import HTTPException


def validate_public_media_url(raw_url: str, allowed_hosts: set[str]) -> str:
    """Validate an HTTP(S) URL against an explicit host allowlist.

    Defense-in-depth only: production workers must additionally enforce network
    egress policy and mitigate DNS rebinding at connection time.
    """
    value = raw_url.strip()
    if not value or len(value) > 2048:
        raise HTTPException(status_code=422, detail="URL is empty or too long")
    try:
        parsed = urlsplit(value)
        host = (parsed.hostname or "").rstrip(".").lower()
        port = parsed.port
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid URL")

    if parsed.scheme not in {"http", "https"} or not host:
        raise HTTPException(status_code=422, detail="Only HTTP(S) URLs are supported")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=422, detail="URL credentials are not allowed")
    if port not in {None, 80, 443}:
        raise HTTPException(status_code=422, detail="Non-standard ports are not allowed")

    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    if ip is not None:
        if not ip.is_global:
            raise HTTPException(status_code=422, detail="Private IP addresses are not allowed")
        raise HTTPException(status_code=422, detail="Direct IP URLs are not supported")

    if not any(host == d or host.endswith("." + d) for d in allowed_hosts):
        raise HTTPException(status_code=422, detail="Unsupported media platform")

    try:
        records = socket.getaddrinfo(host, port or (443 if parsed.scheme == "https" else 80),
                                     type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise HTTPException(status_code=422, detail="Host could not be resolved")
    for record in records:
        if not ipaddress.ip_address(record[4][0]).is_global:
            raise HTTPException(status_code=422, detail="Host resolves to a non-public address")
    return value
