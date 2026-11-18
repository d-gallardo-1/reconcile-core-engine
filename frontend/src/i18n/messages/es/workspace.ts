// Spanish text for the batch workspace (see en/workspace.ts).
import type { WorkspaceMessages } from '../types';

export const workspace: WorkspaceMessages = {
  'nav.audit': 'Historial de Auditoría',
  'app.uploadedBadge': 'Lote cargado · {label} · solo en memoria',
  'confirm.title': '¿Reemplazar el lote actual?',
  'confirm.resolutions_one': '{count} decisión de auditoría se descartará.',
  'confirm.resolutions_other': '{count} decisiones de auditoría se descartarán.',
  'confirm.scenarios_one': '{count} escenario inyectado se quitará.',
  'confirm.scenarios_other': '{count} escenarios inyectados se quitarán.',
  'confirm.uploaded': 'El lote cargado {label} será reemplazado.',
  'confirm.irreversible': 'Esta acción no se puede deshacer.',
  'confirm.proceed': 'Reemplazar Lote',
  'confirm.cancel': 'Cancelar',
  'upload.load': 'Cargar como Lote Activo',
  'upload.loading': 'Cargando…',
  'upload.loaded': 'Cargado como lote activo.',
  'upload.warning':
    'Un lote cargado se guarda en memoria y lo ve cualquiera conectado a este motor. No cargue datos confidenciales en esta demo.',
  'audit.viewTitle': 'Decisiones Registradas',
  'audit.count_one': '{count} decisión',
  'audit.count_other': '{count} decisiones',
  'audit.empty': 'Aún no se ha registrado ninguna decisión en este lote.',
  'audit.noIdentity':
    'Esta demo no tiene inicio de sesión: cada entrada registra cuándo se tomó la decisión, no quién la tomó.',
  'audit.cause': 'Causa',
  'sort.label': 'Ordenar',
  'sort.batchOrder': 'Orden del lote',
  'sort.columnOrder': 'Orden por columna',
  'sort.largestVariance': 'Mayor diferencia primero',
  'sort.attentionFirst': 'Lo que requiere atención primero',
  'sort.counterpartyAZ': 'Contraparte A–Z',
};
