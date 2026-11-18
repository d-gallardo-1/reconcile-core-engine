// Simplified Chinese (zh-CN) reconciliation vocabulary.
import type { DomainMessages } from '../types';

export const domain: DomainMessages = {
  'status.EXACT_MATCH': '精确匹配',
  'status.TOLERANCE_MATCH': '容差匹配',
  'status.ANOMALY': '发现异常',
  'status.RESOLVED': '已处理 / 已审计',
  'status.pending': '排队中',

  'pass.1': '精确匹配',
  'pass.2': '模糊 / 容差匹配',
  'pass.3': '未对平异常检测',
  'passRule.1':
    '一笔 ERP 记录、一笔银行结算和一条已核实的登记记录，且金额、增值税和结算日期完全一致。',
  'passRule.2':
    '同样的三方结构，且 |差异| ≤ {amount}、|结算偏移| ≤ {days}。涵盖电汇手续费、汇率舍入差和清算延迟。',
  'passRule.3':
    '其余所有记录均为异常，并归入第一个适用的原因：未入账借记、孤立应计、重复结算、代扣税缺口、登记或增值税不符、缺少增值税税率、金额超出容差、缺少日期、日期超出窗口。',

  'taxCheck.VERIFIED': '增值税已核实',
  'taxCheck.VAT_MISMATCH': '增值税不符',
  'taxCheck.RATE_MISSING': '缺少增值税税率',
  'taxCheck.CERTIFICATE_MISSING': '缺少凭证',
  'taxCheck.NOT_REGISTERED': '未在登记中',
  'taxStatus.REGISTERED': '已登记',
  'taxStatus.CERTIFICATE_MISSING': '缺少凭证',
  'taxStatus.NOT_REGISTERED': '未登记',

  'anomaly.AMOUNT_VARIANCE': '金额差异',
  'anomaly.SETTLEMENT_DATE_SHIFT': '结算日期偏移',
  'anomaly.VAT_MISMATCH': '增值税不符',
  'anomaly.MISSING_TAX_RECORD': '缺少税务记录',
  'anomaly.WITHHOLDING_GAP': '代扣税缺口',
  'anomaly.DUPLICATE_SETTLEMENT': '重复结算',
  'anomaly.ORPHAN_ERP_ACCRUAL': '孤立 ERP 应计',
  'anomaly.UNBOOKED_BANK_DEBIT': '银行借记未入账',
  'anomaly.INCOMPLETE_SOURCE_DATA': '来源数据不完整',

  'action.APPROVE_VARIANCE': '批准差异',
  'action.FLAG_FOR_CREDIT_NOTE': '标记为开具贷项通知单',
  'action.REJECT': '驳回记录',

  'explanation.EXACT': 'ERP、银行和税务登记在金额、增值税和结算日期上一致。',
  'explanation.TOLERANCE_AMOUNT': '在容差范围内自动匹配：金额差异 {delta}。',
  'explanation.TOLERANCE_DATE': '在容差范围内自动匹配：结算偏移 {shift} 天。',
  'explanation.TOLERANCE_AMOUNT_AND_DATE':
    '在容差范围内自动匹配：金额差异 {delta}，结算偏移 {shift} 天。',
  'explanation.UNBOOKED_BANK_DEBIT': '银行借记已清算，但没有对应的 ERP 记录或增值税凭证。',
  'explanation.ORPHAN_ERP_ACCRUAL': '已记入 ERP 总账，但在银行流水中未找到结算。',
  'explanation.DUPLICATE_SETTLEMENT':
    '针对一笔 ERP 记录，银行流水中结算了 {count} 次（多付敞口 {delta}）。',
  'explanation.WITHHOLDING_GAP':
    '银行结算金额与 ERP 金额相差 {delta}，且税务登记中没有代扣税凭证。',
  'explanation.MISSING_TAX_RECORD': '发票未出现在税务/增值税登记中。',
  'explanation.VAT_MISMATCH': '税务登记中的增值税与 ERP 增值税税率不一致。',
  'explanation.VAT_RATE_MISSING': 'ERP 记录没有增值税税率，因此无法核查登记的增值税。',
  'explanation.AMOUNT_OUTSIDE_TOLERANCE': '金额差异 {delta} 超出 {tolerance} 的容差。',
  'explanation.DATE_MISSING': '缺少记账日期或清算日期，无法确定结算日期。',
  'explanation.DATE_OUTSIDE_WINDOW': '结算偏移 {shift} 天，超出 {window} 天的窗口。',

  'scenario.SCN-301.label': '税务缺口',
  'scenario.SCN-301.description':
    'INV-2026-881：银行结算金额比 ERP 金额少 10%。有一笔预扣税已被扣缴但从未入账；登记中没有凭证。',
  'scenario.SCN-302.label': '重复付款',
  'scenario.SCN-302.description':
    'INV-2026-884：针对一笔 ERP 记录，银行流水中付款两次，多付敞口为整张发票的金额。',
  'scenario.SCN-303.label': '银行流水缺失',
  'scenario.SCN-303.description':
    'INV-2026-890：已记入 ERP 和税务登记，但 10 个工作日后仍未出现在银行结算流水中。',
  'scenario.SCN-304.label': '借记未入账',
  'scenario.SCN-304.description':
    '直接扣款 DD-4419 已在银行流水中清算，但没有对应的 ERP 采购订单或增值税凭证。',

  'error.RUN_IN_PROGRESS': '对账运行正在进行，请等待其完成。',
  'error.SCENARIO_ACTIVE': '该场景已在当前批次中启用。',
  'error.ALREADY_RESOLVED': '该记录已处理，审计条目不可更改。',
  'error.NOT_AN_OPEN_ANOMALY': '该记录不是未结异常。',
  'error.UNKNOWN_SCENARIO': '未知场景。',
  'error.UNKNOWN_TRANSACTION': '未知交易。',
  'error.UNKNOWN_CURRENCY': '不支持该币种。',
  'error.TOLERANCE_OUT_OF_RANGE': '金额容差超出该币种的上限。',
  'error.TIMEOUT': '引擎未能及时响应，请检查网络连接后重试。',
  'error.UNREACHABLE': '无法连接引擎。',
  'error.GENERIC': '请求失败。',
};
