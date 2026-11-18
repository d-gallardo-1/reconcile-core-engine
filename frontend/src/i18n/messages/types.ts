import type { domain } from './en/domain';
import type { ui } from './en/ui';
import type { workspace } from './en/workspace';

// The English dictionaries define the keys. Typing a translation with these
// makes a missing or misspelled key a compile error.
export type UiMessages = Record<keyof typeof ui, string>;
export type DomainMessages = Record<keyof typeof domain, string>;
export type WorkspaceMessages = Record<keyof typeof workspace, string>;
export type Messages = UiMessages & DomainMessages & WorkspaceMessages;
export type MessageKey = keyof Messages;
