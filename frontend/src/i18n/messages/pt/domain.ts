// Brazilian Portuguese reconciliation vocabulary (pt-BR).
import type { DomainMessages } from '../types';

export const domain: DomainMessages = {
  'status.EXACT_MATCH': 'CONCILIAÇÃO EXATA',
  'status.TOLERANCE_MATCH': 'CONCILIAÇÃO POR TOLERÂNCIA',
  'status.ANOMALY': 'ANOMALIA DETECTADA',
  'status.RESOLVED': 'RESOLVIDO / AUDITADO',
  'status.pending': 'NA FILA',

  'pass.1': 'Conciliação Exata',
  'pass.2': 'Conciliação Aproximada / por Tolerância',
  'pass.3': 'Detecção de Anomalias Não Conciliadas',
  'passRule.1':
    'Um lançamento no ERP, uma liquidação bancária e um registro fiscal verificado com valor, IVA e data de liquidação idênticos.',
  'passRule.2':
    'Mesma estrutura tripla, com |variação| ≤ {amount} e |deslocamento da liquidação| ≤ {days}. Cobre tarifas de transferência, arredondamento cambial e atraso de compensação.',
  'passRule.3':
    'Tudo o que sobra é uma anomalia e recebe a primeira causa aplicável: débito não contabilizado, provisão órfã, liquidação duplicada, diferença de retenção, divergência de registro ou de IVA, alíquota de IVA ausente, valor fora da tolerância, data ausente, data fora da janela.',

  'taxCheck.VERIFIED': 'IVA verificado',
  'taxCheck.VAT_MISMATCH': 'IVA divergente',
  'taxCheck.RATE_MISSING': 'Alíquota de IVA ausente',
  'taxCheck.CERTIFICATE_MISSING': 'Certificado ausente',
  'taxCheck.NOT_REGISTERED': 'Fora do registro',
  'taxStatus.REGISTERED': 'Registrado',
  'taxStatus.CERTIFICATE_MISSING': 'Certificado ausente',
  'taxStatus.NOT_REGISTERED': 'Não registrado',

  'anomaly.AMOUNT_VARIANCE': 'Variação de valor',
  'anomaly.SETTLEMENT_DATE_SHIFT': 'Deslocamento da data de liquidação',
  'anomaly.VAT_MISMATCH': 'IVA divergente',
  'anomaly.MISSING_TAX_RECORD': 'Registro fiscal ausente',
  'anomaly.WITHHOLDING_GAP': 'Diferença de retenção',
  'anomaly.DUPLICATE_SETTLEMENT': 'Liquidação duplicada',
  'anomaly.ORPHAN_ERP_ACCRUAL': 'Provisão órfã no ERP',
  'anomaly.UNBOOKED_BANK_DEBIT': 'Débito bancário não contabilizado',
  'anomaly.INCOMPLETE_SOURCE_DATA': 'Dados de origem incompletos',

  'action.APPROVE_VARIANCE': 'Aprovar Variação',
  'action.FLAG_FOR_CREDIT_NOTE': 'Sinalizar para Nota de Crédito',
  'action.REJECT': 'Rejeitar Lançamento',

  'explanation.EXACT': 'ERP, banco e registro fiscal coincidem em valor, IVA e data de liquidação.',
  'explanation.TOLERANCE_AMOUNT': 'Conciliado automaticamente dentro da tolerância: variação de valor de {delta}.',
  'explanation.TOLERANCE_DATE':
    'Conciliado automaticamente dentro da tolerância: liquidação deslocada em {shift} dia(s).',
  'explanation.TOLERANCE_AMOUNT_AND_DATE':
    'Conciliado automaticamente dentro da tolerância: variação de valor de {delta} e liquidação deslocada em {shift} dia(s).',
  'explanation.UNBOOKED_BANK_DEBIT':
    'Débito bancário compensado sem lançamento correspondente no ERP nem comprovante de IVA.',
  'explanation.ORPHAN_ERP_ACCRUAL':
    'Registrado no razão do ERP, mas nenhuma liquidação foi encontrada no arquivo bancário.',
  'explanation.DUPLICATE_SETTLEMENT':
    'Liquidado {count} vezes no arquivo bancário para um único lançamento do ERP (exposição de pagamento em excesso de {delta}).',
  'explanation.WITHHOLDING_GAP':
    'O banco liquidou {delta} em relação ao valor do ERP e o registro fiscal não possui certificado de retenção.',
  'explanation.MISSING_TAX_RECORD': 'A fatura não consta no registro fiscal/de IVA.',
  'explanation.VAT_MISMATCH': 'O IVA registrado no registro fiscal difere da alíquota de IVA do ERP.',
  'explanation.VAT_RATE_MISSING':
    'O lançamento do ERP não tem alíquota de IVA, portanto o IVA do registro não pode ser verificado.',
  'explanation.AMOUNT_OUTSIDE_TOLERANCE':
    'A variação de valor de {delta} excede a tolerância de {tolerance}.',
  'explanation.DATE_MISSING':
    'Falta a data de lançamento ou de compensação, portanto a liquidação não pode ser datada.',
  'explanation.DATE_OUTSIDE_WINDOW':
    'Liquidação deslocada em {shift} dia(s), fora da janela de {window} dias.',

  'scenario.SCN-301.label': 'Diferença Fiscal',
  'scenario.SCN-301.description':
    'INV-2026-881: o banco liquidou 10% a menos que o valor do ERP. Uma retenção de imposto foi aplicada, mas nunca registrada; não há certificado no registro.',
  'scenario.SCN-302.label': 'Pagamento Duplicado',
  'scenario.SCN-302.description':
    'INV-2026-884: paga duas vezes no arquivo bancário para um único lançamento do ERP, gerando uma exposição de pagamento em excesso equivalente ao valor total da fatura.',
  'scenario.SCN-303.label': 'Arquivo Bancário Ausente',
  'scenario.SCN-303.description':
    'INV-2026-890: registrada no ERP e no registro fiscal, mas ausente do arquivo de liquidação bancária após 10 dias úteis.',
  'scenario.SCN-304.label': 'Débito Não Contabilizado',
  'scenario.SCN-304.description':
    'O débito direto DD-4419 foi compensado no arquivo bancário sem pedido de compra nem comprovante de IVA correspondente no ERP.',

  'error.RUN_IN_PROGRESS': 'Há uma execução de conciliação em andamento. Aguarde a conclusão.',
  'error.SCENARIO_ACTIVE': 'Este cenário já está ativo no lote.',
  'error.ALREADY_RESOLVED': 'Este registro já foi resolvido; os lançamentos de auditoria não podem ser alterados.',
  'error.NOT_AN_OPEN_ANOMALY': 'Este registro não é uma anomalia em aberto.',
  'error.MIXED_ANOMALY_TYPES': 'A seleção mistura causas diferentes; resolva uma causa por vez.',
  'error.UNKNOWN_SCENARIO': 'Cenário desconhecido.',
  'error.UNKNOWN_TRANSACTION': 'Transação desconhecida.',
  'error.UNKNOWN_CURRENCY': 'Esta moeda não é compatível.',
  'error.TOLERANCE_OUT_OF_RANGE': 'A tolerância de valor está acima do limite para esta moeda.',
  'error.TOLERANCE_DECIMALS': 'A tolerância de valor tem mais casas decimais do que esta moeda permite.',
  'error.INVALID_WORKBOOK': 'A planilha não pode ser carregada. Veja os problemas indicados.',
  'error.TIMEOUT': 'O motor não respondeu a tempo. Verifique a conexão e tente novamente.',
  'error.UNREACHABLE': 'Não foi possível acessar o motor.',
  'error.GENERIC': 'A solicitação falhou.',
};
