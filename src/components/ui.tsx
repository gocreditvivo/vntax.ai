import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useI18n } from '../i18n';
import type { Status } from '../types';

// ─── primitives ────────────────────────────────────────────────────────────

export function Button({
  variant = 'primary', size = 'md', className = '', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  // Pill radius on actions is a token-scale decision: full-round reads as
  // "tappable" at a glance, which matters for a low-tech-confidence audience.
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold ' +
    'transition focus:outline-none focus-visible:ring-2 focus-visible:ring-jade-600 ' +
    'focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-interactive-primary text-interactive-contrast hover:bg-interactive-hover active:bg-interactive-active',
    secondary: 'bg-white text-jade-800 border border-line hover:bg-cream',
    ghost: 'bg-transparent text-content-secondary hover:bg-cream',
    danger: 'bg-white text-clay-700 border border-clay-300 hover:bg-clay-50',
  };
  const sizes = { sm: 'px-4 py-1.5 text-sm', md: 'px-5 py-2.5', lg: 'px-6 py-3.5 text-lg' };
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />;
}

export function Card({
  className = '', children, role,
}: { className?: string; children: ReactNode; role?: string }) {
  return (
    <div role={role} className={`rounded-lg border border-line bg-surface-base ${className}`}>
      {children}
    </div>
  );
}

export function Field({
  label, hint, children, id,
}: { label: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-600">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-sm text-ink-500">{hint}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        'w-full rounded-sm border border-line bg-white px-4 py-3 text-content-primary ' +
        'placeholder:text-ink-400 focus:border-jade-600 focus:outline-none ' +
        'focus-visible:ring-2 focus-visible:ring-jade-600/30 ' + (props.className ?? '')
      }
    />
  );
}

/** Money is always right-aligned and tabular so columns line up. */
export function Money({ value, className = '' }: { value: number; className?: string }) {
  const { money } = useI18n();
  return <span className={`tabular-nums ${className}`}>{money(value)}</span>;
}

// ─── patterns ──────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<Status, { cls: string; icon: string }> = {
  not_started:      { cls: 'bg-ink-100 text-ink-700',    icon: '○' },
  in_progress:      { cls: 'bg-navy-100 text-navy-800',  icon: '◐' },
  waiting_customer: { cls: 'bg-gold-100 text-gold-800',  icon: '◆' },
  waiting_system:   { cls: 'bg-navy-100 text-navy-800',  icon: '◌' },
  needs_review:     { cls: 'bg-gold-100 text-gold-800',  icon: '▲' },
  action_required:  { cls: 'bg-clay-100 text-clay-800',  icon: '!' },
  blocked:          { cls: 'bg-clay-100 text-clay-800',  icon: '■' },
  failed:           { cls: 'bg-clay-100 text-clay-800',  icon: '×' },
  completed:        { cls: 'bg-jade-100 text-jade-800',  icon: '✓' },
  archived:         { cls: 'bg-ink-100 text-ink-600',    icon: '—' },
};

/**
 * Never colour alone: every chip carries an icon AND a text label.
 * Accessibility requirement, not decoration.
 */
export function StatusChip({ status }: { status: Status }) {
  const { t } = useI18n();
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
      <span aria-hidden="true">{s.icon}</span>
      <span>{t.status[status]}</span>
    </span>
  );
}

/** Confidence is shown, never hidden. A low bar is an invitation to check. */
export function ConfidenceBar({ value }: { value: number }) {
  const { t, pct } = useI18n();
  const level = value >= 0.85 ? 'bg-jade-600' : value >= 0.65 ? 'bg-gold-500' : 'bg-clay-500';
  return (
    <div className="flex items-center gap-2" title={`${t.tx.confidence}: ${pct(value)}`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full ${level}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-ink-500">{pct(value)}</span>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface-sunken/60 px-6 py-16 text-center">
      <div className="mb-3 text-3xl text-ink-300" aria-hidden="true">◇</div>
      <h3 className="mb-1.5 text-lg font-semibold text-ink-800">{title}</h3>
      <p className="mb-5 max-w-sm text-ink-500">{body}</p>
      {action}
    </div>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label ?? t.common.loading}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-ink-100" />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-clay-300 bg-clay-50 p-6" role="alert">
      <h3 className="mb-1 font-semibold text-clay-800">{t.common.errorTitle}</h3>
      <p className="mb-4 text-clay-700">{t.common.errorBody}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>{t.common.retry}</Button>}
    </div>
  );
}

/**
 * The required disclosure. Appears wherever an estimate or a deduction is shown.
 * Deliberately calm — a wall of legal text teaches customers to ignore it.
 */
export function DisclosureNote({ kind }: { kind: 'planning' | 'deduction' | 'general' }) {
  const { t } = useI18n();
  const body =
    kind === 'planning' ? t.legal.planningBody
    : kind === 'deduction' ? t.deductions.eligibility
    : t.legal.disclosure;
  const label =
    kind === 'planning' ? t.legal.planningOnly
    : kind === 'deduction' ? t.deductions.possible
    : null;
  return (
    <div className="rounded-sm border border-line bg-cream px-4 py-3 text-sm text-content-secondary">
      {label && <span className="mr-1.5 font-semibold text-ink-800">{label}.</span>}
      {body}
      <p className="mt-2 text-xs text-ink-500">{t.legal.stateBoundary}</p>
    </div>
  );
}

/** Last four only. Never the leading digits. */
export function MaskedAccount({ masked }: { masked: string }) {
  return <span className="font-mono text-ink-600">{masked}</span>;
}

export function PageHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="display-section text-3xl text-content-primary">{title}</h1>
        {subtitle && <p className="mt-1.5 text-content-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Stat({
  label, value, tone = 'neutral',
}: { label: string; value: ReactNode; tone?: 'neutral' | 'good' | 'warn' }) {
  const tones = {
    neutral: 'text-ink-900',
    good: 'text-jade-700',
    warn: 'text-clay-700',
  };
  return (
    <Card className="p-4">
      <div className="text-sm text-content-muted">{label}</div>
      <div className={`mt-1 display-section text-2xl tabular-nums ${tones[tone]}`}>{value}</div>
    </Card>
  );
}
