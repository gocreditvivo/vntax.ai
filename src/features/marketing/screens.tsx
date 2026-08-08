import { useState } from 'react';
import { useI18n, FormName } from '../../i18n';
import { Link, useNav } from '../../app/router';
import { useAuth } from '../../auth/AuthProvider';
import { createBusiness } from '../../data/businesses';
import { MarketingLayout, OnboardingLayout } from '../../layouts';
import { Button, Card, Field, FormError, Input, DisclosureNote } from '../../components/ui';
import { clearDraft, readDraft, writeDraft, type OnboardingDraft } from './onboardingDraft';
import type { EntityType, Industry } from '../../types';

// ═══ 1. Bilingual homepage ═════════════════════════════════════════════════

export function Home() {
  const { t } = useI18n();
  return (
    <MarketingLayout>
      {/* hero — april-inspired, light variant: pale neutral field (like
          getapril.com's off-white background) instead of the jade block,
          with jade/gold reserved for the illustration and primary CTA. */}
      <section className="relative overflow-hidden bg-ink-50 px-5 py-20 text-content-primary">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-line bg-white px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-content-secondary">
              {t.marketing.trustBadge}
            </p>
            <h1 className="display-hero max-w-xl text-4xl text-content-primary sm:text-5xl lg:text-6xl">
              {t.marketing.heroTitle}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-content-secondary">{t.marketing.heroBody}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth/sign-up"
                className="rounded-full bg-jade-700 px-6 py-3.5 font-semibold text-white hover:bg-jade-800"
              >
                {t.marketing.ctaPrimary}
              </Link>
              <Link
                to="/#how"
                className="rounded-full border border-line px-6 py-3.5 font-semibold text-content-primary hover:bg-white"
              >
                {t.marketing.ctaSecondary}
              </Link>
            </div>
            <p className="mt-5 max-w-2xl text-sm text-content-muted">
              {t.marketing.productBoundary}
            </p>
            <p className="mt-5 text-sm text-content-muted">{t.legal.promise}</p>
          </div>
          <HeroLedgerCard />
        </div>
      </section>

      {/* industry selection */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="display-section mb-6 text-3xl">{t.marketing.pickIndustry}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ['restaurant', t.marketing.restaurantCard, t.marketing.restaurantCardBody],
            ['nail_salon', t.marketing.salonCard, t.marketing.salonCardBody],
          ] as const).map(([key, title, body]) => (
            <Link key={key} to="/auth/sign-up">
              <Card className="h-full rounded-2xl p-6 transition hover:border-jade-600 hover:shadow-sm">
                <h3 className="display-section text-xl text-content-primary">{title}</h3>
                <p className="mt-2 text-content-muted">{body}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="bg-cream px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="display-section mb-8 text-3xl">{t.marketing.howTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([
              [t.marketing.how1, t.marketing.how1Body],
              [t.marketing.how2, t.marketing.how2Body],
              [t.marketing.how3, t.marketing.how3Body],
              [t.marketing.how4, t.marketing.how4Body],
            ] as const).map(([title, body], i) => (
              <Card key={title} className="p-5">
                {/* numbered because these ARE sequential steps */}
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-jade-700 text-sm font-semibold text-white">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-content-primary">{title}</h3>
                <p className="mt-1.5 text-sm text-content-muted">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* bilingual + security */}
      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-16 sm:grid-cols-2">
        <Card className="p-6">
          <h3 className="display-section text-xl">{t.marketing.bilingualTitle}</h3>
          <p className="mt-2 text-content-muted">{t.marketing.bilingualBody}</p>
          <p className="mt-4 text-sm text-ink-600">
            <FormName id="schedule_c" />
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="display-section text-xl">{t.marketing.securityTitle}</h3>
          <p className="mt-2 text-content-muted">{t.marketing.securityBody}</p>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <DisclosureNote kind="general" />
      </section>
    </MarketingLayout>
  );
}

// ═══ 3. Sign-up and login ══════════════════════════════════════════════════

/**
 * Sign-up and login live in `authForms.tsx`. They are re-exported here so the
 * app shell's import surface is unchanged and screen imports stay in one place.
 */
export { SignUp, Login } from './authForms';

// ═══ 4 & 5. Onboarding, including industry selection ═══════════════════════

const ENTITY_TYPES: EntityType[] = [
  'sole_proprietor', 'single_member_llc', 'multi_member_llc',
  'partnership', 's_corporation', 'unknown',
];

/**
 * Onboarding wizard.
 *
 * The final step now performs a real insert into `businesses`. The database
 * trigger `on_business_created` creates the owner membership atomically, and
 * `refreshIdentity()` re-reads memberships so the app shell can resolve a role
 * for the new business immediately rather than on the next page load.
 *
 * The owner name and phone collected here are not written to `profiles`: the
 * signup metadata already populated that row via `on_auth_user_created`, and
 * overwriting it from the wizard would silently discard whatever the user
 * typed at signup. These fields prefill from the signed-in profile instead.
 */
export function Onboarding({
  step, fallbackIndustry = 'restaurant',
}: { step: string; fallbackIndustry?: Industry }) {
  const { t } = useI18n();
  const { navigate } = useNav();
  const { status, identity, refreshIdentity, setActiveBusinessId } = useAuth();

  // `fallbackIndustry` seeds a fresh draft only. Once the user picks an
  // industry the stored draft wins, so a demo-mode default never overrides a
  // real choice made two steps earlier.
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const stored = readDraft();
    return stored.legalName || stored.industry !== 'restaurant'
      ? stored
      : { ...stored, industry: fallbackIndustry };
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const STEPS = ['language', 'owner', 'business', 'industry', 'entity', 'connections', 'complete'];
  const idx = Math.max(1, STEPS.indexOf(step) + 1);
  const next = (to: string) => navigate(`/onboarding/${to}`);

  /** Writes through to sessionStorage on every keystroke so back never loses input. */
  const set = <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
    setDraft(writeDraft({ [key]: value } as Partial<OnboardingDraft>));
  };

  const titles: Record<string, string> = {
    language: t.onboarding.languageTitle,
    owner: t.onboarding.ownerTitle,
    business: t.onboarding.businessTitle,
    industry: t.onboarding.industryTitle,
    entity: t.onboarding.entityTitle,
    connections: t.onboarding.connectionsTitle,
    complete: t.onboarding.completeTitle,
  };

  async function createAndEnter() {
    if (saving) return;

    if (!draft.legalName.trim()) {
      setSaveError(t.onboarding.businessNameRequired);
      navigate('/onboarding/business');
      return;
    }

    // Demo mode has no database. The wizard still completes so the preview
    // build and the unit suite can walk the whole flow.
    if (status === 'unconfigured') {
      clearDraft();
      navigate('/app/dashboard');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const result = await createBusiness({
      legalName: draft.legalName,
      dbaName: draft.dbaName,
      industry: draft.industry,
      entityType: draft.entityType,
      phone: draft.ownerPhone,
      address: {
        line1: draft.line1,
        line2: null,
        city: draft.city,
        state: draft.state.trim().toUpperCase(),
        postalCode: draft.postalCode,
        // Locality is resolved from the full address by a later step. An empty
        // id marks it unresolved rather than asserting a jurisdiction we have
        // not actually determined — filing authorities are address-level.
        localityId: '',
      },
    });

    if (!result.ok) {
      setSaving(false);
      setSaveError(t.onboarding.createFailed);
      return;
    }

    // Select the new business before refreshing, so the shell has a target the
    // moment the membership appears.
    setActiveBusinessId(result.data.id);
    await refreshIdentity();
    clearDraft();
    setSaving(false);
    navigate('/app/dashboard');
  }

  return (
    <OnboardingLayout step={idx} total={STEPS.length} title={titles[step] ?? ''}>
      {saveError && <FormError message={saveError} />}

      {step === 'language' && (
        <>
          <p className="mb-6 text-ink-500">{t.onboarding.languageBody}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <LangCard label="Tiếng Việt" note="Ngôn ngữ chính" onClick={() => next('owner')} />
            <LangCard label="English" note="Primary language" onClick={() => next('owner')} />
          </div>
        </>
      )}

      {step === 'owner' && (
        <Card className="p-6">
          {identity && (
            <p className="mb-4 text-sm text-content-muted">
              {t.onboarding.signedInAs} {identity.email}
            </p>
          )}
          <Field id="oname" label={t.auth.ownerName}>
            <Input
              id="oname"
              value={draft.ownerName || identity?.displayName || ''}
              onChange={(e) => set('ownerName', e.target.value)}
              autoComplete="name"
            />
          </Field>
          <Field id="ophone" label={t.auth.phone} hint={t.auth.phoneOptional}>
            <Input
              id="ophone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={draft.ownerPhone}
              onChange={(e) => set('ownerPhone', e.target.value)}
            />
          </Field>
          <Button className="w-full" onClick={() => next('business')}>{t.common.continue}</Button>
        </Card>
      )}

      {step === 'business' && (
        <Card className="p-6">
          <Field id="bname" label={t.onboarding.businessName} error={nameError ?? undefined}>
            <Input
              id="bname"
              value={draft.legalName}
              onChange={(e) => { set('legalName', e.target.value); setNameError(null); }}
              aria-invalid={!!nameError}
              autoComplete="organization"
            />
          </Field>
          <Field id="dba" label={t.onboarding.dbaName}>
            <Input id="dba" value={draft.dbaName} onChange={(e) => set('dbaName', e.target.value)} />
          </Field>
          <Field id="addr" label={t.onboarding.address} hint={t.onboarding.localityNote}>
            <Input
              id="addr"
              value={draft.line1}
              onChange={(e) => set('line1', e.target.value)}
              autoComplete="street-address"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="city" label={t.onboarding.city}>
              <Input id="city" value={draft.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field id="state" label={t.onboarding.state}>
              <Input
                id="state"
                value={draft.state}
                maxLength={2}
                onChange={(e) => set('state', e.target.value.toUpperCase())}
              />
            </Field>
            <Field id="zip" label={t.onboarding.postal}>
              <Input
                id="zip"
                inputMode="numeric"
                value={draft.postalCode}
                onChange={(e) => set('postalCode', e.target.value)}
                autoComplete="postal-code"
              />
            </Field>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (!draft.legalName.trim()) {
                setNameError(t.onboarding.businessNameRequired);
                return;
              }
              next('industry');
            }}
          >
            {t.common.continue}
          </Button>
        </Card>
      )}

      {step === 'industry' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ['restaurant', t.marketing.restaurantCard, t.marketing.restaurantCardBody],
            ['nail_salon', t.marketing.salonCard, t.marketing.salonCardBody],
          ] as const).map(([key, title, body]) => (
            <button
              key={key}
              onClick={() => { set('industry', key); next('entity'); }}
              className={
                'rounded-2xl border bg-white p-6 text-left transition hover:border-jade-600 ' +
                (draft.industry === key ? 'border-jade-600' : 'border-line')
              }
            >
              <h3 className="font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-ink-500">{body}</p>
            </button>
          ))}
        </div>
      )}

      {step === 'entity' && (
        <Card className="p-6">
          <p className="mb-4 text-sm text-ink-500">{t.onboarding.entityHelp}</p>
          <div className="mb-5 space-y-2">
            {ENTITY_TYPES.map((e) => (
              <label
                key={e}
                className={
                  'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ' +
                  (draft.entityType === e ? 'border-jade-600 bg-jade-50' : 'border-line')
                }
              >
                <input
                  type="radio" name="entity" value={e} checked={draft.entityType === e}
                  onChange={() => set('entityType', e)} className="accent-jade-700"
                />
                <span className="font-medium">{t.entity[e]}</span>
              </label>
            ))}
          </div>
          <Button className="w-full" onClick={() => next('connections')}>{t.common.continue}</Button>
        </Card>
      )}

      {step === 'connections' && (
        <Card className="p-6">
          <p className="mb-5 text-ink-500">{t.onboarding.connectionsBody}</p>
          <div className="mb-5 space-y-2">
            {(['bank', 'credit_card', 'payment_processor'] as const).map((k) => (
              <div key={k} className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
                <span className="font-medium">{t.connections[k]}</span>
                <Button variant="secondary" size="sm">{t.connections.connect}</Button>
              </div>
            ))}
          </div>
          <p className="mb-5 text-sm text-ink-500">{t.connections.neverCredentials}</p>
          <Button className="w-full" onClick={() => next('complete')}>{t.common.continue}</Button>
        </Card>
      )}

      {step === 'complete' && (
        <Card className="p-8 text-center">
          <div className="mb-3 text-4xl" aria-hidden="true">✓</div>
          <p className="mb-6 text-ink-500">{t.onboarding.completeBody}</p>
          <Button onClick={() => void createAndEnter()} disabled={saving} aria-busy={saving}>
            {saving ? t.onboarding.saving : t.onboarding.createBusiness}
          </Button>
        </Card>
      )}
    </OnboardingLayout>
  );
}

/**
 * april-inspired hero illustration: a floating "ledger card" built from SVG
 * shapes (no external asset dependency), tilted like a 3D object, with a
 * small monospace-labeled callout — riffing on the IRS-form visual language
 * without borrowing any actual form content.
 */
function HeroLedgerCard() {
  return (
    <div className="relative mx-auto hidden aspect-square w-full max-w-sm sm:block" aria-hidden="true">
      <div className="absolute inset-0 rounded-3xl bg-jade-600/10 blur-3xl" />
      <svg
        viewBox="0 0 320 320"
        className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 -rotate-6 drop-shadow-2xl transition-transform duration-700 hover:rotate-0"
      >
        <rect x="48" y="24" width="200" height="260" rx="18" fill="#FFFFFF" stroke="#155E4C" strokeWidth="2" />
        <rect x="68" y="56" width="120" height="12" rx="6" fill="#155E4C" />
        <rect x="68" y="84" width="160" height="6" rx="3" fill="#C4C2BB" />
        <rect x="68" y="100" width="160" height="6" rx="3" fill="#C4C2BB" />
        <rect x="68" y="116" width="110" height="6" rx="3" fill="#C4C2BB" />
        <line x1="68" y1="142" x2="228" y2="142" stroke="#E5E0D6" strokeWidth="2" />
        <rect x="68" y="158" width="90" height="8" rx="4" fill="#3D3B35" />
        <rect x="188" y="158" width="40" height="8" rx="4" fill="#B8894A" />
        <rect x="68" y="178" width="90" height="8" rx="4" fill="#3D3B35" />
        <rect x="188" y="178" width="40" height="8" rx="4" fill="#B8894A" />
        <rect x="68" y="198" width="90" height="8" rx="4" fill="#3D3B35" />
        <rect x="188" y="198" width="40" height="8" rx="4" fill="#B8894A" />
        <rect x="68" y="236" width="160" height="2" fill="#E5E0D6" />
        <rect x="68" y="250" width="70" height="10" rx="5" fill="#0C3830" />
        <rect x="188" y="250" width="40" height="10" rx="5" fill="#0C3830" />
        <circle cx="232" cy="40" r="22" fill="#C79A42" />
        <path d="M224 40l6 6 10-12" stroke="#0C3830" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="absolute -bottom-2 left-1/2 w-max -translate-x-1/2 rounded-xl border border-line bg-white px-4 py-2 font-mono text-xs text-content-primary shadow-lg">
        $3,184 <span className="text-content-muted">est. refund</span>
      </div>
    </div>
  );
}

function LangCard({ label, note, onClick }: { label: string; note: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-line bg-white p-6 text-left transition hover:border-jade-600"
    >
      <div className="font-display text-xl font-semibold">{label}</div>
      <div className="mt-1 text-sm text-ink-500">{note}</div>
    </button>
  );
}

