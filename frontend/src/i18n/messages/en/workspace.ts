// English text for the batch workspace: upload, confirmation, audit trail and
// small-screen sorting. Same rules as ui.ts: keys are fixed, {placeholders} stay.

export const workspace = {
  'nav.audit': 'Audit Trail',
  'app.uploadedBadge': 'Uploaded batch · {label} · held in memory only',
  'confirm.title': 'Replace the current batch?',
  'confirm.resolutions_one': '{count} audit decision will be discarded.',
  'confirm.resolutions_other': '{count} audit decisions will be discarded.',
  'confirm.scenarios_one': '{count} injected scenario will be removed.',
  'confirm.scenarios_other': '{count} injected scenarios will be removed.',
  'confirm.uploaded': 'The uploaded batch {label} will be replaced.',
  'confirm.irreversible': 'This cannot be undone.',
  'confirm.proceed': 'Replace Batch',
  'confirm.cancel': 'Cancel',
  'upload.load': 'Load as Active Batch',
  'upload.loading': 'Loading…',
  'upload.loaded': 'Loaded as the active batch.',
  'upload.warning':
    'An uploaded batch is held in memory and shown to everyone connected to this engine. Do not upload confidential data to this demo.',
  'audit.viewTitle': 'Decisions Recorded',
  'audit.count_one': '{count} decision',
  'audit.count_other': '{count} decisions',
  'audit.empty': 'No decision has been recorded in this batch yet.',
  'audit.noIdentity':
    'This demo has no sign-in: an entry records when a decision was taken, not who took it.',
  'audit.cause': 'Cause',
  'sort.label': 'Sort',
  'sort.batchOrder': 'Batch order',
  'sort.columnOrder': 'Column order',
  'sort.largestVariance': 'Largest variance first',
  'sort.attentionFirst': 'Needs attention first',
  'sort.counterpartyAZ': 'Counterparty A–Z',
} as const;
