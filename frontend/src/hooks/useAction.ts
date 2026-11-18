import { useCallback, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { ApiError } from '../lib/api';
import { errorText } from '../lib/errorText';

/**
 * Runs API calls and keeps the last error for display, in the active language
 * when the backend sent a known code. The resulting state is not read from the
 * response: it arrives over SSE, the same way every other tab receives it.
 */
export function useAction() {
  const i18n = useI18n();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setFailure(null);
    try {
      await action();
      return true;
    } catch (cause) {
      setFailure(cause instanceof ApiError ? cause : new ApiError('GENERIC', ''));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  // Translated on every render, so the message follows a language change.
  const error = failure ? errorText(i18n, failure) : null;

  return { busy, error, run, clearError: () => setFailure(null) };
}
