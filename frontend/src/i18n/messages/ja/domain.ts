// Japanese reconciliation vocabulary.
import type { DomainMessages } from '../types';

export const domain: DomainMessages = {
  'status.EXACT_MATCH': '完全一致',
  'status.TOLERANCE_MATCH': '許容差内一致',
  'status.ANOMALY': '異常を検出',
  'status.RESOLVED': '解決済み / 監査済み',
  'status.pending': '待機中',

  'pass.1': '完全一致',
  'pass.2': 'あいまい / 許容差照合',
  'pass.3': '未照合の異常検出',
  'passRule.1':
    'ERPの記帳1件、銀行決済1件、検証済みの登録簿レコードが、金額、VAT、決済日のすべてで一致する場合です。',
  'passRule.2':
    '同じ3者構成で、|差異| ≤ {amount} かつ |決済日のずれ| ≤ {days} の場合です。送金手数料、為替の端数処理、決済遅延が対象です。',
  'passRule.3':
    '残りはすべて異常として扱い、最初に該当する原因を付与します。未記帳の引落、孤立した未払計上、二重決済、源泉徴収の差異、登録簿またはVATの不一致、VAT税率の欠落、許容差を超える金額、日付の欠落、許容期間外の日付です。',

  'taxCheck.VERIFIED': 'VAT検証済み',
  'taxCheck.VAT_MISMATCH': 'VAT不一致',
  'taxCheck.RATE_MISSING': 'VAT税率なし',
  'taxCheck.CERTIFICATE_MISSING': '証明書なし',
  'taxCheck.NOT_REGISTERED': '登録簿に未登録',
  'taxStatus.REGISTERED': '登録済み',
  'taxStatus.CERTIFICATE_MISSING': '証明書なし',
  'taxStatus.NOT_REGISTERED': '未登録',

  'anomaly.AMOUNT_VARIANCE': '金額差異',
  'anomaly.SETTLEMENT_DATE_SHIFT': '決済日のずれ',
  'anomaly.VAT_MISMATCH': 'VAT不一致',
  'anomaly.MISSING_TAX_RECORD': '税務レコードなし',
  'anomaly.WITHHOLDING_GAP': '源泉徴収の差異',
  'anomaly.DUPLICATE_SETTLEMENT': '二重決済',
  'anomaly.ORPHAN_ERP_ACCRUAL': 'ERPの孤立した未払計上',
  'anomaly.UNBOOKED_BANK_DEBIT': '未記帳の銀行引落',
  'anomaly.INCOMPLETE_SOURCE_DATA': 'ソースデータの不備',

  'action.APPROVE_VARIANCE': '差異を承認',
  'action.FLAG_FOR_CREDIT_NOTE': 'クレジットノート対象に指定',
  'action.REJECT': '記帳を却下',

  'explanation.EXACT': 'ERP、銀行、税務登録簿の金額、VAT、決済日が一致しています。',
  'explanation.TOLERANCE_AMOUNT': '許容差内で自動照合されました。金額差異は {delta} です。',
  'explanation.TOLERANCE_DATE': '許容差内で自動照合されました。決済日が {shift} 日ずれています。',
  'explanation.TOLERANCE_AMOUNT_AND_DATE':
    '許容差内で自動照合されました。金額差異は {delta}、決済日は {shift} 日ずれています。',
  'explanation.UNBOOKED_BANK_DEBIT':
    '銀行引落が決済済みですが、対応するERPの記帳もVAT領収書もありません。',
  'explanation.ORPHAN_ERP_ACCRUAL':
    'ERP元帳に記録されていますが、銀行フィードに対応する決済が見つかりません。',
  'explanation.DUPLICATE_SETTLEMENT':
    'ERPの記帳1件に対し、銀行フィードで {count} 回決済されています（過払いエクスポージャー {delta}）。',
  'explanation.WITHHOLDING_GAP':
    'ERPの金額に対し銀行は {delta} で決済しており、税務登録簿に源泉徴収の証明書がありません。',
  'explanation.MISSING_TAX_RECORD': '請求書が税務/VAT登録簿にありません。',
  'explanation.VAT_MISMATCH': '税務登録簿に記録されたVATが、ERPのVAT税率と異なります。',
  'explanation.VAT_RATE_MISSING':
    'ERPの記帳にVAT税率がないため、登録簿のVATを検証できません。',
  'explanation.AMOUNT_OUTSIDE_TOLERANCE':
    '金額差異 {delta} が許容差 {tolerance} を超えています。',
  'explanation.DATE_MISSING':
    '計上日または決済日が欠けているため、決済日を特定できません。',
  'explanation.DATE_OUTSIDE_WINDOW':
    '決済日が {shift} 日ずれており、{window}日の許容期間を超えています。',

  'scenario.SCN-301.label': '税務ギャップ',
  'scenario.SCN-301.description':
    'INV-2026-881：銀行はERPの金額より10%少なく決済しました。源泉徴収税が差し引かれていますが記録されておらず、登録簿に証明書もありません。',
  'scenario.SCN-302.label': '二重支払',
  'scenario.SCN-302.description':
    'INV-2026-884：ERPの記帳1件に対し、銀行フィードで2回支払われており、請求額全額の過払いエクスポージャーが生じています。',
  'scenario.SCN-303.label': '銀行フィード欠落',
  'scenario.SCN-303.description':
    'INV-2026-890：ERPと税務登録簿には記録がありますが、営業日10日が経過しても銀行決済フィードに存在しません。',
  'scenario.SCN-304.label': '未記帳の引落',
  'scenario.SCN-304.description':
    '口座振替 DD-4419 が銀行フィードで決済されましたが、対応するERPの発注書もVAT領収書もありません。',

  'error.RUN_IN_PROGRESS': '照合を実行中です。完了までお待ちください。',
  'error.SCENARIO_ACTIVE': 'このシナリオはすでにバッチで有効です。',
  'error.ALREADY_RESOLVED': 'このレコードはすでに解決済みです。監査記録は変更できません。',
  'error.NOT_AN_OPEN_ANOMALY': 'このレコードは未解決の異常ではありません。',
  'error.UNKNOWN_SCENARIO': '不明なシナリオです。',
  'error.UNKNOWN_TRANSACTION': '不明な取引です。',
  'error.UNKNOWN_CURRENCY': 'この通貨はサポートされていません。',
  'error.TOLERANCE_OUT_OF_RANGE': '金額許容差がこの通貨の上限を超えています。',
  'error.TIMEOUT': 'エンジンが時間内に応答しませんでした。接続を確認して、もう一度お試しください。',
  'error.UNREACHABLE': 'エンジンに接続できませんでした。',
  'error.GENERIC': 'リクエストに失敗しました。',
};
