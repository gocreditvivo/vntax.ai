import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../app/App';
import { en } from '../i18n/en';
import { vi } from '../i18n/vi';

describe('locale default', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('loads English by default', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: en.marketing.heroTitle })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('keeps Vietnamese available through an explicit user choice', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: en.common.language }));

    expect(await screen.findByRole('heading', { name: vi.marketing.heroTitle })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('vi');
    expect(window.localStorage.getItem('vntax.locale')).toBe('vi');
  });

  it('allows direct locked auth pages to switch to Vietnamese', async () => {
    const user = userEvent.setup();
    render(<App initialPath="/auth/login" />);

    expect(await screen.findByRole('heading', { name: en.states.productUnavailableTitle })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: en.common.language }));

    expect(await screen.findByRole('heading', { name: vi.states.productUnavailableTitle })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('vi');
  });

  it('sets Vietnamese from the onboarding language choice when onboarding is available', async () => {
    const user = userEvent.setup();
    render(<App initialPath="/onboarding/language" initialLocale="en" />);

    await user.click(await screen.findByText('Tiếng Việt'));

    expect(await screen.findByRole('heading', { name: vi.onboarding.ownerTitle })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('vi');
    expect(window.localStorage.getItem('vntax.locale')).toBe('vi');
  });

  it('honors a previously saved Vietnamese choice', async () => {
    window.localStorage.setItem('vntax.locale', 'vi');

    render(<App />);

    expect(await screen.findByRole('heading', { name: vi.marketing.heroTitle })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('vi');
  });
});
