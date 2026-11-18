"""Excel round trip: audit pack export and ledger workbook parsing.

``export_audit_workbook`` writes the report sheets plus a ``Ledger_Input`` sheet
holding the source rows. ``parse_ledger_workbook`` reads that sheet back into
the same ``LedgerTransaction`` objects, so a batch survives the round trip.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import BinaryIO, Iterable

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet
from pydantic import ValidationError

from . import excel_schema as schema
from .excel_schema import Column
from .excel_summary import summary_rows
from .models import BatchState, LedgerTransaction, MatchStatus, ReconciledRecord

MAX_ROWS = 5000
_HEADER_FONT = Font(bold=True, color="FFFFFF")
_HEADER_FILL = PatternFill("solid", fgColor="1F2937")

Target = str | Path | BinaryIO


class WorkbookError(ValueError):
    """The workbook cannot be used; ``errors`` lists every problem found."""

    def __init__(self, errors: list[str]) -> None:
        super().__init__("; ".join(errors))
        self.errors = errors


def _write_table(sheet: Worksheet, columns: Iterable[Column], rows: Iterable[list]) -> None:
    columns = list(columns)
    sheet.append([column.header for column in columns])
    for cell in sheet[1]:
        cell.font, cell.fill = _HEADER_FONT, _HEADER_FILL
    for row in rows:
        sheet.append([schema.to_cell(value) for value in row])
    for index, column in enumerate(columns, start=1):
        letter = get_column_letter(index)
        sheet.column_dimensions[letter].width = 48 if column.field == "explanation" else 20
        number_format = {"money": schema.MONEY_FORMAT, "date": schema.DATE_FORMAT}.get(column.kind)
        if number_format:
            for cell in sheet[letter][1:]:
                cell.number_format = number_format
    sheet.freeze_panes = "A2"


def _report_rows(records: list[ReconciledRecord], status: MatchStatus, columns) -> list[list]:
    return [
        [getattr(record, column.field) for column in columns]
        for record in records
        if record.status is status
    ]


def _resolved_rows(records: list[ReconciledRecord]) -> list[list]:
    rows = []
    for record in records:
        if record.resolution is None:
            continue
        row = [getattr(record, column.field) for column in schema.REPORT_COLUMNS]
        row += [getattr(record.resolution, column.field) for column in schema.RESOLUTION_COLUMNS]
        rows.append(row)
    return rows


def export_audit_workbook(state: BatchState, filepath: Target) -> None:
    """Write the multi-sheet audit pack for ``state`` to a path or binary stream."""
    workbook = Workbook()
    summary = workbook.active
    summary.title = schema.SUMMARY_SHEET
    for label, value in summary_rows(state):
        summary.append([label, schema.to_cell(value)])
    for cell in summary["A"]:
        cell.font = Font(bold=True)
    summary.column_dimensions["A"].width = 36
    summary.column_dimensions["B"].width = 60

    for title, status in (
        (schema.EXACT_SHEET, MatchStatus.EXACT_MATCH),
        (schema.TOLERANCE_SHEET, MatchStatus.TOLERANCE_MATCH),
        (schema.ANOMALY_SHEET, MatchStatus.ANOMALY),
    ):
        rows = _report_rows(state.records, status, schema.REPORT_COLUMNS)
        _write_table(workbook.create_sheet(title), schema.REPORT_COLUMNS, rows)

    _write_table(
        workbook.create_sheet(schema.RESOLVED_SHEET),
        schema.REPORT_COLUMNS + schema.RESOLUTION_COLUMNS,
        _resolved_rows(state.records),
    )
    write_ledger_sheet(workbook.create_sheet(schema.LEDGER_SHEET), state.records)
    workbook.save(filepath)


def write_ledger_sheet(sheet: Worksheet, transactions: Iterable[LedgerTransaction]) -> None:
    rows = [[getattr(tx, column.field) for column in schema.LEDGER_COLUMNS] for tx in transactions]
    _write_table(sheet, schema.LEDGER_COLUMNS, rows)


def export_template_workbook(transactions: Iterable[LedgerTransaction], filepath: Target) -> None:
    """Write an input template: only the ``Ledger_Input`` sheet, with sample rows."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = schema.LEDGER_SHEET
    write_ledger_sheet(sheet, transactions)
    workbook.save(filepath)


def _parse_row(number: int, cells: tuple) -> tuple[LedgerTransaction | None, list[str]]:
    values, errors = {}, []
    for column, cell in zip(schema.LEDGER_COLUMNS, cells):
        try:
            value = schema.from_cell(column, cell)
        except (ValueError, TypeError) as error:
            errors.append(f"Row {number}, '{column.header}': {error}.")
            continue
        if value is None and column.required:
            errors.append(f"Row {number}, '{column.header}': value is required.")
        elif value is not None:
            values[column.field] = value
    if errors:
        return None, errors
    try:
        return LedgerTransaction(**values), []
    except ArithmeticError:
        return None, [f"Row {number}: a numeric value is out of range."]
    except ValidationError as error:
        return None, [
            f"Row {number}, '{'.'.join(str(p) for p in issue['loc'])}': {issue['msg']}."
            for issue in error.errors()
        ]


def parse_ledger_workbook(filepath: Target | bytes) -> list[LedgerTransaction]:
    """Read the ``Ledger_Input`` sheet. Raises ``WorkbookError`` listing every problem."""
    source = io.BytesIO(filepath) if isinstance(filepath, bytes) else filepath
    try:
        workbook = load_workbook(source, read_only=True, data_only=True)
    except Exception:  # zip, XML or format errors from a corrupt or hostile file
        raise WorkbookError(["The file is not a readable .xlsx workbook."]) from None
    try:
        if schema.LEDGER_SHEET not in workbook.sheetnames:
            raise WorkbookError([f"Sheet '{schema.LEDGER_SHEET}' was not found."])
        rows = workbook[schema.LEDGER_SHEET].iter_rows(values_only=True)
        expected = [column.header for column in schema.LEDGER_COLUMNS]
        header = [str(cell).strip() if cell is not None else "" for cell in next(rows, ())]
        if header[: len(expected)] != expected:
            raise WorkbookError(["Header row must be exactly: " + ", ".join(expected) + "."])

        transactions, errors, seen = [], [], set()
        for number, cells in enumerate(rows, start=2):
            # Checked before anything else, so blank rows and rows with data
            # only outside the schema columns cannot keep the loop running.
            if number > MAX_ROWS + 1:
                errors.append(
                    f"The sheet has more than {MAX_ROWS} rows. Blank and formatted rows "
                    "count: delete the unused rows below the data."
                )
                break
            cells = tuple(cells[: len(expected)])
            if all(cell is None for cell in cells):
                continue
            transaction, row_errors = _parse_row(number, cells)
            errors.extend(row_errors)
            if transaction is None:
                continue
            if transaction.tx_id in seen:
                errors.append(f"Row {number}: duplicate TX ID '{transaction.tx_id}'.")
            seen.add(transaction.tx_id)
            transactions.append(transaction)
        if not transactions and not errors:
            errors.append("The sheet has no data rows.")
        if errors:
            raise WorkbookError(errors[:50])
        return transactions
    finally:
        workbook.close()
