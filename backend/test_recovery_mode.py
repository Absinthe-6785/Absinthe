from fastapi import HTTPException
import pytest
from unittest.mock import MagicMock

import main


@pytest.mark.asyncio
async def test_reset_is_locked_in_recovery_mode(monkeypatch: pytest.MonkeyPatch):
    supabase = MagicMock()
    monkeypatch.setattr(main, "supabase", supabase)
    monkeypatch.setattr(main, "RECOVERY_MODE_ACTIVE", True)
    assert main.RECOVERY_MODE_ACTIVE is True
    with pytest.raises(HTTPException) as exc:
        await main.reset_all_data("test-user")
    assert exc.value.status_code == 423
    supabase.table.assert_not_called()


@pytest.mark.asyncio
async def test_restore_is_locked_before_any_table_write(monkeypatch: pytest.MonkeyPatch):
    supabase = MagicMock()
    monkeypatch.setattr(main, "supabase", supabase)
    monkeypatch.setattr(main, "RECOVERY_MODE_ACTIVE", True)
    with pytest.raises(HTTPException) as exc:
        await main.import_backup(main.RestorePayload(), "test-user")
    assert exc.value.status_code == 423
    supabase.table.assert_not_called()


@pytest.mark.asyncio
async def test_non_destructive_health_endpoints_remain_available():
    assert await main.root() == {"status": "ok"}
    assert await main.ping() == {"pong": True}
