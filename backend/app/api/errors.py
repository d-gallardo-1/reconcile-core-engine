"""Maps engine errors to HTTP responses in one place.

Every body carries ``detail`` (English) and ``code`` (stable, translated by the UI).
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from ..errors import ConflictError, EngineError, InvalidRequestError, NotFoundError

_STATUS = {NotFoundError: 404, ConflictError: 409, InvalidRequestError: 422}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(EngineError)
    async def _engine_error(_: Request, error: EngineError) -> JSONResponse:
        status = _STATUS.get(type(error), 400)
        content: dict[str, object] = {"detail": str(error), "code": error.code}
        if error.details is not None:
            content["errors"] = error.details
        return JSONResponse(status_code=status, content=content)
