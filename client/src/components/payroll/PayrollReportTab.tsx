import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ClipboardPaste,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Upload,
  X,
  ArrowRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
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
  getCompanyHolidaysForMonth,
  getEmployeeShiftsByEmployeeId,
  getPayrollPeriodBounds,
  type KdaPayrollReportRow
} from '@/services/payrollReportService';
import { downloadPayrollExcel } from '@/utils/payrollReportExcelExport';
import { downloadPayrollCsv } from '@/utils/payrollReportCsvExport';
import { downloadPayrollPdf } from '@/utils/payrollReportPdfExport';
import {
  buildPayrollApprovalAttachment,
  type PayrollApprovalAttachmentFormat
} from '@/utils/payrollReportApprovalAttachment';
import { parsePunchLog } from '@/utils/payrollPunchLogParser';
import { holidayDatesInPeriod, PAYROLL_LATE_TOLERANCE_MINUTES } from '@/utils/payrollWorkingDays';
import { extractAttendanceTextFromPdfs } from '@/utils/payrollAttendancePdfExtract';
import { recalcPayrollRow } from '@/utils/payrollRowRecalc';
import { employeeService, type Employee } from '@/services/employeeService';
import {
  getSavedPayrollReport,
  revertPayrollApproval,
  savePayrollReport,
  type PayrollApprovalStatus,
  type SavedPayrollReport
} from '@/services/payrollReportStorageService';
import {
  payrollApprovalStatusLabel,
  submitPayrollForApproval
} from '@/services/payrollApprovalService';
import { toast } from 'sonner';
import {
  formatPayrollCompanyTitle,
  formatPayrollDepartmentLabel,
  formatPayrollPeriodLabel,
  getPayrollEmployeeDisplayName,
  getPayrollMonthLabel,
  PAYROLL_MONTH_KEYS,
  translatePaymentMethod
} from '@/utils/payrollDisplay';

const APPROVAL_FORMAT_I18N: Record<
  PayrollApprovalAttachmentFormat,
  { label: string; description: string }
> = {
  excel: { label: 'approvalFormatExcel', description: 'approvalFormatExcelDesc' },
  csv: { label: 'approvalFormatCsv', description: 'approvalFormatCsvDesc' },
  pdf: { label: 'approvalFormatPdf', description: 'approvalFormatPdfDesc' }
};

function formatKwd(n: number): string {
  return n.toFixed(3);
}

export default function PayrollReportTab() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [month, setMonth] = useState('12');
  const [year, setYear] = useState('2025');
  const [department, setDepartment] = useState<string>('all');
  const [departmentOptions, setDepartmentOptions] = useState<{ value: string; label: string }[]>([]);
  const [employeesById, setEmployeesById] = useState<Record<string, Employee>>({});
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{
    companyName: string;
    companyNameArabic: string;
    periodLabel: string;
    departmentLabel: string;
  } | null>(null);
  const [rows, setRows] = useState<KdaPayrollReportRow[]>([]);
  /** Days to move from absent → permitted late (per employee, draft before clicking move) */
  const [permittedLateMoveQty, setPermittedLateMoveQty] = useState<Record<string, string>>({});
  const [savedInfo, setSavedInfo] = useState<{
    savedAt: string;
    savedByEmail: string | null;
    reportId?: string;
    approvalStatus?: PayrollApprovalStatus;
    submittedAt?: string | null;
    gmApprovedAt?: string | null;
    gmApprovedByName?: string | null;
    gmApprovalNote?: string | null;
    approvedAt?: string | null;
    approvedByName?: string | null;
    approvalNote?: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [revertingApproval, setRevertingApproval] = useState(false);
  const [reportSource, setReportSource] = useState<'saved' | 'generated' | 'punch' | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalAttachmentFormat, setApprovalAttachmentFormat] =
    useState<PayrollApprovalAttachmentFormat>('excel');
  const [punchLogText, setPunchLogText] = useState('');
  const [punchPdfFiles, setPunchPdfFiles] = useState<File[]>([]);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [punchPasteOpen, setPunchPasteOpen] = useState(false);
  const [generatingFromPunch, setGeneratingFromPunch] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tableFullscreen, setTableFullscreen] = useState(false);
  const punchPdfInputRef = useRef<HTMLInputElement>(null);
  const suppressAutoLoad = useRef(false);

  const companyId = user?.company_id;

  const months = useMemo(
    () =>
      PAYROLL_MONTH_KEYS.map((key, i) => ({
        value: String(i + 1),
        label: t(`payroll.months.${key}`)
      })),
    [t, i18n.language]
  );

  const col = useCallback((key: string) => t(`payroll.columns.${key}`), [t]);

  useEffect(() => {
    if (!tableFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTableFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [tableFullscreen]);

  useEffect(() => {
    if (!companyId) return;
    employeeService.getAll(companyId).then((employees) => {
      const byId: Record<string, Employee> = {};
      const depts = new Set<string>();
      employees.forEach((e) => {
        byId[e.id] = e;
        const d = e.department || (e as { departments?: { name?: string } }).departments?.name;
        if (d) depts.add(d);
      });
      setEmployeesById(byId);
      setDepartmentOptions([
        { value: 'all', label: t('payroll.allDepartments') },
        ...Array.from(depts).sort().map((d) => ({ value: d, label: d }))
      ]);
    });
  }, [companyId, t, i18n.language]);

  const applySavedReport = (saved: SavedPayrollReport) => {
    setMeta(saved.report_data.meta);
    setRows(saved.report_data.rows.map((r) => recalcPayrollRow(r as KdaPayrollReportRow)));
    setSavedInfo({
      savedAt: saved.saved_at,
      savedByEmail: saved.saved_by_email ?? null,
      reportId: saved.id,
      approvalStatus: saved.approval_status ?? 'draft',
      submittedAt: saved.submitted_at ?? null,
      gmApprovedAt: saved.gm_approved_at ?? null,
      gmApprovedByName: saved.gm_approved_by_name ?? null,
      gmApprovalNote: saved.gm_approval_note ?? null,
      approvedAt: saved.approved_at ?? null,
      approvedByName: saved.approved_by_name ?? null,
      approvalNote: saved.approval_note ?? null
    });
    setReportSource('saved');
    setDirty(false);
  };

  const loadReport = useCallback(async (options?: { forceRegenerate?: boolean }) => {
    if (!companyId) {
      toast.error(t('payroll.companyNotSet'));
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
          toast.success(
            t('payroll.loadedSaved', {
              period: formatPayrollPeriodLabel(month, year, t),
              count: saved.report_data.rows.length
            })
          );
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
          ? t('payroll.rebuiltPayroll', { count: report.rows.length })
          : t('payroll.builtPayroll', { count: report.rows.length })
      );
    } catch (e) {
      console.error(e);
      toast.error(t('payroll.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [companyId, month, year, department, t]);

  /** Auto-load when month/year/department changes */
  useEffect(() => {
    if (!companyId) return;
    if (suppressAutoLoad.current) {
      suppressAutoLoad.current = false;
      return;
    }
    void loadReport();
  }, [companyId, month, year, department, loadReport]);

  const handleRegenerate = useCallback(async () => {
    await loadReport({ forceRegenerate: true });
  }, [loadReport]);

  const handleGenerateFromPunchLog = useCallback(async () => {
    if (!companyId) {
      toast.error(t('payroll.companyNotSet'));
      return;
    }
    if (!punchLogText.trim() && punchPdfFiles.length === 0) {
      toast.error(t('payroll.toast.punchLogEmpty'));
      return;
    }

    setGeneratingFromPunch(true);
    try {
      let combinedText = punchLogText.trim();
      if (punchPdfFiles.length > 0) {
        setExtractingPdf(true);
        try {
          const pdfText = await extractAttendanceTextFromPdfs(punchPdfFiles);
          combinedText = [combinedText, pdfText].filter(Boolean).join('\n');
        } finally {
          setExtractingPdf(false);
        }
      }

      if (!combinedText.trim()) {
        toast.error(t('payroll.toast.punchPdfNoText'));
        return;
      }

      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      const period = getPayrollPeriodBounds(y, m);
      const employees = Object.values(employeesById);
      const [holidays, shiftsByEmployeeId] = await Promise.all([
        getCompanyHolidaysForMonth(companyId, y, m),
        getEmployeeShiftsByEmployeeId(companyId)
      ]);
      const holidayDates = holidayDatesInPeriod(holidays, period.periodStart, period.periodEnd);
      const parseResult = parsePunchLog(combinedText, period, employees, {
        holidayDates,
        shiftsByEmployeeId,
        lateToleranceMinutes: PAYROLL_LATE_TOLERANCE_MINUTES
      });

      if (parseResult.totalLinesParsed === 0) {
        toast.error(t('payroll.toast.punchLogEmpty'));
        return;
      }

      const attendanceEmployeeIds = Object.keys(parseResult.actualDaysByEmployeeId);
      if (attendanceEmployeeIds.length === 0) {
        toast.error(t('payroll.toast.punchLogNoMatchedEmployees'));
        return;
      }

      const [leaveDays, workingDaysMap] = await Promise.all([
        getApprovedLeaveDaysForMonth(companyId, y, m),
        getWorkingDaysInMonthByEmployee(companyId, y, m)
      ]);

      const report = await buildKdaPayrollReport({
        companyId,
        month: m,
        year: y,
        department: department === 'all' ? undefined : department,
        workingDaysByEmployeeId: workingDaysMap,
        paidLeaveDaysByEmployeeId: leaveDays,
        actualDaysByEmployeeId: parseResult.actualDaysByEmployeeId,
        missingAttendanceDefaultsToFullPresent: true
      });

      suppressAutoLoad.current = true;
      setSavedInfo(null);
      setMeta({
        companyName: report.companyName,
        companyNameArabic: report.companyNameArabic,
        periodLabel: report.periodLabel,
        departmentLabel: report.departmentLabel
      });
      setRows(report.rows.map((row) => recalcPayrollRow(row)));
      setDirty(false);
      setReportSource('punch');

      let details = '';
      if (punchPdfFiles.length > 0) {
        details += t('payroll.toast.punchPdfFilesUsed', { count: punchPdfFiles.length });
      }
      if (parseResult.skippedInvalid > 0) {
        details += t('payroll.toast.punchLogSkippedInvalid', { count: parseResult.skippedInvalid });
      }
      if (parseResult.unmappedMachineIds.length > 0) {
        const ids = parseResult.unmappedMachineIds
          .map((u) => `${u.id} (${u.name})`)
          .join(', ');
        details += t('payroll.toast.punchLogUnmapped', {
          count: parseResult.unmappedMachineIds.length,
          ids
        });
      }

      toast.success(
        t('payroll.toast.punchLogGenerated', {
          punches: parseResult.totalLinesParsed,
          employees: report.rows.length,
          details
        })
      );
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('payroll.toast.punchLogFailed'));
    } finally {
      setGeneratingFromPunch(false);
      setExtractingPdf(false);
    }
  }, [companyId, punchLogText, punchPdfFiles, year, month, department, employeesById, t]);

  const handlePunchPdfFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setPunchPdfFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const added = Array.from(files).filter((f) => !existing.has(`${f.name}-${f.size}`));
      return [...prev, ...added];
    });
    e.target.value = '';
  };

  const removePunchPdfFile = (index: number) => {
    setPunchPdfFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePreviewPdfExtraction = useCallback(async () => {
    if (punchPdfFiles.length === 0) return;
    setExtractingPdf(true);
    try {
      const pdfText = await extractAttendanceTextFromPdfs(punchPdfFiles);
      if (!pdfText.trim()) {
        toast.error(t('payroll.toast.punchPdfNoText'));
        return;
      }
      setPunchLogText((prev) => {
        const base = prev.trim();
        return base ? `${base}\n${pdfText}` : pdfText;
      });
      toast.success(t('payroll.toast.punchPdfExtracted', { count: punchPdfFiles.length }));
    } catch (e) {
      console.error(e);
      toast.error(t('payroll.toast.punchPdfExtractFailed'));
    } finally {
      setExtractingPdf(false);
    }
  }, [punchPdfFiles, t]);

  const updatePaidLeaveDays = (employeeId: string, value: number) => {
    setDirty(true);
    setRows((prev) =>
      prev.map((r) =>
        r.employeeId === employeeId
          ? recalcPayrollRow(r, { paidLeaveDays: Math.max(0, value) })
          : r
      )
    );
  };

  const updateSalaryRefund = (employeeId: string, value: number) => {
    setDirty(true);
    setRows((prev) =>
      prev.map((r) =>
        r.employeeId === employeeId
          ? recalcPayrollRow(r, { salaryRefund: Math.max(0, value) })
          : r
      )
    );
  };

  const moveAllAbsentToPaidLeave = (employeeId: string) => {
    setDirty(true);
    setRows((prev) =>
      prev.map((r) => {
        if (r.employeeId !== employeeId) return r;
        return recalcPayrollRow(r, {
          paidLeaveDays: (r.paidLeaveDays ?? 0) + (r.absentDays ?? 0)
        });
      })
    );
  };

  const updatePermittedLateDays = (employeeId: string, value: number) => {
    setDirty(true);
    setRows((prev) =>
      prev.map((r) =>
        r.employeeId === employeeId
          ? recalcPayrollRow(r, { permittedLateDays: Math.max(0, value) })
          : r
      )
    );
  };

  const moveAbsentToPermittedLate = (employeeId: string) => {
    const row = rows.find((r) => r.employeeId === employeeId);
    if (!row || (row.absentDays ?? 0) <= 0) return;
    const qty = parseFloat(permittedLateMoveQty[employeeId] ?? '1') || 0;
    if (qty <= 0) return;
    const move = Math.min(qty, row.absentDays ?? 0);
    setDirty(true);
    setRows((prev) =>
      prev.map((r) => {
        if (r.employeeId !== employeeId) return r;
        return recalcPayrollRow(r, {
          permittedLateDays: (r.permittedLateDays ?? 0) + move
        });
      })
    );
    setPermittedLateMoveQty((prev) => ({ ...prev, [employeeId]: '' }));
  };

  const removePayrollRow = (employeeId: string) => {
    setDirty(true);
    setRows((prev) => {
      const next = prev
        .filter((r) => r.employeeId !== employeeId)
        .map((r, i) => ({ ...r, sn: i + 1 }));
      if (next.length === prev.length) return prev;
      return next;
    });
    toast.success(t('payroll.toast.rowRemoved'));
  };

  const handleSaveReport = useCallback(async () => {
    if (!companyId || !user || !meta || rows.length === 0) {
      toast.error(t('payroll.toast.loadFirst'));
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
        gmApprovedAt: saved.gm_approved_at ?? null,
        gmApprovedByName: saved.gm_approved_by_name ?? null,
        gmApprovalNote: saved.gm_approval_note ?? null,
        approvedAt: saved.approved_at ?? null,
        approvedByName: saved.approved_by_name ?? null,
        approvalNote: saved.approval_note ?? null
      });
      setReportSource('saved');
      setDirty(false);
      toast.success(t('payroll.toast.saveSuccess'));
    } catch (e) {
      console.error(e);
      toast.error(t('payroll.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [companyId, user, meta, rows, year, month, department, t]);

  const approvalStatus = savedInfo?.approvalStatus ?? 'draft';
  const isApprovalLocked =
    approvalStatus === 'pending_approval' ||
    approvalStatus === 'pending_gm' ||
    approvalStatus === 'pending_ceo' ||
    approvalStatus === 'approved';

  const handleSubmitForApproval = useCallback(async (format: PayrollApprovalAttachmentFormat) => {
    if (!companyId || !user || !meta || rows.length === 0) {
      toast.error(t('payroll.toast.loadFirst'));
      return;
    }
    if (isApprovalLocked) {
      toast.error(t('payroll.toast.alreadyStatus', { status: payrollApprovalStatusLabel(approvalStatus) }));
      return;
    }

    setSubmittingApproval(true);
    try {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      const monthName = getPayrollMonthLabel(month, t);

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
        approval_status: 'pending_gm',
        submitted_at: new Date().toISOString(),
        submitted_by_email: user.email ?? null,
        whats_task_id: result.whats_task_id
      });

      setApprovalDialogOpen(false);
      toast.success(t('payroll.toast.approvalSentGm'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('payroll.toast.approvalFailed'));
    } finally {
      setSubmittingApproval(false);
    }
  }, [companyId, user, meta, rows, year, month, department, isApprovalLocked, approvalStatus, t]);

  const canRevertApproval = Boolean(savedInfo?.reportId && approvalStatus !== 'draft');

  const handleRevertApproval = useCallback(async () => {
    if (!savedInfo?.reportId) return;
    if (!window.confirm(t('payroll.revertApprovalConfirm'))) return;

    setRevertingApproval(true);
    try {
      const updated = await revertPayrollApproval(savedInfo.reportId);
      applySavedReport(updated);
      toast.success(t('payroll.toast.approvalReverted'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('payroll.toast.approvalRevertFailed'));
    } finally {
      setRevertingApproval(false);
    }
  }, [savedInfo?.reportId, t]);

  const handleExport = async () => {
    if (!meta || rows.length === 0) {
      toast.error(t('payroll.toast.loadFirst'));
      return;
    }
    try {
      const monthName = getPayrollMonthLabel(month, t);
      const filename = `Payroll_${monthName}_${year}.xlsx`;
      const exportRows = rows.map((row) => ({ ...row }));
      await downloadPayrollExcel({ ...meta, rows: exportRows }, filename);
      toast.success(t('payroll.toast.excelExported', { count: exportRows.length }));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('payroll.toast.excelExportFailed'));
    }
  };

  const handleExportCsv = async () => {
    if (!meta || rows.length === 0) {
      toast.error(t('payroll.toast.loadFirst'));
      return;
    }
    try {
      const monthName = getPayrollMonthLabel(month, t);
      const filename = `Payroll_${monthName}_${year}.xlsx`;
      const exportRows = rows.map((row) => ({ ...row }));
      await downloadPayrollCsv(meta, exportRows, filename);
      toast.success(t('payroll.toast.tableExported', { count: exportRows.length }));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('payroll.toast.tableExportFailed'));
    }
  };

  const handleExportPdf = async () => {
    if (!meta || rows.length === 0) {
      toast.error(t('payroll.toast.loadFirst'));
      return;
    }
    try {
      const monthName = getPayrollMonthLabel(month, t);
      const filename = `Payroll_${monthName}_${year}.pdf`;
      const exportRows = rows.map((row) => ({ ...row }));
      await downloadPayrollPdf(meta, exportRows, filename);
      toast.success(t('payroll.toast.pdfExported', { count: exportRows.length }));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('payroll.toast.pdfExportFailed'));
    }
  };

  const totalNet = rows.reduce((s, r) => s + r.netSalaryKwd, 0);
  const totalRefund = rows.reduce((s, r) => s + r.salaryRefund, 0);
  const totalPayable = rows.reduce((s, r) => s + r.amountScheduledToPay, 0);
  const totalGross = rows.reduce((s, r) => s + r.totalGrossKwd, 0);
  const displayPeriod = meta ? formatPayrollPeriodLabel(month, year, t) : '';
  const displayDepartment = formatPayrollDepartmentLabel(department, t);
  const companyTitle = meta ? formatPayrollCompanyTitle(meta.companyName, meta.companyNameArabic) : '';
  const busy = loading || generatingFromPunch || extractingPdf;
  const canGenerateFromPunch = punchLogText.trim().length > 0 || punchPdfFiles.length > 0;

  return (
    <div className="space-y-6">
      <Card className="p-6 rounded-xl border-2 shadow-sm bg-gradient-to-br from-card to-muted/20">
        <h4 className="font-semibold mb-2 text-foreground flex flex-wrap items-center gap-2">
          {t('payroll.reportTitle')}
          {savedInfo?.approvalStatus && savedInfo.approvalStatus !== 'draft' && (
            <Badge
              variant={
                savedInfo.approvalStatus === 'approved'
                  ? 'default'
                  : savedInfo.approvalStatus === 'rejected'
                    ? 'destructive'
                    : savedInfo.approvalStatus === 'pending_ceo'
                      ? 'outline'
                      : 'secondary'
              }
            >
              {payrollApprovalStatusLabel(savedInfo.approvalStatus)}
            </Badge>
          )}
          {canRevertApproval && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => void handleRevertApproval()}
              disabled={revertingApproval || submittingApproval || saving}
            >
              {revertingApproval ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="w-3 h-3 mr-1" />
              )}
              {t('payroll.revertApproval')}
            </Button>
          )}
        </h4>
        <p
          className="text-sm text-muted-foreground mb-4"
          dangerouslySetInnerHTML={{ __html: t('payroll.reportIntro') }}
        />
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t('payroll.month')}</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t('payroll.year')}</label>
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
            <label className="text-sm font-medium mb-1 block">{t('payroll.department')}</label>
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
          <Button onClick={() => loadReport()} disabled={busy} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />}
            {t('payroll.reload')}
          </Button>
          <Button onClick={handleRegenerate} disabled={busy} variant="outline">
            {t('payroll.rebuildFromAttendance')}
          </Button>
          {rows.length > 0 && (
            <>
              <Button variant="default" onClick={handleSaveReport} disabled={saving || submittingApproval || isApprovalLocked}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 animate-spin" /> : <Save className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />}
                {t('payroll.savePayroll')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setApprovalDialogOpen(true)}
                disabled={saving || submittingApproval || isApprovalLocked}
              >
                {submittingApproval ? (
                  <Loader2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                )}
                {t('payroll.saveAndSendApproval')}
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('payroll.exportExcel')}
              </Button>
              <Button variant="outline" onClick={() => void handleExportCsv()}>
                <FileText className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('payroll.exportTable')}
              </Button>
              <Button variant="outline" onClick={() => void handleExportPdf()}>
                <FileDown className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('payroll.exportPdf')}
              </Button>
            </>
          )}
        </div>
        {reportSource === 'punch' && rows.length > 0 && (
          <p className="text-sm text-muted-foreground mt-3">{t('payroll.generatedFromPunchLog')}</p>
        )}
        {dirty && rows.length > 0 && (
          <p className="text-sm text-amber-600 mt-3 font-medium">{t('payroll.unsavedChanges')}</p>
        )}
        {reportSource === 'saved' && savedInfo && (
          <p className="text-sm text-muted-foreground mt-3">
            {t('payroll.savedShowing', {
              date: new Date(savedInfo.savedAt).toLocaleString(),
              by: savedInfo.savedByEmail ? t('payroll.savedBy', { email: savedInfo.savedByEmail }) : ''
            })}
            {savedInfo.approvalStatus === 'pending_gm' && savedInfo.submittedAt && (
              <>{t('payroll.submittedForGmApproval', { date: new Date(savedInfo.submittedAt).toLocaleString() })}</>
            )}
            {savedInfo.approvalStatus === 'pending_approval' && savedInfo.submittedAt && (
              <>{t('payroll.submittedForApproval', { date: new Date(savedInfo.submittedAt).toLocaleString() })}</>
            )}
            {savedInfo.approvalStatus === 'pending_ceo' && savedInfo.gmApprovedAt && (
              <>
                {t('payroll.gmApprovedOn', {
                  date: new Date(savedInfo.gmApprovedAt).toLocaleString(),
                  by: savedInfo.gmApprovedByName
                    ? t('payroll.gmApprovedBy', { name: savedInfo.gmApprovedByName })
                    : ''
                })}
                {t('payroll.awaitingCeoApproval')}
              </>
            )}
            {savedInfo.approvalStatus === 'approved' && savedInfo.approvedAt && (
              <>
                {t('payroll.approvedOn', {
                  date: new Date(savedInfo.approvedAt).toLocaleString(),
                  by: savedInfo.approvedByName ? t('payroll.approvedBy', { name: savedInfo.approvedByName }) : ''
                })}
              </>
            )}
            {savedInfo.approvalNote ? t('payroll.approvalNote', { note: savedInfo.approvalNote }) : ''}
          </p>
        )}
      </Card>

      <Collapsible open={punchPasteOpen} onOpenChange={setPunchPasteOpen}>
        <Card className="rounded-xl border-2 shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-muted/40 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium text-foreground">
                <ClipboardPaste className="w-4 h-4 text-primary" />
                {t('payroll.pastePunchLog')}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${punchPasteOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-4 border-t border-border/60 pt-4">
              <p className="text-sm text-muted-foreground">{t('payroll.pastePunchLogDesc')}</p>

              <div className="space-y-2">
                <Label>{t('payroll.uploadAttendancePdf')}</Label>
                <input
                  ref={punchPdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="hidden"
                  onChange={handlePunchPdfFilesChange}
                  disabled={busy || isApprovalLocked}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => punchPdfInputRef.current?.click()}
                    disabled={busy || isApprovalLocked}
                  >
                    <Upload className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                    {t('payroll.uploadAttendancePdfBtn')}
                  </Button>
                  {punchPdfFiles.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handlePreviewPdfExtraction()}
                      disabled={busy || isApprovalLocked}
                    >
                      {extractingPdf ? (
                        <Loader2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                      )}
                      {t('payroll.previewPdfExtraction')}
                    </Button>
                  )}
                </div>
                {punchPdfFiles.length > 0 && (
                  <ul className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3">
                    {punchPdfFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${file.size}-${index}`}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate font-mono text-xs">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => removePunchPdfFile(index)}
                          disabled={busy || isApprovalLocked}
                          aria-label={t('common.delete')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="punch-log-textarea">{t('payroll.pastePunchLogOptional')}</Label>
                <Textarea
                  id="punch-log-textarea"
                  value={punchLogText}
                  onChange={(e) => setPunchLogText(e.target.value)}
                  placeholder={t('payroll.pastePunchLogPlaceholder')}
                  className="min-h-[120px] font-mono text-xs"
                  disabled={busy || isApprovalLocked}
                />
              </div>
              <Button
                onClick={() => void handleGenerateFromPunchLog()}
                disabled={busy || isApprovalLocked || !canGenerateFromPunch}
              >
                {generatingFromPunch ? (
                  <Loader2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 animate-spin" />
                ) : (
                  <ClipboardPaste className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                )}
                {extractingPdf ? t('payroll.extractingPdf') : t('payroll.generateFromPunchLog')}
              </Button>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {meta && rows.length > 0 && (
        <>
          <div className="flex flex-wrap gap-4">
            <Card className="p-4 flex-1 min-w-[160px] rounded-xl border-2 bg-gradient-to-br from-primary/5 to-transparent border-primary/20 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('payroll.totalGross')}</p>
              <p className="text-xl font-bold tabular-nums mt-1 text-foreground">{totalGross.toFixed(3)}</p>
            </Card>
            <Card className="p-4 flex-1 min-w-[160px] rounded-xl border-2 bg-gradient-to-br from-muted/40 to-transparent border-border shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('payroll.totalNet')}</p>
              <p className="text-xl font-bold tabular-nums mt-1 text-foreground">{totalNet.toFixed(3)}</p>
            </Card>
            <Card className="p-4 flex-1 min-w-[160px] rounded-xl border-2 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/30 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('payroll.totalRefund')}</p>
              <p className="text-xl font-bold tabular-nums mt-1 text-amber-600">{totalRefund.toFixed(3)}</p>
            </Card>
            <Card className="p-4 flex-1 min-w-[160px] rounded-xl border-2 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/30 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('payroll.totalPayable')}</p>
              <p className="text-xl font-bold tabular-nums mt-1 text-emerald-700">{totalPayable.toFixed(3)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{t('payroll.totalPayableHint')}</p>
            </Card>
          </div>

          <Card
            className={cn(
              'overflow-hidden rounded-xl border-2 shadow-lg',
              tableFullscreen
                ? 'fixed inset-0 z-50 flex max-w-none w-full flex-col rounded-none border-0 shadow-2xl'
                : 'relative left-1/2 w-screen max-w-[80vw] -translate-x-1/2 shadow-black/5'
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b bg-gradient-to-r from-muted/50 to-muted/30 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{companyTitle}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{displayPeriod} · {displayDepartment}</p>
                {savedInfo && (
                  <p className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                    {t('payroll.lastSaved', {
                      date: new Date(savedInfo.savedAt).toLocaleString(),
                      email: savedInfo.savedByEmail || '—'
                    })}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setTableFullscreen((v) => !v)}
                title={tableFullscreen ? t('payroll.exitFullscreen') : t('payroll.expandFullscreen')}
              >
                {tableFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">
                  {tableFullscreen ? t('payroll.exitFullscreen') : t('payroll.expandFullscreen')}
                </span>
              </Button>
            </div>
            <div
              className={cn(
                'min-w-0 w-full flex-1 overflow-x-auto overflow-y-auto bg-muted/10',
                tableFullscreen ? 'max-h-none' : 'max-h-[70vh]'
              )}
            >
              <table className="w-full text-sm border-collapse min-w-[2700px]">
                <thead className="sticky top-0 z-10">
                  <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:font-semibold [&>th]:text-foreground border-b-2 border-primary/20 bg-[#D9E1F2]">
                    <th rowSpan={2} className="text-center border-r border-border/60">{col('sn')}</th>
                    <th rowSpan={2} className="text-center min-w-[80px] border-r border-border/60">{col('empCode')}</th>
                    <th rowSpan={2} className="text-left min-w-[160px] border-r border-border/60">{col('nameArabic')}</th>
                    <th rowSpan={2} className="text-center min-w-[90px] border-r border-border/60">{col('joinDate')}</th>
                    <th rowSpan={2} className="text-right min-w-[88px] border-r border-border/60">{col('basicSalary')}</th>
                    <th rowSpan={2} className="text-center min-w-[64px] border-r border-border/60">{col('scheduledDays')}</th>
                    <th rowSpan={2} className="text-center min-w-[64px] border-r border-border/60">{col('presentDays')}</th>
                    <th rowSpan={2} className="text-center min-w-[72px] border-r border-border/60">{col('absentDays')}</th>
                    <th rowSpan={2} className="text-center min-w-[88px] border-r border-primary/30">{col('paidLeaveDays')}</th>
                    <th rowSpan={2} className="text-center min-w-[88px] border-r border-primary/30">{col('permittedLateDays')}</th>
                    <th rowSpan={2} className="text-right min-w-[80px] border-r border-border/60">{col('absentDeduction')}</th>
                    <th colSpan={6} className="text-center border-r border-primary/30 bg-[#FFF2CC]">{col('grossAccrualMonth')}</th>
                    <th colSpan={4} className="text-center border-r border-primary/30 bg-[#FFF2CC]">{col('deductions')}</th>
                    <th rowSpan={2} className="text-right min-w-[88px] border-r border-border/60">{col('netSalary')}</th>
                    <th rowSpan={2} className="text-right min-w-[96px] bg-amber-500/15 border-r border-amber-500/30">{col('salaryRefund')}</th>
                    <th rowSpan={2} className="text-right min-w-[100px] border-r border-border/60">{col('totalPayable')}</th>
                    <th rowSpan={2} className="text-left min-w-[120px] border-r border-border/60">{col('methodOfPayment')}</th>
                    <th rowSpan={2} className="text-left min-w-[90px] border-r border-border/60">{col('notes')}</th>
                    <th rowSpan={2} className="sticky right-0 z-20 text-center min-w-[52px] bg-[#D9E1F2] border-l border-border/60 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.15)]">{col('actions')}</th>
                  </tr>
                  <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:font-semibold [&>th]:text-foreground border-b-2 border-primary/20 bg-[#D9E1F2]">
                    <th className="text-right min-w-[80px] border-r border-border/50">{col('salaryKwd')}</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">{col('paidLeaveKwd')}</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">{col('overTimeKwd')}</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">{col('housingKwd')}</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">{col('other')}</th>
                    <th className="text-right min-w-[80px] border-r border-primary/30">{col('total')}</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">{col('penalties')}</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">{col('deductionsCol')}</th>
                    <th className="text-right min-w-[80px] border-r border-border/50">{col('loan')}</th>
                    <th className="text-right min-w-[80px] border-r border-primary/30">{col('deductionsOther')}</th>
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
                      <td className="px-2 py-2 max-w-[200px] truncate align-middle border-r border-border/40" title={getPayrollEmployeeDisplayName(r, employeesById)}>{getPayrollEmployeeDisplayName(r, employeesById)}</td>
                      <td className="px-2 py-2 text-center align-middle tabular-nums border-r border-border/40">{r.joinDate}</td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums border-r border-border/40">{formatKwd(r.basicSalaryKwd)}</td>
                      <td className="px-2 py-2 text-center align-middle tabular-nums border-r border-border/40">{r.workingDaysInMonth}</td>
                      <td className="px-2 py-2 text-center align-middle border-r border-border/40">
                        <Badge variant="outline" className="tabular-nums bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                          {r.actualWorkingDays}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-center align-middle border-r border-border/40">
                        <div className="flex flex-col items-center gap-1">
                          <Badge
                            variant="outline"
                            className={`tabular-nums ${
                              r.absentDays > 0
                                ? 'bg-red-500/10 text-red-700 border-red-500/30'
                                : 'bg-muted/30 text-muted-foreground'
                            }`}
                          >
                            {r.absentDays}
                          </Badge>
                          {r.absentDays > 0 && !isApprovalLocked && (
                            <div className="flex flex-col items-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] text-primary"
                                onClick={() => moveAllAbsentToPaidLeave(r.employeeId)}
                                title={t('payroll.moveAbsentToPaidLeave')}
                              >
                                <ArrowRight className="w-3 h-3 mr-0.5" />
                                {t('payroll.moveToLeave')}
                              </Button>
                              <div className="flex items-center gap-0.5">
                                <Input
                                  type="number"
                                  min={1}
                                  max={r.absentDays}
                                  step={1}
                                  placeholder="1"
                                  className="num-input h-6 w-10 px-1 text-[10px] text-center tabular-nums"
                                  value={permittedLateMoveQty[r.employeeId] ?? ''}
                                  onChange={(e) =>
                                    setPermittedLateMoveQty((prev) => ({
                                      ...prev,
                                      [r.employeeId]: e.target.value
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      moveAbsentToPermittedLate(r.employeeId);
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1 text-[10px] text-emerald-700 shrink-0"
                                  onClick={() => moveAbsentToPermittedLate(r.employeeId)}
                                  title={t('payroll.moveAbsentToPermittedLate')}
                                >
                                  <ArrowRight className="w-3 h-3 mr-0.5" />
                                  {t('payroll.moveToPermittedLate')}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-middle border-r border-primary/20">
                        <Input
                          type="number"
                          min={0}
                          step={0.001}
                          className="num-input h-8 min-w-[3.5rem] w-full text-center tabular-nums"
                          value={r.paidLeaveDays}
                          disabled={isApprovalLocked}
                          onChange={(e) =>
                            updatePaidLeaveDays(r.employeeId, parseFloat(e.target.value) || 0)
                          }
                        />
                      </td>
                      <td className="px-2 py-2 align-middle border-r border-primary/20">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="num-input h-8 min-w-[3.5rem] w-full text-center tabular-nums"
                          value={r.permittedLateDays ?? 0}
                          disabled={isApprovalLocked}
                          onChange={(e) =>
                            updatePermittedLateDays(r.employeeId, parseFloat(e.target.value) || 0)
                          }
                        />
                      </td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums border-r border-border/40 text-red-600">
                        {r.absentDeductionKwd > 0 ? `−${formatKwd(r.absentDeductionKwd)}` : '—'}
                      </td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums bg-muted/20 border-r border-border/40">{formatKwd(r.salaryKwd)}</td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums bg-muted/20 border-r border-border/40">{formatKwd(r.paidLeaveKwd)}</td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums bg-muted/20 border-r border-border/40">{formatKwd(r.overTimeKwd)}</td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums bg-muted/20 border-r border-border/40">{formatKwd(r.housingAllowanceKwd)}</td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums bg-muted/20 border-r border-border/40">{formatKwd(r.otherKwd)}</td>
                      <td className="px-2 py-2 text-right font-medium align-middle tabular-nums border-r border-primary/20">{formatKwd(r.totalGrossKwd)}</td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums border-r border-border/40">{formatKwd(r.penaltiesKwd)}</td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums border-r border-border/40">{formatKwd(r.deductionsKwd)}</td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums border-r border-border/40">{formatKwd(r.loanKwd)}</td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums border-r border-primary/20">{formatKwd(r.deductionsOtherKwd)}</td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums font-medium border-r border-border/40">{formatKwd(r.netSalaryKwd)}</td>
                      <td className="px-2 py-2 align-middle bg-amber-500/15 border-r border-amber-500/30">
                        <Input
                          type="number"
                          min={0}
                          step={0.001}
                          className="num-input h-8 min-w-[5rem] w-full text-right tabular-nums bg-background"
                          value={r.salaryRefund}
                          disabled={isApprovalLocked}
                          onChange={(e) =>
                            updateSalaryRefund(r.employeeId, parseFloat(e.target.value) || 0)
                          }
                        />
                      </td>
                      <td className="px-2 py-2 text-right align-middle tabular-nums font-semibold border-r border-border/40">
                        {formatKwd(r.amountScheduledToPay)}
                      </td>
                      <td className="px-2 py-2 align-middle border-r border-border/40">{translatePaymentMethod(r.methodOfPayment, t)}</td>
                      <td className="px-2 py-2 align-middle text-muted-foreground border-r border-border/40">{r.notes || '—'}</td>
                      <td
                        className={`sticky right-0 z-10 px-1 py-2 align-middle text-center border-l border-border/40 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.15)] ${idx % 2 === 1 ? 'bg-muted/20' : 'bg-background'}`}
                      >
                        {!isApprovalLocked && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removePayrollRow(r.employeeId)}
                            title={t('payroll.removeRow')}
                            aria-label={t('payroll.removeRow')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
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
          <p>{t('payroll.emptyState')}</p>
        </Card>
      )}

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('payroll.approvalDialogTitle')}</DialogTitle>
            <DialogDescription>{t('payroll.approvalDialogDesc')}</DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={approvalAttachmentFormat}
            onValueChange={(v) => setApprovalAttachmentFormat(v as PayrollApprovalAttachmentFormat)}
            className="gap-3 py-2"
          >
            {(Object.keys(APPROVAL_FORMAT_I18N) as PayrollApprovalAttachmentFormat[]).map((opt) => (
              <div key={opt} className="flex items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem value={opt} id={`approval-format-${opt}`} className="mt-0.5" />
                <Label htmlFor={`approval-format-${opt}`} className="cursor-pointer font-normal leading-snug">
                  <span className="font-medium text-foreground">{t(`payroll.${APPROVAL_FORMAT_I18N[opt].label}`)}</span>
                  <span className="block text-sm text-muted-foreground">{t(`payroll.${APPROVAL_FORMAT_I18N[opt].description}`)}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)} disabled={submittingApproval}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void handleSubmitForApproval(approvalAttachmentFormat)}
              disabled={submittingApproval}
            >
              {submittingApproval ? (
                <Loader2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
              )}
              {t('payroll.approvalSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
