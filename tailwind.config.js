/** VNTax.ai design tokens.
 *
 *  Palette: jade / navy / clay / gold / ink (unchanged brand identity).
 *  Structure: Wise-derived token architecture — semantic naming, a disciplined
 *  type scale with paired line-heights, negative tracking that tightens as
 *  display type grows, a 5-step radius scale, and a fixed spacing scale.
 *  See docs/DESIGN_TOKENS.md for the full rationale.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        jade: { 50:'#EDF5F1',100:'#D6E9E0',600:'#1B7A5F',700:'#155E4C',800:'#10493B',900:'#0C3830' },
        navy: { 50:'#EEF1F6',100:'#DCE3EE',600:'#33507F',800:'#1E3157',900:'#152444' },
        clay: { 50:'#FBEFED',100:'#F6DFDB',300:'#E3B0A9',500:'#C4695F',600:'#B15A50',700:'#93463E',800:'#75372F',900:'#5A2A24' },
        gold: { 50:'#FBF4E6',100:'#F5E7C8',500:'#C79A42',600:'#B8894A',700:'#966E38',800:'#75552B',900:'#5A4121' },
        ink:  { 50:'#F7F7F5',100:'#EBEAE6',300:'#C4C2BB',400:'#9E9B93',500:'#6E6B63',600:'#54514A',700:'#3D3B35',800:'#2A2823',900:'#1A1815' },
        cream: '#FBF8F3',
        line: '#E5E0D6',

        // Semantic aliases — prefer these in new code over raw ramp steps.
        content: { primary:'#1A1815', secondary:'#54514A', muted:'#6E6B63', inverse:'#FFFFFF' },
        interactive: { primary:'#155E4C', hover:'#10493B', active:'#0C3830', contrast:'#FFFFFF' },
        sentiment: { positive:'#1B7A5F', warning:'#C79A42', negative:'#93463E', info:'#33507F' },
        surface: { base:'#FFFFFF', sunken:'#FBF8F3', inverse:'#152444' },
      },

      /* Type scale 12→48. Each step pairs a line-height and its tracking:
         body/UI sits at normal-to-slightly-open, display tightens as it grows. */
      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1.125rem', letterSpacing: '0.01em'  }], // 12
        sm:   ['0.875rem', { lineHeight: '1.25rem',  letterSpacing: '0.005em' }], // 14
        base: ['1rem',     { lineHeight: '1.5rem',   letterSpacing: '0'       }], // 16
        lg:   ['1.125rem', { lineHeight: '1.75rem',  letterSpacing: '0'       }], // 18
        xl:   ['1.25rem',  { lineHeight: '1.75rem',  letterSpacing: '-0.005em'}], // 20
        '2xl':['1.5rem',   { lineHeight: '1.875rem', letterSpacing: '-0.01em' }], // 24
        '3xl':['1.75rem',  { lineHeight: '2.125rem', letterSpacing: '-0.015em'}], // 28
        '4xl':['2rem',     { lineHeight: '2.375rem', letterSpacing: '-0.02em' }], // 32
        '5xl':['2.5rem',   { lineHeight: '2.875rem', letterSpacing: '-0.025em'}], // 40
        '6xl':['3rem',     { lineHeight: '3.375rem', letterSpacing: '-0.03em' }], // 48
      },
      letterSpacing: {
        display: '-0.02em',
        'display-tight': '-0.03em',
      },

      /* Radius scale: 10 / 16 / 24 / 32 / pill. */
      borderRadius: {
        sm: '10px',
        DEFAULT: '10px',
        md: '10px',
        lg: '16px',
        xl: '16px',
        '2xl': '24px',
        '3xl': '32px',
        full: '9999px',
      },

      /* Fixed spacing steps used for section rhythm. */
      spacing: {
        xs: '8px', sm: '16px', md: '24px', lg: '32px', xl: '40px', '2xl': '56px', '3xl': '72px',
      },

      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Lora', 'Georgia', 'serif'],
      },
      borderColor: { DEFAULT: '#E5E0D6' },
    },
  },
  plugins: [],
};
