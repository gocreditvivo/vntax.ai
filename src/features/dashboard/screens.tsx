import { useState } from 'react';
import { useI18n } from '../../i18n';
import { Link } from '../../app/router';
import {
  Button, Card, ConfidenceBar, DisclosureNote, EmptyState, ErrorState,
  LoadingState, MaskedAccount, Money, PageHeader, Stat, StatusChip,
} from '../../components/ui';
import { StateView, ActionFeedback, PermissionDenied } from '../../components/states';
import { useAsync, useAction } from '../../state/useAsync';
import {
  categorizationService, receiptRepository, transactionRepository,
  type Caller,
} from '../../services';
import { db, scopeTo } from '../../services';
import { ACCOUNTS, ALERTS, CONNECTIONS, DEDUCTION_GROUPS, DOCUMENTS, ESTIMATES } from '../../mocks/fixtures';
import type { Business, Connection, Receipt, Transaction } from '../../types';

type LoadState = 'loading' | 'error' | 'ready';

// ═══ 6. Customer dashboard ═════════════════════════════════════════════════

export function Dashboard({
  business, caller, state = 'ready',
}: { business: Business; caller?: Caller; state?: LoadState }) {
  const { t, money } = useI18n();
  const bid = business.id;

  const call: Caller = caller ?? { userId: 'u_owner_rest', role: 'owner', businessId: bid };
  const summary = useAsync(() => transactionRepository.summary(call), [call.businessId, call.role]);
  const txs = scopeTo(db().transactions, bid);
  const alerts = ALERTS.filter((a) => a.businessId === bid);
  // Use the quarterly estimate as the source of truth for financial totals —
  // transaction-level data is incomplete (only one income entry in fixtures).
  const est = ESTIMATES.find((e) => e.businessId === bid);
  const income = est ? est.estimatedNetProfit + (est.selfEmploymentComponent ?? 0) : 0;
  const expenses = est?.selfEmploymentComponent ?? 0;
  const netProfit = est?.estimatedNetProfit ?? 0;
  const uncategorized = txs.filter((x) => !x.confirmed).length;
  const missingReceipts = txs.filter((x) => !x.receiptId).length;
  const missingDocs = DOCUMENTS.filter((d) => d.businessId === bid && (d.status === 'missing' || d.status === 'requested')).length;
  const dedTotal = DEDUCTION_GROUPS.filter((g) => g.businessId === bid).reduce((s, g) => s + g.total, 0);

  // Readiness is a plain proportion of resolved items — not a score we invent.
  const totalItems = txs.length + missingDocs + alerts.length;
  const resolved = txs.filter((x) => x.confirmed).length;
  const readiness = totalItems ? Math.round((resolved / totalItems) * 100) : 0;

  if (state === 'loading' || summary.status === 'loading') {
    return <div className="space-y-4"><PageHeader title={t.nav.dashboard} /><LoadingState /></div>;
  }
  if (state === 'error' || summary.status === 'error') {
    return <div className="space-y-4"><PageHeader title={t.nav.dashboard} /><ErrorState onRetry={summary.reload} /></div>;
  }
  if (summary.status === 'permission_denied') {
    return <div className="space-y-4"><PageHeader title={t.nav.dashboard} /><PermissionDenied error={summary.error} /></div>;
  }

  return (
    <div>
      <PageHeader
        title={`${t.dashboard.greeting}, ${business.dbaName ?? business.legalName}`}
        subtitle={t.dashboard.whatsHappening}
      />

      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-600">{t.dashboard.readiness}</span>
            <span className="font-display text-lg font-semibold tabular-nums text-jade-700">{readiness}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full bg-jade-600" style={{ width: `${readiness}%` }} />
          </div>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-3">
          {[
            [t.dashboard.income, money(income)],
            [t.dashboard.expenses, money(expenses)],
            [t.dashboard.estNet, money(netProfit)],
          ].map(([l, v]) => (
            <div key={l} className="bg-white px-5 py-4">
              <div className="text-sm text-ink-500">{l}</div>
              <div className="mt-1 font-display text-xl font-semibold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t.dashboard.uncategorized} value={uncategorized} tone={uncategorized ? 'warn' : 'good'} />
        <Stat label={t.dashboard.missingReceipts} value={missingReceipts} tone={missingReceipts ? 'warn' : 'good'} />
        <Stat label={t.dashboard.possibleDeductions} value={money(dedTotal)} />
        <Stat label={t.dashboard.missingDocs} value={missingDocs} tone={missingDocs ? 'warn' : 'good'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg font-semibold">{t.dashboard.alerts}</h2>
          {alerts.length === 0 ? (
            <EmptyState title={t.alerts.emptyTitle} body={t.alerts.emptyBody} />
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={
                          a.severity === 'urgent' ? 'text-clay-600'
                          : a.severity === 'attention' ? 'text-gold-600' : 'text-navy-600'
                        }
                      >
                        {a.severity === 'urgent' ? '!' : a.severity === 'attention' ? '▲' : 'i'}
                      </span>
                      <span className="font-medium text-ink-900">
                        {t.alerts[a.kind as keyof typeof t.alerts] as string}
                      </span>
                    </div>
                    <div className="mt-1"><StatusChip status={a.status} /></div>
                  </div>
                  <Link to={a.deepLink}>
                    <Button variant="secondary" size="sm">{t.alerts.resolve}</Button>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          {est && (
            <Card className="p-5">
              <h2 className="mb-1 font-display text-lg font-semibold">{t.dashboard.quarterlyEstimate}</h2>
              <div className="mb-3 font-display text-2xl font-semibold tabular-nums text-jade-700">
                {money(est.remainingEstimate)}
              </div>
              <p className="mb-3 text-sm text-ink-500">
                {t.quarterly.nextDue}: {est.nextDueDate}
              </p>
              <DisclosureNote kind="planning" />
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">{t.dashboard.syncStatus}</h2>
            <div className="space-y-2">
              {CONNECTIONS.filter((c) => c.businessId === bid).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-ink-600">{c.institutionName}</span>
                  <span
                    className={
                      'shrink-0 text-xs ' +
                      (c.status === 'sync_completed' ? 'text-jade-700' : 'text-clay-700')
                    }
                  >
                    {c.status === 'sync_completed' ? '✓ ' : '! '}
                    {t.connections[c.status as keyof typeof t.connections] as string}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              {ACCOUNTS.filter((a) => a.businessId === bid).map((a) => (
                <div key={a.id} className="flex justify-between text-xs text-ink-500">
                  <span>{a.name}</span>
                  <MaskedAccount masked={a.maskedNumber} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═══ 7. Transaction list and categorization ════════════════════════════════

type Filter = 'all' | 'needs_review' | 'confirmed' | 'missing_receipt';

export function Transactions({
  caller, state,
}: { business?: Business; caller: Caller; state?: LoadState }) {
  const { t, date } = useI18n();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const list = useAsync(
    () => transactionRepository.list(caller, { filter, limit: 40 }),
    [caller.businessId, caller.role, filter]
  );
  const confirmOne = useAction(categorizationService.confirm);
  const confirmMany = useAction(categorizationService.confirmMany);

  // Demo/testing overrides so every state is reachable from the UI.
  const forced: Record<string, unknown> | null =
    state === 'loading' ? { status: 'loading' }
    : state === 'error' ? { status: 'error', error: { kind: 'network', message: 'error.network' } }
    : null;
  const view = (forced ?? list) as typeof list;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const confirmSelected = async () => {
    await confirmMany.run(caller, [...selected]);
    setSelected(new Set());
    list.reload();
  };

  const mayConfirm = caller.role === 'owner';

  return (
    <div>
      <PageHeader title={t.tx.title} subtitle={t.legal.confirmationRequired} />

      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ['all', t.tx.filterAll],
          ['needs_review', t.tx.filterNeedsReview],
          ['confirmed', t.tx.filterConfirmed],
          ['missing_receipt', t.tx.filterMissingReceipt],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={
              'rounded-full px-3.5 py-1.5 text-sm transition ' +
              (filter === k ? 'bg-jade-700 font-semibold text-white' : 'border border-line bg-white text-ink-600')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {selected.size > 0 && mayConfirm && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-jade-600 bg-jade-50 px-4 py-3">
          <span className="text-sm font-medium">{selected.size} {t.tx.selected}</span>
          <Button size="sm" onClick={confirmSelected}>{t.tx.bulkConfirm}</Button>
        </div>
      )}
      <ActionFeedback state={confirmMany.state} />

      <StateView
        state={view}
        empty={{ title: t.tx.emptyTitle, body: t.tx.emptyBody }}
      >
        {(rows: Transaction[]) => (
          <div className="space-y-2">
            {rows.map((x) => {
              const confirmed = Boolean(x.confirmed);
              return (
                <Card key={x.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-label={x.merchantNormalized ?? x.merchantRaw}
                      checked={selected.has(x.id)}
                      onChange={() => toggle(x.id)}
                      disabled={confirmed || !mayConfirm}
                      className="mt-1 h-4 w-4 shrink-0 accent-jade-700"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-ink-900">
                          {x.merchantNormalized ?? x.merchantRaw}
                        </span>
                        <Money value={x.amount} className={x.amount > 0 ? 'text-jade-700' : 'text-ink-900'} />
                      </div>
                      <div className="mt-0.5 text-sm text-ink-500">{date(x.postedAt)}</div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {confirmed ? (
                          <>
                            <StatusChip status="completed" />
                            <span className="text-sm text-ink-600">{x.confirmed!.categoryKey}</span>
                            {x.confirmed!.corrected && (
                              <span className="text-xs text-ink-400">· {t.tx.corrected}</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="rounded-full bg-gold-100 px-2.5 py-1 text-xs font-medium text-gold-800">
                              {t.tx.suggested}
                            </span>
                            <span className="text-sm text-ink-700">{x.suggested?.categoryKey}</span>
                            {x.suggested && <ConfidenceBar value={x.suggested.confidence} />}
                          </>
                        )}
                        {x.suggested?.scheduleCLine && (
                          <span className="text-xs text-ink-400">
                            {t.tx.scheduleLine} {x.suggested.scheduleCLine}
                          </span>
                        )}
                      </div>

                      {x.flags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {x.flags.map((f) => (
                            <span key={f} className="rounded-full bg-clay-50 px-2 py-0.5 text-xs text-clay-700">
                              {f === 'possible_duplicate' ? t.tx.flagDuplicate
                                : f === 'possible_transfer' ? t.tx.flagTransfer
                                : f === 'missing_receipt' ? t.tx.flagNoReceipt
                                : t.tx.flagUnusual}
                            </span>
                          ))}
                        </div>
                      )}

                      {!confirmed && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={!mayConfirm}
                            onClick={async () => { await confirmOne.run(caller, x.id); list.reload(); }}
                          >
                            {t.common.confirm}
                          </Button>
                          <Button size="sm" variant="secondary" disabled={!mayConfirm}>
                            {t.common.change}
                          </Button>
                          {!mayConfirm && (
                            <span className="self-center text-xs text-ink-500">
                              {t.legal.confirmationRequired}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </StateView>
      <ActionFeedback state={confirmOne.state} />
    </div>
  );
}

// ═══ 8. Receipt upload and queue ═══════════════════════════════════════════

export function Receipts({
  caller, state,
}: { business?: Business; caller: Caller; state?: LoadState }) {
  const { t, money, date } = useI18n();
  const all = useAsync(() => receiptRepository.list(caller), [caller.businessId, caller.role]);
  const upload = useAction(receiptRepository.upload);

  const forced: Record<string, unknown> | null =
    state === 'loading' ? { status: 'loading' }
    : state === 'error' ? { status: 'error', error: { kind: 'network', message: 'error.network' } }
    : null;
  const view = (forced ?? all) as typeof all;
  return (
    <div>
      <PageHeader title={t.receipts.title} />

      <Card className="mb-6 border-dashed p-8 text-center">
        <div className="mb-2 text-3xl" aria-hidden="true">▣</div>
        <h2 className="font-display text-lg font-semibold">{t.receipts.uploadTitle}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">{t.receipts.uploadBody}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={async () => { await upload.run(caller, { name: 'photo.jpg' }); all.reload(); }}>
            {t.receipts.takePhoto}
          </Button>
          <Button variant="secondary" onClick={async () => { await upload.run(caller, { name: 'receipt.pdf' }); all.reload(); }}>
            {t.receipts.chooseFile}
          </Button>
        </div>
        <ActionFeedback state={upload.state} />
      </Card>

      <h2 className="mb-3 font-display text-lg font-semibold">{t.receipts.queue}</h2>

      <StateView state={view} empty={{ title: t.receipts.emptyTitle, body: t.receipts.emptyBody }}>
        {(items: Receipt[]) => {
          const needsAttention = items.filter((r) =>
            ['unreadable', 'unmatched', 'duplicate', 'needs_info'].includes(r.status));
          const matched = items.filter((r) => r.status === 'matched');
          return (
            <>
              <div className="mb-6 space-y-2">
                {needsAttention.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-ink-900">
                          {r.extracted?.merchant.value ?? t.receipts.unreadable}
                        </div>
                        <div className="mt-1 text-sm text-ink-500">
                          {r.status === 'unreadable' ? t.receipts.unreadableBody
                            : r.status === 'duplicate' ? t.receipts.duplicate
                            : r.status === 'needs_info' ? t.receipts.needsInfo
                            : t.receipts.unmatched}
                        </div>
                        {r.extracted && (
                          <div className="mt-2.5 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                            {([
                              [t.receipts.merchant, r.extracted.merchant.value ?? '—', r.extracted.merchant.confidence],
                              [t.receipts.date, r.extracted.date.value ? date(r.extracted.date.value) : '—', r.extracted.date.confidence],
                              [t.receipts.total, r.extracted.total.value != null ? money(r.extracted.total.value) : '—', r.extracted.total.confidence],
                            ] as const).map(([label, val, conf]) => (
                              <div key={label} className="flex items-center justify-between gap-3">
                                <span className="text-ink-500">{label}</span>
                                <span className="flex items-center gap-2">
                                  <span className={conf < 0.5 ? 'text-clay-700' : 'text-ink-800'}>{val}</span>
                                  <ConfidenceBar value={conf} />
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {r.extracted && r.extracted.merchant.confidence < 0.5 && (
                          <p className="mt-2 text-sm text-clay-700">{t.receipts.lowConfidence}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <StatusChip
                          status={
                            r.status === 'unreadable' ? 'failed'
                            : r.status === 'duplicate' ? 'needs_review'
                            : r.status === 'needs_info' ? 'waiting_customer' : 'needs_review'
                          }
                        />
                        <Button size="sm" variant="secondary">{t.receipts.matchTo}</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <h3 className="mb-2 text-sm font-medium text-ink-500">
                {t.receipts.matched} · {matched.length}
              </h3>
              <div className="space-y-1.5">
                {matched.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-2.5">
                    <span className="min-w-0 truncate text-sm text-ink-700">{r.extracted?.merchant.value}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-sm tabular-nums text-ink-600">
                        {r.extracted?.total.value != null ? money(r.extracted.total.value) : '—'}
                      </span>
                      <StatusChip status="completed" />
                    </span>
                  </div>
                ))}
              </div>
            </>
          );
        }}
      </StateView>
    </div>
  );
}

// ═══ 6b. Connections management ═════════════════════════════════════════════

export function Connections({
  business, caller: _caller,
}: { business: Business; caller: Caller }) {
  const { t } = useI18n();
  const bid = business.id;
  const conns = CONNECTIONS.filter((c) => c.businessId === bid);
  const accounts = ACCOUNTS.filter((a) => a.businessId === bid);

  return (
    <div>
      <PageHeader title={t.connections.title} subtitle={t.connections.neverCredentials} />
      <div className="mb-5"><DisclosureNote kind="general" /></div>

      <div className="space-y-3">
        {conns.map((c: Connection) => {
          const linkedAccounts = accounts.filter((a) => a.connectionId === c.id);
          return (
            <Card key={c.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-ink-900">{c.institutionName}</h3>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600">
                      {(t.connections as Record<string, string>)[c.kind] ?? c.kind}
                    </span>
                  </div>
                  {c.lastSyncAt && (
                    <p className="mt-1 text-sm text-ink-500">
                      {t.connections.lastSync}: {new Date(c.lastSyncAt).toLocaleDateString()}
                    </p>
                  )}
                  {linkedAccounts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {linkedAccounts.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 text-sm text-ink-600">
                          <span>{a.name}</span>
                          <span className="tabular-nums text-ink-400">{a.maskedNumber}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusChip status={
                    c.status === 'sync_completed' ? 'completed'
                    : c.status === 'sync_failed' ? 'failed'
                    : c.status === 'expired' ? 'action_required'
                    : c.status === 'auth_required' ? 'action_required'
                    : c.status === 'sync_in_progress' ? 'in_progress'
                    : c.status === 'connected' ? 'completed'
                    : c.status === 'connecting' ? 'in_progress'
                    : 'not_started'
                  } />
                  <span className="text-sm text-ink-500">{(t.connections as Record<string, string>)[c.status] ?? c.status}</span>
                  {(c.status === 'sync_failed' || c.status === 'expired') && (
                    <Button variant="secondary" size="sm">{t.connections.reconnect}</Button>
                  )}
                </div>
              </div>
              {c.failureReason && (
                <p className="mt-3 rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-700">
                  {c.failureReason === 'auth_expired' ? t.connections.auth_required : c.failureReason}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
