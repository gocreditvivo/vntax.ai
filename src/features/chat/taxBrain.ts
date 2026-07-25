/**
 * Tax Explainer Brain - the bot's knowledge.
 *
 * SAFETY BOUNDARY (read before editing):
 * Every entry here EXPLAINS a concept. None applies a concept to a person's
 * situation. That distinction is the whole legal boundary:
 *
 *   Explaining "what a deduction is"          -> teaching, safe, no credential
 *   Telling someone "you should deduct X"     -> advice, requires a credentialed
 *                                                preparer (EA/CPA/attorney)
 *
 * So every entry ends by routing any decision to a human ("routeToHuman").
 * The bot has the eyes of a professional (it knows what to explain) but never
 * the mouth of one (it never tells you what to do). Do not add an entry that
 * tells the reader what to claim, elect, or file, or that predicts a number
 * for their situation. If an entry starts to sound like advice, it is advice.
 *
 * Vietnamese is written in the hybrid register the community actually uses:
 * Vietnamese sentences with the English tax terms kept inline (form 1099,
 * deduction, W-2), because that is how these words are really spoken. It still
 * needs review by a native speaker who knows these trades before launch.
 *
 * Sources are IRS references. Figures that change year to year (rates,
 * thresholds) are deliberately NOT stated as numbers - they are described, with
 * a note to check the current figure - so the content does not go stale or
 * imply a calculation. Items needing a verified current figure are marked TODO.
 */

export type ScriptLocale = 'en' | 'vi';

export interface Explainer {
  emoji: string;
  category: 'forms' | 'income' | 'expenses' | 'deadlines' | 'workers' | 'tips' | 'basics';
  en: { title: string; body: string; source: string };
  vi: { title: string; body: string; source: string };
  /** Shown at the end of every explainer. The routing line, localized. */
}

/** The universal routing line - appended to the end of every explanation. */
export const ROUTE_TO_HUMAN: Record<ScriptLocale, string> = {
  en: 'This explains the idea in general. For your own situation, a real person on our team takes a look - we do not decide that automatically.',
  vi: 'Ph\u1EA7n n\u00E0y gi\u1EA3i th\u00EDch chung th\u00F4i. C\u00F2n tr\u01B0\u1EDDng h\u1EE3p ri\u00EAng c\u1EE7a b\u1EA1n, m\u1ED9t ng\u01B0\u1EDDi th\u1EADt trong nh\u00F3m s\u1EBD xem - ch\u00Fang t\u00F4i kh\u00F4ng t\u1EF1 \u0111\u1ED9ng quy\u1EBFt \u0111i\u1EC1u \u0111\u00F3.',
};

export const TAX_BRAIN = {
  // ---- FORMS ----------------------------------------------------------------
  form1099nec: {
    emoji: '\u{1F4C4}', category: 'income',
    en: { title: 'Form 1099-NEC', body: 'A company sends this to you and the IRS when they pay you $600 or more for work as a non-employee - like a contractor or booth renter. NEC means "nonemployee compensation." If you do nails at a salon as a booth renter, the salon may send you one.', source: 'IRS - About Form 1099-NEC' },
    vi: { title: 'Form 1099-NEC', body: 'C\u00F4ng ty g\u1EEDi form n\u00E0y cho b\u1EA1n v\u00E0 IRS khi h\u1ECD tr\u1EA3 b\u1EA1n t\u1EEB $600 tr\u1EDF l\u00EAn cho c\u00F4ng vi\u1EC7c ki\u1EC3u kh\u00F4ng ph\u1EA3i nh\u00E2n vi\u00EAn - nh\u01B0 th\u1EA7u ho\u1EB7c thu\u00EA gh\u1EBF. NEC ngh\u0129a l\u00E0 "ti\u1EC1n tr\u1EA3 ng\u01B0\u1EDDi kh\u00F4ng ph\u1EA3i nh\u00E2n vi\u00EAn." N\u1EBFu b\u1EA1n l\u00E0m nail ki\u1EC3u thu\u00EA gh\u1EBF, ti\u1EC7m c\u00F3 th\u1EC3 g\u1EEDi b\u1EA1n m\u1ED9t t\u1EDD.', source: 'IRS - About Form 1099-NEC' },
  },
  form1099k: {
    emoji: '\u{1F4B3}', category: 'income',
    en: { title: 'Form 1099-K', body: 'This comes from a card processor or an app (like a Square reader, or Uber). It shows the total that passed through - the gross amount, before the app took its cut. So the number can look bigger than what actually reached your bank. Both numbers matter; they just measure different things.', source: 'IRS - Understanding Your Form 1099-K' },
    vi: { title: 'Form 1099-K', body: 'Form n\u00E0y t\u1EEB m\u00E1y qu\u1EB9t th\u1EBB ho\u1EB7c app (nh\u01B0 Square, hay Uber). N\u00F3 cho th\u1EA5y t\u1ED5ng s\u1ED1 ti\u1EC1n \u0111i qua - s\u1ED1 g\u1ED9p, tr\u01B0\u1EDBc khi app tr\u1EEB ph\u1EA7n c\u1EE7a h\u1ECD. N\u00EAn con s\u1ED1 c\u00F3 th\u1EC3 tr\u00F4ng l\u1EDBn h\u01A1n s\u1ED1 th\u1EF1c s\u1EF1 v\u1EC1 t\u1EDBi ng\u00E2n h\u00E0ng. C\u1EA3 hai s\u1ED1 \u0111\u1EC1u quan tr\u1ECDng; ch\u1EC9 l\u00E0 \u0111o hai th\u1EE9 kh\u00E1c nhau.', source: 'IRS - Understanding Your Form 1099-K' },
  },
  formW2: {
    emoji: '\u{1F4CB}', category: 'income',
    en: { title: 'Form W-2', body: 'If you work a regular job with an employer, they send this at the start of the year. It shows your pay and the tax they already took out for you. If you work in a restaurant, your tips can show up on it too - including a box for "allocated tips" (Box 8).', source: 'IRS - About Form W-2' },
    vi: { title: 'Form W-2', body: 'N\u1EBFu b\u1EA1n l\u00E0m c\u00F4ng vi\u1EC7c th\u01B0\u1EDDng xuy\u00EAn c\u00F3 ch\u1EE7, h\u1ECD g\u1EEDi form n\u00E0y \u0111\u1EA7u n\u0103m. N\u00F3 cho th\u1EA5y ti\u1EC1n l\u01B0\u01A1ng v\u00E0 ti\u1EC1n thu\u1EBF h\u1ECD \u0111\u00E3 tr\u1EEB s\u1EB5n cho b\u1EA1n. N\u1EBFu b\u1EA1n l\u00E0m nh\u00E0 h\u00E0ng, ti\u1EC1n tip c\u0169ng c\u00F3 th\u1EC3 hi\u1EC7n tr\u00EAn \u0111\u00F3 - c\u00F3 c\u1EA3 \u00F4 "allocated tips" (Box 8).', source: 'IRS - About Form W-2' },
  },
  scheduleC: {
    emoji: '\u{1F4D2}', category: 'forms',
    en: { title: 'Schedule C', body: 'This is the page where a self-employed person lists their business income and their business expenses, so only the profit is taxed. If you own a salon or drive for an app, your money usually lands here. It attaches to your personal tax return (Form 1040).', source: 'IRS - About Schedule C' },
    vi: { title: 'Schedule C', body: '\u0110\u00E2y l\u00E0 trang m\u00E0 ng\u01B0\u1EDDi t\u1EF1 l\u00E0m ch\u1EE7 ghi thu nh\u1EADp kinh doanh v\u00E0 chi ph\u00ED kinh doanh, \u0111\u1EC3 ch\u1EC9 \u0111\u00E1nh thu\u1EBF ph\u1EA7n l\u1EDDi. N\u1EBFu b\u1EA1n c\u00F3 ti\u1EC7m ho\u1EB7c ch\u1EA1y app, ti\u1EC1n c\u1EE7a b\u1EA1n th\u01B0\u1EDDng v\u1EC1 \u0111\u00E2y. N\u00F3 g\u1EAFn v\u00E0o t\u1EDD khai thu\u1EBF c\u00E1 nh\u00E2n (Form 1040).', source: 'IRS - About Schedule C' },
  },
  formW9: {
    emoji: '\u{1F4DD}', category: 'workers',
    en: { title: 'Form W-9', body: 'When you pay someone to do work for your business, you ask them to fill out a W-9 first. It gives you their name and tax number so you can report what you paid them at the end of the year. Good habit: collect it before you pay, not in January.', source: 'IRS - About Form W-9' },
    vi: { title: 'Form W-9', body: 'Khi b\u1EA1n tr\u1EA3 ti\u1EC1n cho ai \u0111\u00F3 l\u00E0m vi\u1EC7c cho ti\u1EC7m, b\u1EA1n xin h\u1ECD \u0111i\u1EC1n W-9 tr\u01B0\u1EDBc. N\u00F3 cho b\u1EA1n t\u00EAn v\u00E0 s\u1ED1 thu\u1EBF c\u1EE7a h\u1ECD \u0111\u1EC3 cu\u1ED1i n\u0103m b\u00E1o \u0111\u00E3 tr\u1EA3 h\u1ECD bao nhi\u00EAu. Th\u00F3i quen t\u1ED1t: xin tr\u01B0\u1EDBc khi tr\u1EA3, \u0111\u1EEBng \u0111\u1EE3i th\u00E1ng Gi\u00EAng.', source: 'IRS - About Form W-9' },
  },

  // ---- BASICS ---------------------------------------------------------------
  deduction: {
    emoji: '\u{1F4C9}', category: 'basics',
    en: { title: 'What a deduction is', body: 'A deduction lowers the amount of income you get taxed on. If you spend money to run your business - supplies, gas, rent on your booth - that spending can reduce the profit you pay tax on. The IRS calls a valid business cost "ordinary and necessary" for your kind of work. Keeping receipts is what backs it up.', source: 'IRS - Publication 535, Business Expenses' },
    vi: { title: 'Deduction l\u00E0 g\u00EC', body: 'Deduction l\u00E0m gi\u1EA3m s\u1ED1 thu nh\u1EADp b\u1ECB \u0111\u00E1nh thu\u1EBF. N\u1EBFu b\u1EA1n chi ti\u1EC1n \u0111\u1EC3 l\u00E0m \u0103n - v\u1EADt t\u01B0, x\u0103ng, ti\u1EC1n thu\u00EA gh\u1EBF - kho\u1EA3n \u0111\u00F3 c\u00F3 th\u1EC3 gi\u1EA3m ph\u1EA7n l\u1EDDi b\u1ECB \u0111\u00E1nh thu\u1EBF. IRS g\u1ECDi chi ph\u00ED h\u1EE3p l\u1EC7 l\u00E0 "ordinary and necessary" cho ngh\u1EC1 c\u1EE7a b\u1EA1n. Gi\u1EEF bi\u00EAn lai l\u00E0 \u0111\u1EC3 ch\u1EE9ng minh.', source: 'IRS - Publication 535' },
  },
  expense: {
    emoji: '\u{1F9FE}', category: 'expenses',
    en: { title: 'A business expense', body: 'Money you spend to do your work - nail supplies, a chair, gloves, gas to drive, tools. These are separate from personal spending. The clearer you keep them apart (a separate account helps), the easier everything is later. Keep the receipts.', source: 'IRS - Publication 535' },
    vi: { title: 'Chi ph\u00ED kinh doanh', body: 'Ti\u1EC1n b\u1EA1n chi \u0111\u1EC3 l\u00E0m vi\u1EC7c - v\u1EADt t\u01B0 nail, gh\u1EBF, g\u0103ng tay, x\u0103ng, d\u1EE5ng c\u1EE5. Kh\u00E1c v\u1EDBi chi ti\u00EAu c\u00E1 nh\u00E2n. C\u00E0ng gi\u1EEF ri\u00EAng r\u00F5 (t\u00E0i kho\u1EA3n ri\u00EAng gi\u00FAp \u0111\u01B0\u1EE3c), sau n\u00E0y c\u00E0ng d\u1EC5. Nh\u1EDB gi\u1EEF bi\u00EAn lai.', source: 'IRS - Publication 535' },
  },
  grossVsNet: {
    emoji: '\u2696\uFE0F', category: 'basics',
    en: { title: 'Gross vs. net', body: 'Gross is the total that came in before anything is taken out. Net is what is left after costs. On a 1099-K the number is usually gross - the whole amount before the app took its fee - so it can look bigger than what reached you. Knowing which is which keeps your records straight.', source: 'IRS - Understanding Your Form 1099-K' },
    vi: { title: 'Gross v\u1EDBi net', body: 'Gross l\u00E0 t\u1ED5ng ti\u1EC1n v\u00F4 tr\u01B0\u1EDBc khi tr\u1EEB g\u00EC. Net l\u00E0 s\u1ED1 c\u00F2n l\u1EA1i sau chi ph\u00ED. Tr\u00EAn 1099-K con s\u1ED1 th\u01B0\u1EDDng l\u00E0 gross - to\u00E0n b\u1ED9 tr\u01B0\u1EDBc khi app tr\u1EEB ph\u00ED - n\u00EAn tr\u00F4ng l\u1EDBn h\u01A1n s\u1ED1 v\u1EC1 t\u1EDBi b\u1EA1n. Bi\u1EBFt s\u1ED1 n\u00E0o l\u00E0 s\u1ED1 n\u00E0o gi\u1EEF s\u1ED5 s\u00E1ch cho \u0111\u00FAng.', source: 'IRS - Understanding Your Form 1099-K' },
  },
  itin: {
    emoji: '\u{1F194}', category: 'basics',
    en: { title: 'ITIN vs. SSN', body: 'An SSN is a Social Security number. An ITIN is a tax ID number for people who need to file taxes but are not eligible for an SSN. Both let you file. One thing to know: some newer tax breaks require an SSN specifically, so they may not apply to an ITIN filer - a person on our team can tell you which is which for your case.', source: 'IRS - Individual Taxpayer Identification Number' },
    vi: { title: 'ITIN v\u1EDBi SSN', body: 'SSN l\u00E0 s\u1ED1 an sinh x\u00E3 h\u1ED9i. ITIN l\u00E0 s\u1ED1 thu\u1EBF cho ng\u01B0\u1EDDi c\u1EA7n khai thu\u1EBF nh\u01B0ng kh\u00F4ng \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n c\u00F3 SSN. C\u1EA3 hai \u0111\u1EC1u khai \u0111\u01B0\u1EE3c. M\u1ED9t \u0111i\u1EC1u n\u00EAn bi\u1EBFt: v\u00E0i kho\u1EA3n gi\u1EA3m thu\u1EBF m\u1EDBi \u0111\u00F2i ph\u1EA3i c\u00F3 SSN, n\u00EAn c\u00F3 th\u1EC3 kh\u00F4ng \u00E1p d\u1EE5ng cho ng\u01B0\u1EDDi d\u00F9ng ITIN - ng\u01B0\u1EDDi trong nh\u00F3m s\u1EBD n\u00F3i cho b\u1EA1n bi\u1EBFt tr\u01B0\u1EDDng h\u1EE3p c\u1EE7a b\u1EA1n.', source: 'IRS - ITIN' },
  },

  // ---- DEADLINES ------------------------------------------------------------
  quarterly: {
    emoji: '\u{1F4C5}', category: 'deadlines',
    en: { title: 'Why taxes a few times a year', body: 'When you have an employer, they take tax out of each paycheck for you. When you work for yourself, nobody does that - so the IRS asks you to send in a bit through the year instead of all at once. These are called estimated taxes. The dates fall roughly every few months. We track them so you are not caught out.', source: 'IRS - Estimated Taxes' },
    vi: { title: 'V\u00EC sao \u0111\u00F3ng thu\u1EBF v\u00E0i l\u1EA7n m\u1ED9t n\u0103m', body: 'Khi c\u00F3 ch\u1EE7, h\u1ECD tr\u1EEB thu\u1EBF t\u1EEB m\u1ED7i k\u1EF3 l\u01B0\u01A1ng cho b\u1EA1n. Khi t\u1EF1 l\u00E0m ch\u1EE7, kh\u00F4ng ai l\u00E0m v\u1EADy - n\u00EAn IRS xin b\u1EA1n \u0111\u00F3ng m\u1ED9t \u00EDt trong n\u0103m thay v\u00EC m\u1ED9t l\u1EA7n. C\u00E1i n\u00E0y g\u1ECDi l\u00E0 estimated taxes. Ng\u00E0y r\u01A1i kho\u1EA3ng v\u00E0i th\u00E1ng m\u1ED9t l\u1EA7n. Ch\u00Fang t\u00F4i theo d\u00F5i \u0111\u1EC3 b\u1EA1n kh\u00F4ng b\u1ECB b\u1EA5t ng\u1EDD.', source: 'IRS - Estimated Taxes' },
  },
  form2290: {
    emoji: '\u{1F69B}', category: 'deadlines',
    en: { title: 'Form 2290 (heavy trucks)', body: 'If you run a truck at or above 55,000 pounds, there is a yearly highway-use tax on it, filed on Form 2290. Its year runs July through June, and the stamped proof is usually needed to keep the truck registered. This one has its own calendar, separate from your income taxes.', source: 'IRS - About Form 2290' },
    vi: { title: 'Form 2290 (xe t\u1EA3i n\u1EB7ng)', body: 'N\u1EBFu b\u1EA1n ch\u1EA1y xe t\u1EEB 55,000 pounds tr\u1EDF l\u00EAn, c\u00F3 thu\u1EBF s\u1EED d\u1EE5ng \u0111\u01B0\u1EDDng h\u00E0ng n\u0103m, khai tr\u00EAn Form 2290. N\u0103m c\u1EE7a n\u00F3 t\u00EDnh t\u1EEB th\u00E1ng 7 t\u1EDBi th\u00E1ng 6, v\u00E0 gi\u1EA5y \u0111\u00F3ng m\u1ED9c th\u01B0\u1EDDng c\u1EA7n \u0111\u1EC3 gi\u1EEF \u0111\u0103ng k\u00FD xe. C\u00E1i n\u00E0y c\u00F3 l\u1ECBch ri\u00EAng, kh\u00E1c v\u1EDBi thu\u1EBF thu nh\u1EADp.', source: 'IRS - About Form 2290' },
  },

  // ---- TIPS -----------------------------------------------------------------
  tipsBasics: {
    emoji: '\u{1F4B5}', category: 'tips',
    en: { title: 'Tips and taxes', body: 'Tips are income, whether they come by card or cash. Card tips usually show up in the system already. Cash tips do not appear on any form, so your own record is the only proof - a simple daily log does the job. Keeping it is what protects you if anyone ever asks.', source: 'IRS - Publication 531, Reporting Tip Income' },
    vi: { title: 'Ti\u1EC1n tip v\u1EDBi thu\u1EBF', body: 'Ti\u1EC1n tip l\u00E0 thu nh\u1EADp, d\u00F9 b\u1EB1ng th\u1EBB hay ti\u1EC1n m\u1EB7t. Tip th\u1EBB th\u01B0\u1EDDng \u0111\u00E3 c\u00F3 trong h\u1EC7 th\u1ED1ng. Tip ti\u1EC1n m\u1EB7t kh\u00F4ng hi\u1EC7n tr\u00EAn form n\u00E0o, n\u00EAn s\u1ED5 ghi c\u1EE7a b\u1EA1n l\u00E0 b\u1EB1ng ch\u1EE9ng duy nh\u1EA5t - m\u1ED9t s\u1ED5 ghi m\u1ED7i ng\u00E0y l\u00E0 \u0111\u1EE7. Gi\u1EEF n\u00F3 l\u00E0 \u0111\u1EC3 b\u1EA3o v\u1EC7 b\u1EA1n n\u1EBFu ai h\u1ECFi.', source: 'IRS - Publication 531' },
  },
  tipsDeduction: {
    emoji: '\u2728', category: 'tips',
    en: { title: 'The newer tips deduction', body: 'There is a newer tax break for some tipped workers that can lower the tax on a portion of qualifying tips, for a limited set of years. It has conditions - one being that it requires a Social Security number, so an ITIN filer would not qualify. Whether it fits you depends on your specific situation. TODO: confirm current-year amount and rules.', source: 'IRS - guidance on tip income deduction' },
    vi: { title: 'Kho\u1EA3n gi\u1EA3m thu\u1EBF tip m\u1EDBi', body: 'C\u00F3 m\u1ED9t kho\u1EA3n gi\u1EA3m thu\u1EBF m\u1EDBi cho v\u00E0i ng\u01B0\u1EDDi l\u00E0m ngh\u1EC1 c\u00F3 tip, c\u00F3 th\u1EC3 gi\u1EA3m thu\u1EBF tr\u00EAn m\u1ED9t ph\u1EA7n tip \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n, trong m\u1ED9t s\u1ED1 n\u0103m nh\u1EA5t \u0111\u1ECBnh. N\u00F3 c\u00F3 \u0111i\u1EC1u ki\u1EC7n - m\u1ED9t \u0111i\u1EC1u l\u00E0 ph\u1EA3i c\u00F3 SSN, n\u00EAn ng\u01B0\u1EDDi d\u00F9ng ITIN kh\u00F4ng \u0111\u1EE7. C\u00F3 h\u1EE3p v\u1EDBi b\u1EA1n hay kh\u00F4ng t\u00F9y tr\u01B0\u1EDDng h\u1EE3p ri\u00EAng. TODO: x\u00E1c nh\u1EADn s\u1ED1 v\u00E0 lu\u1EADt n\u0103m hi\u1EC7n t\u1EA1i.', source: 'IRS - h\u01B0\u1EDBng d\u1EABn v\u1EC1 gi\u1EA3m thu\u1EBF tip' },
  },

  // ---- WORKERS --------------------------------------------------------------
  workerType: {
    emoji: '\u{1F465}', category: 'workers',
    en: { title: 'Employee vs. contractor', body: 'These are two different ways a worker can be treated, and they change the paperwork and the taxes for both sides. Roughly: the more control the business has over how and when the work is done, the more it looks like an employee. It depends on the real details of the working relationship, not just what it is called. This one genuinely needs a professional to look at - it is not something to guess.', source: 'IRS - Independent Contractor vs. Employee' },
    vi: { title: 'Nh\u00E2n vi\u00EAn v\u1EDBi th\u1EA7u (contractor)', body: '\u0110\u00E2y l\u00E0 hai c\u00E1ch \u0111\u1ED1i x\u1EED kh\u00E1c nhau v\u1EDBi ng\u01B0\u1EDDi l\u00E0m, v\u00E0 n\u00F3 \u0111\u1ED5i gi\u1EA5y t\u1EDD v\u00E0 thu\u1EBF cho c\u1EA3 hai b\u00EAn. \u0110\u1EA1i kh\u00E1i: ti\u1EC7m c\u00E0ng ki\u1EC3m so\u00E1t c\u00E1ch v\u00E0 gi\u1EDD l\u00E0m, c\u00E0ng gi\u1ED1ng nh\u00E2n vi\u00EAn. N\u00F3 t\u00F9y chi ti\u1EBFt th\u1EF1c c\u1EE7a quan h\u1EC7 l\u00E0m vi\u1EC7c, kh\u00F4ng ph\u1EA3i ch\u1EC9 t\u00EAn g\u1ECDi. C\u00E1i n\u00E0y th\u1EF1c s\u1EF1 c\u1EA7n ng\u01B0\u1EDDi chuy\u00EAn m\u00F4n xem - \u0111\u1EEBng \u0111o\u00E1n.', source: 'IRS - Independent Contractor vs. Employee' },
  },
} as const satisfies Record<string, Explainer>;

export type TaxTermKey = keyof typeof TAX_BRAIN;
