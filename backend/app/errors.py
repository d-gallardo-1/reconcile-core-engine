"""Engine errors. Each carries a stable code the UI can translate."""

from __future__ import annotations


class EngineError(Exception):
    """Base class; the API layer maps subclasses to HTTP status codes."""

    def __init__(self, code: str, message: str, details: list[str] | None = None) -> None:
        super().__init__(message)
        self.code = code
        #: Individual problems behind the error, for example one per workbook row.
        self.details = details


class NotFoundError(EngineError):
    pass


class ConflictError(EngineError):
    pass


class InvalidRequestError(EngineError):
    pass


def run_in_progress() -> ConflictError:
    return ConflictError(
        "RUN_IN_PROGRESS", "A reconciliation run is in progress. Wait for it to finish."
    )
