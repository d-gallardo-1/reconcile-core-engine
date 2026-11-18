export interface Neighbours {
  previous: string | null;
  next: string | null;
  /** 1-based position of the current record, or 0 when it is not in the list. */
  position: number;
  total: number;
}

/**
 * The records before and after `current` in `order`. The ends do not wrap:
 * reaching the last record should be noticeable, not a silent jump to the first.
 */
export function neighbours(order: readonly string[], current: string | null): Neighbours {
  const index = current === null ? -1 : order.indexOf(current);
  if (index === -1) return { previous: null, next: null, position: 0, total: order.length };
  return {
    previous: index > 0 ? order[index - 1] : null,
    next: index < order.length - 1 ? order[index + 1] : null,
    position: index + 1,
    total: order.length,
  };
}

/**
 * The list the drawer steps through: the rows shown in the table when the open
 * record is one of them, otherwise the whole batch (a record opened from the
 * exposure panel may be hidden by the current filter or search).
 */
export function navigationOrder(
  shown: readonly string[],
  all: readonly string[],
  current: string | null,
): readonly string[] {
  return current !== null && shown.includes(current) ? shown : all;
}

/** True when a key press belongs to a field the user is typing in. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLInputElement && target.type !== 'checkbox' && target.type !== 'button')
  );
}
