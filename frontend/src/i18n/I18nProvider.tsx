import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createFormatters, type Formatters } from './format';
import {
  DEFAULT_LOCALE,
  initialLocale,
  localeByCode,
  rememberLocale,
  type LocaleDefinition,
} from './locales';
import type { MessageKey } from './messages/types';

type Params = Record<string, string | number>;
/** Base of a message that has `_one` and `_other` forms, for example `unit.days`. */
export type PluralKey = MessageKey extends infer K
  ? K extends `${infer Base}_one`
    ? Base
    : never
  : never;

export interface I18n {
  locale: LocaleDefinition;
  setLocale: (code: string) => void;
  /** Translated message with its {placeholders} filled in. */
  t: (key: MessageKey, params?: Params) => string;
  /** Like `t`, choosing the singular or plural form for `count`. */
  tn: (key: PluralKey, count: number, params?: Params) => string;
  /** Message for a code sent by the backend, or `fallback` when it has no translation. */
  tCode: (prefix: string, code: string | null | undefined, fallback: string, params?: Params) => string;
  fmt: Formatters;
}

function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

function build(locale: LocaleDefinition, currencyCode: string, setLocale: I18n['setLocale']): I18n {
  const messages = locale.messages as Record<string, string | undefined>;
  const english = DEFAULT_LOCALE.messages as Record<string, string | undefined>;
  const lookup = (key: string) => messages[key] ?? english[key];
  const plurals = new Intl.PluralRules(locale.intl);
  const fmt = createFormatters(locale.intl, currencyCode);
  return {
    locale,
    setLocale,
    fmt,
    t: (key, params) => fill(lookup(key) ?? key, params),
    tn: (key, count, params) => {
      const form = plurals.select(count) === 'one' ? 'one' : 'other';
      return fill(lookup(`${key}_${form}`) ?? key, { count: fmt.integer(count), ...params });
    },
    tCode: (prefix, code, fallback, params) => {
      const template = code ? lookup(`${prefix}.${code}`) : undefined;
      return template === undefined ? fallback : fill(template, params);
    },
  };
}

const Context = createContext<I18n | null>(null);

interface Props {
  /** ISO code of the batch currency; amounts are formatted in it. */
  currencyCode: string;
  children: ReactNode;
}

export function I18nProvider({ currencyCode, children }: Props) {
  const [locale, setLocaleState] = useState<LocaleDefinition>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale.intl;
  }, [locale]);

  const value = useMemo(() => {
    const setLocale = (code: string) => {
      rememberLocale(code);
      setLocaleState(localeByCode(code));
    };
    return build(locale, currencyCode, setLocale);
  }, [locale, currencyCode]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(Context);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
