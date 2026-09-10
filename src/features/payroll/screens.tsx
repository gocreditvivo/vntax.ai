import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, PageHeader } from '../../components/ui';
import { useI18n } from '../../i18n';
import {
  calculateWorker, dcRulesFor, totalPayroll,
  type PayrollWorkerInput, type WorkerKind,
} from './engine';
import { csvCell } from './csv';

type Step = 1 | 2 | 3;

const blankWorker = (id: string): PayrollWorkerInput => ({
  id, name: '', kind: 'w2_hourly', rateOrPay: 18.4,
  regularHours: 0, overtimeHours: 0, reportedTips: 0, tipsPaidWithPayroll: true,
  section125Deduction: 0, retirement401k: 0, otherAfterTaxDeductions: 0,
  federalWithholding: 0, dcWithholding: 0,
  ytdSocialSecurityWages: 0, ytdMedicareWages: 0, ytdFutaWages: 0, ytdDcUiWages: 0,
});

const words = (vi: boolean) => vi ? {
  title: 'Tính lương DC theo tuần',
  subtitle: 'Nhập từng bước, xem lại trước khi xuất. Chỉ dùng cho một tuần làm việc tại Washington, DC trong năm 2026.',
  steps: ['Tuần lương', 'Người làm', 'Xem lại'], business: 'Tên cơ sở', weekEnd: 'Ngày cuối tuần làm việc',
  payDate: 'Ngày trả lương', next: 'Tiếp tục', back: 'Quay lại', add: 'Thêm người', remove: 'Xóa',
  uiRate: 'Thuế suất UI DC năm 2026 (%)', uiRateHelp: 'Cơ sở mới dùng 2,7%. Cơ sở đang hoạt động phải nhập thuế suất trên thông báo DOES năm 2026.',
  person: 'Tên người làm', type: 'Loại người làm', rate: 'Mức lương giờ / tiền trả tuần',
  hours: 'Giờ thường', overtime: 'Giờ tăng ca', tips: 'Tiền tip đã báo cáo',
  tipsInCheck: 'Trả tiền tip này trong kỳ lương', taxDetails: 'Thuế, khoản trừ và số từ đầu năm',
  section125: 'Khoản Section 125 đủ điều kiện', retirement: '401(k) trước thuế', other: 'Khoản trừ sau thuế',
  fed: 'Thuế liên bang giữ lại', dc: 'Thuế DC giữ lại', ytdSs: 'Lương Social Security từ đầu năm',
  ytdMed: 'Lương Medicare từ đầu năm', ytdFuta: 'Lương FUTA từ đầu năm', ytdUi: 'Lương DC UI từ đầu năm',
  gross: 'Tổng lương chịu thuế', pay: 'Tiền trả người làm', employer: 'Thuế phía chủ',
  remit: 'Khoản trừ cần chuyển',
  deposit: 'Khoản nộp liên bang', funding: 'Tổng tiền cần chuẩn bị', export: 'Tải CSV để xem lại',
  blocked: 'Cần sửa trước khi dùng', warning: 'Cần kiểm tra',
  withholding: 'Thuế thu nhập liên bang và DC phải nhập từ W-4/D-4 và hướng dẫn hiện hành. VNTax không đoán số này.',
  boundary: 'Đây là bảng tính và kiểm tra hồ sơ. Phần này không nộp thuế, phát hành phiếu lương, hoặc chuyển tiền.',
  privacy: 'Chưa lưu lên máy chủ. File CSV không chứa SSN.', source: 'Nguồn chính thức cho năm 2026',
} : {
  title: 'Guided DC weekly payroll',
  subtitle: 'Answer a few clear questions, then review before export. For one Washington, DC workweek in 2026 only.',
  steps: ['Workweek', 'People', 'Review'], business: 'Business name', weekEnd: 'Workweek ending',
  payDate: 'Pay date', next: 'Continue', back: 'Back', add: 'Add person', remove: 'Remove',
  uiRate: '2026 DC UI employer rate (%)', uiRateHelp: 'New employers use 2.7%. Established employers must enter the rate on their 2026 DOES notice.',
  person: 'Worker name', type: 'Worker type', rate: 'Hourly rate / weekly payment',
  hours: 'Regular hours', overtime: 'Overtime hours', tips: 'Reported tips',
  tipsInCheck: 'Include these tips in this payment', taxDetails: 'Taxes, deductions, and year-to-date wages',
  section125: 'Qualified section 125 deduction', retirement: 'Traditional 401(k) deferral', other: 'Other after-tax deductions',
  fed: 'Federal income tax withholding', dc: 'DC income tax withholding', ytdSs: 'YTD Social Security wages',
  ytdMed: 'YTD Medicare wages', ytdFuta: 'YTD FUTA wages', ytdUi: 'YTD DC UI wages',
  gross: 'Gross taxable wages', pay: 'Payments to workers', employer: 'Employer payroll taxes',
  remit: 'Deductions to remit',
  deposit: 'Federal deposit', funding: 'Total funding needed', export: 'Download review CSV',
  blocked: 'Fix before use', warning: 'Review required',
  withholding: 'Federal and DC income-tax withholding must come from the employee W-4/D-4 and current instructions. VNTax does not guess it.',
  boundary: 'This is a calculation and record-review aid. It does not file taxes, issue paystubs, or move money.',
  privacy: 'This run is not stored on a server. The CSV contains no SSNs.', source: 'Official 2026 sources',
};

const typeLabels = (vi: boolean): Record<WorkerKind, string> => vi ? {
  w2_hourly: 'Nhân viên W-2 trả theo giờ', w2_tipped: 'Nhân viên W-2 có tip',
  w2_salary_exempt: 'W-2 lương cố định (đã xác nhận miễn tăng ca)', contractor: 'Trả nhà thầu (không phải payroll)',
} : {
  w2_hourly: 'W-2 hourly', w2_tipped: 'W-2 tipped hourly',
  w2_salary_exempt: 'W-2 salary (exemption confirmed)', contractor: 'Contractor payment (not payroll)',
};

function localMessage(message: string, vi: boolean): string {
  if (!vi) return message;
  const exact: Record<string, string> = {
    'Enter the worker name.': 'Nhập tên người làm.',
    'Hours exceed one seven-day workweek.': 'Tổng giờ vượt quá một tuần bảy ngày.',
    'This worker type cannot use hourly fields in this worksheet.': 'Loại người làm này không dùng ô tính theo giờ trong bảng này.',
    'Salary alone does not establish an overtime exemption; confirm duties and salary tests.': 'Chỉ trả lương cố định chưa đủ để được miễn tăng ca; cần kiểm tra công việc và mức lương.',
    'Worker classification is a legal facts-and-circumstances test, not a payroll choice.': 'Phân loại nhân viên hay nhà thầu phụ thuộc vào thực tế công việc, không phải chỉ chọn trong bảng lương.',
    'Reported tips were entered for a worker not marked as tipped.': 'Có nhập tiền tip nhưng người làm chưa được chọn là nhân viên có tip.',
    'Employer tip-credit makeup was added for this workweek.': 'Đã cộng phần chủ phải bù vì tip chưa đủ cho tuần này.',
    'Deductions and withholding exceed this payment.': 'Khoản trừ và thuế giữ lại lớn hơn số tiền trả.',
    'Federal withholding is $0; verify the employee W-4 and 2026 Publication 15-T.': 'Thuế liên bang giữ lại đang là $0; kiểm tra W-4 và Publication 15-T năm 2026.',
    'DC withholding is $0; verify the employee D-4 and current DC instructions.': 'Thuế DC giữ lại đang là $0; kiểm tra D-4 và hướng dẫn DC hiện hành.',
    'Enter a valid 2026 Washington, DC workweek ending date.': 'Nhập ngày kết thúc tuần làm việc hợp lệ tại Washington, DC trong năm 2026.',
    'The worksheet only supports a seven-day workweek entirely inside 2026.': 'Bảng này chỉ hỗ trợ tuần bảy ngày nằm hoàn toàn trong năm 2026.',
    'This workweek crosses the July 1 DC wage change. Split hours into periods before and after July 1.': 'Tuần này đi qua ngày đổi lương DC 1 tháng 7. Hãy tách giờ trước và sau ngày 1 tháng 7.',
    'Enter a valid 2026 pay date.': 'Nhập ngày trả lương hợp lệ trong năm 2026.',
    'Pay date cannot be before the workweek ending date.': 'Ngày trả lương không thể trước ngày kết thúc tuần làm việc.',
    "Enter a DC unemployment rate from the employer's 2026 rate notice.": 'Nhập thuế suất thất nghiệp DC từ thông báo năm 2026 của chủ cơ sở.',
    'Regular hours exceed 40; move excess weekly hours to overtime.': 'Giờ thường vượt quá 40; chuyển giờ vượt quá trong tuần sang giờ tăng ca.',
    'Confirm the section 125 election is exempt from FIT, FICA, and FUTA for this worker; benefit treatment varies.': 'Xác nhận lựa chọn Section 125 của người làm này được miễn FIT, FICA và FUTA; cách xử lý tùy loại quyền lợi.',
    'Confirm plan eligibility and year-to-date 401(k) limits; this worksheet does not test plan limits.': 'Xác nhận điều kiện của chương trình và giới hạn 401(k) từ đầu năm; bảng này không kiểm tra giới hạn chương trình.',
    'Confirm authorization and any applicable limits for other after-tax deductions.': 'Xác nhận quyền khấu trừ và mọi giới hạn áp dụng cho các khoản trừ sau thuế khác.',
  };
  if (exact[message]) return exact[message];
  if (message.startsWith('Hourly rate is below the DC minimum wage')) return message.replace('Hourly rate is below the DC minimum wage of', 'Mức lương giờ thấp hơn lương tối thiểu DC là');
  if (message.startsWith('Tipped cash rate is below the DC minimum')) return message.replace('Tipped cash rate is below the DC minimum of', 'Mức tiền mặt cho nhân viên có tip thấp hơn mức tối thiểu DC là');
  return message;
}

function NumberField({ label, value, set }: { label: string; value: number; set: (n: number) => void }) {
  return <label className="block text-sm text-content-secondary"><span className="mb-1 block">{label}</span><Input type="number" min="0" step="0.01" value={value} onChange={(e) => set(Number(e.target.value) || 0)} /></label>;
}

export function Payroll() {
  const { locale } = useI18n();
  const isVietnamese = locale === 'vi';
  const c = words(isVietnamese);
  const labels = typeLabels(isVietnamese);
  const [step, setStep] = useState<Step>(1);
  const [business, setBusiness] = useState('Saigon Kitchen');
  const [weekEnd, setWeekEnd] = useState('2026-08-08');
  const [payDate, setPayDate] = useState('2026-08-12');
  const [dcUiRatePercent, setDcUiRatePercent] = useState(2.7);
  const [workers, setWorkers] = useState<PayrollWorkerInput[]>([
    { ...blankWorker('worker-1'), name: 'Employee 1', kind: 'w2_tipped', rateOrPay: 10.3 },
  ]);
  const ruleState = useMemo(() => {
    try { return { rules: dcRulesFor(weekEnd, dcUiRatePercent / 100, payDate), error: '' }; }
    catch (error) { return { rules: null, error: error instanceof Error ? error.message : 'Invalid payroll rules.' }; }
  }, [weekEnd, payDate, dcUiRatePercent]);
  const rules = ruleState.rules;
  const results = useMemo(() => rules ? workers.map((worker) => calculateWorker(worker, rules)) : [], [rules, workers]);
  const totals = useMemo(() => totalPayroll(results), [results]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);
  const dollars = (n: number) => new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(n);
  const patch = <K extends keyof PayrollWorkerInput>(id: string, key: K, value: PayrollWorkerInput[K]) =>
    setWorkers((all) => all.map((worker) => worker.id === id ? { ...worker, [key]: value } : worker));

  function download() {
    const head = ['Business', 'Workweek ending', 'Pay date', 'DC UI employer rate', 'Worker', 'Type', 'Gross wages', 'Employee FICA', 'Federal withholding', 'DC withholding', 'Payment', 'Deductions to remit', 'Employer payroll taxes', 'Federal deposit', 'Funding needed', 'Status'];
    const rows = results.map((r) => [business, weekEnd, payDate, rules?.dcUiEmployerRate ?? '', r.name, labels[r.kind], r.grossWages,
      r.employeeFica, r.federalWithholding, r.dcWithholding, r.paymentToWorker, r.deductionRemittances,
      r.employerPayrollTaxes, r.federalDeposit, r.fundingNeeded,
      r.blockers.length ? 'BLOCKED' : r.warnings.length ? 'REVIEW' : 'READY FOR PROFESSIONAL REVIEW']);
    const blob = new Blob(['\uFEFF' + [head, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VNTax_DC_Payroll_${business.replace(/[^A-Za-z0-9]+/g, '_')}_${weekEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return <div className="space-y-5">
    <PageHeader title={c.title} subtitle={c.subtitle} />
    <ol className="grid grid-cols-3 gap-2" aria-label="Payroll progress">{c.steps.map((label, i) => <li key={label} className={`rounded-xl border p-3 text-sm ${step === i + 1 ? 'border-jade-600 bg-jade-50 font-semibold text-jade-800' : 'border-line bg-white text-content-muted'}`}>{i + 1}. {label}</li>)}</ol>

    {step === 1 && <Card className="space-y-5 p-6">
      <label className="block text-sm text-content-secondary"><span className="mb-1 block">{c.business}</span><Input value={business} onChange={(e) => setBusiness(e.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-content-secondary"><span className="mb-1 block">{c.weekEnd}</span><Input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} /></label>
        <label className="block text-sm text-content-secondary"><span className="mb-1 block">{c.payDate}</span><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></label>
        <div><NumberField label={c.uiRate} value={dcUiRatePercent} set={setDcUiRatePercent} /><p className="mt-1 text-xs text-content-muted">{c.uiRateHelp}</p></div>
      </div>
      {!rules && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{localMessage(ruleState.error, isVietnamese)}</p>}
      {rules && <p className="rounded-lg bg-cream p-3 text-sm text-content-secondary">DC rates effective {rules.effectiveDate}: minimum {dollars(rules.minimumWage)} · tipped cash wage {dollars(rules.tippedCashWage)} · UI {(rules.dcUiEmployerRate * 100).toFixed(2)}%.</p>}
      <Button disabled={!rules || !business.trim()} onClick={() => setStep(2)}>{c.next}</Button>
    </Card>}

    {step === 2 && <div className="space-y-4">
      {workers.map((worker, index) => {
        const result = results[index];
        const hourly = worker.kind === 'w2_hourly' || worker.kind === 'w2_tipped';
        const tipped = worker.kind === 'w2_tipped';
        return <Card key={worker.id} className="p-5">
          <div className="mb-4 flex justify-between gap-3"><h2 className="font-semibold">{index + 1}. {worker.name || c.person}</h2>{workers.length > 1 && <button className="text-sm text-red-700 underline" onClick={() => setWorkers((all) => all.filter((w) => w.id !== worker.id))}>{c.remove}</button>}</div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-content-secondary"><span className="mb-1 block">{c.person}</span><Input value={worker.name} onChange={(e) => patch(worker.id, 'name', e.target.value)} /></label>
            <label className="block text-sm text-content-secondary"><span className="mb-1 block">{c.type}</span><select className="w-full rounded-sm border border-line bg-white px-3 py-2.5" value={worker.kind} onChange={(e) => patch(worker.id, 'kind', e.target.value as WorkerKind)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <NumberField label={c.rate} value={worker.rateOrPay} set={(n) => patch(worker.id, 'rateOrPay', n)} />
            {hourly && <NumberField label={c.hours} value={worker.regularHours} set={(n) => patch(worker.id, 'regularHours', n)} />}
            {hourly && <NumberField label={c.overtime} value={worker.overtimeHours} set={(n) => patch(worker.id, 'overtimeHours', n)} />}
            {tipped && <NumberField label={c.tips} value={worker.reportedTips} set={(n) => patch(worker.id, 'reportedTips', n)} />}
          </div>
          {tipped && <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={worker.tipsPaidWithPayroll} onChange={(e) => patch(worker.id, 'tipsPaidWithPayroll', e.target.checked)} />{c.tipsInCheck}</label>}
          {worker.kind !== 'contractor' && <details className="mt-5 rounded-xl border border-line p-4"><summary className="cursor-pointer font-medium">{c.taxDetails}</summary><div className="mt-4 grid gap-4 md:grid-cols-2">
            <NumberField label={c.section125} value={worker.section125Deduction} set={(n) => patch(worker.id, 'section125Deduction', n)} />
            <NumberField label={c.retirement} value={worker.retirement401k} set={(n) => patch(worker.id, 'retirement401k', n)} />
            <NumberField label={c.other} value={worker.otherAfterTaxDeductions} set={(n) => patch(worker.id, 'otherAfterTaxDeductions', n)} />
            <NumberField label={c.fed} value={worker.federalWithholding} set={(n) => patch(worker.id, 'federalWithholding', n)} />
            <NumberField label={c.dc} value={worker.dcWithholding} set={(n) => patch(worker.id, 'dcWithholding', n)} />
            <NumberField label={c.ytdSs} value={worker.ytdSocialSecurityWages} set={(n) => patch(worker.id, 'ytdSocialSecurityWages', n)} />
            <NumberField label={c.ytdMed} value={worker.ytdMedicareWages} set={(n) => patch(worker.id, 'ytdMedicareWages', n)} />
            <NumberField label={c.ytdFuta} value={worker.ytdFutaWages} set={(n) => patch(worker.id, 'ytdFutaWages', n)} />
            <NumberField label={c.ytdUi} value={worker.ytdDcUiWages} set={(n) => patch(worker.id, 'ytdDcUiWages', n)} />
          </div></details>}
          {result && <p className="mt-4 text-sm">{c.gross}: <b>{dollars(result.grossWages)}</b> · {c.pay}: <b>{dollars(result.paymentToWorker)}</b></p>}
        </Card>;
      })}
      <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => setWorkers((all) => [...all, blankWorker(`worker-${Date.now()}`)])}>{c.add}</Button><Button variant="secondary" onClick={() => setStep(1)}>{c.back}</Button><Button onClick={() => setStep(3)}>{c.next}</Button></div>
    </div>}

    {step === 3 && <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[[c.gross, totals.grossWages], [c.pay, totals.paymentsToWorkers], [c.remit, totals.deductionRemittances], [c.employer, totals.employerPayrollTaxes], [c.funding, totals.fundingNeeded]].map(([label, amount]) => <Card key={String(label)} className="p-4"><p className="text-sm text-content-muted">{label}</p><p className="mt-1 font-mono text-2xl font-semibold">{dollars(Number(amount))}</p></Card>)}</div>
      <Card className="p-5"><h2 className="font-semibold">{c.deposit}: {dollars(totals.federalDeposit)}</h2><p className="mt-2 text-sm text-content-secondary">{c.uiRate}: {(rules!.dcUiEmployerRate * 100).toFixed(2)}%</p><p className="mt-2 text-sm text-content-secondary">{c.withholding}</p></Card>
      {results.map((result) => <Card key={result.workerId} className="p-5"><div className="flex justify-between gap-3"><div><h2 className="font-semibold">{result.name || c.person}</h2><p className="text-sm text-content-muted">{labels[result.kind]}</p></div><p className="font-mono text-xl font-semibold">{dollars(result.paymentToWorker)}</p></div>
        {result.blockers.length > 0 && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-900"><b>{c.blocked}</b><ul className="mt-2 list-disc pl-5">{result.blockers.map((item) => <li key={item}>{localMessage(item, isVietnamese)}</li>)}</ul></div>}
        {result.warnings.length > 0 && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><b>{c.warning}</b><ul className="mt-2 list-disc pl-5">{result.warnings.map((item) => <li key={item}>{localMessage(item, isVietnamese)}</li>)}</ul></div>}
      </Card>)}
      <Card className="space-y-3 p-5 text-sm text-content-secondary"><p>{c.privacy}</p><p>{c.boundary}</p><p className="font-medium text-content-primary">{c.source}</p><ul className="list-disc space-y-1 pl-5"><li><a className="underline" href="https://www.irs.gov/publications/p15" target="_blank" rel="noreferrer">IRS Publication 15 (2026)</a></li><li><a className="underline" href="https://www.ssa.gov/OACT/cola/cbb.html" target="_blank" rel="noreferrer">SSA contribution and benefit base</a></li><li><a className="underline" href="https://does.dc.gov/node/1412291" target="_blank" rel="noreferrer">DC Office of Wage-Hour</a></li><li><a className="underline" href="https://essp.does.dc.gov/DOES%20ESSP%20Employer%20Landing%20Page.html" target="_blank" rel="noreferrer">DC unemployment insurance</a></li></ul></Card>
      <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => setStep(2)}>{c.back}</Button><Button disabled={results.some((r) => r.blockers.length > 0)} onClick={download}>{c.export}</Button></div>
    </div>}
  </div>;
}
