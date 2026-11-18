import { domain as enDomain } from './messages/en/domain';
import { ui as enUi } from './messages/en/ui';
import { workspace as enWorkspace } from './messages/en/workspace';
import { domain as esDomain } from './messages/es/domain';
import { ui as esUi } from './messages/es/ui';
import { workspace as esWorkspace } from './messages/es/workspace';
import { domain as jaDomain } from './messages/ja/domain';
import { ui as jaUi } from './messages/ja/ui';
import { workspace as jaWorkspace } from './messages/ja/workspace';
import { domain as ptDomain } from './messages/pt/domain';
import { ui as ptUi } from './messages/pt/ui';
import { workspace as ptWorkspace } from './messages/pt/workspace';
import { domain as zhDomain } from './messages/zh/domain';
import { ui as zhUi } from './messages/zh/ui';
import { workspace as zhWorkspace } from './messages/zh/workspace';
import type { Messages } from './messages/types';

export interface LocaleDefinition {
  code: string;
  /** Name shown in the selector, written in the language itself. */
  name: string;
  /** BCP 47 tag used for number, currency and plural formatting. */
  intl: string;
  messages: Messages;
}

// To add a language: write its three dictionaries under messages/<code>/ and add
// one entry here. The types make a missing key a compile error.
export const LOCALES: LocaleDefinition[] = [
  { code: 'en', name: 'English', intl: 'en-GB', messages: { ...enUi, ...enDomain, ...enWorkspace } },
  { code: 'es', name: 'Español', intl: 'es', messages: { ...esUi, ...esDomain, ...esWorkspace } },
  { code: 'pt', name: 'Português', intl: 'pt-BR', messages: { ...ptUi, ...ptDomain, ...ptWorkspace } },
  { code: 'zh', name: '中文', intl: 'zh-CN', messages: { ...zhUi, ...zhDomain, ...zhWorkspace } },
  { code: 'ja', name: '日本語', intl: 'ja-JP', messages: { ...jaUi, ...jaDomain, ...jaWorkspace } },
];

export const DEFAULT_LOCALE = LOCALES[0];

const STORAGE_KEY = 'reconcile.locale';

function find(code: string | null | undefined): LocaleDefinition | undefined {
  const language = code?.toLowerCase().split('-')[0];
  return LOCALES.find((locale) => locale.code === language);
}

/** Saved choice first, then the browser language, then English. */
export function initialLocale(): LocaleDefinition {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage blocked: fall through */
  }
  return find(saved) ?? find(navigator.language) ?? DEFAULT_LOCALE;
}

export function rememberLocale(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
}

export function localeByCode(code: string): LocaleDefinition {
  return find(code) ?? DEFAULT_LOCALE;
}
