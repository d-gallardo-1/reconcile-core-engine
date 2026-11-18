import {
  CheckCircle2,
  OctagonAlert,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { MatchStatus, TaxCheck } from '../types/reconciliation';

export interface StatusMeta {
  icon: LucideIcon;
  /** Text + border + tinted background classes for the badge. */
  badge: string;
  pulse: boolean;
}

// Status is never conveyed by colour alone: every badge has an icon and a
// translated label (message key `status.<STATUS>`).
export const STATUS_META: Record<MatchStatus, StatusMeta> = {
  EXACT_MATCH: {
    icon: CheckCircle2,
    badge: 'border-exact/40 bg-exact/10 text-emerald-300',
    pulse: false,
  },
  TOLERANCE_MATCH: {
    icon: SlidersHorizontal,
    badge: 'border-tolerance/40 bg-tolerance/10 text-cyan-300',
    pulse: false,
  },
  ANOMALY: {
    icon: OctagonAlert,
    badge: 'border-anomaly/50 bg-anomaly/10 text-red-300',
    pulse: true,
  },
  RESOLVED: {
    icon: ShieldCheck,
    badge: 'border-audited/40 bg-audited/10 text-amber-300',
    pulse: false,
  },
};

/** Whether a registry check result is the expected one. */
export const TAX_CHECK_OK: Record<TaxCheck, boolean> = {
  VERIFIED: true,
  VAT_MISMATCH: false,
  RATE_MISSING: false,
  CERTIFICATE_MISSING: false,
  NOT_REGISTERED: false,
};

export type StatusFilter = 'ALL' | MatchStatus;

export const FILTERS: StatusFilter[] = [
  'ALL',
  'ANOMALY',
  'TOLERANCE_MATCH',
  'EXACT_MATCH',
  'RESOLVED',
];
