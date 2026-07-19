/** Design tokens from ARCHITECTURE.md §19: deep navy, jade green, warm cream,
 *  light gray, restrained gold. No stereotypical imagery, large readable type. */
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
