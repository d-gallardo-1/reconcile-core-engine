import type { I18n } from '../i18n/I18nProvider';
import type { ApiError } from './api';

/**
 * Text for a failed request. A code the backend sent is translated; a failure
 * without one (for example an HTML error page from a proxy) keeps whatever
 * detail arrived, because a generic sentence would hide the cause.
 */
export function errorText(i18n: I18n, failure: ApiError): string {
  const generic = i18n.t('error.GENERIC');
  if (failure.code === 'GENERIC') {
    return failure.message ? `${generic} (${failure.message})` : generic;
  }
  return i18n.tCode('error', failure.code, failure.message || generic);
}
