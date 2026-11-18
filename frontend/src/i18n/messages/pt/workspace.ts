// Portuguese text for the batch workspace (see en/workspace.ts).
import type { WorkspaceMessages } from '../types';

export const workspace: WorkspaceMessages = {
  'nav.audit': 'Trilha de Auditoria',
  'app.uploadedBadge': 'Lote carregado · {label} · apenas em memória',
  'confirm.title': 'Substituir o lote atual?',
  'confirm.resolutions_one': '{count} decisão de auditoria será descartada.',
  'confirm.resolutions_other': '{count} decisões de auditoria serão descartadas.',
  'confirm.scenarios_one': '{count} cenário injetado será removido.',
  'confirm.scenarios_other': '{count} cenários injetados serão removidos.',
  'confirm.uploaded': 'O lote carregado {label} será substituído.',
  'confirm.irreversible': 'Esta ação não pode ser desfeita.',
  'confirm.proceed': 'Substituir Lote',
  'confirm.cancel': 'Cancelar',
  'upload.load': 'Carregar como Lote Ativo',
  'upload.loading': 'Carregando…',
  'upload.loaded': 'Carregado como lote ativo.',
  'upload.warning':
    'Um lote carregado fica em memória e é visto por todos os conectados a este motor. Não carregue dados confidenciais nesta demonstração.',
  'audit.viewTitle': 'Decisões Registradas',
  'audit.count_one': '{count} decisão',
  'audit.count_other': '{count} decisões',
  'audit.empty': 'Nenhuma decisão foi registrada neste lote ainda.',
  'audit.noIdentity':
    'Esta demonstração não tem login: cada entrada registra quando a decisão foi tomada, não quem a tomou.',
  'audit.cause': 'Causa',
  'sort.label': 'Ordenar',
  'sort.batchOrder': 'Ordem do lote',
  'sort.columnOrder': 'Ordem por coluna',
  'sort.largestVariance': 'Maior variação primeiro',
  'sort.attentionFirst': 'O que exige atenção primeiro',
  'sort.counterpartyAZ': 'Contraparte A–Z',
};
