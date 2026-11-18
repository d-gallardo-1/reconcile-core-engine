import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18nFor, i18nWrapper } from '../test/withI18n';
import { useI18n } from './I18nProvider';
import { initialLocale } from './locales';

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('translation', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    const { t } = i18nFor('en');
    expect(t('demo.active', { code: 'SCN-301' })).toBe('SCN-301 Active');
    // A missing parameter stays as written instead of printing "undefined".
    expect(t('demo.inject', { code: 'SCN-301' })).toBe('Inject SCN-301 {label}');
  });

  it('translates into the selected language', () => {
    expect(i18nFor('es').t('demo.reset')).toBe('Restablecer Lote');
    expect(i18nFor('en').t('demo.reset')).toBe('Reset Batch');
  });

  it('chooses singular or plural by the rules of the language', () => {
    const english = i18nFor('en');
    expect(english.tn('unit.days', 1)).toBe('1 day');
    expect(english.tn('unit.days', 2)).toBe('2 days');
    expect(english.tn('unit.days', 0)).toBe('0 days');
    expect(i18nFor('es').tn('unit.records', 1)).toBe('1 registro');
    expect(i18nFor('es').tn('unit.records', 15)).toBe('15 registros');
  });

  it('formats the count of a plural message for the language', () => {
    expect(i18nFor('en').tn('unit.records', 5000)).toBe('5,000 records');
    expect(i18nFor('es').tn('unit.records', 5000)).toBe('5000 registros');
  });

  it('translates a backend code and falls back to the given text for an unknown one', () => {
    const { tCode } = i18nFor('es');
    expect(tCode('status', 'RESOLVED', 'fallback')).toBe('RESUELTA / AUDITADA');
    expect(tCode('explanation', 'CODE_FROM_A_NEWER_BACKEND', 'English sentence.')).toBe(
      'English sentence.',
    );
    expect(tCode('error', null, 'fallback')).toBe('fallback');
    expect(tCode('scenario', 'SCN-301.label', 'Tax Gap')).toBe('Brecha Fiscal');
  });

  it('formats amounts in the batch currency it was given', () => {
    expect(i18nFor('en', 'JPY').fmt.money(3000)).toBe('JP¥3,000');
    expect(i18nFor('en', 'GBP').fmt.money(15)).toBe('£15.00');
  });
});

describe('language selection', () => {
  it('prefers the saved choice, then the browser language, then English', () => {
    window.localStorage.setItem('reconcile.locale', 'ja');
    expect(initialLocale().code).toBe('ja');

    window.localStorage.clear();
    vi.stubGlobal('navigator', { language: 'pt-BR' });
    expect(initialLocale().code).toBe('pt');

    vi.stubGlobal('navigator', { language: 'de-DE' });
    expect(initialLocale().code).toBe('en');
  });

  it('ignores a saved value that is not a supported language', () => {
    window.localStorage.setItem('reconcile.locale', 'xx');
    vi.stubGlobal('navigator', { language: 'es-CL' });
    expect(initialLocale().code).toBe('es');
  });

  it('switches language, remembers it and sets the document language', () => {
    const { result } = renderHook(() => useI18n(), { wrapper: i18nWrapper('en') });
    expect(document.documentElement.lang).toBe('en-GB');

    act(() => result.current.setLocale('zh'));

    expect(result.current.locale.code).toBe('zh');
    expect(result.current.t('common.yes')).toBe('是');
    expect(window.localStorage.getItem('reconcile.locale')).toBe('zh');
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('refuses to be used outside its provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useI18n())).toThrow(/I18nProvider/);
  });
});
