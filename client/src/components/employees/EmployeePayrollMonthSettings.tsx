import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Loader2, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  employeePayrollMonthService,
  type EmployeePayrollMonthAdjustment,
} from '@/services/employeePayrollMonthService';
import {
  PAYROLL_MONTH_ENTRY_EFFECT,
  type PayrollMonthEntryType,
  type PayrollMonthInputMode,
  summarizeMonthAdjustments,
} from '@/utils/payrollMonthAdjustments';
import { getPayrollPeriodBounds, formatPayrollPeriodRange } from '@/utils/payrollPeriod';
import { toast } from 'sonner';

const ENTRY_TYPES: PayrollMonthEntryType[] = [
  'paid_leave',
  'paid_leave_from_balance',
  'unpaid_leave',
  'sick_leave',
  'emergency_leave',
  'permitted_late',
  'full_month_salary',
  'loan',
];

const EMPTY_FORM = {
  entry_type: 'paid_leave' as PayrollMonthEntryType,
  input_mode: 'days_count' as PayrollMonthInputMode,
  days_count: '1',
  amount_kwd: '',
  date_from: '',
  date_to: '',
  notes: '',
};

interface EmployeePayrollMonthSettingsProps {
  employeeId: string;
  companyId: string;
  readOnly?: boolean;
}

export function EmployeePayrollMonthSettings({
  employeeId,
  companyId,
  readOnly = false,
}: EmployeePayrollMonthSettingsProps) {
  const { t } = useTranslation();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [entries, setEntries] = useState<EmployeePayrollMonthAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const period = useMemo(() => getPayrollPeriodBounds(y, m), [y, m]);
  const summary = useMemo(() => summarizeMonthAdjustments(entries, period), [entries, period]);

  const load = useCallback(async () => {
    if (!employeeId || !y || !m) return;
    setLoading(true);
    try {
      const data = await employeePayrollMonthService.getByEmployeeMonth(employeeId, y, m);
      setEntries(data);
    } catch (e) {
      console.error(e);
      toast.error(t('employees.payrollMonth.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, y, m, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      const isLoan = form.entry_type === 'loan';
      const payload = {
        employee_id: employeeId,
        company_id: companyId,
        payroll_year: y,
        payroll_month: m,
        entry_type: form.entry_type,
        input_mode: isLoan ? ('amount_kwd' as PayrollMonthInputMode) : form.input_mode,
        days_count:
          !isLoan && form.input_mode === 'days_count' ? parseFloat(form.days_count) || 0 : null,
        amount_kwd: isLoan ? parseFloat(form.amount_kwd) || 0 : null,
        date_from: !isLoan && form.input_mode === 'date_range' ? form.date_from || null : null,
        date_to: !isLoan && form.input_mode === 'date_range' ? form.date_to || null : null,
        notes: form.notes.trim() || null,
      };

      if (isLoan) {
        if (!payload.amount_kwd || payload.amount_kwd <= 0) {
          toast.error(t('employees.payrollMonth.loanAmountRequired'));
          return;
        }
      } else if (payload.input_mode === 'days_count' && (!payload.days_count || payload.days_count <= 0)) {
        toast.error(t('employees.payrollMonth.daysRequired'));
        return;
      }
      if (
        payload.input_mode === 'date_range' &&
        (!payload.date_from || !payload.date_to || payload.date_from > payload.date_to)
      ) {
        toast.error(t('employees.payrollMonth.dateRangeRequired'));
        return;
      }

      await employeePayrollMonthService.create(payload);
      setForm(EMPTY_FORM);
      await load();
      toast.success(t('employees.payrollMonth.saved'));
    } catch (e) {
      console.error(e);
      toast.error(t('employees.payrollMonth.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (readOnly) return;
    if (!confirm(t('employees.payrollMonth.confirmDelete'))) return;
    try {
      await employeePayrollMonthService.delete(id);
      await load();
      toast.success(t('employees.payrollMonth.deleted'));
    } catch (e) {
      console.error(e);
      toast.error(t('employees.payrollMonth.deleteFailed'));
    }
  };

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: t(`payroll.months.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][i]}`),
      })),
    [t],
  );

  const effectBadge = (type: PayrollMonthEntryType) => {
    const effect = PAYROLL_MONTH_ENTRY_EFFECT[type];
    const variant =
      effect === 'add_salary'
        ? 'default'
        : effect === 'deduct_salary'
          ? 'destructive'
          : 'secondary';
    return (
      <Badge variant={variant} className="text-xs">
        {t(`employees.payrollMonth.effect.${effect}`)}
      </Badge>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-white/10">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Calendar size={22} className="text-amber-400" />
          {t('employees.payrollMonth.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">{t('employees.payrollMonth.subtitle')}</p>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label>{t('payroll.month')}</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((mo) => (
                  <SelectItem key={mo.value} value={mo.value}>
                    {mo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t('payroll.year')}</Label>
            <Input
              type="number"
              className="w-[100px]"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground pb-2">
            {t('employees.payrollMonth.periodHint', { range: formatPayrollPeriodRange(period) })}
          </p>
        </div>

        {!readOnly && (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
            <h4 className="font-semibold text-sm">{t('employees.payrollMonth.addEntry')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>{t('employees.payrollMonth.entryType')}</Label>
                <Select
                  value={form.entry_type}
                  onValueChange={(v) => {
                    const type = v as PayrollMonthEntryType;
                    setForm({
                      ...form,
                      entry_type: type,
                      input_mode: type === 'loan' ? 'amount_kwd' : form.input_mode,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`employees.payrollMonthEntry.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.entry_type !== 'loan' ? (
                <div className="space-y-1">
                  <Label>{t('employees.payrollMonth.inputMode')}</Label>
                  <Select
                    value={form.input_mode}
                    onValueChange={(v) =>
                      setForm({ ...form, input_mode: v as PayrollMonthInputMode })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days_count">{t('employees.payrollMonth.modeDays')}</SelectItem>
                      <SelectItem value="date_range">
                        {t('employees.payrollMonth.modeDateRange')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>{t('employees.payrollMonth.loanAmount')}</Label>
                  <Input
                    type="number"
                    min={0.001}
                    step={0.001}
                    value={form.amount_kwd}
                    onChange={(e) => setForm({ ...form, amount_kwd: e.target.value })}
                    placeholder="0.000"
                  />
                </div>
              )}
              {form.entry_type !== 'loan' && form.input_mode === 'days_count' ? (
                <div className="space-y-1">
                  <Label>{t('employees.payrollMonth.daysCount')}</Label>
                  <Input
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={form.days_count}
                    onChange={(e) => setForm({ ...form, days_count: e.target.value })}
                  />
                </div>
              ) : form.entry_type !== 'loan' ? (
                <>
                  <div className="space-y-1">
                    <Label>{t('employees.payrollMonth.dateFrom')}</Label>
                    <Input
                      type="date"
                      value={form.date_from}
                      onChange={(e) => setForm({ ...form, date_from: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('employees.payrollMonth.dateTo')}</Label>
                    <Input
                      type="date"
                      value={form.date_to}
                      onChange={(e) => setForm({ ...form, date_to: e.target.value })}
                    />
                  </div>
                </>
              ) : null}
              <div className="space-y-1 md:col-span-2">
                <Label>{t('employees.payrollMonth.notesOptional')}</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <Button onClick={() => void handleAdd()} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {t('employees.payrollMonth.addBtn')}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('employees.payrollMonth.noEntries')}</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t(`employees.payrollMonthEntry.${entry.entry_type}`)}</span>
                  {effectBadge(entry.entry_type)}
                  <span className="text-muted-foreground">
                    {entry.entry_type === 'loan'
                      ? t('employees.payrollMonth.loanAmountLabel', {
                          amount: Number(entry.amount_kwd ?? 0).toFixed(3),
                        })
                      : entry.input_mode === 'days_count'
                        ? t('employees.payrollMonth.daysLabel', { count: entry.days_count })
                        : `${entry.date_from?.slice(0, 10)} → ${entry.date_to?.slice(0, 10)}`}
                  </span>
                  {entry.notes ? (
                    <span className="text-muted-foreground italic">— {entry.notes}</span>
                  ) : null}
                </div>
                {!readOnly && (
                  <Button variant="ghost" size="icon" onClick={() => void handleDelete(entry.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {(summary.entries.length > 0 || summary.loan_kwd > 0) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm space-y-1">
            <p className="font-semibold">{t('employees.payrollMonth.summaryTitle')}</p>
            <p>
              {t('employees.payrollMonth.summaryPaid', { days: summary.paid_leave_days })}
              {' · '}
              {t('employees.payrollMonth.summaryPaidFromBalance', {
                days: summary.paid_leave_from_balance_days,
              })}
              {' · '}
              {t('employees.payrollMonth.summaryUnpaid', { days: summary.unpaid_leave_days })}
              {' · '}
              {t('employees.payrollMonth.summarySick', { days: summary.sick_leave_days })}
              {' · '}
              {t('employees.payrollMonth.summaryEmergency', { days: summary.emergency_leave_days })}
              {' · '}
              {t('employees.payrollMonth.summaryPermittedLate', { days: summary.permitted_late_days })}
              {summary.full_month_salary ? (
                <>
                  {' · '}
                  {t('employees.payrollMonth.summaryFullMonth')}
                </>
              ) : null}
              {summary.loan_kwd > 0 ? (
                <>
                  {' · '}
                  {t('employees.payrollMonth.summaryLoan', {
                    amount: summary.loan_kwd.toFixed(3),
                  })}
                </>
              ) : null}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
