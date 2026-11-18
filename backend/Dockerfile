# Pinned by digest so a rebuilt tag cannot change the base silently; Dependabot
# updates the tag and the digest together.
FROM python:3.13-slim@sha256:e48f59cdba69a3cbd9ed2cf0f348d90d45a8d350d98134cf1070bc106ee9ed90

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv

# Unprivileged runtime user.
RUN useradd --system --uid 10001 --no-create-home reconcile

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

USER 10001
EXPOSE 8000

# One worker only: the batch lives in memory and must be shared by all clients.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-graceful-shutdown", "3"]
