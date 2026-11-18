import type { BatchState } from '../types/reconciliation';

export interface WorkAtRisk {
  /** Audit decisions recorded in the batch. */
  resolutions: number;
  /** Demo scenarios injected into the batch. */
  scenarios: number;
  /** Name of the uploaded workbook, when the batch is not the synthetic one. */
  uploadedLabel: string | null;
  /** True when replacing the batch would lose something the user did. */
  any: boolean;
}

/**
 * What replacing the batch (reset, currency change, another upload) would
 * discard. A change of tolerance alone is not counted: it is one click to redo.
 */
export function workAtRisk(state: BatchState): WorkAtRisk {
  const resolutions = state.records.filter((record) => record.resolution !== null).length;
  const scenarios = state.scenarios.filter((scenario) => scenario.active).length;
  const uploadedLabel = state.source.kind === 'UPLOADED' ? (state.source.label ?? '') : null;
  return {
    resolutions,
    scenarios,
    uploadedLabel,
    any: resolutions > 0 || scenarios > 0 || uploadedLabel !== null,
  };
}
