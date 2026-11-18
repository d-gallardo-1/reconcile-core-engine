import {
  CheckCircle2,
  OctagonAlert,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { MatchStatus, TaxCheck } from '../types/reconciliation';

export interface StatusMeta {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Text + border + tinted background classes for the badge. */
  badge: string;
  text: string;
  pulse: boolean;
}

// Status is never conveyed by colour alone: every badge has an icon and a label.
export const STATUS_META: Record<MatchStatus, StatusMeta> = {
  EXACT_MATCH: {
    label: 'EXACT MATCH',
    shortLabel: 'Exact',
    icon: CheckCircle2,
    badge: 'border-exact/40 bg-exact/10 text-emerald-300',
    text: 'text-emerald-300',
    pulse: false,
  },
  TOLERANCE_MATCH: {
    label: 'TOLERANCE MATCH',
    shortLabel: 'Tolerance',
    icon: SlidersHorizontal,
    badge: 'border-tolerance/40 bg-tolerance/10 text-cyan-300',
    text: 'text-cyan-300',
    pulse: false,
  },
  ANOMALY: {
    label: 'ANOMALY DETECTED',
    shortLabel: 'Anomaly',
    icon: OctagonAlert,
    badge: 'border-anomaly/50 bg-anomaly/10 text-red-300',
    text: 'text-red-300',
    pulse: true,
  },
  RESOLVED: {
    label: 'RESOLVED / AUDITED',
    shortLabel: 'Resolved',
    icon: ShieldCheck,
    badge: 'border-audited/40 bg-audited/10 text-amber-300',
    text: 'text-amber-300',
    pulse: false,
  },
};

export const TAX_CHECK_LABEL: Record<TaxCheck, { label: string; ok: boolean }> = {
  VERIFIED: { label: 'VAT verified', ok: true },
  VAT_MISMATCH: { label: 'VAT mismatch', ok: false },
  RATE_MISSING: { label: 'VAT rate missing', ok: false },
  CERTIFICATE_MISSING: { label: 'Certificate missing', ok: false },
  NOT_REGISTERED: { label: 'Not in registry', ok: false },
};

export type StatusFilter = 'ALL' | MatchStatus;

export const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ANOMALY', label: 'Anomaly' },
  { value: 'TOLERANCE_MATCH', label: 'Tolerance' },
  { value: 'EXACT_MATCH', label: 'Exact' },
  { value: 'RESOLVED', label: 'Resolved' },
];
