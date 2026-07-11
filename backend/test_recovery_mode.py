from fastapi import HTTPException
import pytest

import main


@pytest.mark.asyncio
async def test_reset_is_locked_in_recovery_mode():
    assert main.RECOVERY_MODE_ACTIVE is True
    with pytest.raises(HTTPException) as exc:
        await main.reset_all_data("test-user")
    assert exc.value.status_code == 423


@pytest.mark.asyncio
async def test_restore_is_locked_before_any_table_write():
    with pytest.raises(HTTPException) as exc:
        await main.import_backup(main.RestorePayload(), "test-user")
    assert exc.value.status_code == 423
