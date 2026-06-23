import { adminApi } from './api';
import type { KdaPayrollReportRow } from './payrollReportService';

export interface PayrollReportMeta {
  companyName: string;
  companyNameArabic: string;
  periodLabel: string;
  departmentLabel: string;
}

export type PayrollApprovalStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'on_hold'
  | 'need_update';

export interface SavedPayrollReport {
  id: string;
  company_id: string;
  year: number;
  month: number;
  department: string;
  report_data: {
    meta: PayrollReportMeta;
    rows: KdaPayrollReportRow[];
  };
  saved_at: string;
  saved_by_user_id: string | null;
  saved_by_email: string | null;
  approval_status?: PayrollApprovalStatus;
  submitted_at?: string | null;
  submitted_by_email?: string | null;
  approved_at?: string | null;
  approved_by_name?: string | null;
  approval_note?: string | null;
  whats_task_id?: string | null;
}

const DEPT_KEY = (d: string) => (d === 'all' ? '' : d);

/**
 * Fetch a saved payroll report for the given company, year, month, and department.
 * Returns null if none saved.
 */
export async function getSavedPayrollReport(
  companyId: string,
  year: number,
  month: number,
  department: string
): Promise<SavedPayrollReport | null> {
  const dept = DEPT_KEY(department);
  const url = `/payroll_reports?company_id=eq.${companyId}&year=eq.${year}&month=eq.${month}&department=eq.${encodeURIComponent(dept)}&select=*&limit=1`;
  const res = await adminApi.get<SavedPayrollReport[]>(url);
  const list = Array.isArray(res.data) ? res.data : [];
  return list[0] ?? null;
}

/**
 * Save or update a payroll report. Upserts by (company_id, year, month, department).
 */
export async function savePayrollReport(
  companyId: string,
  year: number,
  month: number,
  department: string,
  payload: {
    meta: PayrollReportMeta;
    rows: KdaPayrollReportRow[];
  },
  savedBy: { userId: string; email: string }
): Promise<SavedPayrollReport> {
  const dept = DEPT_KEY(department);
  const body = {
    company_id: companyId,
    year,
    month,
    department: dept,
    report_data: payload,
    saved_at: new Date().toISOString(),
    saved_by_user_id: savedBy.userId,
    saved_by_email: savedBy.email
  };

  const existing = await getSavedPayrollReport(companyId, year, month, department);
  if (existing) {
    const res = await adminApi.patch<SavedPayrollReport[]>(
      `/payroll_reports?id=eq.${existing.id}`,
      body,
      { headers: { Prefer: 'return=representation' } }
    );
    const updated = Array.isArray(res.data) ? res.data[0] : (res.data as unknown as SavedPayrollReport);
    if (!updated) throw new Error('Failed to update payroll report');
    return updated;
  }

  const res = await adminApi.post<SavedPayrollReport>('/payroll_reports', body, {
    headers: { Prefer: 'return=representation' }
  });
  const created = Array.isArray(res.data) ? res.data[0] : (res.data as unknown as SavedPayrollReport);
  if (!created) throw new Error('Failed to create payroll report');
  return created;
}
