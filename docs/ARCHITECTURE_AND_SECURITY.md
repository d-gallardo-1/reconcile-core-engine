# Architecture and Security

This document describes how `reconcile-core-engine` is built, what protects it, and
what a real deployment would still need.

**Scope reminder.** This is a reference architecture demonstration. All data belongs to
the fictional *Veritas Ledger Systems — UK & EU Audit Division* and is synthetic. No
real ledger, bank or tax record is used anywhere in the repository.

## 1. Components

| Component | Technology | Role |
| --- | --- | --- |
| UI | React 18, TypeScript, Vite, Tailwind CSS 4, Lucide icons | Cockpit, resolution drawer, rule inspector |
| Reverse proxy | `nginxinc/nginx-unprivileged` | Serves the static bundle, proxies `/api/` |
| API | Python 3.13, FastAPI, Uvicorn (one worker), Pydantic 2 | Rules, state, SSE |
| Workbooks | openpyxl (+ defusedxml) | Audit pack export, input parsing. No Pandas |

The backend runs with **one worker** on purpose. The batch, the tolerances, the
resolutions and the list of SSE subscribers live in the memory of that process; a
second worker would hold a different copy and clients would disagree.

## 2. Data model

One input row (`LedgerTransaction`) holds what the three sources say about one invoice:

- **Source A, ERP general ledger:** gross amount, posting date, VAT rate.
- **Source B, bank settlement feed:** amount per settlement, clearing date, number of
  settlements found.
- **Source C, tax/VAT registry:** status (`REGISTERED`, `CERTIFICATE_MISSING`,
  `NOT_REGISTERED`) and the VAT amount held.

The engine derives, per row: the variance (bank total minus ERP amount), the settlement
shift in days, the registry check, the verdict, the pass that decided it and a
plain-language explanation.

## 3. The three passes (`backend/app/matching.py`)

1. **Exact match.** One ERP entry, exactly one settlement, a registry record whose VAT
   equals the VAT contained in the ERP gross amount, zero variance, zero shift.
2. **Tolerance match.** Same structure, with `|variance| ≤ amount tolerance` and
   `|shift| ≤ date window`. Both conditions must hold.
3. **Anomaly detection.** Everything else. The cause is the first that applies, from
   most to least specific: unbooked bank debit, orphan ERP accrual, duplicate
   settlement, withholding gap (certificate missing), missing registry record, VAT
   mismatch, amount outside tolerance, date outside the window.

The functions are pure: the same batch and tolerances always give the same verdicts.
Changing a tolerance re-evaluates the whole batch immediately. Structural problems
(pass 3 causes other than amount and date) are never absorbed by a tolerance.

A **live run** does not compute anything different. It replays the verdicts one record
at a time (pass 1 visits every record, pass 2 the ones left open, pass 3 the rest) so
that a viewer can watch the pipeline. While a run is in progress, tolerance changes,
injection, reset and resolution answer `409 Conflict`. A run that stops before its last
step, because of an error or a shutdown, ends as `FAILED` and the error is logged; it
is never reported as completed.

## 4. Event stream

`GET /api/v1/stream` is a Server-Sent Events endpoint. Each client gets its own bounded
`asyncio.Queue` (256 events).

| Event | Payload | When |
| --- | --- | --- |
| `snapshot` | Full batch state | Once, on connect |
| `state_update` | Full batch state | After every change, from any client |
| `reconciliation_progress` | One step of a live run | During a run |
| `heartbeat` | `{}` | After 5 s without another event |

Because state events carry the whole batch, a slow client that loses queued events is
correct again on the next one. The browser treats 8 s of silence as a dead connection
and reconnects.

Nginx is configured for streaming on `/api/`: `proxy_http_version 1.1`, an empty
`Connection` header, `proxy_buffering off`, `proxy_cache off` and
`chunked_transfer_encoding off`. The API also sends `X-Accel-Buffering: no`.

## 5. Excel round trip

`export_audit_workbook(state, filepath)` writes six sheets: `Summary`, `Exact_Matches`,
`Tolerance_Matches`, `Unresolved_Anomalies`, `Resolved_Audit_Trail` and `Ledger_Input`.
`parse_ledger_workbook(filepath)` reads `Ledger_Input` back into the same objects. The
column layout is defined once (`excel_schema.py`) and used by the exporter, the parser,
the template and the schema table in the UI.

The parser reports every problem it finds with its row and column, instead of stopping
at the first one.

## 6. Security posture

Controls that exist in this repository:

| Control | Where |
| --- | --- |
| No external network calls: no CDN, no web fonts, system font stacks only | `frontend/src/index.css`, `frontend/index.html` |
| API docs page disabled (it would load assets from a CDN) | `backend/app/main.py` |
| Content-Security-Policy `default-src 'self'`, `X-Frame-Options: DENY`, `nosniff`, `no-referrer` | `frontend/nginx.conf` |
| Backend not published to the host; UI port bound to `127.0.0.1` | `docker-compose.yml` |
| Containers run as non-root, read-only filesystem, all capabilities dropped, `no-new-privileges` | `docker-compose.yml`, Dockerfiles |
| Input validation with bounds on every request body and path parameter | `backend/app/api/` |
| Upload limit of 2 MB, enforced while reading the body | `backend/app/api/export_routes.py` |
| Hardened XML parsing for workbooks (defusedxml), read-only parsing, 5,000-row limit that also counts blank rows, bounded numeric values | `backend/app/excel_io.py`, `backend/app/excel_schema.py` |
| Workbook parsing runs off the event loop, so an upload does not stall the stream | `backend/app/api/export_routes.py` |
| Spreadsheet formula injection: text starting with `=`, `+`, `-` or `@` is stored as text | `backend/app/excel_schema.py` |
| Uploaded workbooks are verified and discarded; they never replace the active batch | `backend/app/api/export_routes.py` |
| Exact dependency versions, lockfile for the frontend, monthly Dependabot | `backend/requirements.txt`, `frontend/package-lock.json`, `.github/dependabot.yml` |

## 7. What a real deployment would need

These are open on purpose, and none of them is solved here:

- **Authentication and authorisation.** Every endpoint is anonymous. A real system
  needs user identity, roles (preparer, reviewer, approver) and the identity recorded
  on each resolution. Until then, keep the port bound to localhost.
- **A durable, tamper-evident audit trail.** Resolutions are held in memory. A real
  audit trail belongs in an append-only store with integrity protection.
- **Persistence and recovery.** A restart returns to the default batch. A real system
  needs a database, backups and a tested restore.
- **TLS.** The demo serves plain HTTP on localhost. Anything beyond that needs HTTPS.
- **Rate limiting** on the run, export and verification endpoints.
- **A bound on decompressed workbook size.** The verifier limits the upload to 2 MB and
  the rows it reads, but a highly compressible file can still expand to much more than
  that in memory before those limits apply.
- **Cross-site request protection.** The state-changing endpoints accept plain POST
  requests without an origin check, so a web page open in the same browser could call
  them. Authentication with an origin or token check would close this.
- **Record matching.** Finding which bank line belongs to which invoice is the hard
  part of reconciliation and is outside this demo.
- **Data protection.** Real financial data is confidential and often personal. Access
  logging, retention rules and encryption at rest would have to be designed.
- **Independent review.** No penetration test has been performed.

## 8. Verification status

| Item | Status |
| --- | --- |
| Backend test suite (`pytest`) | Passing on Python 3.14, the version installed on the development machine. **Not yet run on Python 3.13**, the version the container image and CI use; the first CI run will be that check |
| Frontend type check and production build | Run locally on Node.js 20, passing. The frontend has no unit tests |
| Native code review (gentle-ai) of backend, frontend, delivery files and documentation | Approved with no blocking findings. Several non-blocking findings were fixed afterwards; others remain open (frontend unit tests, an error boundary, applying a response when the stream is down) |
| Application exercised in a browser against the local backend | Done during development |
| Docker images and the Nginx configuration | Built and run locally with Docker Engine 29 and Compose 2.40 on Ubuntu 24.04 (WSL 2). The smoke-test steps of the CI workflow were run by hand against that stack and passed: UI and security headers, API through the proxy, unbuffered SSE during a live run, audit pack round trip, non-root users, read-only filesystem, backend port not published. The CI workflow itself has not run yet because the repository has not been pushed |
