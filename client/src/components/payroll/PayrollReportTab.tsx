import { useState, useEffect, useCallback, useRef } from 'react';
import { Download, FileDown, FileSpreadsheet, FileText, Loader2, RefreshCw, Save, Send, Upload } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildKdaPayrollReport,
  getApprovedLeaveDaysForMonth,
  getWorkingDaysInMonthByEmployee,
  getActualWorkingDaysFromAttendance,
  type KdaPayrollReportRow
} from '@/services/payrollReportService';
import { buildPayrollExcelBuffer, downloadPayrollExcel } from '@/utils/payrollReportExcelExport';
import { downloadPayrollCsv } from '@/utils/payrollReportCsvExport';
import { downloadPayrollPdf } from '@/utils/payrollReportPdfExport';
import {
  buildPayrollApprovalAttachment,
  PAYROLL_APPROVAL_FORMAT_OPTIONS,
  type PayrollApprovalAttachmentFormat
} from '@/utils/payrollReportApprovalAttachment';
import { importPayrollExcel } from '@/utils/payrollReportExcelImport';
import { PAYROLL_MONTH_DIVISOR } from '@/utils/payrollTemplate';
import { employeeService } from '@/services/employeeService';
import {
  getSavedPayrollReport,
  savePayrollReport,
  type PayrollApprovalStatus,
  type SavedPayrollReport
} from '@/services/payrollReportStorageService';
import {
  payrollApprovalStatusLabel,
  submitPayrollForApproval
} from '@/services/payrollApprovalService';
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
  const [savedInfo, setSavedInfo] = useState<{
    savedAt: string;
    savedByEmail: string | null;
    reportId?: string;
    approvalStatus?: PayrollApprovalStatus;
    submittedAt?: string | null;
    approvedAt?: string | null;
    approvedByName?: string | null;
    approvalNote?: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reportSource, setReportSource] = useState<'saved' | 'generated' | 'imported' | null>(null);
  const [importing, setImporting] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalAttachmentFormat, setApprovalAttachmentFormat] =
    useState<PayrollApprovalAttachmentFormat>('excel');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suppressAutoLoad = useRef(false);
  const reportSourceRef = useRef(reportSource);
  const dirtyRef = useRef(dirty);
  reportSourceRef.current = reportSource;
  dirtyRef.current = dirty;

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

  const applySavedReport = (saved: SavedPayrollReport) => {
    setMeta(saved.report_data.meta);
    setRows(saved.report_data.rows);
    setSavedInfo({
      savedAt: saved.saved_at,
      savedByEmail: saved.saved_by_email ?? null,
      reportId: saved.id,
      approvalStatus: saved.approval_status ?? 'draft',
      submittedAt: saved.submitted_at ?? null,
      approvedAt: saved.approved_at ?? null,
      approvedByName: saved.approved_by_name ?? null,
      approvalNote: saved.approval_note ?? null
    });
    setDirty(false);
    setReportSource('saved');
  };

  const loadReport = useCallback(async (options?: { forceRegenerate?: boolean }) => {
    if (!companyId) {
      toast.error('Company not set.');
      return;
    }
    if (
      reportSourceRef.current === 'imported' &&
      dirtyRef.current &&
      !options?.forceRegenerate &&
      !window.confirm('You have unsaved imported payroll data. Reload will discard it and load from the system or saved report. Continue?')
    ) {
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
          applySavedReport(saved);
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

  /** Auto-load when month/year/department changes */
  useEffect(() => {
    if (!companyId) return;
    if (suppressAutoLoad.current) {
      suppressAutoLoad.current = false;
      return;
    }
    if (reportSourceRef.current === 'imported' && dirtyRef.current) {
      return;
    }
    void loadReport();
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
        savedByEmail: saved.saved_by_email ?? null,
        reportId: saved.id,
        approvalStatus: saved.approval_status ?? 'draft',
        submittedAt: saved.submitted_at ?? null,
        approvedAt: saved.approved_at ?? null,
        approvedByName: saved.approved_by_name ?? null,
        approvalNote: saved.approval_note ?? null
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

  const approvalStatus = savedInfo?.approvalStatus ?? 'draft';
  const isApprovalLocked = approvalStatus === 'pending_approval' || approvalStatus === 'approved';

  const handleSubmitForApproval = useCallback(async (format: PayrollApprovalAttachmentFormat) => {
    if (!companyId || !user || !meta || rows.length === 0) {
      toast.error('Load a report first.');
      return;
    }
    if (isApprovalLocked) {
      toast.error(`Payroll is already ${payrollApprovalStatusLabel(approvalStatus).toLowerCase()}.`);
      return;
    }

    setSubmittingApproval(true);
    try {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      const monthName = MONTHS.find((mo) => mo.value === month)?.label || month;

      const saved = await savePayrollReport(
        companyId,
        y,
        m,
        department,
        { meta, rows },
        { userId: user.id, email: user.email }
      );

      const attachment = await buildPayrollApprovalAttachment(
        meta,
        rows,
        format,
        `Payroll_${monthName}_${year}`
      );

      const result = await submitPayrollForApproval({
        companyId,
        payrollReportId: saved.id,
        year: y,
        month: m,
        department,
        attachmentBase64: attachment.base64,
        attachmentFilename: attachment.filename,
        attachmentMime: attachment.mime
      });

      applySavedReport({
        ...saved,
        approval_status: 'pending_approval',
        submitted_at: new Date().toISOString(),
        submitted_by_email: user.email ?? null,
        whats_task_id: result.whats_task_id
      });

      setApprovalDialogOpen(false);
      toast.success('Payroll sent for approval. The approver will receive a WhatsApp poll.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to send for approval.');
    } finally {
      setSubmittingApproval(false);
    }
  }, [companyId, user, meta, rows, year, month, department, isApprovalLocked, approvalStatus]);

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

  const handleImportExcel = useCallback(
    async (file: File) => {
      if (!companyId) {
        toast.error('Company not set.');
        return;
      }
      if (dirty && !window.confirm('You have unsaved edits. Import from Excel and replace them?')) {
        return;
      }
      setImporting(true);
      try {
        let employees = await employeeService.getAll(companyId);
        if (department !== 'all') {
          employees = employees.filter(
            (e) =>
              (e.department || '').toLowerCase() === department.toLowerCase() ||
              ((e as { departments?: { name?: string } }).departments?.name || '').toLowerCase() ===
                department.toLowerCase()
          );
        }

        const result = await importPayrollExcel(file, employees, { department });

        suppressAutoLoad.current = true;
        setMeta(result.meta);
        setRows(result.rows);
        setSavedInfo(null);
        setDirty(true);
        setReportSource('imported');

        const unmatched = result.unmatchedNames.length;
        let msg = `Imported ${result.rows.length} row(s) from Excel`;
        if (result.matched > 0) {
          msg += ` (${result.matched} matched by name`;
          if (unmatched > 0) msg += `, ${unmatched} added without match`;
          msg += ')';
        } else if (unmatched > 0) {
          msg += ` (${unmatched} without employee match — still added)`;
        }
        msg += '. Save when ready.';
        toast.success(msg);
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : 'Failed to import Excel.');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [companyId, department, dirty, rows]
  );

  const onImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleImportExcel(file);
  };

  const handleExport = async () => {
    if (!meta || rows.length === 0) {
      toast.error('Load report first.');
      return;
    }
    try {
      const monthName = MONTHS.find((m) => m.value === month)?.label || month;
      const filename = `Payroll_${monthName}_${year}.xlsx`;
      const exportRows = rows.map((row) => ({ ...row }));
      await downloadPayrollExcel({ ...meta, rows: exportRows }, filename);
      toast.success(`Excel exported with ${exportRows.length} employee row(s).`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to export Excel report.');
    }
  };

  const handleExportCsv = async () => {
    if (!meta || rows.length === 0) {
      toast.error('Load report first.');
      return;
    }
    try {
      const monthName = MONTHS.find((m) => m.value === month)?.label || month;
      const filename = `Payroll_${monthName}_${year}.xlsx`;
      const exportRows = rows.map((row) => ({ ...row }));
      await downloadPayrollCsv(meta, exportRows, filename);
      toast.success(`Table exported with ${exportRows.length} employee row(s).`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to export table.');
    }
  };

  const handleExportPdf = async () => {
    if (!meta || rows.length === 0) {
      toast.error('Load report first.');
      return;
    }
    try {
      const monthName = MONTHS.find((m) => m.value === month)?.label || month;
      const filename = `Payroll_${monthName}_${year}.pdf`;
      const exportRows = rows.map((row) => ({ ...row }));
      await downloadPayrollPdf(meta, exportRows, filename);
      toast.success(`PDF exported with ${exportRows.length} employee row(s).`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to export PDF report.');
    }
  };

  const totalNet = rows.reduce((s, r) => s + r.netSalaryKwd, 0);
  const totalRefund = rows.reduce((s, r) => s + r.salaryRefund, 0);
  const totalGross = rows.reduce((s, r) => s + r.totalGrossKwd, 0);

  return (
    <div className="space-y-6">
      <Card className="p-6 rounded-xl border-2 shadow-sm bg-gradient-to-br from-card to-muted/20">
        <h4 className="font-semibold mb-2 text-foreground flex flex-wrap items-center gap-2">
          Payroll Report
          {savedInfo?.approvalStatus && savedInfo.approvalStatus !== 'draft' && (
            <Badge
              variant={
                savedInfo.approvalStatus === 'approved'
                  ? 'default'
                  : savedInfo.approvalStatus === 'rejected'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {payrollApprovalStatusLabel(savedInfo.approvalStatus)}
            </Badge>
          )}
        </h4>
        <p className="text-sm text-muted-foreground mb-4">
          Pick a month and year — a saved payroll loads automatically if one exists, otherwise it builds from attendance and leave. Edit values on screen, <strong>Import Excel</strong> (shows all rows from the file; matches names when possible), then <strong>Save Payroll</strong> or <strong>Save &amp; Send for Approval</strong>.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={onImportFileChange}
        />
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
          <Button
            variant="outline"
            disabled={loading || importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import Excel
          </Button>
          <Button onClick={() => loadReport()} disabled={loading || importing} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Reload
          </Button>
          <Button onClick={handleRegenerate} disabled={loading || importing} variant="outline">
            Rebuild from attendance
          </Button>
          {rows.length > 0 && (
            <>
              <Button variant="default" onClick={handleSaveReport} disabled={saving || submittingApproval || isApprovalLocked}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Payroll
              </Button>
              <Button
                variant="secondary"
                onClick={() => setApprovalDialogOpen(true)}
                disabled={saving || submittingApproval || isApprovalLocked}
              >
                {submittingApproval ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Save &amp; Send for Approval
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
              <Button variant="outline" onClick={() => void handleExportCsv()}>
                <FileText className="w-4 h-4 mr-2" />
                Export Table
              </Button>
              <Button variant="outline" onClick={() => void handleExportPdf()}>
                <FileDown className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </>
          )}
        </div>
        {dirty && rows.length > 0 && (
          <p className="text-sm text-amber-600 mt-3 font-medium">Unsaved changes — click Save Payroll to keep your edits.</p>
        )}
        {reportSource === 'imported' && !dirty && (
          <p className="text-sm text-muted-foreground mt-3">
            Loaded from imported Excel file ({rows.length} row{rows.length === 1 ? '' : 's'}). Save to keep this data.
          </p>
        )}
        {reportSource === 'imported' && dirty && (
          <p className="text-sm text-amber-600 mt-3 font-medium">
            Imported Excel ({rows.length} row{rows.length === 1 ? '' : 's'}) — unsaved. Export uses exactly these rows; save before reload.
          </p>
        )}
        {reportSource === 'saved' && savedInfo && !dirty && (
          <p className="text-sm text-muted-foreground mt-3">
            Showing saved payroll from {new Date(savedInfo.savedAt).toLocaleString()}
            {savedInfo.savedByEmail ? ` by ${savedInfo.savedByEmail}` : ''}.
            {savedInfo.approvalStatus === 'pending_approval' && savedInfo.submittedAt && (
              <> Submitted for approval {new Date(savedInfo.submittedAt).toLocaleString()}.</>
            )}
            {savedInfo.approvalStatus === 'approved' && savedInfo.approvedAt && (
              <>
                {' '}
                Approved {new Date(savedInfo.approvedAt).toLocaleString()}
                {savedInfo.approvedByName ? ` by ${savedInfo.approvedByName}` : ''}.
              </>
            )}
            {savedInfo.approvalNote ? ` Note: ${savedInfo.approvalNote}` : ''}
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

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send payroll for approval</DialogTitle>
            <DialogDescription>
              Payroll will be saved and sent to the configured approver via WhatsApp. Choose the attachment format.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={approvalAttachmentFormat}
            onValueChange={(v) => setApprovalAttachmentFormat(v as PayrollApprovalAttachmentFormat)}
            className="gap-3 py-2"
          >
            {PAYROLL_APPROVAL_FORMAT_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem value={opt.value} id={`approval-format-${opt.value}`} className="mt-0.5" />
                <Label htmlFor={`approval-format-${opt.value}`} className="cursor-pointer font-normal leading-snug">
                  <span className="font-medium text-foreground">{opt.label}</span>
                  <span className="block text-sm text-muted-foreground">{opt.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)} disabled={submittingApproval}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmitForApproval(approvalAttachmentFormat)}
              disabled={submittingApproval}
            >
              {submittingApproval ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Save &amp; Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
