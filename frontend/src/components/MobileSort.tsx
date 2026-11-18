import { useId } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages/types';
import type { Sort } from '../lib/tableView';

// On a narrow screen there are no column headers to click, so the orders that
// matter most are offered as a menu.
const OPTIONS: { value: string; label: MessageKey; sort: Sort | null }[] = [
  { value: 'batch', label: 'sort.batchOrder', sort: null },
  { value: 'variance', label: 'sort.largestVariance', sort: { key: 'variance', direction: 'desc' } },
  { value: 'status', label: 'sort.attentionFirst', sort: { key: 'status', direction: 'asc' } },
  { value: 'counterparty', label: 'sort.counterpartyAZ', sort: { key: 'counterparty', direction: 'asc' } },
];

const OTHER = 'other';

interface Props {
  sort: Sort | null;
  onChange: (sort: Sort | null) => void;
}

/** Sort menu for the card layout, where there are no column headers to click. */
export function MobileSort({ sort, onChange }: Props) {
  const { t } = useI18n();
  const id = useId();
  const offered = OPTIONS.find(
    (option) => option.sort?.key === sort?.key && option.sort?.direction === sort?.direction,
  );
  // A column order chosen on a wide screen is not one of the menu entries;
  // show it as such instead of claiming the batch order.
  const value = offered?.value ?? OTHER;
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-xs text-slate-400">
      {t('sort.label')}
      <select
        id={id}
        className="field"
        value={value}
        onChange={(event) =>
          onChange(OPTIONS.find((option) => option.value === event.target.value)?.sort ?? null)
        }
      >
        {value === OTHER && (
          <option value={OTHER} disabled>
            {t('sort.columnOrder')}
          </option>
        )}
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.label)}
          </option>
        ))}
      </select>
    </label>
  );
}
