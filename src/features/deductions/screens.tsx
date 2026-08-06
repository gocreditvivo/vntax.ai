import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useI18n, FormName } from '../../i18n';
import posthog from '../../posthog';
import {
  Button, Card, DisclosureNote, PageHeader, Stat, StatusChip,
} from '../../components/ui';
import { StateView, ActionFeedback } from '../../components/states';
import { useAsync, useAction } from '../../state/useAsync';
import {
  deductionService, documentService, exportService, industryService,
  quarterlyService, sharingService, type Caller,
} from '../../services';
import { USERS } from '../../mocks/fixtures';
import { can, isGrantActive } from '../../security/permissions';
import type {
  Business, BusinessDocument, DeductionGroup, QuarterlyEstimate,
  RestaurantMetrics, SalonMetrics, SharingGrant,
} from '../../types';

type LoadState = 'loading' | 'error' | 'ready';

// ═══ 9. Possible deductions workspace ══════════════════════════════════════

export function Deductions({
  caller, state,
}: { business?: Business; caller: Caller; state?: LoadState }) {
  const { t, money } = useI18n();
  const groups = useAsync(() => deductionService.suggest(caller), [caller.businessId, caller.role]);
  const confirmGroup = useAction(deductionService.confirmGroup);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const forced =
    state === 'loading' ? { status: 'loading' as const }
    : state === 'error' ? { status: 'error' as const, error: { kind: 'network' as const, message: 'error.network' } }
    : null;
  const view = (forced ?? groups) as typeof groups;

  return (
    <div>
      <PageHeader title={t.deductions.title} subtitle={t.deductions.subtitle} />
      <div className="mb-5"><DisclosureNote kind="deduction" /></div>

      <StateView state={view} empty={{ title: t.deductions.emptyTitle, body: t.deductions.emptyBody }}>
        {(rows: DeductionGroup[]) => (
          <div className="space-y-3">
            {rows.slice(0, 12).map((g) => {
              const ok = g.customerConfirmed || done[g.id];
              return (
                <Card key={g.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold text-ink-900">{g.categoryKey}</h3>
                        {g.scheduleCLine && (
                          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600">
                            {t.tx.scheduleLine} {g.scheduleCLine}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-ink-500">
                        {g.transactionIds.length} {t.deductions.supporting.toLowerCase()} ·{' '}
                        {g.receiptsAttached} {t.deductions.receiptsAttached}
                        {g.receiptsMissing > 0 && (
                          <span className="text-clay-700"> · {g.receiptsMissing} {t.deductions.receiptsMissing}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-semibold tabular-nums text-jade-700">
                        {money(g.total)}
                      </div>
                      <div className="mt-1"><StatusChip status={ok ? 'completed' : g.status} /></div>
                    </div>
                  </div>

                  {g.professionalReviewRecommended && (
                    <p className="mt-3 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-800">
                      {t.legal.reviewRecommended}
                    </p>
                  )}
                  {g.needsMoreInformation.length > 0 && (
                    <p className="mt-2 text-sm text-clay-700">{t.deductions.needsInfo}</p>
                  )}

                  {!ok && (
                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-jade-700"
                        onChange={async () => {
                          const r = await confirmGroup.run(caller, g.id);
                          if (r.ok) {
                            setDone({ ...done, [g.id]: true });
                            posthog.capture('deduction_group_confirmed');
                          }
                        }}
                      />
                      <span>{t.deductions.confirmGroup}</span>
                    </label>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </StateView>
      <ActionFeedback state={confirmGroup.state} />
    </div>
  );
}

// ═══ 12. Quarterly planning ════════════════════════════════════════════════

export function Quarterly({
  caller, state,
}: { business?: Business; caller: Caller; state?: LoadState }) {
  const { t, money } = useI18n();
  const [pct, setPct] = useState(0);
  const est = useAsync(() => quarterlyService.estimate(caller), [caller.businessId, caller.role]);

  const forced =
    state === 'loading' ? { status: 'loading' as const }
    : state === 'error' ? { status: 'error' as const, error: { kind: 'network' as const, message: 'error.network' } }
    : null;
  const view = (forced ?? est) as typeof est;

  return (
    <div>
      <PageHeader title={t.quarterly.title} subtitle={t.quarterly.subtitle} />
      <div className="mb-5"><DisclosureNote kind="planning" /></div>

      <StateView state={view} empty={{ title: t.quarterly.title, body: t.errors.no_estimate }}>
        {(e: QuarterlyEstimate) => (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={t.quarterly.estNetProfit} value={money(e.estimatedNetProfit)} />
              <Stat label={t.quarterly.seComponent} value={money(e.selfEmploymentComponent)} />
              <Stat label={t.quarterly.paid} value={money(e.paymentsMade)} />
              <Stat label={t.quarterly.remaining} value={money(e.remainingEstimate)} tone="warn" />
            </div>

            <Card className="mb-5 p-5">
              <h2 className="mb-1 font-display text-lg font-semibold">{t.quarterly.scenario}</h2>
              <p className="mb-4 text-sm text-ink-500">{t.quarterly.scenarioBody}</p>
              <input
                type="range" min={-30} max={30} value={pct}
                onChange={(ev: ChangeEvent<HTMLInputElement>) => setPct(Number(ev.target.value))}
                className="w-full accent-jade-700" aria-label={t.quarterly.scenario}
              />
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-sm text-ink-500">
                  {pct > 0 ? '+' : ''}{pct}% {t.dashboard.income.toLowerCase()}
                </span>
                <span className="font-display text-xl font-semibold tabular-nums text-jade-700">
                  {money(e.selfEmploymentComponent * (1 + pct / 100))}
                </span>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
                <h2 className="font-display text-lg font-semibold">{t.quarterly.howCalculated}</h2>
                <span className="text-xs text-ink-500">
                  {t.quarterly.rulesetVersion} {e.rulesetVersion} · {e.rulesetStatus}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {e.trace.map((line, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        <td className="px-5 py-2.5 text-ink-700">{line.label}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-ink-900">
                          {typeof line.value === 'number' ? money(line.value) : String(line.value)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right text-xs text-ink-400">
                          {line.sourceReference}
                          {line.ruleStatus !== 'verified' && (
                            <span className="ml-1.5 text-gold-700">[{line.ruleStatus}]</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {e.unsupported.length > 0 && (
                <div className="border-t border-line bg-gold-50 px-5 py-3 text-sm text-gold-900">
                  {e.unsupported.join(', ')}
                </div>
              )}
            </Card>

            <p className="mt-4 text-sm text-ink-500"><FormName id="form_1040es" /></p>
          </>
        )}
      </StateView>
    </div>
  );
}

// ═══ 13. Document center ═══════════════════════════════════════════════════

export function Documents({
  caller, state,
}: { business?: Business; caller: Caller; state?: LoadState }) {
  const { t, date } = useI18n();
  const docs = useAsync(() => documentService.list(caller), [caller.businessId, caller.role]);
  const upload = useAction(documentService.upload);

  const forced =
    state === 'loading' ? { status: 'loading' as const }
    : state === 'error' ? { status: 'error' as const, error: { kind: 'network' as const, message: 'error.network' } }
    : null;
  const view = (forced ?? docs) as typeof docs;

  const statusMap = {
    accepted: 'completed', uploaded: 'in_progress', processing: 'waiting_system',
    needs_review: 'needs_review', requested: 'waiting_customer', missing: 'action_required',
    rejected: 'failed', expired: 'failed', not_requested: 'not_started',
    shared: 'completed', exported: 'completed',
  } as const;

  return (
    <div>
      <PageHeader title={t.documents.title} />
      <StateView state={view} empty={{ title: t.documents.emptyTitle, body: t.documents.emptyBody }}>
        {(rows: BusinessDocument[]) => (
          <div className="space-y-2">
            {rows.map((d) => (
              <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-medium text-ink-900">{d.label}</div>
                  <div className="mt-0.5 text-sm text-ink-500">
                    {d.taxYear && `${t.documents.taxYear} ${d.taxYear} · `}{d.kind}
                    {d.expiresAt && (
                      <span className="text-gold-700"> · {t.documents.expiring} {date(d.expiresAt)}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusChip status={statusMap[d.status]} />
                  {(d.status === 'missing' || d.status === 'requested') && (
                    <Button size="sm" variant="secondary"
                      onClick={async () => {
                        const result = await upload.run(caller, d.id);
                        if (result?.ok) posthog.capture('document_uploaded', { document_kind: d.kind });
                        docs.reload();
                      }}>
                      {t.common.upload}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </StateView>
      <ActionFeedback state={upload.state} />
    </div>
  );
}

// ═══ 14. Tax-ready export ══════════════════════════════════════════════════

export function ExportCenter({
  caller, state,
}: { business?: Business; caller: Caller; state?: LoadState }) {
  const { t } = useI18n();
  const comp = useAsync(() => exportService.completeness(caller), [caller.businessId, caller.role]);
  const build = useAction(exportService.build);
  const [built, setBuilt] = useState<{ id: string; included: number } | null>(null);

  const forced =
    state === 'loading' ? { status: 'loading' as const }
    : state === 'error' ? { status: 'error' as const, error: { kind: 'network' as const, message: 'error.network' } }
    : null;
  const view = (forced ?? comp) as typeof comp;

  const contents = [
    'businessProfile', 'incomeSummary', 'expenseSummary', 'categorizedTransactions',
    'receiptIndex', 'missingReceipts', 'possibleDeductions', 'payrollSummary',
    'contractorSummary', 'tipsSummary', 'salesTaxSummary', 'quarterlyPayments',
    'accountList', 'documentChecklist', 'unresolvedQuestions', 'customerNotes', 'auditSummary',
  ];

  return (
    <div>
      <PageHeader title={t.exports.title} subtitle={t.exports.subtitle} />

      <StateView state={view} empty={{ title: t.exports.title, body: t.states.emptyGeneric }}>
        {(c: { unconfirmedTransactions: number; missingReceipts: number; unresolvedAlerts: number; missingDocuments: number }) => (
          <>
            {/* Completeness is stated BEFORE the package is built, never buried. */}
            <Card className="mb-5 border-gold-300 bg-gold-50 p-5">
              <h2 className="mb-3 font-display text-lg font-semibold text-gold-900">{t.exports.completeness}</h2>
              <div className="grid gap-3 sm:grid-cols-4">
                {([
                  [c.unconfirmedTransactions, t.exports.unconfirmed],
                  [c.missingReceipts, t.exports.missingReceipts],
                  [c.unresolvedAlerts, t.exports.unresolvedAlerts],
                  [c.missingDocuments, t.exports.missingDocs],
                ] as const).map(([n, label]) => (
                  <div key={label}>
                    <div className="font-display text-2xl font-semibold tabular-nums text-gold-900">{n}</div>
                    <div className="text-sm text-gold-800">{label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-gold-800">{t.exports.completeNote}</p>
            </Card>

            <Card className="mb-5 p-5">
              <h2 className="mb-3 font-display text-lg font-semibold">{t.exports.contents}</h2>
              <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {contents.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-jade-700" />
                    <span className="text-ink-700">{k}</span>
                  </label>
                ))}
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={async () => {
                  const r = await build.run(caller, 2026, ['pdf', 'csv']);
                  if (r.ok) {
                    setBuilt({ id: r.data.id, included: r.data.includedTransactionIds.length });
                    posthog.capture('tax_export_built', {
                      included_transaction_count: r.data.includedTransactionIds.length,
                    });
                  }
                }}
              >
                {t.exports.build}
              </Button>
              {built && (
                <>
                  <StatusChip status="completed" />
                  <span className="text-sm text-ink-600">
                    {t.exports.ready} · {built.included} {t.tx.filterConfirmed.toLowerCase()}
                  </span>
                  <Button variant="secondary" size="sm">{t.exports.share}</Button>
                </>
              )}
            </div>
            <ActionFeedback state={build.state} />
          </>
        )}
      </StateView>
    </div>
  );
}

// ═══ 15. Professional sharing ══════════════════════════════════════════════

export function Sharing({
  caller, state,
}: { business?: Business; caller: Caller; state?: LoadState }) {
  const { t, date } = useI18n();
  const grants = useAsync(() => sharingService.list(caller), [caller.businessId, caller.role]);
  const invite = useAction(sharingService.invite);
  const revoke = useAction(sharingService.revoke);
  const [email, setEmail] = useState('');

  const mayGrant = can({ role: caller.role, userId: caller.userId, businessId: caller.businessId },
                       'sharing', 'grant').allowed;

  const forced =
    state === 'loading' ? { status: 'loading' as const }
    : state === 'error' ? { status: 'error' as const, error: { kind: 'network' as const, message: 'error.network' } }
    : null;
  const view = (forced ?? grants) as typeof grants;

  return (
    <div>
      <PageHeader title={t.sharing.title} subtitle={t.sharing.subtitle} />
      <Card className="mb-5 bg-jade-50 p-4 text-sm text-jade-900">{t.sharing.neverShared}</Card>
      {!mayGrant && <Card className="mb-5 bg-ink-50 p-4 text-sm text-ink-700">{t.sharing.ownerOnly}</Card>}

      <h2 className="mb-3 font-display text-lg font-semibold">{t.sharing.activeAccess}</h2>

      <StateView state={view} empty={{ title: t.sharing.emptyTitle, body: t.sharing.emptyBody }}>
        {(rows: SharingGrant[]) => (
          <div className="mb-6 space-y-2">
            {rows.map((g) => {
              const active = isGrantActive(g);
              const who = USERS.find((u) => u.id === g.inviteeUserId);
              return (
                <Card key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="font-medium text-ink-900">{who?.displayName ?? g.inviteeEmail}</div>
                    <div className="mt-0.5 text-sm text-ink-500">
                      {g.taxYears.join(', ')} · {g.folders.join(', ')}
                    </div>
                    <div className="mt-1 text-xs text-ink-400">
                      {t.sharing.expires}: {date(g.expiresAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusChip status={active ? 'completed' : 'archived'} />
                    {active && mayGrant && (
                      <Button size="sm" variant="danger"
                        onClick={async () => {
                          const result = await revoke.run(caller, g.id);
                          if (result?.ok) posthog.capture('professional_access_revoked');
                          grants.reload();
                        }}>
                        {t.sharing.revoke}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </StateView>
      <ActionFeedback state={revoke.state} />

      {mayGrant && (
        <Card className="p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">{t.sharing.invite}</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="email" placeholder="cpa@example.com" aria-label={t.sharing.inviteEmail}
              value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-line px-4 py-2.5"
            />
            <Button
              onClick={async () => {
                const r = await invite.run(caller, { email, taxYears: [2026], folders: ['tax_2026'] });
                if (r.ok) {
                  setEmail('');
                  grants.reload();
                  posthog.capture('professional_access_invited');
                }
              }}
            >
              {t.sharing.invite}
            </Button>
          </div>
          <ActionFeedback state={invite.state} />
          <p className="mt-3 text-sm text-ink-500">{t.legal.reviewRecommended}</p>
        </Card>
      )}
    </div>
  );
}

// ═══ 10. Restaurant dashboard ══════════════════════════════════════════════

export function RestaurantDashboard({ caller }: { caller: Caller; state?: LoadState }) {
  const { t, money, pct } = useI18n();
  const q = useAsync(() => industryService.restaurant(caller), [caller.businessId, caller.role]);

  return (
    <div>
      <PageHeader title={t.restaurant.title} subtitle={t.restaurant.observationNote} />
      <StateView state={q}>{(m: RestaurantMetrics) => (<>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t.restaurant.grossSales} value={money(m.grossSales)} />
        <Stat label={t.restaurant.foodCost} value={money(m.foodCost)} />
        <Stat label={t.restaurant.laborCost} value={money(m.laborCost)} />
        <Stat label={t.dashboard.estNet} value={money(m.estimatedNetIncome)} tone="good" />
      </div>

      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-display text-lg font-semibold">{t.dashboard.expenses}</h2>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {([
              [t.restaurant.foodCost, m.foodCost],
              [t.restaurant.beverageCost, m.beverageCost],
              [t.restaurant.payroll, m.payroll],
              [t.restaurant.rent, m.rent],
              [t.restaurant.utilities, m.utilities],
              [t.restaurant.deliveryFees, m.deliveryFees],
              [t.restaurant.merchantFees, m.merchantFees],
              [t.restaurant.operating, m.operatingExpenses],
            ] as const).map(([label, v]) => (
              <tr key={label} className="border-b border-line last:border-0">
                <td className="px-5 py-2.5 text-ink-700">{label}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(v)}</td>
                <td className="px-5 py-2.5 text-right text-xs text-ink-400">
                  {pct(v / m.grossSales)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">{t.restaurant.vendorConcentration}</h2>
        <div className="space-y-2.5">
          {m.vendorConcentration.map((v) => (
            <div key={v.vendor}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-ink-700">{v.vendor}</span>
                <span className="tabular-nums text-ink-500">{pct(v.share)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full bg-navy-600" style={{ width: `${v.share * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-500">{t.restaurant.observationNote}</p>
      </Card>
      </>)}</StateView>
    </div>
  );
}

// ═══ 11. Nail salon dashboard ══════════════════════════════════════════════

export function SalonDashboard({ caller }: { caller: Caller; state?: LoadState }) {
  const { t, money } = useI18n();
  const q = useAsync(() => industryService.salon(caller), [caller.businessId, caller.role]);

  return (
    <div>
      <PageHeader title={t.salon.title} />
      <StateView state={q}>{(m: SalonMetrics) => (<>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t.salon.serviceIncome} value={money(m.serviceIncome)} />
        <Stat label={t.salon.boothRental} value={money(m.boothRentalIncome)} />
        <Stat label={t.salon.contractorPayments} value={money(m.contractorPayments)} />
        <Stat label={t.dashboard.estNet} value={money(m.estimatedNetIncome)} tone="good" />
      </div>

      {/* The product surfaces the question; it never answers it */}
      <Card className="mb-5 border-clay-300 bg-clay-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-clay-900">
              {t.salon.missingW9}: {m.missingW9Count}
            </h2>
            <p className="mt-1 text-sm text-clay-800">
              {m.possible1099Count} {t.salon.possible1099.toLowerCase()}
            </p>
            <p className="mt-2 text-sm text-clay-800">{t.salon.classificationNote}</p>
          </div>
          <Button variant="secondary" size="sm">{t.salon.contractorTracker}</Button>
        </div>
        <p className="mt-3 text-sm text-clay-700"><FormName id="form_w9" /></p>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-display text-lg font-semibold">{t.dashboard.expenses}</h2>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {([
              [t.salon.supplies, m.supplyExpenses],
              [t.salon.employeePayroll, m.employeePayroll],
              [t.salon.contractorPayments, m.contractorPayments],
              [t.salon.rent, m.rent],
              [t.restaurant.utilities, m.utilities],
              [t.salon.merchantFees, m.merchantFees],
            ] as const).map(([label, v]) => (
              <tr key={label} className="border-b border-line last:border-0">
                <td className="px-5 py-2.5 text-ink-700">{label}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{money(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      </>)}</StateView>
    </div>
  );
}
