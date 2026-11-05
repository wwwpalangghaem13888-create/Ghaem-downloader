import pytest
from fastapi import HTTPException

from app.security.urls import validate_public_media_url


def test_rejects_non_http_scheme():
    with pytest.raises(HTTPException):
        validate_public_media_url("file:///etc/passwd", {"youtube.com"})


def test_rejects_credentials():
    with pytest.raises(HTTPException):
        validate_public_media_url("https://user:pass@youtube.com/watch?v=x", {"youtube.com"})


def test_rejects_unlisted_domain():
    with pytest.raises(HTTPException):
        validate_public_media_url("https://example.org/video", {"youtube.com"})


def test_rejects_private_ip():
    with pytest.raises(HTTPException):
        validate_public_media_url("http://127.0.0.1/video", {"youtube.com"})


def test_rejects_nonstandard_port():
    with pytest.raises(HTTPException):
        validate_public_media_url("https://youtube.com:8443/watch?v=x", {"youtube.com"})
