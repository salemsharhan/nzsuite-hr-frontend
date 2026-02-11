import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { buildKdaPayrollCsv, downloadCsv } from '@/utils/payrollReportExport';
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
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
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

  const loadReport = useCallback(async () => {
    if (!companyId) {
      toast.error('Company not set.');
      return;
    }
    setLoading(true);
    setSavedInfo(null);
    try {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);

      const saved = await getSavedPayrollReport(companyId, y, m, department);
      if (saved?.report_data?.meta && Array.isArray(saved?.report_data?.rows)) {
        setMeta(saved.report_data.meta);
        setRows(saved.report_data.rows);
        setSavedInfo({
          savedAt: saved.saved_at,
          savedByEmail: saved.saved_by_email ?? null
        });
        toast.success(`Loaded saved report (${saved.report_data.rows.length} employees). Last saved ${new Date(saved.saved_at).toLocaleString()} by ${saved.saved_by_email || '—'}.`);
        return;
      }

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
      setSavedInfo(null);
      toast.success(`Generated report for ${report.rows.length} employees. Save to reuse this report next time.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load payroll report.');
    } finally {
      setLoading(false);
    }
  }, [companyId, month, year, department]);

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
      toast.success('Report saved. Next time you load this month & year, this saved version will open.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save report.');
    } finally {
      setSaving(false);
    }
  }, [companyId, user, meta, rows, year, month, department]);

  const round3 = (n: number) => Math.round(n * 1000) / 1000;

  const updateRow = (employeeId: string, updates: Partial<KdaPayrollReportRow>) => {
    setRows((prev) =>
      prev.map((r) =>
        r.employeeId === employeeId ? { ...r, ...updates } : r
      )
    );
  };

  const updateNumericAndRecalc = (
    employeeId: string,
    updates: Partial<Pick<KdaPayrollReportRow, 'basicSalaryKwd' | 'workingDaysInMonth' | 'actualWorkingDays' | 'paidLeaveDays' | 'salaryKwd' | 'paidLeaveKwd' | 'housingAllowanceKwd' | 'otherKwd' | 'netSalaryKwd'>>
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.employeeId !== employeeId) return r;
        const next = { ...r, ...updates };
        const work = next.workingDaysInMonth ?? 0;
        const present = next.actualWorkingDays ?? 0;
        const leave = next.paidLeaveDays ?? 0;
        const absent = Math.max(0, work - present - leave);
        let salary = next.salaryKwd;
        let paidLeave = next.paidLeaveKwd;
        if (work > 0 && (updates.basicSalaryKwd !== undefined || updates.workingDaysInMonth !== undefined || updates.actualWorkingDays !== undefined || updates.paidLeaveDays !== undefined)) {
          salary = round3((next.basicSalaryKwd / work) * present);
          paidLeave = round3((next.basicSalaryKwd / work) * leave);
        }
        const housing = next.housingAllowanceKwd;
        const other = next.otherKwd;
        const totalGross = round3(salary + paidLeave + housing + other);
        const net = round3(next.netSalaryKwd ?? totalGross);
        return {
          ...next,
          absentDays: absent,
          salaryKwd: salary,
          paidLeaveKwd: paidLeave,
          totalGrossKwd: totalGross,
          netSalaryKwd: net,
          amountScheduledToPay: round3(net + (next.salaryRefund ?? 0))
        };
      })
    );
  };

  const updateRefund = (employeeId: string, value: number) => {
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

  const handleExport = () => {
    if (!meta || rows.length === 0) {
      toast.error('Load report first.');
      return;
    }
    const csv = buildKdaPayrollCsv({
      ...meta,
      rows
    });
    const monthName = MONTHS.find((m) => m.value === month)?.label || month;
    const filename = `Payroll_Report_${monthName}_${year}.csv`;
    downloadCsv(csv, filename);
    toast.success('Report exported.');
  };

  const totalNet = rows.reduce((s, r) => s + r.netSalaryKwd, 0);
  const totalRefund = rows.reduce((s, r) => s + r.salaryRefund, 0);
  const totalGross = rows.reduce((s, r) => s + r.totalGrossKwd, 0);

  return (
    <div className="space-y-6">
      <Card className="p-6 rounded-xl border-2 shadow-sm bg-gradient-to-br from-card to-muted/20">
        <h4 className="font-semibold mb-2 text-foreground">Payroll Report (KDA format)</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Scheduled days come from each employee’s shift. Present and Absent are from attendance; Leave from approved requests. Edit amounts in the table, then export.
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
          <Button onClick={loadReport} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Load Report
          </Button>
          {rows.length > 0 && (
            <>
              <Button variant="default" onClick={handleSaveReport} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Report
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </>
          )}
        </div>
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
              <table className="w-full text-sm border-collapse min-w-[1800px]">
                <thead className="sticky top-0 z-10">
                  <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-semibold [&>th]:text-foreground border-b-2 border-primary/20 bg-gradient-to-b from-muted/70 to-muted/50">
                    <th className="text-left w-10 border-r border-border/60" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.sn')}</th>
                    <th className="text-left min-w-[80px] border-r border-border/60" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.code')}</th>
                    <th className="text-left min-w-[160px] border-r border-border/60" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.name')}</th>
                    <th className="text-left min-w-[90px] border-r border-primary/30" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.join')}</th>
                    <th className="text-center min-w-[72px] bg-primary/10 border-r border-primary/20" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.scheduled')}</th>
                    <th className="text-center min-w-[72px] bg-primary/10 border-r border-primary/20" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.present')}</th>
                    <th className="text-center min-w-[72px] bg-primary/10 border-r border-primary/20" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.leave')}</th>
                    <th className="text-center min-w-[72px] bg-primary/10 border-r border-primary/30" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.absent')}</th>
                    <th className="text-right min-w-[88px] border-r border-border/60" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.basic')}</th>
                    <th className="text-right min-w-[88px] bg-muted/40 border-r border-border/50" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.salary')}</th>
                    <th className="text-right min-w-[88px] bg-muted/40 border-r border-border/50" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.paidLeave')}</th>
                    <th className="text-right min-w-[88px] bg-muted/40 border-r border-border/50" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.housing')}</th>
                    <th className="text-right min-w-[88px] bg-muted/40 border-r border-primary/30" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.other')}</th>
                    <th className="text-right min-w-[88px] border-r border-border/50" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.gross')}</th>
                    <th className="text-right min-w-[88px] border-r border-border/50" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.net')}</th>
                    <th className="text-right min-w-[88px] border-r border-primary/30" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.toPay')}</th>
                    <th className="text-left min-w-[120px] bg-muted/40 border-r border-border/50" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.method')}</th>
                    <th className="text-right min-w-[88px] bg-amber-500/15 border-r border-amber-500/30" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.refund')}</th>
                    <th className="text-left min-w-[90px] bg-muted/40" dir={isRtl ? 'rtl' : 'ltr'}>{t('payrollReport.notes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr
                      key={r.employeeId}
                      className={`border-b border-border/50 transition-colors hover:bg-primary/5 ${idx % 2 === 1 ? 'bg-muted/20' : ''}`}
                    >
                      <td className="px-3 py-2 align-middle tabular-nums text-foreground border-r border-border/40">{r.sn}</td>
                      <td className="px-3 py-2 font-mono text-xs align-middle text-foreground border-r border-border/40">{r.empCode}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate align-middle text-foreground border-r border-border/40" title={r.nameArabicEnglish}>{r.nameArabicEnglish}</td>
                      <td className="px-3 py-2 text-foreground align-middle tabular-nums border-r border-primary/20">{r.joinDate}</td>
                      <td className="px-3 py-2 align-middle bg-primary/5 border-r border-primary/20">
                        <Input
                          type="number"
                          min="0"
                          className="num-input h-9 min-w-[4rem] w-full max-w-[4.5rem] px-2 text-center tabular-nums text-foreground border border-input bg-background"
                          value={r.workingDaysInMonth ?? ''}
                          onChange={(e) => updateNumericAndRecalc(r.employeeId, { workingDaysInMonth: parseInt(e.target.value, 10) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle bg-primary/5 border-r border-primary/20">
                        <Input
                          type="number"
                          min="0"
                          className="num-input h-9 min-w-[4rem] w-full max-w-[4.5rem] px-2 text-center tabular-nums text-foreground border border-input bg-background"
                          value={r.actualWorkingDays}
                          onChange={(e) => updateNumericAndRecalc(r.employeeId, { actualWorkingDays: parseInt(e.target.value, 10) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle bg-primary/5 border-r border-primary/20">
                        <Input
                          type="number"
                          min="0"
                          className="num-input h-9 min-w-[4rem] w-full max-w-[4.5rem] px-2 text-center tabular-nums text-foreground border border-input bg-background"
                          value={r.paidLeaveDays}
                          onChange={(e) => updateNumericAndRecalc(r.employeeId, { paidLeaveDays: parseInt(e.target.value, 10) || 0 })}
                        />
                      </td>
                      <td className={`px-3 py-2 text-center align-middle font-medium tabular-nums bg-primary/5 border-r border-primary/20 ${r.absentDays > 0 ? 'text-amber-600 bg-amber-500/10' : 'text-foreground'}`}>
                        {r.absentDays}
                      </td>
                      <td className="px-3 py-2 align-middle border-r border-border/40">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          className="num-input h-9 min-w-[7rem] w-full max-w-[8rem] pl-2 pr-3 text-right tabular-nums text-foreground border border-input bg-background"
                          value={r.basicSalaryKwd === 0 ? '' : r.basicSalaryKwd}
                          onChange={(e) => updateNumericAndRecalc(r.employeeId, { basicSalaryKwd: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle bg-muted/30 border-r border-border/40">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          className="num-input h-9 min-w-[7rem] w-full max-w-[8rem] pl-2 pr-3 text-right tabular-nums text-foreground border border-input bg-background"
                          value={r.salaryKwd === 0 ? '' : r.salaryKwd}
                          onChange={(e) => updateNumericAndRecalc(r.employeeId, { salaryKwd: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle bg-muted/30 border-r border-border/40">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          className="num-input h-9 min-w-[7rem] w-full max-w-[8rem] pl-2 pr-3 text-right tabular-nums text-foreground border border-input bg-background"
                          value={r.paidLeaveKwd === 0 ? '' : r.paidLeaveKwd}
                          onChange={(e) => updateNumericAndRecalc(r.employeeId, { paidLeaveKwd: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle bg-muted/30 border-r border-border/40">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          className="num-input h-9 min-w-[7rem] w-full max-w-[8rem] pl-2 pr-3 text-right tabular-nums text-foreground border border-input bg-background"
                          value={r.housingAllowanceKwd === 0 ? '' : r.housingAllowanceKwd}
                          onChange={(e) => updateNumericAndRecalc(r.employeeId, { housingAllowanceKwd: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle bg-muted/30 border-r border-primary/20">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          className="num-input h-9 min-w-[7rem] w-full max-w-[8rem] pl-2 pr-3 text-right tabular-nums text-foreground border border-input bg-background"
                          value={r.otherKwd === 0 ? '' : r.otherKwd}
                          onChange={(e) => updateNumericAndRecalc(r.employeeId, { otherKwd: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium align-middle tabular-nums text-foreground border-r border-border/40">{r.totalGrossKwd.toFixed(3)}</td>
                      <td className="px-3 py-2 align-middle border-r border-border/40">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          className="num-input h-9 min-w-[7rem] w-full max-w-[8rem] pl-2 pr-3 text-right font-medium tabular-nums text-foreground border border-input bg-background"
                          value={r.netSalaryKwd === 0 ? '' : r.netSalaryKwd}
                          onChange={(e) => updateNumericAndRecalc(r.employeeId, { netSalaryKwd: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right align-middle tabular-nums font-medium text-foreground border-r border-primary/20">{r.amountScheduledToPay.toFixed(3)}</td>
                      <td className="px-3 py-2 align-middle bg-muted/30 border-r border-border/40">
                        <Select
                          value={r.methodOfPayment}
                          onValueChange={(v) => updateRow(r.employeeId, { methodOfPayment: v })}
                        >
                          <SelectTrigger className="h-9 min-w-[120px] text-foreground border border-input bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                            <SelectItem value="Check">Check</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 align-middle bg-amber-500/15 border-r border-amber-500/30">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          className="num-input h-9 min-w-[7rem] w-full max-w-[8rem] pl-2 pr-3 text-right tabular-nums text-foreground border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30"
                          value={r.salaryRefund || ''}
                          onChange={(e) => updateRefund(r.employeeId, parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle bg-muted/30">
                        <Input
                          className="h-9 min-w-[5rem] px-2 text-foreground border border-input bg-background"
                          value={r.notes}
                          onChange={(e) => updateRow(r.employeeId, { notes: e.target.value })}
                          placeholder="—"
                        />
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
          <p>Select month, year, and department, then click &quot;Load Report&quot; to build the payroll table.</p>
        </Card>
      )}
    </div>
  );
}
