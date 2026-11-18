import { CircleAlert, CircleCheck, Download, Upload } from 'lucide-react';
import { useId, useState, type ChangeEvent } from 'react';
import { api } from '../lib/api';
import type { VerifyResult } from '../types/reconciliation';

type Outcome = { file: string; result?: VerifyResult; error?: string };

/** Downloads the input template and checks a filled-in workbook against the schema. */
export function TemplateVerifier({ maxUploadBytes }: { maxUploadBytes: number }) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    if (file.size > maxUploadBytes) {
      setOutcome({ file: file.name, error: 'The workbook is larger than 2 MB.' });
      return;
    }
    setBusy(true);
    try {
      setOutcome({ file: file.name, result: await api.verifyTemplate(file) });
    } catch (cause) {
      setOutcome({ file: file.name, error: cause instanceof Error ? cause.message : 'Upload failed.' });
    } finally {
      setBusy(false);
    }
  };

  const errors = outcome?.error ? [outcome.error] : (outcome?.result?.errors ?? []);
  const valid = outcome?.result?.valid === true;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <a className="btn" href={api.exportTemplateUrl} download>
          <Download aria-hidden="true" className="h-4 w-4" />
          Download .XLSX Template
        </a>
        <label htmlFor={inputId} className={`btn cursor-pointer ${busy ? 'opacity-50' : ''}`}>
          <Upload aria-hidden="true" className="h-4 w-4" />
          {busy ? 'Verifying…' : 'Verify a Workbook'}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".xlsx"
          disabled={busy}
          onChange={(event) => void onFile(event)}
          className="sr-only"
        />
      </div>
      <p className="text-xs text-slate-500">
        Verification is read-only: the workbook is checked against the schema and discarded. It
        does not replace the active batch.
      </p>
      {outcome && (
        <div
          role="status"
          className={`rounded-md border p-3 text-sm ${
            valid ? 'border-exact/40 bg-exact/10 text-emerald-200' : 'border-anomaly/50 bg-anomaly/10 text-red-200'
          }`}
        >
          <p className="flex items-center gap-2 font-semibold">
            {valid ? (
              <CircleCheck aria-hidden="true" className="h-4 w-4" />
            ) : (
              <CircleAlert aria-hidden="true" className="h-4 w-4" />
            )}
            <span className="num break-all">{outcome.file}</span>
            {valid ? `· valid, ${outcome.result?.row_count} rows` : '· not valid'}
          </p>
          {errors.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
