/**
 * Chat Guide - conversational onboarding.
 *
 * A SCRIPTED guide. Every message is authored copy from CHAT_SCRIPT below.
 * There is no language model here and no free-text generation. This is a
 * deliberate safety boundary: a scripted guide can explain a term or walk a
 * step, but it cannot generate tax advice or predict an outcome, because it can
 * only say what is written here.
 *
 * DO NOT wire this to an LLM without: (a) a backend, (b) a credentialed
 * reviewer for generated content, and (c) legal review.
 *
 * Uses the app's existing i18n locale (en / vi) so the guide follows the
 * language the customer already chose. Spanish falls back to English until the
 * script is translated.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useI18n } from '../../i18n';
import type { Locale } from '../../types';
import { TAX_BRAIN, ROUTE_TO_HUMAN } from './taxBrain';
import type { TaxTermKey, ScriptLocale as BrainLocale } from './taxBrain';

type ReplyStyle = 'default' | 'snap';

interface Reply {
  emoji?: string;
  label: string;
  style?: ReplyStyle;
}

interface LearnChip {
  key: TaxTermKey;
  label: string;
}

interface Step {
  bot: string;
  learn?: LearnChip;
  replies: Reply[];
}

type ScriptLocale = 'en' | 'vi';

// glossary popups: plain-language, IRS-sourced, no advice
// Chip keys now reference the shared TAX_BRAIN (see taxBrain.ts).

// the conversation script
const CHAT_SCRIPT: Record<ScriptLocale, Step[]> = {
  en: [
    {
      bot: "Hi! I'm here to help you get your taxes organized \u2014 no stress. \u{1F60A} First, what kind of work do you do?",
      replies: [
        { emoji: '\u{1F485}', label: 'I own a nail salon' },
        { emoji: '\u{1F35C}', label: 'I have a restaurant' },
        { emoji: '\u{1F697}', label: 'I drive or deliver' },
        { emoji: '\u{1F527}', label: 'I do contract work' },
      ],
    },
    {
      bot: 'Great \u2014 I help a lot of salon owners. \u{1F485} How do most of your payments come in?',
      learn: { key: 'form1099nec', label: "What's a 1099?" },
      replies: [
        { emoji: '\u{1F4B3}', label: 'Card or app payments' },
        { emoji: '\u{1F4C4}', label: 'A company pays me' },
        { emoji: '\u{1F9FE}', label: 'I invoice my clients' },
        { emoji: '\u{1F937}', label: 'A mix of these' },
      ],
    },
    {
      bot: 'Synthetic walkthrough only: this guide does not accept or read files. Choose a fictional sample to preview the planned review step.',
      learn: { key: 'formW2', label: "What's a W-2?" },
      replies: [
        { emoji: '\u{1F4F7}', label: 'Use sample photo', style: 'snap' },
        { emoji: '\u{1F4C1}', label: 'Use sample upload' },
        { emoji: '\u23ED\uFE0F', label: 'Skip sample' },
      ],
    },
    {
      bot: "Sample preview only \u2014 no file was read or saved. A future review could look like this:\n\n\u{1F4C4} Fictional 1099-NEC \u00B7 income \u00B7 $6,900\n\u{1F9FE} Fictional supply receipt \u00B7 expense \u00B7 $84",
      learn: { key: 'expense', label: "What's an expense?" },
      replies: [
        { emoji: '\u2705', label: 'Yes, that looks right' },
        { emoji: '\u270F\uFE0F', label: 'I need to fix something' },
      ],
    },
    {
      bot: 'One planning concept: some self-employed people may need estimated payments during the year. This demo does not calculate a requirement or send reminders; current dates and your facts must be verified.',
      learn: { key: 'quarterly', label: 'Why a few times a year?' },
      replies: [{ emoji: '\u{1F44D}', label: 'Good to know' }],
    },
    {
      bot: "That's the end of the synthetic guide. No papers were stored and no human review request was created.",
      replies: [{ emoji: '\u{1F3E0}', label: 'Open synthetic dashboard' }],
    },
  ],
  vi: [
    {
      bot: 'Ch\u00E0o b\u1EA1n! T\u00F4i \u1EDF \u0111\u00E2y \u0111\u1EC3 gi\u00FAp b\u1EA1n s\u1EAFp x\u1EBFp thu\u1EBF \u2014 \u0111\u1EEBng lo. \u{1F60A} Tr\u01B0\u1EDBc ti\u00EAn, b\u1EA1n l\u00E0m ngh\u1EC1 g\u00EC?',
      replies: [
        { emoji: '\u{1F485}', label: 'T\u00F4i c\u00F3 ti\u1EC7m nail' },
        { emoji: '\u{1F35C}', label: 'T\u00F4i c\u00F3 nh\u00E0 h\u00E0ng' },
        { emoji: '\u{1F697}', label: 'T\u00F4i ch\u1EA1y xe / giao h\u00E0ng' },
        { emoji: '\u{1F527}', label: 'T\u00F4i l\u00E0m th\u1EA7u' },
      ],
    },
    {
      bot: 'Tuy\u1EC7t \u2014 t\u00F4i gi\u00FAp r\u1EA5t nhi\u1EC1u ch\u1EE7 ti\u1EC7m nail. \u{1F485} Ph\u1EA7n l\u1EDBn ti\u1EC1n c\u1EE7a b\u1EA1n \u0111\u1EBFn b\u1EB1ng c\u00E1ch n\u00E0o?',
      learn: { key: 'form1099nec', label: '1099 l\u00E0 g\u00EC?' },
      replies: [
        { emoji: '\u{1F4B3}', label: 'Th\u1EBB ho\u1EB7c app' },
        { emoji: '\u{1F4C4}', label: 'M\u1ED9t c\u00F4ng ty tr\u1EA3 t\u00F4i' },
        { emoji: '\u{1F9FE}', label: 'T\u00F4i xu\u1EA5t h\u00F3a \u0111\u01A1n cho kh\u00E1ch' },
        { emoji: '\u{1F937}', label: 'Nhi\u1EC1u th\u1EE9' },
      ],
    },
    {
      bot: 'Ch\u1EC9 l\u00E0 ph\u1EA7n xem th\u1EED gi\u1EA3 l\u1EADp: h\u01B0\u1EDBng d\u1EABn n\u00E0y kh\u00F4ng nh\u1EADn ho\u1EB7c \u0111\u1ECDc t\u1EC7p. Ch\u1ECDn m\u1ED9t m\u1EABu h\u01B0 c\u1EA5u \u0111\u1EC3 xem b\u01B0\u1EDBc ki\u1EC3m tra d\u1EF1 ki\u1EBFn.',
      learn: { key: 'formW2', label: 'W-2 l\u00E0 g\u00EC?' },
      replies: [
        { emoji: '\u{1F4F7}', label: 'D\u00F9ng h\u00ECnh m\u1EABu', style: 'snap' },
        { emoji: '\u{1F4C1}', label: 'D\u00F9ng t\u1EC7p m\u1EABu' },
        { emoji: '\u23ED\uFE0F', label: 'B\u1ECF qua m\u1EABu' },
      ],
    },
    {
      bot: 'Ch\u1EC9 l\u00E0 m\u1EABu xem th\u1EED \u2014 kh\u00F4ng c\u00F3 t\u1EC7p n\u00E0o \u0111\u01B0\u1EE3c \u0111\u1ECDc hay l\u01B0u. B\u01B0\u1EDBc ki\u1EC3m tra sau n\u00E0y c\u00F3 th\u1EC3 tr\u00F4ng nh\u01B0 sau:\n\n\u{1F4C4} 1099-NEC h\u01B0 c\u1EA5u \u00B7 thu nh\u1EADp \u00B7 $6,900\n\u{1F9FE} Bi\u00EAn lai h\u01B0 c\u1EA5u \u00B7 chi ph\u00ED \u00B7 $84',
      learn: { key: 'expense', label: 'Chi ph\u00ED l\u00E0 g\u00EC?' },
      replies: [
        { emoji: '\u2705', label: '\u0110\u00FAng r\u1ED3i' },
        { emoji: '\u270F\uFE0F', label: 'T\u00F4i c\u1EA7n s\u1EEDa' },
      ],
    },
    {
      bot: 'M\u1ED9t kh\u00E1i ni\u1EC7m \u0111\u1EC3 chu\u1EA9n b\u1ECB: m\u1ED9t s\u1ED1 ng\u01B0\u1EDDi t\u1EF1 l\u00E0m ch\u1EE7 c\u00F3 th\u1EC3 ph\u1EA3i \u0111\u00F3ng thu\u1EBF t\u1EA1m t\u00EDnh trong n\u0103m. B\u1EA3n m\u1EABu n\u00E0y kh\u00F4ng x\u00E1c \u0111\u1ECBnh ngh\u0129a v\u1EE5 hay g\u1EEDi nh\u1EAFc nh\u1EDF; c\u1EA7n ki\u1EC3m tra ng\u00E0y hi\u1EC7n h\u00E0nh v\u00E0 ho\u00E0n c\u1EA3nh th\u1EF1c t\u1EBF.',
      learn: { key: 'quarterly', label: 'V\u00EC sao v\u00E0i l\u1EA7n m\u1ED9t n\u0103m?' },
      replies: [{ emoji: '\u{1F44D}', label: 'Hay \u0111\u00F3' }],
    },
    {
      bot: 'Ph\u1EA7n h\u01B0\u1EDBng d\u1EABn gi\u1EA3 l\u1EADp \u0111\u00E3 xong. Kh\u00F4ng c\u00F3 gi\u1EA5y t\u1EDD n\u00E0o \u0111\u01B0\u1EE3c l\u01B0u v\u00E0 kh\u00F4ng c\u00F3 y\u00EAu c\u1EA7u ng\u01B0\u1EDDi th\u1EADt xem l\u1EA1i.',
      replies: [{ emoji: '\u{1F3E0}', label: 'M\u1EDF trang gi\u1EA3 l\u1EADp' }],
    },
  ],
};

const UI: Record<ScriptLocale, { guide: string; status: string; opening: string; close: string; restart: string }> = {
  en: { guide: 'VNTax Guide', status: 'here to help', opening: 'Opening your dashboard\u2026 \u{1F338}', close: 'Got it', restart: 'Start over' },
  vi: { guide: 'H\u01B0\u1EDBng d\u1EABn VNTax', status: 's\u1EB5n s\u00E0ng gi\u00FAp', opening: '\u0110ang m\u1EDF trang c\u1EE7a b\u1EA1n\u2026 \u{1F338}', close: '\u0110\u00E3 hi\u1EC3u', restart: 'B\u1EAFt \u0111\u1EA7u l\u1EA1i' },
};

function scriptLocale(locale: Locale): ScriptLocale {
  return locale === 'vi' ? 'vi' : 'en';
}

interface Bubble {
  from: 'bot' | 'me';
  text: string;
  learn?: LearnChip;
}

export function ChatGuide({ onComplete }: { onComplete?: () => void }) {
  const { locale } = useI18n();
  const sl = scriptLocale(locale);
  const script = CHAT_SCRIPT[sl];
  const ui = UI[sl];

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(false);
  const [popup, setPopup] = useState<TaxTermKey | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    setBubbles([]);
    setStep(0);
    setTyping(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setTyping(false);
      setBubbles([{ from: 'bot', text: script[0].bot, learn: script[0].learn }]);
    }, 700);
  }, [script]);

  useEffect(() => {
    start();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [start]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, typing]);

  const pick = (label: string) => {
    const next = step + 1;
    setBubbles((b) => [...b, { from: 'me', text: label }]);
    if (next < script.length) {
      setTyping(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setTyping(false);
        setBubbles((b) => [...b, { from: 'bot', text: script[next].bot, learn: script[next].learn }]);
        setStep(next);
      }, 850);
    } else {
      setBubbles((b) => [...b, { from: 'bot', text: ui.opening }]);
      onComplete?.();
    }
  };

  const current = step < script.length ? script[step] : null;
  const showReplies =
    !typing && current !== null && bubbles.length > 0 && bubbles[bubbles.length - 1].from === 'bot';
  const brainLocale: BrainLocale = sl;
  const g = popup ? TAX_BRAIN[popup][brainLocale] : null;

  return (
    <div className="mx-auto flex h-[680px] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-line bg-[#F7FAF8] shadow-xl">
      <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-4">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-jade-600 to-clay-500 text-xl">
          {'\u{1F338}'}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-ink-900">{ui.guide}</p>
          <p className="text-xs font-semibold text-jade-600">
            {'\u25CF'} {ui.status}
          </p>
        </div>
        <button
          type="button"
          onClick={start}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-cream"
        >
          {ui.restart}
        </button>
      </div>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-5">
        {bubbles.map((b, i) => (
          <div
            key={i}
            className={`max-w-[82%] whitespace-pre-line rounded-2xl px-4 py-3 text-[0.98rem] ${
              b.from === 'bot'
                ? 'self-start rounded-bl-sm border border-line bg-white text-ink-900'
                : 'self-end rounded-br-sm bg-jade-600 font-medium text-white'
            }`}
          >
            {b.text}
            {b.learn && (
              <button
                type="button"
                onClick={() => setPopup(b.learn!.key)}
                className="mt-2 flex items-center gap-1.5 rounded-full border border-navy-100 bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-800"
              >
                ? {b.learn.label}
              </button>
            )}
          </div>
        ))}
        {typing && (
          <div className="flex gap-1 self-start rounded-2xl rounded-bl-sm border border-line bg-white px-4 py-3.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {showReplies && current && (
        <div className="flex flex-col gap-2 border-t border-line bg-[#F7FAF8] px-4 py-4">
          {current.replies.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(r.label)}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition hover:-translate-y-px ${
                r.style === 'snap'
                  ? 'justify-center border-clay-100 bg-clay-50 text-clay-700 hover:border-clay-500 hover:bg-clay-100'
                  : 'border-jade-50 bg-white text-jade-800 hover:border-jade-600 hover:bg-jade-50'
              }`}
            >
              {r.emoji && r.style !== 'snap' && <span className="text-xl">{r.emoji}</span>}
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      )}

      {g && popup && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center bg-ink-900/40"
          onClick={() => setPopup(null)}
        >
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-3xl">{TAX_BRAIN[popup].emoji}</div>
            <h4 className="mt-2 text-xl font-bold text-ink-900">{g.title}</h4>
            <p className="mt-2 text-ink-700">{g.body}</p>
            <p className="mt-3 rounded-xl border border-jade-100 bg-jade-50 px-3 py-2 text-sm text-jade-800">
              {ROUTE_TO_HUMAN[brainLocale]}
            </p>
            <p className="mt-3 text-xs text-ink-500">{g.source}</p>
            <button
              type="button"
              onClick={() => setPopup(null)}
              className="mt-5 w-full rounded-xl bg-ink-900 py-3.5 font-semibold text-white"
            >
              {ui.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
