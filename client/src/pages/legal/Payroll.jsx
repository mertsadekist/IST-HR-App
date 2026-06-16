import { useState } from 'react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import { Calculator, Scale, Clock, AlertTriangle, DollarSign, FileText, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Payroll() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('exit');

  // --- Exit Settlement State ---
  const [exData, setExData] = useState({
    name: '', basic: '', full: '', start: '', end: '', prob: '',
    type: 'term_legit', visa: 'full', leave: '', unpaid: '', noticeServed: '', deduct: ''
  });
  const [exResult, setExResult] = useState(null);

  // --- Absence & Lateness State ---
  const [absData, setAbsData] = useState({ wage: '', days: '' });
  const [lateData, setLateData] = useState({ wage: '', hrs: '', min: '', count: '' });
  const [capData, setCapData] = useState({ wage: '', absence: '', late: '', adv: '', other: '' });

  // --- Attendance State ---
  const [attData, setAttData] = useState({
    name: '', dept: '', month: new Date().toISOString().slice(0, 7), wage: '', basic: '', visa: 'full',
    workdays: '', present: '', late: '', auth: '', unauth: '', ph: '',
    otStd: '', otNight: '', otFri: '', otPh: '',
    ltHrs: '', ltMin: '', ltCount: '',
    dAbs: '', dLate: '', dAdv: '',
    leaves: { al: '', slFull: '', slHalf: '', slUn: '', matFull: '', matHalf: '', pat: '', berA: '', berB: '', emer: '', study: '', unpaid: '' }
  });
  const [showReport, setShowReport] = useState(false);

  // --- Calculation Logic: Exit Settlement ---
  const calcExitSettlement = () => {
    const basic = parseFloat(exData.basic) || 0;
    const full = parseFloat(exData.full) || basic;
    if (!basic || !exData.start || !exData.end) {
      setExResult({ error: 'Please fill in Basic Wage, Start Date, and Last Working Day.' });
      return;
    }
    const start = new Date(exData.start);
    const end = new Date(exData.end);
    const prob = exData.prob ? new Date(exData.prob) : null;
    const inProbation = prob && end <= prob;

    const totalDaysRaw = Math.floor((end - start) / 86400000);
    const unpaidDays = parseFloat(exData.unpaid) || 0;
    const totalDays = Math.max(0, totalDaysRaw - unpaidDays);
    const yearsTotal = totalDays / 365;
    const yearsFloor = Math.floor(yearsTotal);
    const partialYearDays = totalDays - (yearsFloor * 365);

    const dailyBasic = basic / 30;
    const dailyFull = full / 30;

    let noticeDays = 30;
    if (yearsTotal >= 10) noticeDays = 90;
    else if (yearsTotal >= 5) noticeDays = 60;
    if (inProbation) noticeDays = 1;

    let eosb = 0;
    const isMisconduct = exData.type === 'term_misconduct';
    if (!inProbation && yearsTotal >= 1 && !isMisconduct) {
      const yrs1_5 = Math.min(yearsFloor, 5);
      const yrs_over5 = Math.max(0, yearsFloor - 5);
      const partial_rate = yearsFloor >= 5 ? 30 : 21;
      eosb = dailyBasic * 21 * yrs1_5 + dailyBasic * 30 * yrs_over5 + dailyBasic * partial_rate * (partialYearDays / 365);
      const cap = full * 24;
      if (eosb > cap) eosb = cap;
    }

    let noticePay = 0;
    let noticeNote = '';
    if (exData.type === 'term_legit' || exData.type === 'expiry') {
      noticePay = dailyFull * noticeDays;
      noticeNote = `Employer must pay ${noticeDays} days notice pay`;
    } else if (exData.type === 'resign') {
      const noticeServed = parseFloat(exData.noticeServed) || 0;
      const noticeOwed = dailyFull * noticeDays;
      const noticeDeduct = Math.max(0, noticeOwed - (dailyFull * noticeServed));
      if (noticeDeduct > 0) {
        noticePay = -noticeDeduct;
        noticeNote = `Employee did not serve full notice. Deduction: AED ${noticeDeduct.toFixed(2)}`;
      } else {
        noticeNote = 'Employee fully served notice period';
      }
    }

    let leaveValue = 0;
    if (!inProbation || (inProbation && yearsTotal >= 0.5)) {
      leaveValue = dailyFull * (parseFloat(exData.leave) || 0);
    }

    const lastMonthWage = dailyFull * end.getDate();
    const grossDues = eosb + Math.max(0, noticePay) + leaveValue + lastMonthWage;
    const noticeDeductVal = noticePay < 0 ? Math.abs(noticePay) : 0;
    const deductions = parseFloat(exData.deduct) || 0;
    const totalDeduct = deductions + noticeDeductVal;
    const net = grossDues - totalDeduct;

    setExResult({
      error: null,
      eosb, noticePay, noticeNote, leaveValue, lastMonthWage, grossDues, totalDeduct, net,
      yearsTotal,
      inProbation,
      isMisconduct
    });
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in print:space-y-0">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('payroll.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('payroll.subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 bg-surface-50 p-1 rounded-xl w-fit print:hidden">
        {[
          { key: 'exit', label: t('payroll.tab_exit'), icon: DollarSign },
          { key: 'visa', label: t('payroll.tab_visa'), icon: FileText },
          { key: 'absence', label: t('payroll.tab_absence'), icon: Clock },
          { key: 'attendance', label: t('payroll.tab_attendance'), icon: Calculator },
          { key: 'matrix', label: t('payroll.tab_matrix'), icon: Scale },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.key ? 'bg-brand-700 text-white shadow-sm' : 'text-surface-600 hover:bg-surface-100'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'exit' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="!p-6">
            <h2 className="font-semibold text-surface-800 mb-2 flex items-center gap-2">
              <Calculator size={18} className="text-brand-500" /> {t('payroll.calc_title', 'Employee Exit Settlement Calculator')}
            </h2>
            <p className="text-xs text-surface-500 mb-4">{t('payroll.calc_subtitle', 'UAE Federal Decree-Law No. 33 of 2021')}</p>
            <div className="space-y-4">
              <Input label={t('payroll.emp_name', 'Employee Name')} value={exData.name} onChange={e => setExData({ ...exData, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <Input label={t('payroll.monthly_basic', 'Monthly Basic Wage (AED)')} type="number" value={exData.basic} onChange={e => setExData({ ...exData, basic: e.target.value })} />
                <Input label={t('payroll.monthly_full', 'Monthly Full Wage (AED)')} type="number" value={exData.full} onChange={e => setExData({ ...exData, full: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label={t('payroll.start_date', 'Start Date')} type="date" value={exData.start} onChange={e => setExData({ ...exData, start: e.target.value })} />
                <Input label={t('payroll.last_working_day', 'Last Working Day')} type="date" value={exData.end} onChange={e => setExData({ ...exData, end: e.target.value })} />
                <Input label={t('payroll.probation_ends', 'Probation Ends')} type="date" value={exData.prob} onChange={e => setExData({ ...exData, prob: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select label={t('payroll.exit_type', 'Exit Type')} value={exData.type} onChange={e => setExData({ ...exData, type: e.target.value })}
                  options={[
                    { value: 'term_legit', label: t('payroll.term_employer', 'Termination by Employer') },
                    { value: 'term_misconduct', label: t('payroll.dismissal', 'Dismissal for Misconduct (Art. 44)') },
                    { value: 'resign', label: t('payroll.resignation', 'Resignation by Employee') },
                    { value: 'expiry', label: t('payroll.expiry', 'Contract Expiry') },
                    { value: 'mutual', label: t('payroll.mutual', 'Mutual Agreement') }
                  ]} />
                <Select label={t('payroll.visa_type', 'Visa Type')} value={exData.visa} onChange={e => setExData({ ...exData, visa: e.target.value })}
                  options={[{ value: 'full', label: t('payroll.full_visa', 'Full Employer Visa') }, { value: 'wp', label: t('payroll.wp_only', 'Work Permit Only') }]} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label={t('payroll.unused_leave', 'Unused Annual Leave Days')} type="number" value={exData.leave} onChange={e => setExData({ ...exData, leave: e.target.value })} />
                <Input label={t('payroll.unpaid_leave', 'Total Unpaid Leave Days')} type="number" value={exData.unpaid} onChange={e => setExData({ ...exData, unpaid: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label={t('payroll.notice_served', 'Notice Period Served (days)')} type="number" value={exData.noticeServed} onChange={e => setExData({ ...exData, noticeServed: e.target.value })} />
                <Input label={t('payroll.deductions', 'Deductions/Advances (AED)')} type="number" value={exData.deduct} onChange={e => setExData({ ...exData, deduct: e.target.value })} />
              </div>
              <Button onClick={calcExitSettlement} className="w-full">{t('payroll.calc_btn', 'Calculate Final Settlement')}</Button>
            </div>
          </Card>

          {exResult && (
            <Card className="!p-6 bg-surface-50 border-surface-200">
              {exResult.error ? (
                <div className="text-red-600 bg-red-50 p-3 rounded">{exResult.error}</div>
              ) : (
                <>
                  <h2 className="font-semibold text-surface-800 mb-4">Final Settlement Breakdown</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-600">Total Service Period:</span>
                      <span className="font-medium">{exResult.yearsTotal.toFixed(2)} Years {exResult.inProbation && '(In Probation)'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-600">EOSB (Gratuity):</span>
                      <span className="font-semibold text-emerald-700">{exResult.eosb.toFixed(2)} AED</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-600">Notice Pay (owed to emp):</span>
                      <span className="font-medium">{Math.max(0, exResult.noticePay).toFixed(2)} AED</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-600">Unused Leave Encashment:</span>
                      <span className="font-medium">{exResult.leaveValue.toFixed(2)} AED</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-600">Wages (Last Month to LWD):</span>
                      <span className="font-medium">{exResult.lastMonthWage.toFixed(2)} AED</span>
                    </div>
                    <div className="border-t border-surface-200 my-2 pt-2 flex justify-between font-semibold">
                      <span>Total Gross Dues:</span>
                      <span>{exResult.grossDues.toFixed(2)} AED</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Total Deductions (Advances/Notice):</span>
                      <span>- {exResult.totalDeduct.toFixed(2)} AED</span>
                    </div>
                    <div className="p-4 bg-brand-700 text-white rounded-xl mt-4 flex justify-between items-center shadow-lg">
                      <span className="font-semibold text-lg">Net Settlement</span>
                      <span className="font-bold text-2xl">{exResult.net.toFixed(2)} AED</span>
                    </div>
                    {exResult.noticeNote && <p className="text-xs text-surface-500 mt-2">*{exResult.noticeNote}</p>}
                    {exResult.isMisconduct && <p className="text-xs text-red-600 mt-1">*Art 44: EOSB forfeited.</p>}
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === 'visa' && (
        <Card className="!p-6">
          <h2 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <FileText size={18} className="text-brand-500" /> {t('payroll.visa_title', 'Work Permit Only vs. Full Employer-Sponsored Visa')}
          </h2>
          <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 p-3 text-sm mb-6 rounded-r">
            {t('payroll.visa_subtitle', 'All UAE Labour Law rights apply equally to BOTH categories. Differences are administrative only.')}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-surface-100">
                  <th className="p-3 text-left border border-surface-200">{t('payroll.entitlement', 'Entitlement')}</th>
                  <th className="p-3 text-left border border-surface-200 bg-brand-50 text-brand-800">{t('payroll.full_visa', 'Full Employer Visa')}</th>
                  <th className="p-3 text-left border border-surface-200 bg-emerald-50 text-emerald-800">{t('payroll.wp_only', 'Work Permit Only')}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['EOSB Gratuity', 'Full entitlement (21d/yr ≤5yrs, 30d/yr >5yrs)', 'Identical'],
                  ['Annual Leave (30 days)', 'Fully applicable', 'Fully applicable'],
                  ['Sick Leave (90 days)', 'Fully applicable', 'Fully applicable'],
                  ['Overtime Pay', 'Fully applicable', 'Fully applicable'],
                  ['Notice Period Pay', 'Fully applicable', 'Fully applicable'],
                  ['Mandatory Health Ins.', 'Employer MUST provide', 'Employer MUST provide'],
                  ['Repatriation Ticket', 'Employer obligated if employer terminates', 'No employer obligation'],
                  ['Visa Cancellation', 'Employer cancels residency; bears cost', 'Employee cancels permit; no residency cost'],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-surface-50">
                    <td className="p-3 border border-surface-200 font-medium text-surface-700">{row[0]}</td>
                    <td className="p-3 border border-surface-200 text-surface-600">✅ {row[1]}</td>
                    <td className="p-3 border border-surface-200 text-surface-600">✅ {row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'absence' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="!p-6">
              <h3 className="font-semibold text-surface-800 mb-4">{t('payroll.unauthorized_absence_deduction', '🚫 Unauthorized Absence Deduction')}</h3>
              <div className="space-y-4">
                <Input label={t('payroll.monthly_full_wage', 'Monthly Full Wage (AED)')} type="number" value={absData.wage} onChange={e => setAbsData({ ...absData, wage: e.target.value })} />
                <Input label={t('payroll.absent_days', 'Absent Days')} type="number" value={absData.days} onChange={e => setAbsData({ ...absData, days: e.target.value })} />
                {absData.wage && absData.days && (
                  <div className="p-3 bg-red-50 text-red-700 font-semibold rounded mt-2">
                    Deduction: AED {((parseFloat(absData.wage) / 30) * parseFloat(absData.days)).toFixed(2)}
                  </div>
                )}
              </div>
            </Card>

            <Card className="!p-6">
              <h3 className="font-semibold text-surface-800 mb-4">⏰ {t('payroll.lateness_deduction', 'Lateness Deduction Calculator')}</h3>
              <div className="space-y-4">
                <Input label={t('payroll.monthly_full_wage', 'Monthly Full Wage (AED)')} type="number" value={lateData.wage} onChange={e => setLateData({ ...lateData, wage: e.target.value })} />
                <div className="grid grid-cols-3 gap-2">
                  <Input label={t('payroll.hours', 'Hours')} type="number" value={lateData.hrs} onChange={e => setLateData({ ...lateData, hrs: e.target.value })} />
                  <Input label={t('payroll.minutes', 'Minutes')} type="number" value={lateData.min} onChange={e => setLateData({ ...lateData, min: e.target.value })} />
                  <Input label={t('payroll.incidents', 'Incidents')} type="number" value={lateData.count} onChange={e => setLateData({ ...lateData, count: e.target.value })} />
                </div>
                {lateData.wage && (lateData.hrs || lateData.min) && (
                  <div className="p-3 bg-orange-50 text-orange-700 font-semibold rounded mt-2">
                    Deduction: AED {((parseFloat(lateData.wage) / 30 / 8) * (parseFloat(lateData.hrs || 0) + parseFloat(lateData.min || 0) / 60)).toFixed(2)}
                  </div>
                )}
              </div>
            </Card>

            <Card className="!p-6">
              <h3 className="font-semibold text-surface-800 mb-4">📊 50% Deduction Cap Check</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Monthly Wage" type="number" value={capData.wage} onChange={e => setCapData({ ...capData, wage: e.target.value })} />
                  <Input label="Advances/Loans" type="number" value={capData.adv} onChange={e => setCapData({ ...capData, adv: e.target.value })} />
                  <Input label="Absence Deduct" type="number" value={capData.absence} onChange={e => setCapData({ ...capData, absence: e.target.value })} />
                  <Input label="Lateness Deduct" type="number" value={capData.late} onChange={e => setCapData({ ...capData, late: e.target.value })} />
                </div>
                {capData.wage && (
                  <div className="p-3 bg-surface-100 rounded mt-2">
                    {(() => {
                      const total = (parseFloat(capData.adv)||0) + (parseFloat(capData.absence)||0) + (parseFloat(capData.late)||0);
                      const cap = parseFloat(capData.wage) * 0.5;
                      if (total > cap) {
                        return <span className="text-red-600 font-semibold">Exceeds 50% Cap! (Max allowed: AED {cap.toFixed(2)})</span>;
                      }
                      return <span className="text-emerald-600 font-semibold">Within Cap (Total: AED {total.toFixed(2)}, Limit: AED {cap.toFixed(2)})</span>;
                    })()}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div>
            <Card className="!p-6 h-full">
              <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-brand-500" /> {t('payroll.disciplinary_framework', 'Disciplinary Escalation Framework')}
              </h3>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-200 before:to-transparent">
                {[
                  { lvl: 1, title: t('payroll.verbal_warning', 'Verbal Warning'), trig: '1st-2nd lateness', bg: 'bg-surface-200 text-surface-700' },
                  { lvl: 2, title: t('payroll.written_warning', 'Written Warning'), trig: '3rd lateness or 2nd absence', bg: 'bg-amber-100 text-amber-700' },
                  { lvl: 3, title: t('payroll.final_warning', 'Final Warning'), trig: '4th-5th lateness or 3rd absence', bg: 'bg-orange-100 text-orange-700' },
                  { lvl: 4, title: t('payroll.unpaid_suspension', 'Unpaid Suspension'), trig: 'Persistent violations', bg: 'bg-red-100 text-red-700' },
                  { lvl: 5, title: t('payroll.termination', 'Termination (Art 44)'), trig: '7+ consecutive / 20 non-consec days', bg: 'bg-red-600 text-white' },
                ].map((item, i) => (
                  <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white ${item.bg} shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2`}>
                      {item.lvl}
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
                      <div className="font-bold text-surface-800">{item.title}</div>
                      <div className="text-xs text-surface-500 mt-1">{item.trig}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-6">
          {!showReport ? (
            <>
              <Card className="!p-6">
                <h3 className="font-semibold text-surface-800 mb-4">{t('payroll.attendance_report_builder', 'Monthly Attendance & Leave Report Builder')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Input label="Employee Name" value={attData.name} onChange={e => setAttData({ ...attData, name: e.target.value })} />
                  <Input label="Department/Entity" value={attData.dept} onChange={e => setAttData({ ...attData, dept: e.target.value })} />
                  <Input label={t('payroll.report_month', 'Report Month')} type="month" value={attData.month} onChange={e => setAttData({ ...attData, month: e.target.value })} />
                  <Input label="Monthly Full Wage" type="number" value={attData.wage} onChange={e => setAttData({ ...attData, wage: e.target.value })} />
                  <Input label="Monthly Basic Wage" type="number" value={attData.basic} onChange={e => setAttData({ ...attData, basic: e.target.value })} />
                  <Select label="Visa Type" value={attData.visa} onChange={e => setAttData({ ...attData, visa: e.target.value })} options={[{ value: 'full', label: 'Full Employer Visa' }, { value: 'wp', label: 'Work Permit Only' }]} />
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <Card className="!p-6">
                    <h4 className="font-semibold text-surface-800 mb-3">{t('payroll.attendance_metrics', 'A. Attendance Metrics')}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label={t('payroll.working_days', 'Working Days')} type="number" value={attData.workdays} onChange={e => setAttData({ ...attData, workdays: e.target.value })} />
                      <Input label={t('payroll.days_present', 'Days Present')} type="number" value={attData.present} onChange={e => setAttData({ ...attData, present: e.target.value })} />
                      <Input label={t('payroll.auth_absence', 'Auth. Absence')} type="number" value={attData.auth} onChange={e => setAttData({ ...attData, auth: e.target.value })} />
                      <Input label={t('payroll.unauth_absence', 'Unauth. Absence')} type="number" value={attData.unauth} onChange={e => setAttData({ ...attData, unauth: e.target.value })} />
                      <Input label="Public Holidays" type="number" value={attData.ph} onChange={e => setAttData({ ...attData, ph: e.target.value })} />
                    </div>
                  </Card>

                  <Card className="!p-6">
                    <h4 className="font-semibold text-surface-800 mb-3">B. Overtime & Lateness</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="OT Std (1.25x)" type="number" value={attData.otStd} onChange={e => setAttData({ ...attData, otStd: e.target.value })} />
                      <Input label="OT Night/Fri (1.5x)" type="number" value={attData.otFri} onChange={e => setAttData({ ...attData, otFri: e.target.value })} />
                      <Input label="Late Hrs" type="number" value={attData.ltHrs} onChange={e => setAttData({ ...attData, ltHrs: e.target.value })} />
                      <Input label="Late Incidents" type="number" value={attData.ltCount} onChange={e => setAttData({ ...attData, ltCount: e.target.value })} />
                    </div>
                  </Card>
                  
                  <Card className="!p-6">
                    <h4 className="font-semibold text-surface-800 mb-3">C. Deductions</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <Input label="Absence (AED)" type="number" value={attData.dAbs} onChange={e => setAttData({ ...attData, dAbs: e.target.value })} />
                      <Input label="Lateness (AED)" type="number" value={attData.dLate} onChange={e => setAttData({ ...attData, dLate: e.target.value })} />
                      <Input label="Advances (AED)" type="number" value={attData.dAdv} onChange={e => setAttData({ ...attData, dAdv: e.target.value })} />
                    </div>
                  </Card>
                </div>

                <Card className="!p-6">
                  <h4 className="font-semibold text-surface-800 mb-3">{t('payroll.leave_balances', 'D. Leave Balances (Used YTD)')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { k: 'al', lbl: t('payroll.annual_leave', 'Annual Leave'), max: 30 },
                      { k: 'slFull', lbl: t('payroll.sick_full', 'Sick (Full)'), max: 15 },
                      { k: 'slHalf', lbl: t('payroll.sick_half', 'Sick (Half)'), max: 30 },
                      { k: 'slUn', lbl: t('payroll.sick_unpaid', 'Sick (Unpaid)'), max: 45 },
                      { k: 'matFull', lbl: 'Maternity', max: 45 },
                      { k: 'pat', lbl: 'Paternity', max: 5 },
                    ].map(l => (
                      <div key={l.k}>
                        <div className="flex justify-between text-xs mb-1"><span className="font-medium">{l.lbl}</span><span className="text-surface-400">Max: {l.max}</span></div>
                        <div className="flex items-center gap-2">
                          <Input type="number" value={attData.leaves[l.k]} onChange={e => setAttData({ ...attData, leaves: { ...attData.leaves, [l.k]: e.target.value } })} className="w-20" />
                          <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${parseFloat(attData.leaves[l.k] || 0) > l.max ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, (parseFloat(attData.leaves[l.k] || 0) / l.max) * 100)}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
              <div className="text-center pt-4">
                <Button onClick={() => setShowReport(true)} className="px-8"><FileText size={18} className="mr-2" /> Generate Report</Button>
              </div>
            </>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-surface-200 shadow-sm print:shadow-none print:border-none">
              <div className="text-center mb-8 border-b pb-4">
                <h2 className="text-2xl font-bold text-surface-900">Monthly Attendance & Payroll Report</h2>
                <p className="text-surface-500">{attData.month} | Generated: {new Date().toLocaleDateString()}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="font-bold border-b mb-2">Employee Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-surface-500">Name:</span> <span className="font-medium">{attData.name || '-'}</span>
                    <span className="text-surface-500">Department:</span> <span>{attData.dept || '-'}</span>
                    <span className="text-surface-500">Visa Type:</span> <span>{attData.visa === 'wp' ? 'Work Permit Only' : 'Full Employer Visa'}</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold border-b mb-2">Salary Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-surface-500">Basic Wage:</span> <span>AED {parseFloat(attData.basic||0).toFixed(2)}</span>
                    <span className="text-surface-500">Full Wage:</span> <span>AED {parseFloat(attData.wage||0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="font-bold border-b mb-2">Attendance Summary</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr><td className="py-1">Working Days</td><td className="text-right font-medium">{attData.workdays || 0}</td></tr>
                      <tr><td className="py-1">Days Present</td><td className="text-right font-medium">{attData.present || 0}</td></tr>
                      <tr><td className="py-1 text-red-600">Unauthorized Absence</td><td className="text-right text-red-600 font-medium">{attData.unauth || 0}</td></tr>
                      <tr><td className="py-1 text-orange-600">Late Incidents / Hrs</td><td className="text-right text-orange-600 font-medium">{attData.ltCount || 0} / {attData.ltHrs || 0}h</td></tr>
                      <tr><td className="py-1 text-emerald-600">Overtime Hours</td><td className="text-right text-emerald-600 font-medium">{(parseFloat(attData.otStd||0) + parseFloat(attData.otFri||0)).toFixed(1)}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3 className="font-bold border-b mb-2">Deductions (AED)</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr><td className="py-1">Absence</td><td className="text-right text-red-600">- {parseFloat(attData.dAbs||0).toFixed(2)}</td></tr>
                      <tr><td className="py-1">Lateness</td><td className="text-right text-red-600">- {parseFloat(attData.dLate||0).toFixed(2)}</td></tr>
                      <tr><td className="py-1">Advances</td><td className="text-right text-red-600">- {parseFloat(attData.dAdv||0).toFixed(2)}</td></tr>
                      <tr className="font-bold border-t"><td className="py-1">Total Deductions</td><td className="text-right text-red-600">- {(parseFloat(attData.dAbs||0) + parseFloat(attData.dLate||0) + parseFloat(attData.dAdv||0)).toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="font-bold border-b mb-2">Leave Balances YTD</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>Annual: {attData.leaves.al||0}/30</div>
                  <div>Sick (Full): {attData.leaves.slFull||0}/15</div>
                  <div>Sick (Half): {attData.leaves.slHalf||0}/30</div>
                  <div>Maternity: {attData.leaves.matFull||0}/45</div>
                  <div>Paternity: {attData.leaves.pat||0}/5</div>
                </div>
              </div>

              <div className="flex gap-4 justify-center print:hidden pt-6 border-t">
                <Button onClick={() => setShowReport(false)} variant="secondary">Back to Editor</Button>
                <Button onClick={handlePrintReport}><FileText size={18} className="mr-2" /> Print Report</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'matrix' && (
        <Card className="!p-6">
          <h2 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <Scale size={18} className="text-brand-500" /> {t('payroll.exit_matrix', 'Exit Decision Matrix')}
          </h2>
          <div className="bg-emerald-50 text-emerald-800 p-3 text-sm mb-4 rounded border border-emerald-200">
            <strong>UAE Federal Decree-Law No. 33 of 2021:</strong> Resignation no longer reduces EOSB (old Law 8/1980 reduction rules abolished).
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-brand-800 text-white">
                  <th className="p-3 border border-brand-900 font-bold">{t('payroll.exit_scenario', 'Exit Scenario')}</th>
                  <th className="p-3 border border-brand-900">{t('payroll.during_probation', 'During Probation')}</th>
                  <th className="p-3 border border-brand-900">{t('payroll.after_probation', 'After Probation &lt;1 yr')}</th>
                  <th className="p-3 border border-brand-900">{t('payroll.years_1_5', '1–5 Years Service')}</th>
                  <th className="p-3 border border-brand-900">{t('payroll.years_5_plus', '&gt;5 Years Service')}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['🏛️ ' + t('payroll.employer_terminates', 'Employer Terminates (Legitimate)'), 'No EOSB\n1 day notice', 'No EOSB\n30-day notice pay', 'Full EOSB\n21d/yr basic\n+ Notice pay', 'Full EOSB\n(21d×5 + 30d/yr)\n+ Notice pay'],
                  ['🚶 ' + t('payroll.employee_resigns', 'Employee Resigns (Voluntary)'), 'No EOSB\n14d notice (abroad)', 'No EOSB\nMust serve notice', 'Full EOSB\n21d/yr\nMust serve notice', 'Full EOSB\n(21d×5 + 30d/yr)\nMust serve notice'],
                  ['❌ ' + t('payroll.gross_misconduct', 'Gross Misconduct (Art. 44)'), 'No EOSB\nNo notice', 'No EOSB\nNo notice', 'EOSB FORFEITED\nNo notice pay', 'EOSB FORFEITED\nNo notice pay'],
                  ['📄 ' + t('payroll.contract_expiry', 'Contract Expiry'), 'N/A', 'No EOSB\nWages to date', 'Full EOSB\n21d/yr', 'Full EOSB\n(21d×5 + 30d/yr)'],
                  ['🤝 ' + t('payroll.mutual_agreement', 'Mutual Agreement'), 'Full wages to date', 'Wages to date\nEOSB if agreed', 'Full EOSB\nor negotiated amount', 'Full EOSB\nor negotiated amount'],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-surface-50 border-b border-surface-200">
                    <td className="p-3 font-bold bg-surface-50 border-r border-surface-200">{row[0]}</td>
                    <td className="p-3 border-r border-surface-200 whitespace-pre-line text-surface-600">{row[1]}</td>
                    <td className="p-3 border-r border-surface-200 whitespace-pre-line text-surface-600">{row[2]}</td>
                    <td className={`p-3 border-r border-surface-200 whitespace-pre-line font-medium ${row[3].includes('FORFEITED') ? 'text-red-600' : row[3].includes('Full EOSB') ? 'text-emerald-700' : 'text-surface-600'}`}>{row[3]}</td>
                    <td className={`p-3 whitespace-pre-line font-medium ${row[4].includes('FORFEITED') ? 'text-red-600' : row[4].includes('Full EOSB') ? 'text-emerald-700' : 'text-surface-600'}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
