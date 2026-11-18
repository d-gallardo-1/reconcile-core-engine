"""Request and response bodies that are not part of the engine's own models."""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..config import MAX_DATE_WINDOW_DAYS
from ..models import ResolutionAction


class ToleranceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    #: The upper bound depends on the batch currency and is checked by the engine.
    amount_tolerance: Decimal = Field(ge=0, max_digits=15, decimal_places=2)
    date_window_days: int = Field(ge=0, le=MAX_DATE_WINDOW_DAYS, strict=True)


class CurrencyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currency: str = Field(pattern=r"^[A-Za-z]{3}$")


class ResolveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resolution_note: str = Field(min_length=1, max_length=500)
    action: ResolutionAction

    @field_validator("resolution_note")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("resolution_note must not be blank")
        return value


class BulkResolveRequest(ResolveRequest):
    """One decision and one note for several anomalies of the same cause."""

    tx_ids: list[Annotated[str, Field(pattern=r"^[A-Za-z0-9-]{1,32}$")]] = Field(
        min_length=1, max_length=100
    )

    @field_validator("tx_ids")
    @classmethod
    def _no_duplicates(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("tx_ids must not repeat a transaction")
        return value


class HealthResponse(BaseModel):
    status: str
    version: str
    subscribers: int


class SchemaColumn(BaseModel):
    header: str
    kind: str
    required: bool
    description: str


class LedgerSchemaResponse(BaseModel):
    sheet: str
    columns: list[SchemaColumn]
    max_rows: int
    max_upload_bytes: int


class VerifyResponse(BaseModel):
    valid: bool
    row_count: int
    errors: list[str]
