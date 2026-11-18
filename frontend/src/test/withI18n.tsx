import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider, useI18n, type I18n } from '../i18n/I18nProvider';

const STORAGE_KEY = 'reconcile.locale';

/** Provider wrapper for a given language and batch currency. */
export function i18nWrapper(locale: string, currencyCode = 'GBP') {
  window.localStorage.setItem(STORAGE_KEY, locale);
  return function Wrapper({ children }: { children: ReactNode }) {
    return <I18nProvider currencyCode={currencyCode}>{children}</I18nProvider>;
  };
}

/** The i18n object the components receive, for the given language and currency. */
export function i18nFor(locale: string, currencyCode = 'GBP'): I18n {
  return renderHook(() => useI18n(), { wrapper: i18nWrapper(locale, currencyCode) }).result.current;
}
