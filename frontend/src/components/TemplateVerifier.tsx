import { CircleAlert, CircleCheck, Download, Upload } from 'lucide-react';
import { useId, useState, type ChangeEvent } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { api, ApiError } from '../lib/api';
import { errorText } from '../lib/errorText';
import type { VerifyResult } from '../types/reconciliation';

type Outcome = { file: string; result?: VerifyResult; failure?: ApiError; tooLarge?: boolean };

/** Downloads the input template and checks a filled-in workbook against the schema. */
export function TemplateVerifier({ maxUploadBytes }: { maxUploadBytes: number }) {
  const i18n = useI18n();
  const { t, tn, fmt } = i18n;
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    if (file.size > maxUploadBytes) {
      setOutcome({ file: file.name, tooLarge: true });
      return;
    }
    setBusy(true);
    try {
      setOutcome({ file: file.name, result: await api.verifyTemplate(file) });
    } catch (cause) {
      const failure = cause instanceof ApiError ? cause : new ApiError('GENERIC', '');
      setOutcome({ file: file.name, failure });
    } finally {
      setBusy(false);
    }
  };

  // Built on render so the messages follow a language change. Only the
  // row-level validation messages come from the backend and stay in English.
  const errors: string[] = [];
  const backendMessages = outcome?.result !== undefined;
  if (outcome?.tooLarge) {
    errors.push(t('verify.tooLarge', { megabytes: fmt.integer(maxUploadBytes / (1024 * 1024)) }));
  } else if (outcome?.failure) {
    errors.push(errorText(i18n, outcome.failure));
  } else if (outcome?.result) {
    errors.push(...outcome.result.errors);
  }
  const valid = outcome?.result?.valid === true;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <a className="btn" href={api.exportTemplateUrl} download>
          <Download aria-hidden="true" className="h-4 w-4" />
          {t('verify.download')}
        </a>
        <label htmlFor={inputId} className={`btn cursor-pointer ${busy ? 'opacity-50' : ''}`}>
          <Upload aria-hidden="true" className="h-4 w-4" />
          {busy ? t('verify.verifying') : t('verify.upload')}
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
      <p className="text-xs text-slate-500">{t('verify.readOnly')}</p>
      {outcome && (
        <div
          role="status"
          className={`rounded-md border p-3 text-sm ${
            valid ? 'border-exact/40 bg-exact/10 text-emerald-200' : 'border-anomaly/50 bg-anomaly/10 text-red-200'
          }`}
        >
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {valid ? (
              <CircleCheck aria-hidden="true" className="h-4 w-4" />
            ) : (
              <CircleAlert aria-hidden="true" className="h-4 w-4" />
            )}
            <span className="num break-all">{outcome.file}</span>
            <span>
              ·{' '}
              {valid
                ? t('verify.valid', { rows: tn('unit.records', outcome.result?.row_count ?? 0) })
                : t('verify.invalid')}
            </span>
          </p>
          {errors.length > 0 && (
            <ul lang={backendMessages ? 'en' : undefined} className="mt-2 list-disc space-y-1 pl-5">
              {errors.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
