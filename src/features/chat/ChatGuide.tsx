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

type ReplyStyle = 'default' | 'snap';

interface Reply {
  emoji?: string;
  label: string;
  style?: ReplyStyle;
}

interface LearnChip {
  key: keyof typeof GLOSSARY;
  label: string;
}

interface Step {
  bot: string;
  learn?: LearnChip;
  replies: Reply[];
}

type ScriptLocale = 'en' | 'vi';

// glossary popups: plain-language, IRS-sourced, no advice
const GLOSSARY = {
  form1099: {
    emoji: '\u{1F4C4}',
    en: {
      title: 'A 1099 is a form',
      body: 'A company sends it to you and the IRS to show what they paid you during the year. Drivers and contractors usually get one.',
      source: 'Source: IRS \u2014 About Form 1099',
    },
    vi: {
      title: '1099 l\u00E0 m\u1ED9t m\u1EABu \u0111\u01A1n',
      body: 'C\u00F4ng ty g\u1EEDi cho b\u1EA1n v\u00E0 IRS \u0111\u1EC3 cho bi\u1EBFt h\u1ECD \u0111\u00E3 tr\u1EA3 b\u1EA1n bao nhi\u00EAu trong n\u0103m. T\u00E0i x\u1EBF v\u00E0 th\u1EA7u kho\u00E1n th\u01B0\u1EDDng nh\u1EADn \u0111\u01B0\u1EE3c m\u1ED9t t\u1EDD.',
      source: 'Ngu\u1ED3n: IRS \u2014 About Form 1099',
    },
  },
  formW2: {
    emoji: '\u{1F4CB}',
    en: {
      title: 'A W-2 is from your employer',
      body: 'From a regular job. It shows your pay and the tax already taken out for you.',
      source: 'Source: IRS \u2014 About Form W-2',
    },
    vi: {
      title: 'W-2 l\u00E0 t\u1EEB ch\u1EE7 c\u1EE7a b\u1EA1n',
      body: 'T\u1EEB m\u1ED9t c\u00F4ng vi\u1EC7c th\u01B0\u1EDDng xuy\u00EAn. N\u00F3 cho bi\u1EBFt ti\u1EC1n l\u01B0\u01A1ng v\u00E0 ti\u1EC1n thu\u1EBF \u0111\u00E3 \u0111\u01B0\u1EE3c tr\u1EEB gi\u00FAp b\u1EA1n.',
      source: 'Ngu\u1ED3n: IRS \u2014 About Form W-2',
    },
  },
  expense: {
    emoji: '\u{1F9FE}',
    en: {
      title: 'A business expense',
      body: 'Money you spend to run your work \u2014 supplies, gas, tools. Keeping the receipts helps when it is time to organize.',
      source: 'Source: IRS \u2014 Publication 535',
    },
    vi: {
      title: 'Chi ph\u00ED kinh doanh',
      body: 'Ti\u1EC1n b\u1EA1n chi \u0111\u1EC3 l\u00E0m vi\u1EC7c \u2014 v\u1EADt t\u01B0, x\u0103ng, d\u1EE5ng c\u1EE5. Gi\u1EEF bi\u00EAn lai s\u1EBD gi\u00FAp \u00EDch khi s\u1EAFp x\u1EBFp.',
      source: 'Ngu\u1ED3n: IRS \u2014 Publication 535',
    },
  },
  quarterly: {
    emoji: '\u{1F4C5}',
    en: {
      title: 'Why a few times a year?',
      body: 'When no employer takes tax out for you, the IRS asks you to pay a little every few months instead of once. We track the dates for you.',
      source: 'Source: IRS \u2014 Estimated Taxes',
    },
    vi: {
      title: 'V\u00EC sao v\u00E0i l\u1EA7n m\u1ED9t n\u0103m?',
      body: 'Khi kh\u00F4ng c\u00F3 ch\u1EE7 tr\u1EEB thu\u1EBF gi\u00FAp b\u1EA1n, IRS y\u00EAu c\u1EA7u b\u1EA1n \u0111\u00F3ng m\u1ED9t \u00EDt m\u1ED7i v\u00E0i th\u00E1ng thay v\u00EC m\u1ED9t l\u1EA7n. Ch\u00FAng t\u00F4i theo d\u00F5i ng\u00E0y gi\u00FAp b\u1EA1n.',
      source: 'Ngu\u1ED3n: IRS \u2014 Estimated Taxes',
    },
  },
} as const;

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
      learn: { key: 'form1099', label: "What's a 1099?" },
      replies: [
        { emoji: '\u{1F4B3}', label: 'Card or app payments' },
        { emoji: '\u{1F4C4}', label: 'A company pays me' },
        { emoji: '\u{1F9FE}', label: 'I invoice my clients' },
        { emoji: '\u{1F937}', label: 'A mix of these' },
      ],
    },
    {
      bot: "Perfect, thank you. Now let's get one paper in. You don't have to type anything \u2014 just snap a photo and I'll read it for you.",
      learn: { key: 'formW2', label: "What's a W-2?" },
      replies: [
        { emoji: '\u{1F4F7}', label: 'Take a photo', style: 'snap' },
        { emoji: '\u{1F4C1}', label: 'Upload instead' },
        { emoji: '\u23ED\uFE0F', label: "I'll do this later" },
      ],
    },
    {
      bot: "Got it! \u{1F389} I read your form. Here's what I found \u2014 have a look and tell me if it looks right:\n\n\u{1F4C4} 1099-NEC \u00B7 income \u00B7 $6,900\n\u{1F9FE} Supply receipt \u00B7 expense \u00B7 $84",
      learn: { key: 'expense', label: "What's an expense?" },
      replies: [
        { emoji: '\u2705', label: 'Yes, that looks right' },
        { emoji: '\u270F\uFE0F', label: 'I need to fix something' },
      ],
    },
    {
      bot: "One helpful thing to know: because you work for yourself, taxes are paid a few times a year, not just in April. Don't worry \u2014 I'll remind you. \u{1F514} Your next date is September 15.",
      learn: { key: 'quarterly', label: 'Why a few times a year?' },
      replies: [{ emoji: '\u{1F44D}', label: 'Good to know' }],
    },
    {
      bot: "That's everything for now! \u{1F337} Your papers are organized and in one place. Anything tricky, a real person on our team reviews it \u2014 you're never on your own with this.",
      replies: [{ emoji: '\u{1F3E0}', label: 'Go to my dashboard' }],
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
      learn: { key: 'form1099', label: '1099 l\u00E0 g\u00EC?' },
      replies: [
        { emoji: '\u{1F4B3}', label: 'Th\u1EBB ho\u1EB7c app' },
        { emoji: '\u{1F4C4}', label: 'M\u1ED9t c\u00F4ng ty tr\u1EA3 t\u00F4i' },
        { emoji: '\u{1F9FE}', label: 'T\u00F4i xu\u1EA5t h\u00F3a \u0111\u01A1n cho kh\u00E1ch' },
        { emoji: '\u{1F937}', label: 'Nhi\u1EC1u th\u1EE9' },
      ],
    },
    {
      bot: 'T\u1ED1t l\u1EAFm, c\u1EA3m \u01A1n b\u1EA1n. Gi\u1EDD th\u00EAm m\u1ED9t t\u1EDD gi\u1EA5y nh\u00E9. B\u1EA1n kh\u00F4ng c\u1EA7n g\u00F5 g\u00EC c\u1EA3 \u2014 ch\u1EC9 c\u1EA7n ch\u1EE5p h\u00ECnh, t\u00F4i s\u1EBD \u0111\u1ECDc gi\u00FAp.',
      learn: { key: 'formW2', label: 'W-2 l\u00E0 g\u00EC?' },
      replies: [
        { emoji: '\u{1F4F7}', label: 'Ch\u1EE5p h\u00ECnh', style: 'snap' },
        { emoji: '\u{1F4C1}', label: 'T\u1EA3i l\u00EAn' },
        { emoji: '\u23ED\uFE0F', label: '\u0110\u1EC3 sau' },
      ],
    },
    {
      bot: '\u0110\u01B0\u1EE3c r\u1ED3i! \u{1F389} T\u00F4i \u0111\u00E3 \u0111\u1ECDc t\u1EDD gi\u1EA5y. \u0110\u00E2y l\u00E0 nh\u1EEFng g\u00EC t\u00F4i th\u1EA5y \u2014 xem gi\u00FAp c\u00F3 \u0111\u00FAng kh\u00F4ng:\n\n\u{1F4C4} 1099-NEC \u00B7 thu nh\u1EADp \u00B7 $6,900\n\u{1F9FE} Bi\u00EAn lai v\u1EADt t\u01B0 \u00B7 chi ph\u00ED \u00B7 $84',
      learn: { key: 'expense', label: 'Chi ph\u00ED l\u00E0 g\u00EC?' },
      replies: [
        { emoji: '\u2705', label: '\u0110\u00FAng r\u1ED3i' },
        { emoji: '\u270F\uFE0F', label: 'T\u00F4i c\u1EA7n s\u1EEDa' },
      ],
    },
    {
      bot: 'M\u1ED9t \u0111i\u1EC1u h\u1EEFu \u00EDch: v\u00EC b\u1EA1n t\u1EF1 l\u00E0m ch\u1EE7, thu\u1EBF \u0111\u00F3ng v\u00E0i l\u1EA7n m\u1ED9t n\u0103m, kh\u00F4ng ch\u1EC9 th\u00E1ng T\u01B0. \u0110\u1EEBng lo \u2014 t\u00F4i s\u1EBD nh\u1EAFc. \u{1F514} Ng\u00E0y k\u1EBF c\u1EE7a b\u1EA1n l\u00E0 15 th\u00E1ng 9.',
      learn: { key: 'quarterly', label: 'V\u00EC sao v\u00E0i l\u1EA7n m\u1ED9t n\u0103m?' },
      replies: [{ emoji: '\u{1F44D}', label: 'Hay \u0111\u00F3' }],
    },
    {
      bot: 'V\u1EADy l\u00E0 xong! \u{1F337} Gi\u1EA5y t\u1EDD c\u1EE7a b\u1EA1n \u0111\u00E3 g\u1ECDn m\u1ED9t ch\u1ED7. Vi\u1EC7c g\u00EC kh\u00F3, m\u1ED9t ng\u01B0\u1EDDi th\u1EADt trong nh\u00F3m s\u1EBD xem \u2014 b\u1EA1n kh\u00F4ng bao gi\u1EDD ph\u1EA3i t\u1EF1 lo m\u1ED9t m\u00ECnh.',
      replies: [{ emoji: '\u{1F3E0}', label: 'T\u1EDBi trang c\u1EE7a t\u00F4i' }],
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
  const [popup, setPopup] = useState<keyof typeof GLOSSARY | null>(null);
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
  const g = popup ? GLOSSARY[popup][sl] : null;

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
            <div className="text-3xl">{GLOSSARY[popup].emoji}</div>
            <h4 className="mt-2 text-xl font-bold text-ink-900">{g.title}</h4>
            <p className="mt-2 text-ink-700">{g.body}</p>
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
