// Spanish (neutral, international) reconciliation vocabulary.
import type { DomainMessages } from '../types';

export const domain: DomainMessages = {
  'status.EXACT_MATCH': 'COINCIDENCIA EXACTA',
  'status.TOLERANCE_MATCH': 'COINCIDENCIA POR TOLERANCIA',
  'status.ANOMALY': 'ANOMALÍA DETECTADA',
  'status.RESOLVED': 'RESUELTA / AUDITADA',
  'status.pending': 'EN COLA',

  'pass.1': 'Coincidencia Exacta',
  'pass.2': 'Coincidencia Aproximada / por Tolerancia',
  'pass.3': 'Detección de Anomalías sin Conciliar',
  'passRule.1':
    'Un asiento del ERP, una liquidación bancaria y un registro fiscal verificado con importe, IVA y fecha de liquidación idénticos.',
  'passRule.2':
    'La misma estructura triple, con |diferencia| ≤ {amount} y |desfase de liquidación| ≤ {days}. Cubre comisiones de transferencia, redondeos de tipo de cambio y desfase de compensación.',
  'passRule.3':
    'Todo lo que queda es una anomalía y recibe la primera causa que corresponda: débito no contabilizado, devengo huérfano, liquidación duplicada, brecha de retención, discrepancia de registro o de IVA, tipo de IVA ausente, importe fuera de tolerancia, fecha ausente, fecha fuera de la ventana.',

  'taxCheck.VERIFIED': 'IVA verificado',
  'taxCheck.VAT_MISMATCH': 'IVA discrepante',
  'taxCheck.RATE_MISSING': 'Falta el tipo de IVA',
  'taxCheck.CERTIFICATE_MISSING': 'Falta el certificado',
  'taxCheck.NOT_REGISTERED': 'No está en el registro',
  'taxStatus.REGISTERED': 'Registrado',
  'taxStatus.CERTIFICATE_MISSING': 'Falta el certificado',
  'taxStatus.NOT_REGISTERED': 'No registrado',

  'anomaly.AMOUNT_VARIANCE': 'Diferencia de importe',
  'anomaly.SETTLEMENT_DATE_SHIFT': 'Desfase de fecha de liquidación',
  'anomaly.VAT_MISMATCH': 'IVA discrepante',
  'anomaly.MISSING_TAX_RECORD': 'Registro fiscal ausente',
  'anomaly.WITHHOLDING_GAP': 'Brecha de retención',
  'anomaly.DUPLICATE_SETTLEMENT': 'Liquidación duplicada',
  'anomaly.ORPHAN_ERP_ACCRUAL': 'Devengo huérfano del ERP',
  'anomaly.UNBOOKED_BANK_DEBIT': 'Débito bancario no contabilizado',
  'anomaly.INCOMPLETE_SOURCE_DATA': 'Datos de origen incompletos',

  'action.APPROVE_VARIANCE': 'Aprobar Diferencia',
  'action.FLAG_FOR_CREDIT_NOTE': 'Marcar para Nota de Crédito',
  'action.REJECT': 'Rechazar Asiento',

  'explanation.EXACT': 'El ERP, el banco y el registro fiscal coinciden en importe, IVA y fecha de liquidación.',
  'explanation.TOLERANCE_AMOUNT': 'Conciliado automáticamente dentro de la tolerancia: diferencia de importe {delta}.',
  'explanation.TOLERANCE_DATE':
    'Conciliado automáticamente dentro de la tolerancia: liquidación desfasada {shift} día(s).',
  'explanation.TOLERANCE_AMOUNT_AND_DATE':
    'Conciliado automáticamente dentro de la tolerancia: diferencia de importe {delta} y liquidación desfasada {shift} día(s).',
  'explanation.UNBOOKED_BANK_DEBIT':
    'Débito bancario compensado sin asiento correspondiente en el ERP ni comprobante de IVA.',
  'explanation.ORPHAN_ERP_ACCRUAL':
    'Registrado en el libro mayor del ERP, pero no se encontró liquidación en el extracto bancario.',
  'explanation.DUPLICATE_SETTLEMENT':
    'Liquidado {count} veces en el extracto bancario frente a un único asiento del ERP (exposición por pago en exceso de {delta}).',
  'explanation.WITHHOLDING_GAP':
    'El banco liquidó {delta} respecto del importe del ERP y el registro fiscal no contiene certificado de retención.',
  'explanation.MISSING_TAX_RECORD': 'La factura no figura en el registro fiscal/de IVA.',
  'explanation.VAT_MISMATCH': 'El IVA registrado en el registro fiscal difiere del tipo de IVA del ERP.',
  'explanation.VAT_RATE_MISSING':
    'El asiento del ERP no tiene tipo de IVA, por lo que no se puede verificar el IVA del registro.',
  'explanation.AMOUNT_OUTSIDE_TOLERANCE':
    'La diferencia de importe {delta} supera la tolerancia de {tolerance}.',
  'explanation.DATE_MISSING':
    'Falta una fecha de contabilización o de compensación, por lo que no se puede fechar la liquidación.',
  'explanation.DATE_OUTSIDE_WINDOW':
    'Liquidación desfasada {shift} día(s), fuera de la ventana de {window} días.',

  'scenario.SCN-301.label': 'Brecha Fiscal',
  'scenario.SCN-301.description':
    'INV-2026-881: el banco liquidó un 10% menos que el importe del ERP. Se practicó una retención de impuestos que nunca se registró; no hay certificado en el registro.',
  'scenario.SCN-302.label': 'Pago Duplicado',
  'scenario.SCN-302.description':
    'INV-2026-884: pagada dos veces en el extracto bancario frente a un único asiento del ERP, lo que deja una exposición por pago en exceso equivalente al importe total de la factura.',
  'scenario.SCN-303.label': 'Falta en el Extracto Bancario',
  'scenario.SCN-303.description':
    'INV-2026-890: registrada en el ERP y en el registro fiscal, pero ausente del extracto de liquidaciones bancarias tras 10 días hábiles.',
  'scenario.SCN-304.label': 'Débito No Contabilizado',
  'scenario.SCN-304.description':
    'El adeudo directo DD-4419 se compensó en el extracto bancario sin orden de compra del ERP ni comprobante de IVA correspondiente.',

  'error.RUN_IN_PROGRESS': 'Hay una ejecución de conciliación en curso. Espere a que termine.',
  'error.SCENARIO_ACTIVE': 'Este escenario ya está activo en el lote.',
  'error.ALREADY_RESOLVED': 'Este registro ya está resuelto; las entradas de auditoría no pueden modificarse.',
  'error.NOT_AN_OPEN_ANOMALY': 'Este registro no es una anomalía abierta.',
  'error.MIXED_ANOMALY_TYPES': 'La selección mezcla causas distintas; resuelva una causa a la vez.',
  'error.UNKNOWN_SCENARIO': 'Escenario desconocido.',
  'error.UNKNOWN_TRANSACTION': 'Transacción desconocida.',
  'error.UNKNOWN_CURRENCY': 'Esta moneda no es compatible.',
  'error.TOLERANCE_OUT_OF_RANGE': 'La tolerancia de importe supera el límite de esta moneda.',
  'error.TOLERANCE_DECIMALS': 'La tolerancia de importe tiene más decimales de los que admite esta moneda.',
  'error.TIMEOUT': 'El motor no respondió a tiempo. Compruebe la conexión e inténtelo de nuevo.',
  'error.UNREACHABLE': 'No se pudo acceder al motor.',
  'error.GENERIC': 'La solicitud falló.',
};
