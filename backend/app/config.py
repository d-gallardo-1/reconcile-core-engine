"""Runtime settings, read once from environment variables."""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from decimal import Decimal

API_PREFIX = "/api/v1"

#: Default matching rules. With these values the three tolerance cases of the
#: synthetic batch (wire fee, clearing lag, FX rounding) are auto-matched.
DEFAULT_AMOUNT_TOLERANCE_GBP = Decimal("15.00")
DEFAULT_DATE_WINDOW_DAYS = 2

#: Upper bounds accepted by the API; the UI sliders use the same range.
MAX_AMOUNT_TOLERANCE_GBP = Decimal("50.00")
MAX_DATE_WINDOW_DAYS = 5

#: Largest workbook accepted by the template verifier.
MAX_UPLOAD_BYTES = 2 * 1024 * 1024

HEARTBEAT_SECONDS = 5.0

#: Pause between two records of a live run, so a viewer can follow it.
DEFAULT_STEP_SECONDS = 0.15
MAX_STEP_SECONDS = 2.0


@dataclass(frozen=True)
class Settings:
    step_seconds: float = DEFAULT_STEP_SECONDS


def load_settings() -> Settings:
    """Read RECONCILE_STEP_SECONDS; an unusable value falls back to the default."""
    raw = os.environ.get("RECONCILE_STEP_SECONDS", "")
    try:
        value = float(raw)
    except ValueError:
        return Settings()
    if not math.isfinite(value):
        return Settings()
    return Settings(step_seconds=min(max(value, 0.0), MAX_STEP_SECONDS))
