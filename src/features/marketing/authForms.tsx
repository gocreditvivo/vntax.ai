/**
 * Sign-up and login.
 *
 * These forms previously ignored their inputs entirely and set a fake session
 * on click. Everything here is now a real credential exchange with Supabase.
 *
 * Deliberate behaviours, each with a reason:
 *
 * - **Native <form> with onSubmit**, not a click handler. Pressing Enter in a
 *   password field must submit. Owners fill these on phones, where the
 *   keyboard's "go" key is the natural way to finish.
 * - **Field-level errors clear on edit.** Leaving a stale "wrong password"
 *   under a field the user has since corrected is actively misleading.
 * - **The submit button is disabled while in flight** and the busy state is
 *   announced, so a slow connection cannot produce two signup attempts.
 * - **No credential values are ever logged**, and no error `detail` is
 *   rendered — only the translated code.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useI18n } from '../../i18n';
import { Link, useNav } from '../../app/router';
import { useAuth } from '../../auth/AuthProvider';
import { isValidEmail, isValidPassword, type AuthErrorCode } from '../../auth/errors';
import { sendPasswordReset } from '../../auth/session';
import { AuthLayout } from '../../layouts';
import { Button, Card, Field, FormError, FormNotice, Input } from '../../components/ui';

/** Translates an error code. Never renders the raw server message. */
function useAuthMessage() {
  const { t } = useI18n();
  return (code: AuthErrorCode): string => t.auth.errors[code] ?? t.auth.errors.unknown;
}

// ─── sign up ───────────────────────────────────────────────────────────────

export function SignUp() {
  const { t, locale } = useI18n();
  const { navigate } = useNav();
  const { signUp } = useAuth();
  const message = useAuthMessage();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  /** Client-side pass, so obvious problems are caught without a round trip. */
  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = message('required_fields');
    if (!email.trim()) errors.email = message('required_fields');
    else if (!isValidEmail(email)) errors.email = message('invalid_email');
    if (!password) errors.pw = message('required_fields');
    else if (!isValidPassword(password)) errors.pw = message('weak_password');

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    setFormError(null);
    if (!validate()) return;

    setBusy(true);
    const result = await signUp({
      email, password, displayName: name, phone, locale,
    });
    setBusy(false);

    if (!result.ok) {
      // An email collision belongs beside the email field; everything else is
      // a property of the submission as a whole.
      if (result.error.code === 'email_taken' || result.error.code === 'invalid_email') {
        setFieldErrors({ email: message(result.error.code) });
      } else if (result.error.code === 'weak_password') {
        setFieldErrors({ pw: message(result.error.code) });
      } else {
        setFormError(message(result.error.code));
      }
      return;
    }

    // No session means the project requires email confirmation. Navigating
    // into the app here would land the user on a guarded route with no
    // session and bounce them straight back to login with no explanation.
    if (result.data.needsEmailConfirmation) {
      setConfirmSent(true);
      return;
    }

    navigate('/onboarding/business');
  }

  if (confirmSent) {
    return (
      <AuthLayout>
        <Card className="p-7">
          <h1 className="display-section mb-3 text-2xl">{t.auth.confirmEmailTitle}</h1>
          <p className="text-content-muted">{t.auth.confirmEmailBody}</p>
          <p className="mt-6 text-center text-sm text-ink-500">
            <Link to="/auth/login" className="font-medium text-jade-700 underline">
              {t.common.signIn}
            </Link>
          </p>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card className="p-7">
        <h1 className="display-section mb-6 text-2xl">{t.auth.signUpTitle}</h1>

        {formError && <FormError message={formError} />}

        <form onSubmit={onSubmit} noValidate>
          <Field id="name" label={t.auth.ownerName} error={fieldErrors.name}>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: '' })); }}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              disabled={busy}
            />
          </Field>

          <Field id="email" label={t.auth.email} error={fieldErrors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              // inputMode + autoCapitalize matter on phones: the default
              // keyboard capitalises the first letter, producing addresses
              // that fail sign-in later in ways users cannot see.
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: '' })); }}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              disabled={busy}
            />
          </Field>

          <Field id="phone" label={t.auth.phone} hint={t.auth.mfaNote}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
            />
          </Field>

          <Field id="pw" label={t.auth.password} hint={t.auth.passwordHint} error={fieldErrors.pw}>
            <Input
              id="pw"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, pw: '' })); }}
              aria-invalid={!!fieldErrors.pw}
              aria-describedby={fieldErrors.pw ? 'pw-error' : undefined}
              disabled={busy}
            />
          </Field>

          <Button type="submit" className="w-full" disabled={busy} aria-busy={busy}>
            {busy ? t.auth.creatingAccount : t.common.continue}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-500">
          {t.auth.haveAccount}{' '}
          <Link to="/auth/login" className="font-medium text-jade-700 underline">{t.common.signIn}</Link>
        </p>
      </Card>
    </AuthLayout>
  );
}

// ─── login ─────────────────────────────────────────────────────────────────

export function Login() {
  const { t } = useI18n();
  const { navigate } = useNav();
  const { signIn } = useAuth();
  const message = useAuthMessage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    setFormError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setFormError(message('required_fields'));
      return;
    }

    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);

    if (!result.ok) {
      // Every sign-in failure is form-level, never field-level. Marking the
      // email field specifically would confirm which addresses have accounts.
      setFormError(message(result.error.code));
      return;
    }

    navigate('/app/dashboard');
  }

  async function onReset() {
    setFormError(null);
    setNotice(null);

    if (!isValidEmail(email)) {
      setFormError(message('invalid_email'));
      return;
    }

    setBusy(true);
    const result = await sendPasswordReset(email);
    setBusy(false);

    // Deliberately identical on success and on "no such user": the copy says
    // "if that email has an account", so the response cannot be used to test
    // whether an address is registered.
    if (!result.ok && result.error.code !== 'unknown') {
      setFormError(message(result.error.code));
      return;
    }
    setNotice(t.auth.resetSent);
  }

  return (
    <AuthLayout>
      <Card className="p-7">
        <h1 className="display-section mb-6 text-2xl">{t.auth.loginTitle}</h1>

        {formError && <FormError message={formError} />}
        {notice && <FormNotice message={notice} />}

        <form onSubmit={onSubmit} noValidate>
          <Field id="lemail" label={t.auth.email}>
            <Input
              id="lemail"
              name="email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </Field>

          <Field id="lpw" label={t.auth.password}>
            <Input
              id="lpw"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </Field>

          <Button type="submit" className="w-full" disabled={busy} aria-busy={busy}>
            {busy ? t.auth.signingIn : t.common.signIn}
          </Button>
        </form>

        <p className="mt-4 text-center">
          <button
            type="button"
            onClick={() => void onReset()}
            disabled={busy}
            className="text-sm text-content-muted underline hover:text-content-primary disabled:opacity-50"
          >
            {t.auth.forgotPassword}
          </button>
        </p>

        <p className="mt-5 text-center text-sm text-ink-500">
          {t.auth.noAccount}{' '}
          <Link to="/auth/sign-up" className="font-medium text-jade-700 underline">{t.common.signUp}</Link>
        </p>
      </Card>
    </AuthLayout>
  );
}
