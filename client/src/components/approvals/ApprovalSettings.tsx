import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Save, ShieldCheck, UserCog, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { useApprovalLabels } from './ApprovalBits';

interface CompanyRow {
  id: string;
  name: string;
}
interface SettingsRow {
  id: string;
  company_id: string;
  requests_dept_head_enabled: boolean | null;
  payroll_approver_name: string | null;
  payroll_approver_phone_e164: string | null;
  payroll_hr_name: string | null;
  payroll_hr_phone_e164: string | null;
}
interface EmployeeRow {
  id: string;
  employee_id: string | null;
  first_name: string | null;
  last_name: string | null;
  department_id: string | null;
  phone: string | null;
}
interface DepartmentRow {
  id: string;
  name: string;
  head_employee_id: string | null;
  head_wa_phone: string | null;
}

const NO_HEAD = '__none__';
const fullName = (e?: EmployeeRow) => (e ? `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() || e.employee_id || '—' : '—');
const maskPhone = (p?: string | null) => {
  const d = String(p ?? '').replace(/\D/g, '');
  return d ? `•••• ${d.slice(-4)}` : '';
};

export function ApprovalSettings() {
  const { user } = useAuth();
  const L = useApprovalLabels();
  const t = L.t;
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role === 'admin';
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companyId, setCompanyId] = useState<string | undefined>(user?.company_id);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { head: string; phone: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void supabase
      .from('companies')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        setCompanies((data ?? []) as CompanyRow[]);
        if (!companyId && data?.length) setCompanyId(data[0].id);
      });
  }, [isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [{ data: cs }, { data: emps }, { data: deps }] = await Promise.all([
        supabase
          .from('company_settings')
          .select('id, company_id, requests_dept_head_enabled, payroll_approver_name, payroll_approver_phone_e164, payroll_hr_name, payroll_hr_phone_e164')
          .eq('company_id', companyId)
          .maybeSingle(),
        supabase
          .from('employees')
          .select('id, employee_id, first_name, last_name, department_id, phone')
          .eq('company_id', companyId)
          .eq('status', 'Active')
          .order('first_name'),
        supabase.from('departments').select('id, name, head_employee_id, head_wa_phone').order('name'),
      ]);
      setSettings((cs as SettingsRow) ?? null);
      setEmployees((emps ?? []) as EmployeeRow[]);
      setDepartments((deps ?? []) as DepartmentRow[]);
      setDrafts(
        Object.fromEntries(
          ((deps ?? []) as DepartmentRow[]).map((d) => [d.id, { head: d.head_employee_id ?? NO_HEAD, phone: d.head_wa_phone ?? '' }]),
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('approvalFlow.settings.saveFailed'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only departments that have employees in this company
  const companyDepartments = useMemo(() => {
    const counts = new Map<string, number>();
    employees.forEach((e) => e.department_id && counts.set(e.department_id, (counts.get(e.department_id) ?? 0) + 1));
    return departments.filter((d) => counts.has(d.id)).map((d) => ({ ...d, count: counts.get(d.id) ?? 0 }));
  }, [departments, employees]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const toggleDeptStep = async (enabled: boolean) => {
    if (!settings) return;
    setSaving('toggle');
    const { error } = await supabase.from('company_settings').update({ requests_dept_head_enabled: enabled }).eq('id', settings.id);
    setSaving(null);
    if (error) return toast.error(`${t('approvalFlow.settings.saveFailed')}: ${error.message}`);
    setSettings({ ...settings, requests_dept_head_enabled: enabled });
    toast.success(t('approvalFlow.settings.saved'));
  };

  const saveDepartment = async (depId: string) => {
    const d = drafts[depId];
    if (!d) return;
    setSaving(depId);
    const { error } = await supabase
      .from('departments')
      .update({ head_employee_id: d.head === NO_HEAD ? null : d.head, head_wa_phone: d.phone.trim() || null })
      .eq('id', depId);
    setSaving(null);
    if (error) return toast.error(`${t('approvalFlow.settings.saveFailed')}: ${error.message}`);
    toast.success(t('approvalFlow.settings.saved'));
    void load();
  };

  if (!isAdmin) {
    return <Card className="p-6 text-sm text-muted-foreground">{t('approvalFlow.settings.onlyAdmins')}</Card>;
  }

  return (
    <div className="space-y-4">
      {isSuperAdmin && companies.length > 1 && (
        <Card className="p-4 flex flex-wrap items-center gap-3">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('approvalFlow.settings.company')}</span>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      )}

      {loading ? (
        <div className="py-12 flex justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-3 max-w-2xl">
                <div className="rounded-lg p-2 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 h-fit">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('approvalFlow.settings.deptStep')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t('approvalFlow.settings.deptStepHint')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {settings?.requests_dept_head_enabled ? t('approvalFlow.settings.enabled') : t('approvalFlow.settings.disabled')}
                </span>
                <Switch
                  checked={!!settings?.requests_dept_head_enabled}
                  disabled={!settings || saving === 'toggle'}
                  onCheckedChange={(v) => void toggleDeptStep(v)}
                />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold">{t('approvalFlow.settings.approvers')}</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: t('approvalFlow.settings.gm'), name: settings?.payroll_approver_name, phone: settings?.payroll_approver_phone_e164 },
                { label: t('approvalFlow.settings.hr'), name: settings?.payroll_hr_name, phone: settings?.payroll_hr_phone_e164 },
              ].map((a) => (
                <div key={a.label} className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">{a.label}</div>
                  <div className="font-medium">{a.name || t('approvalFlow.settings.notSet')}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    {maskPhone(a.phone)}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('approvalFlow.settings.approversHint')}</p>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold">{t('approvalFlow.settings.departments')}</h3>
            </div>
            <div className="divide-y divide-border rounded-lg border border-border">
              {companyDepartments.map((d) => {
                const draft = drafts[d.id] ?? { head: NO_HEAD, phone: '' };
                const changed = draft.head !== (d.head_employee_id ?? NO_HEAD) || draft.phone !== (d.head_wa_phone ?? '');
                const head = employeeById.get(draft.head);
                return (
                  <div key={d.id} className="p-3 grid gap-3 lg:grid-cols-[1fr_1.3fr_1fr_auto] items-center">
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.count} {t('approvalFlow.settings.employees')}
                      </div>
                    </div>
                    <Select value={draft.head} onValueChange={(v) => setDrafts({ ...drafts, [d.id]: { ...draft, head: v } })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_HEAD}>{t('approvalFlow.settings.noHead')}</SelectItem>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {fullName(e)}
                            {e.employee_id ? ` · ${e.employee_id}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div>
                      <Input
                        dir="ltr"
                        value={draft.phone}
                        disabled={draft.head === NO_HEAD}
                        placeholder={head?.phone ? maskPhone(head.phone) : t('approvalFlow.settings.waOverride')}
                        onChange={(e) => setDrafts({ ...drafts, [d.id]: { ...draft, phone: e.target.value } })}
                      />
                      <div className="text-[11px] text-muted-foreground mt-1">{t('approvalFlow.settings.waOverrideHint')}</div>
                    </div>
                    <Button size="sm" disabled={!changed || saving === d.id} onClick={() => void saveDepartment(d.id)}>
                      {saving === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span className="ms-1.5">{t('approvalFlow.settings.save')}</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
