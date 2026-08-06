import { useState } from 'react';
import { useI18n, FormName } from '../../i18n';
import { Link, useNav } from '../../app/router';
import { setSession } from '../../app/auth';
import posthog from '../../posthog';
import { MarketingLayout, AuthLayout, OnboardingLayout } from '../../layouts';
import { Button, Card, Field, Input, DisclosureNote } from '../../components/ui';
import type { EntityType, Industry } from '../../types';

// ═══ 1. Bilingual homepage ═════════════════════════════════════════════════

export function Home() {
  const { t } = useI18n();
  return (
    <MarketingLayout>
      {/* hero */}
      <section className="bg-gradient-to-b from-jade-800 to-jade-900 px-5 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="mb-5 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm text-white/85">
            {t.marketing.trustBadge}
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
            {t.marketing.heroTitle}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/80">{t.marketing.heroBody}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth/sign-up"
              className="rounded-xl bg-white px-6 py-3.5 font-semibold text-jade-800 hover:bg-cream"
            >
              {t.marketing.ctaPrimary}
            </Link>
            <Link
              to="/#how"
              className="rounded-xl border border-white/40 px-6 py-3.5 font-semibold text-white hover:bg-white/10"
            >
              {t.marketing.ctaSecondary}
            </Link>
          </div>
          <p className="mt-5 max-w-2xl text-sm text-white/60">
            {t.marketing.productBoundary}
          </p>
          <p className="mt-5 text-sm text-white/60">{t.legal.promise}</p>
        </div>
      </section>

      {/* industry selection */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="mb-6 font-display text-2xl font-semibold">{t.marketing.pickIndustry}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ['restaurant', t.marketing.restaurantCard, t.marketing.restaurantCardBody],
            ['nail_salon', t.marketing.salonCard, t.marketing.salonCardBody],
          ] as const).map(([key, title, body]) => (
            <Link key={key} to="/auth/sign-up">
              <Card className="h-full p-6 transition hover:border-jade-600 hover:shadow-sm">
                <h3 className="font-display text-xl font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-ink-500">{body}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="bg-cream px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 font-display text-2xl font-semibold">{t.marketing.howTitle}</h2>
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
                <h3 className="font-semibold text-ink-900">{title}</h3>
                <p className="mt-1.5 text-sm text-ink-500">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* bilingual + security */}
      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-16 sm:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-display text-xl font-semibold">{t.marketing.bilingualTitle}</h3>
          <p className="mt-2 text-ink-500">{t.marketing.bilingualBody}</p>
          <p className="mt-4 text-sm text-ink-600">
            <FormName id="schedule_c" />
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="font-display text-xl font-semibold">{t.marketing.securityTitle}</h3>
          <p className="mt-2 text-ink-500">{t.marketing.securityBody}</p>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <DisclosureNote kind="general" />
      </section>
    </MarketingLayout>
  );
}

// ═══ 3. Sign-up and login ══════════════════════════════════════════════════

export function SignUp() {
  const { t } = useI18n();
  const { navigate } = useNav();
  return (
    <AuthLayout>
      <Card className="p-7">
        <h1 className="mb-6 font-display text-2xl font-semibold">{t.auth.signUpTitle}</h1>
        <Field id="name" label={t.auth.ownerName}><Input id="name" /></Field>
        <Field id="email" label={t.auth.email}><Input id="email" type="email" /></Field>
        <Field id="phone" label={t.auth.phone} hint={t.auth.mfaNote}>
          <Input id="phone" type="tel" />
        </Field>
        <Field id="pw" label={t.auth.password}><Input id="pw" type="password" /></Field>
        <Button className="w-full" onClick={() => {
          setSession();
          posthog.capture('account_signed_up');
          navigate('/onboarding/language');
        }}>
          {t.common.continue}
        </Button>
        <p className="mt-5 text-center text-sm text-ink-500">
          {t.auth.haveAccount}{' '}
          <Link to="/auth/login" className="font-medium text-jade-700 underline">{t.common.signIn}</Link>
        </p>
      </Card>
    </AuthLayout>
  );
}

export function Login() {
  const { t } = useI18n();
  const { navigate } = useNav();
  return (
    <AuthLayout>
      <Card className="p-7">
        <h1 className="mb-6 font-display text-2xl font-semibold">{t.auth.loginTitle}</h1>
        <Field id="lemail" label={t.auth.email}><Input id="lemail" type="email" /></Field>
        <Field id="lpw" label={t.auth.password}><Input id="lpw" type="password" /></Field>
        <Button className="w-full" onClick={() => {
          setSession();
          posthog.capture('account_logged_in');
          navigate('/app/dashboard');
        }}>{t.common.signIn}</Button>
        <p className="mt-5 text-center text-sm text-ink-500">
          {t.auth.noAccount}{' '}
          <Link to="/auth/sign-up" className="font-medium text-jade-700 underline">{t.common.signUp}</Link>
        </p>
      </Card>
    </AuthLayout>
  );
}

// ═══ 4 & 5. Onboarding, including industry selection ═══════════════════════

const ENTITY_TYPES: EntityType[] = [
  'sole_proprietor', 'single_member_llc', 'multi_member_llc',
  'partnership', 's_corporation', 'unknown',
];

export function Onboarding({
  step, onIndustry,
}: { step: string; onIndustry: (i: Industry) => void }) {
  const { t } = useI18n();
  const { navigate } = useNav();
  const [entity, setEntity] = useState<EntityType>('single_member_llc');
  const STEPS = ['language', 'owner', 'business', 'industry', 'entity', 'connections', 'complete'];
  const idx = Math.max(1, STEPS.indexOf(step) + 1);
  const next = (to: string) => navigate(`/onboarding/${to}`);

  const titles: Record<string, string> = {
    language: t.onboarding.languageTitle,
    owner: t.onboarding.ownerTitle,
    business: t.onboarding.businessTitle,
    industry: t.onboarding.industryTitle,
    entity: t.onboarding.entityTitle,
    connections: t.onboarding.connectionsTitle,
    complete: t.onboarding.completeTitle,
  };

  return (
    <OnboardingLayout step={idx} total={STEPS.length} title={titles[step] ?? ''}>
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
          <Field id="oname" label={t.auth.ownerName}><Input id="oname" /></Field>
          <Field id="ophone" label={t.auth.phone}><Input id="ophone" /></Field>
          <Button className="w-full" onClick={() => next('business')}>{t.common.continue}</Button>
        </Card>
      )}

      {step === 'business' && (
        <Card className="p-6">
          <Field id="bname" label={t.onboarding.businessName}><Input id="bname" /></Field>
          <Field id="dba" label={t.onboarding.dbaName}><Input id="dba" /></Field>
          <Field id="addr" label={t.onboarding.address} hint={t.onboarding.localityNote}>
            <Input id="addr" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="city" label={t.onboarding.city}><Input id="city" /></Field>
            <Field id="state" label={t.onboarding.state}><Input id="state" /></Field>
            <Field id="zip" label={t.onboarding.postal}><Input id="zip" /></Field>
          </div>
          <Button className="w-full" onClick={() => next('industry')}>{t.common.continue}</Button>
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
              onClick={() => {
                onIndustry(key);
                posthog.capture('onboarding_industry_selected', { industry: key });
                next('entity');
              }}
              className="rounded-2xl border border-line bg-white p-6 text-left transition hover:border-jade-600"
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
                  (entity === e ? 'border-jade-600 bg-jade-50' : 'border-line')
                }
              >
                <input
                  type="radio" name="entity" value={e} checked={entity === e}
                  onChange={() => setEntity(e)} className="accent-jade-700"
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
          <Button onClick={() => {
            setSession();
            posthog.capture('onboarding_completed');
            navigate('/app/dashboard');
          }}>{t.nav.dashboard}</Button>
        </Card>
      )}
    </OnboardingLayout>
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

