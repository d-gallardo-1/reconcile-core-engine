import type { domain } from './en/domain';
import type { ui } from './en/ui';

// The English dictionaries define the keys. Typing a translation with these
// makes a missing or misspelled key a compile error.
export type UiMessages = Record<keyof typeof ui, string>;
export type DomainMessages = Record<keyof typeof domain, string>;
export type Messages = UiMessages & DomainMessages;
export type MessageKey = keyof Messages;
