import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Button, Card, EmptyState, ErrorState, LoadingState } from './ui';
import type { AsyncState } from '../state/useAsync';
import type { ServiceError } from '../services/core';

/** Looks up a service error message key, falling back to the generic one. */
function errorText(e: ServiceError, t: ReturnType<typeof useI18n>['t']): string {
  const key = e.message.replace(/^error\./, '').replace(/^permission\./, '');
  const table = t.errors as unknown as Record<string, string>;
  return table[key] ?? table[e.kind] ?? table.unknown;
}

export function PermissionDenied({ error }: { error: ServiceError }) {
  const { t } = useI18n();
  return (
    <Card className="border-navy-100 bg-navy-50 p-6" role="alert">
      <h3 className="mb-1 font-semibold text-navy-900">{t.states.permissionDeniedTitle}</h3>
      <p className="text-navy-800">{t.states.permissionDeniedBody}</p>
      <p className="mt-2 text-sm text-navy-600">{errorText(error, t)}</p>
    </Card>
  );
}

export function Blocked({ error, onRetry }: { error: ServiceError; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <Card className="border-gold-300 bg-gold-50 p-6" role="alert">
      <h3 className="mb-1 font-semibold text-gold-900">{t.states.blockedTitle}</h3>
      <p className="text-gold-800">{t.states.blockedBody}</p>
      <p className="mt-2 text-sm text-gold-700">{errorText(error, t)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          {t.common.retry}
        </Button>
      )}
    </Card>
  );
}

/**
 * Renders whichever of the six states applies. Every screen goes through this,
 * so no screen can accidentally omit one.
 */
export function StateView<T>({
  state,
  empty,
  children,
}: {
  state: AsyncState<T> & { reload?: () => void };
  empty?: { title: string; body: string; action?: ReactNode };
  children: (data: T) => ReactNode;
}) {
  const { t } = useI18n();

  switch (state.status) {
    case 'loading':
      return <LoadingState />;
    case 'permission_denied':
      return <PermissionDenied error={state.error} />;
    case 'blocked':
      return <Blocked error={state.error} onRetry={state.reload} />;
    case 'error':
      return (
        <div>
          <ErrorState onRetry={state.reload} />
          <p className="mt-2 text-sm text-ink-500">{errorText(state.error, t)}</p>
        </div>
      );
    case 'empty':
      return (
        <EmptyState
          title={empty?.title ?? t.states.emptyGeneric}
          body={empty?.body ?? ''}
          action={empty?.action}
        />
      );
    case 'success':
      return <>{children(state.data)}</>;
  }
}

/** Inline feedback for an action (confirm, invite, revoke). */
export function ActionFeedback({ state }: { state: { status: string; error?: ServiceError } }) {
  const { t } = useI18n();
  if (state.status === 'idle' || state.status === 'loading') return null;
  if (state.status === 'success') {
    return <p className="mt-2 text-sm text-jade-700">{t.status.completed}</p>;
  }
  if (!state.error) return null;
  const tone =
    state.status === 'permission_denied' ? 'text-navy-800'
    : state.status === 'blocked' ? 'text-gold-800'
    : 'text-clay-700';
  return <p className={`mt-2 text-sm ${tone}`} role="alert">{errorText(state.error, t)}</p>;
}
