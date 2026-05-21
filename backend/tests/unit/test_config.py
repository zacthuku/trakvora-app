"""Unit tests for app.config.Settings."""
import pytest

from app.config import Settings


def test_cors_origins_list_single():
    s = Settings(cors_origins="http://localhost:5173")
    assert s.cors_origins_list == ["http://localhost:5173"]


def test_cors_origins_list_multiple():
    s = Settings(cors_origins="https://trakvora.com, https://api.trakvora.com, http://localhost:5173")
    assert s.cors_origins_list == [
        "https://trakvora.com",
        "https://api.trakvora.com",
        "http://localhost:5173",
    ]


def test_etims_enabled_false_when_empty():
    s = Settings(kra_pin="", etims_username="", etims_password="")
    assert s.etims_enabled is False


def test_etims_enabled_false_when_partial():
    s = Settings(kra_pin="P000000001A", etims_username="user", etims_password="")
    assert s.etims_enabled is False


def test_etims_enabled_true_when_all_set():
    s = Settings(kra_pin="P000000001A", etims_username="user", etims_password="pass")
    assert s.etims_enabled is True


def test_etims_base_url_sandbox():
    s = Settings(etims_sandbox=True)
    assert "sbx" in s.etims_base_url


def test_etims_base_url_production():
    s = Settings(etims_sandbox=False)
    assert "sbx" not in s.etims_base_url
    assert "etims-api.kra.go.ke" in s.etims_base_url
