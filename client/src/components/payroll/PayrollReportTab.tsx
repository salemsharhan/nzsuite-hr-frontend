import { useState, useEffect, useCallback } from 'react';
import { Download, Loader2, RefreshCw, FileSpreadsheet, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildKdaPayrollReport,
  getApprovedLeaveDaysForMonth,
  getWorkingDaysInMonthByEmployee,
  getActualWorkingDaysFromAttendance,
  type KdaPayrollReportRow
} from '@/services/payrollReportService';
import { downloadPayrollExcel } from '@/utils/payrollReportExcelExport';
import { PAYROLL_MONTH_DIVISOR } from '@/utils/payrollTemplate';
import { employeeService } from '@/services/employeeService';
import { getSavedPayrollReport, savePayrollReport } from '@/services/payrollReportStorageService';
import { toast } from 'sonner';

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
  { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' }
];

export default function PayrollReportTab() {
  const { user } = useAuth();
  const [month, setMonth] = useState('12');
  const [year, setYear] = useState('2025');
  const [department, setDepartment] = useState<string>('all');
  const [departmentOptions, setDepartmentOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{
    companyName: string;
    companyNameArabic: string;
    periodLabel: string;
    departmentLabel: string;
  } | null>(null);
  const [rows, setRows] = useState<KdaPayrollReportRow[]>([]);
  const [savedInfo, setSavedInfo] = useState<{ savedAt: string; savedByEmail: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reportSource, setReportSource] = useState<'saved' | 'generated' | null>(null);

  const companyId = user?.company_id;

  useEffect(() => {
    if (!companyId) return;
    employeeService.getAll(companyId).then((employees) => {
      const depts = new Set<string>();
      employees.forEach((e) => {
        const d = e.department || (e as any).departments?.name;
        if (d) depts.add(d);
      });
      setDepartmentOptions([
        { value: 'all', label: 'All Departments' },
        ...Array.from(depts).sort().map((d) => ({ value: d, label: d }))
      ]);
    });
  }, [companyId]);

  const loadReport = useCallback(async (options?: { forceRegenerate?: boolean }) => {
    if (!companyId) {
      toast.error('Company not set.');
      return;
    }
    setLoading(true);
    try {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      const forceRegenerate = options?.forceRegenerate ?? false;

      if (!forceRegenerate) {
        const saved = await getSavedPayrollReport(companyId, y, m, department);
        if (saved?.report_data?.meta && Array.isArray(saved?.report_data?.rows)) {
          setMeta(saved.report_data.meta);
          setRows(saved.report_data.rows);
          setSavedInfo({
            savedAt: saved.saved_at,
            savedByEmail: saved.saved_by_email ?? null
          });
          setDirty(false);
          setReportSource('saved');
          toast.success(`Loaded saved payroll for ${MONTHS.find((mo) => mo.value === month)?.label} ${year} (${saved.report_data.rows.length} employees).`);
          return;
        }
      }

      setSavedInfo(null);
      const [leaveDays, workingDaysMap, actualDaysMap] = await Promise.all([
        getApprovedLeaveDaysForMonth(companyId, y, m),
        getWorkingDaysInMonthByEmployee(companyId, y, m),
        getActualWorkingDaysFromAttendance(companyId, y, m)
      ]);
      const report = await buildKdaPayrollReport({
        companyId,
        month: m,
        year: y,
        department: department === 'all' ? undefined : department,
        workingDaysByEmployeeId: workingDaysMap,
        paidLeaveDaysByEmployeeId: leaveDays,
        actualDaysByEmployeeId: actualDaysMap
      });
      setMeta({
        companyName: report.companyName,
        companyNameArabic: report.companyNameArabic,
        periodLabel: report.periodLabel,
        departmentLabel: report.departmentLabel
      });
      setRows(report.rows);
      setDirty(false);
      setReportSource('generated');
      toast.success(
        forceRegenerate
          ? `Rebuilt payroll from attendance (${report.rows.length} employees). Save when edits are done.`
          : `Built payroll for ${report.rows.length} employees. Edit values, then Save.`
      );
    } catch (e) {
      console.error(e);
      toast.error('Failed to load payroll report.');
    } finally {
      setLoading(false);
    }
  }, [companyId, month, year, department]);

  /** Auto-load saved report (or build fresh) when month/year/department changes */
  useEffect(() => {
    if (!companyId) return;
    if (skipAutoLoad.current) {
      skipAutoLoad.current = false;
      return;
    }
    setMeta(null);
    setRows([]);
    setReportSource(null);
    loadReport();
  }, [companyId, month, year, department, loadReport]);

  const handleRegenerate = useCallback(async () => {
    if (dirty && !window.confirm('You have unsaved edits. Rebuild from attendance and discard them?')) {
      return;
    }
    await loadReport({ forceRegenerate: true });
  }, [dirty, loadReport]);

  const handleSaveReport = useCallback(async () => {
    if (!companyId || !user || !meta || rows.length === 0) {
      toast.error('Load a report first.');
      return;
    }
    setSaving(true);
    try {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      const saved = await savePayrollReport(
        companyId,
        y,
        m,
        department,
        { meta, rows },
        { userId: user.id, email: user.email }
      );
      setSavedInfo({
        savedAt: saved.saved_at,
        savedByEmail: saved.saved_by_email ?? null
      });
      setDirty(false);
      setReportSource('saved');
      toast.success('Payroll saved. It will load automatically next time you pick this month and year.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save report.');
    } finally {
      setSaving(false);
    }
  }, [companyId, user, meta, rows, year, month, department]);

  const round3 = (n: number) => Math.round(n * 1000) / 1000;

  const markDirty = () => setDirty(true);

  const updateRow = (employeeId: string, updates: Partial<KdaPayrollReportRow>) => {
    markDirty();
    setRows((prev) =>
      prev.map((r) =>
        r.employeeId === employeeId ? { ...r, ...updates } : r
      )
    );
  };

  const recalcRow = (row: KdaPayrollReportRow, updates: Partial<KdaPayrollReportRow> = {}): KdaPayrollReportRow => {
    const next = { ...row, ...updates };
    const present = next.actualWorkingDays ?? 0;
    const leave = next.paidLeaveDays ?? 0;
    const work = next.workingDaysInMonth ?? PAYROLL_MONTH_DIVISOR;
    const absent = Math.max(0, work - present - leave);

    const salary =
      updates.basicSalaryKwd !== undefined ||
      updates.actualWorkingDays !== undefined ||
      updates.paidLeaveDays !== undefined
        ? round3((next.basicSalaryKwd / PAYROLL_MONTH_DIVISOR) * present)
        : next.salaryKwd;
    const paidLeave =
      updates.basicSalaryKwd !== undefined ||
      updates.actualWorkingDays !== undefined ||
      updates.paidLeaveDays !== undefined
        ? round3((next.basicSalaryKwd / PAYROLL_MONTH_DIVISOR) * leave)
        : next.paidLeaveKwd;

    const totalGross = round3(
      salary +
        paidLeave +
        (next.overTimeKwd ?? 0) +
        (next.housingAllowanceKwd ?? 0) +
        (next.otherKwd ?? 0)
    );
    const totalDeductions = round3(
      (next.penaltiesKwd ?? 0) +
        (next.deductionsKwd ?? 0) +
        (next.loanKwd ?? 0) +
        (next.deductionsOtherKwd ?? 0)
    );
    const net =
      updates.netSalaryKwd !== undefined
        ? round3(next.netSalaryKwd)
        : round3(Math.max(0, totalGross - totalDeductions));

    return {
      ...next,
      absentDays: absent,
      salaryKwd: salary,
      paidLeaveKwd: paidLeave,
      totalGrossKwd: totalGross,
      netSalaryKwd: net,
      amountScheduledToPay: round3(net + (next.salaryRefund ?? 0))
    };
  };

  const updateNumericAndRecalc = (employeeId: string, updates: Partial<KdaPayrollReportRow>) => {
    markDirty();
    setRows((prev) =>
      prev.map((r) => (r.employeeId === employeeId ? recalcRow(r, updates) : r))
    );
  };

  const updateRefund = (employeeId: string, value: number) => {
    markDirty();
    setRows((prev) =>
      prev.map((r) => {
        if (r.employeeId !== employeeId) return r;
        const refund = round3(value);
        return {
          ...r,
          salaryRefund: refund,
          amountScheduledToPay: round3(r.netSalaryKwd + refund),
          notes: refund > 0 ? (r.notes || '*') : ''
        };
      })
    );
  };

  const handleExport = async () => {
    if (!meta || rows.length === 0) {
      toast.error('Load report first.');
      return;
    }
    try {
      const monthName = MONTHS.find((m) => m.value === month)?.label || month;
      const filename = `Payroll_${monthName}_${year}.xlsx`;
      await downloadPayrollExcel({ ...meta, rows }, filename);
      toast.success('Excel report exported.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export Excel report.');
    }
  };

  const totalNet = rows.reduce((s, r) => s + r.netSalaryKwd, 0);
  const totalRefund = rows.reduce((s, r) => s + r.salaryRefund, 0);
  const totalGross = rows.reduce((s, r) => s + r.totalGrossKwd, 0);

  return (
    <div className="space-y-6">
      <Card className="p-6 rounded-xl border-2 shadow-sm bg-gradient-to-br from-card to-muted/20">
        <h4 className="font-semibold mb-2 text-foreground">Payroll Report</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Pick a month and year — a saved payroll loads automatically if one exists, otherwise it builds from attendance and leave. Edit any values on screen, then click <strong>Save Payroll</strong>. Export Excel when ready.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Month</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Year</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Department</label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => loadReport()} disabled={loading} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Reload
          </Button>
          <Button onClick={handleRegenerate} disabled={loading} variant="outline">
            Rebuild from attendance
          </Button>
          {rows.length > 0 && (
            <>
              <Button variant="default" onClick={handleSaveReport} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Payroll
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            </>
          )}
        </div>
        {dirty && rows.length > 0 && (
          <p className="text-sm text-amber-600 mt-3 font-medium">Unsaved changes — click Save Payroll to keep your edits.</p>
        )}
        {reportSource === 'saved' && savedInfo && !dirty && (
          <p className="text-sm text-muted-foreground mt-3">
            Showing saved payroll from {new Date(savedInfo.savedAt).toLocaleString()}
            {savedInfo.savedByEmail ? ` by ${savedInfo.savedByEmail}` : ''}.
          </p>
        )}
      </Card>

      {meta && rows.length > 0 && (
        <>
          <div className="flex flex-wrap gap-4">
            <Card className="p-4 flex-1 min-w-[160px] rounded-xl border-2 bg-gradient-to-br from-primary/5 to-transparent border-primary/20 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Gross (KWD)</p>
              <p className="text-xl font-bold tabular-nums mt-1 text-foreground">{totalGross.toFixed(3)}</p>
            </Card>
            <Card className="p-4 flex-1 min-w-[160px] rounded-xl border-2 bg-gradient-to-br from-muted/40 to-transparent border-border shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Net (KWD)</p>
              <p className="text-xl font-bold tabular-nums mt-1 text-foreground">{totalNet.toFixed(3)}</p>
            </Card>
            <Card className="p-4 flex-1 min-w-[160px] rounded-xl border-2 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/30 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Refund (KWD)</p>
              <p className="text-xl font-bold tabular-nums mt-1 text-amber-600">{totalRefund.toFixed(3)}</p>
            </Card>
          </div>

          <Card className="overflow-hidden w-screen max-w-[80vw] relative left-1/2 -translate-x-1/2 rounded-xl border-2 shadow-lg shadow-black/5">
            <div className="p-4 border-b bg-gradient-to-r from-muted/50 to-muted/30">
              <p className="font-semibold text-foreground">{meta.companyNameArabic} — {meta.companyName}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{meta.periodLabel} · {meta.departmentLabel}</p>
              {savedInfo && (
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                  Last saved: {new Date(savedInfo.savedAt).toLocaleString()} by {savedInfo.savedByEmail || '—'}
                </p>
              )}
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[70vh] min-w-0 w-full bg-muted/10">
              <table className="w-full text-sm border-collapse min-w-[2400px]">
                <thead className="sticky top-0 z-10">
                  <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:font-semibold [&>th]:text-foreground border-b-2 border-primary/20 bg-[#D9E1F2]">
                    <th rowSpan={2} className="text-center border-r border-border/60">S/N</th>
                    <th rowSpan={2} className="text-center min-w-[80px] border-r border-border/60">Emp. Code<br />كود</th>
                    <th rowSpan={2} className="text-left min-w-[160px] border-r border-border/60">Name / Arabic<br />الاسم / عربي</th>
                    <th rowSpan={2} className="text-center min-w-[90px] border-r border-border/60">Join Date<br />تاريخ التعيين</th>
                    <th rowSpan={2} className="text-right min-w-[88px] border-r border-border/60">Basic Salary KWD<br />الراتب الأساسي</th>
                    <th rowSpan={2} className="text-center min-w-[72px] border-r border-border/60">Actual Working Days<br />أيام العمل الفعلية</th>
                    <th rowSpan={2} className="text-center min-w-[72px] border-r border-primary/30">Paid leave Days<br />اجازات مدفوعة</th>
                    <th colSpan={6} className="text-center border-r border-primary/30 bg-[#FFF2CC]">Gross Accrual Month</th>
                    <th colSpan={4} className="text-center border-r border-primary/30 bg-[#FFF2CC]">Deductions</th>
                    <th rowSpan={2} className="text-right min-w-[88px] border-r border-border/60">Net Salary KWD<br />صافي الراتب</th>
                    <th rowSpan={2} className="text-right min-w-[100px] border-r border-border/60">The amount scheduled to pay</th>
                    <th rowSpan={2} className="text-left min-w-[120px] border-r border-border/60">Method of payment</th>
                    <th rowSpan={2} className="text-right min-w-[88px] bg-amber-500/15 border-r border-amber-500/30">SALARY REFUND</th>
                    <th rowSpan={2} className="text-left min-w-[90px]">Notes<br />ملاحظات</th>
                  </tr>
                  <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:font-semibold [&>th]:text-foreground border-b-2 border-primary/20 bg-[#D9E1F2]">
                    <th className="text-right min-w-[80px] border-r border-border/50">Salary KWD<br />الراتب د.ك</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">Paid Leave KWD<br />اجازات مدفوعة د.ك</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">Over Time KWD<br />إضافي د.ك</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">housing allowance KWD<br />بدل سكن د.ك</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">Other<br />أخرى</th>
                    <th className="text-right min-w-[80px] border-r border-primary/30">Total<br />الإجمالي</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">Penalties<br />جزاءات</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">Deductions<br />خصومات</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">Loan<br />سلف</th>
                    <th className="text-right min-w-[80px] border-r border-primary/30">Other<br />أخرى</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr
                      key={r.employeeId}
                      className={`border-b border-border/50 transition-colors hover:bg-primary/5 ${idx % 2 === 1 ? 'bg-muted/20' : ''}`}
                    >
                      <td className="px-2 py-2 align-middle tabular-nums text-center border-r border-border/40">{r.sn}</td>
                      <td className="px-2 py-2 font-mono text-xs align-middle text-center border-r border-border/40">{r.empCode}</td>
                      <td className="px-2 py-2 max-w-[200px] truncate align-middle border-r border-border/40" title={r.nameArabicEnglish}>{r.nameArabicEnglish}</td>
                      <td className="px-2 py-2 text-center align-middle tabular-nums border-r border-border/40">{r.joinDate}</td>
                      <td className="px-2 py-2 align-middle border-r border-border/40">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right tabular-nums" value={r.basicSalaryKwd === 0 ? '' : r.basicSalaryKwd} onChange={(e) => updateNumericAndRecalc(r.employeeId, { basicSalaryKwd: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 align-middle border-r border-border/40">
                        <Input type="number" min="0" className="num-input h-8 min-w-[3.5rem] w-full text-center tabular-nums" value={r.actualWorkingDays} onChange={(e) => updateNumericAndRecalc(r.employeeId, { actualWorkingDays: parseInt(e.target.value, 10) || 0 })} />
                      </td>
                      <td className="px-2 py-2 align-middle border-r border-primary/20">
                        <Input type="number" min="0" className="num-input h-8 min-w-[3.5rem] w-full text-center tabular-nums" value={r.paidLeaveDays} onChange={(e) => updateNumericAndRecalc(r.employeeId, { paidLeaveDays: parseInt(e.target.value, 10) || 0 })} />
                      </td>
                      <td className="px-2 py-2 align-middle bg-muted/20 border-r border-border/40">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right tabular-nums" value={r.salaryKwd === 0 ? '' : r.salaryKwd} onChange={(e) => updateNumericAndRecalc(r.employeeId, { salaryKwd: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 align-middle bg-muted/20 border-r border-border/40">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right tabular-nums" value={r.paidLeaveKwd === 0 ? '' : r.paidLeaveKwd} onChange={(e) => updateNumericAndRecalc(r.employeeId, { paidLeaveKwd: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 align-middle bg-muted/20 border-r border-border/40">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right tabular-nums" value={r.overTimeKwd === 0 ? '' : r.overTimeKwd} onChange={(e) => updateNumericAndRecalc(r.employeeId, { overTimeKwd: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 align-middle bg-muted/20 border-r border-border/40">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right tabular-nums" value={r.housingAllowanceKwd === 0 ? '' : r.housingAllowanceKwd} onChange={(e) => updateNumericAndRecalc(r.employeeId, { housingAllowanceKwd: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 align-middle bg-muted/20 border-r border-border/40">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right tabular-nums" value={r.otherKwd === 0 ? '' : r.otherKwd} onChange={(e) => updateNumericAndRecalc(r.employeeId, { otherKwd: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 text-right font-medium align-middle tabular-nums border-r border-primary/20">{r.totalGrossKwd.toFixed(3)}</td>
                      <td className="px-2 py-2 align-middle border-r border-border/40">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right tabular-nums" value={r.penaltiesKwd === 0 ? '' : r.penaltiesKwd} onChange={(e) => updateNumericAndRecalc(r.employeeId, { penaltiesKwd: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 align-middle border-r border-border/40">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right tabular-nums" value={r.deductionsKwd === 0 ? '' : r.deductionsKwd} onChange={(e) => updateNumericAndRecalc(r.employeeId, { deductionsKwd: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 align-middle border-r border-border/40">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right tabular-nums" value={r.loanKwd === 0 ? '' : r.loanKwd} onChange={(e) => updateNumericAndRecalc(r.employeeId, { loanKwd: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 align-middle border-r border-primary/20">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right tabular-nums" value={r.deductionsOtherKwd === 0 ? '' : r.deductionsOtherKwd} onChange={(e) => updateNumericAndRecalc(r.employeeId, { deductionsOtherKwd: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 align-middle border-r border-border/40">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right font-medium tabular-nums" value={r.netSalaryKwd === 0 ? '' : r.netSalaryKwd} onChange={(e) => updateNumericAndRecalc(r.employeeId, { netSalaryKwd: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums font-medium border-r border-border/40">{r.amountScheduledToPay.toFixed(3)}</td>
                      <td className="px-2 py-2 align-middle border-r border-border/40">
                        <Select value={r.methodOfPayment} onValueChange={(v) => updateRow(r.employeeId, { methodOfPayment: v })}>
                          <SelectTrigger className="h-8 min-w-[110px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                            <SelectItem value="Check">Check</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2 align-middle bg-amber-500/15 border-r border-amber-500/30">
                        <Input type="number" step="0.001" min="0" className="num-input h-8 min-w-[6rem] w-full text-right tabular-nums border-amber-500/40 bg-amber-50 dark:bg-amber-950/30" value={r.salaryRefund || ''} onChange={(e) => updateRefund(r.employeeId, parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <Input className="h-8 min-w-[4rem] px-2" value={r.notes} onChange={(e) => updateRow(r.employeeId, { notes: e.target.value })} placeholder="—" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!loading && rows.length === 0 && meta === null && (
        <Card className="p-12 text-center text-muted-foreground">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select month and year above. A saved payroll loads automatically, or a new one is built from attendance.</p>
        </Card>
      )}
    </div>
  );
}
