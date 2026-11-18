import { CircleAlert, CircleCheck, Download, FileUp, Upload } from 'lucide-react';
import { useId, useState, type ChangeEvent } from 'react';
import { useReplaceGuard } from '../hooks/useReplaceGuard';
import { useI18n } from '../i18n/I18nProvider';
import { api, ApiError } from '../lib/api';
import { errorText } from '../lib/errorText';
import type { BatchState, VerifyResult } from '../types/reconciliation';

interface Outcome {
  file: File;
  result?: VerifyResult;
  failure?: ApiError;
  tooLarge?: boolean;
  loaded?: boolean;
}

interface Props {
  state: BatchState;
  maxUploadBytes: number;
}

/**
 * Downloads the input template, checks a filled-in workbook against the
 * schema, and offers to load a valid one as the active batch.
 */
export function TemplateVerifier({ state, maxUploadBytes }: Props) {
  const i18n = useI18n();
  const { t, tn, fmt } = i18n;
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { guard, dialog } = useReplaceGuard(state);

  /** Runs a request and merges its result into what is already known about the file. */
  const attempt = async (known: Outcome, call: () => Promise<Partial<Outcome>>) => {
    setBusy(true);
    // A retry clears the old error at once. A file not verified yet shows nothing
    // until its answer arrives, so it never reads as "not valid" in between.
    if (known.result) setOutcome({ ...known, failure: undefined });
    try {
      const gained = await call();
      setOutcome({ ...known, failure: undefined, ...gained });
    } catch (cause) {
      const failure = cause instanceof ApiError ? cause : new ApiError('GENERIC', '');
      setOutcome({ ...known, failure });
    } finally {
      setBusy(false);
    }
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    if (file.size > maxUploadBytes) return setOutcome({ file, tooLarge: true });
    void attempt({ file }, async () => ({ result: await api.verifyTemplate(file) }));
  };

  // A refused load (for example during a run) keeps the verification result,
  // so the workbook still reads as valid and can be loaded again.
  const load = (verified: Outcome) =>
    guard(
      () =>
        void attempt(verified, async () => {
          await api.uploadBatch(verified.file);
          return { loaded: true };
        }),
    );

  // Built on render so the messages follow a language change. Row-level
  // problems come from the backend and stay in English.
  const failure = outcome?.failure;
  const problems = failure?.details ?? outcome?.result?.errors ?? [];
  const headline = outcome?.tooLarge
    ? t('verify.tooLarge', { megabytes: fmt.integer(maxUploadBytes / (1024 * 1024)) })
    : failure
      ? errorText(i18n, failure)
      : null;
  const valid = outcome?.result?.valid === true;
  const good = (valid && !failure) || outcome?.loaded === true;
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
        <input id={inputId} type="file" accept=".xlsx" disabled={busy} onChange={onFile} className="sr-only" />
      </div>
      <p className="text-xs text-slate-500">{t('verify.readOnly')}</p>
      {outcome && (
        <div
          role="status"
          className={`rounded-md border p-3 text-sm ${
            good ? 'border-exact/40 bg-exact/10 text-emerald-200' : 'border-anomaly/50 bg-anomaly/10 text-red-200'
          }`}
        >
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {good ? (
              <CircleCheck aria-hidden="true" className="h-4 w-4" />
            ) : (
              <CircleAlert aria-hidden="true" className="h-4 w-4" />
            )}
            <span className="num break-all">{outcome.file.name}</span>
            <span>
              ·{' '}
              {outcome.loaded
                ? t('upload.loaded')
                : valid
                  ? t('verify.valid', { rows: tn('unit.records', outcome.result?.row_count ?? 0) })
                  : t('verify.invalid')}
            </span>
          </p>
          {headline && <p className="mt-2">{headline}</p>}
          {problems.length > 0 && (
            <ul lang="en" className="mt-2 list-disc space-y-1 pl-5">
              {problems.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
          )}
          {valid && !outcome.loaded && (
            <div className="mt-3 border-t border-exact/30 pt-3">
              <p className="mb-2 text-xs text-amber-200">{t('upload.warning')}</p>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => load(outcome)}>
                <FileUp aria-hidden="true" className="h-4 w-4" />
                {busy ? t('upload.loading') : t('upload.load')}
              </button>
            </div>
          )}
        </div>
      )}
      {dialog}
    </div>
  );
}
