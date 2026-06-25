import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface SubmitPayrollApprovalInput {
  companyId: string;
  payrollReportId?: string;
  year?: number;
  month?: number;
  department?: string;
  title?: string;
  description?: string;
  attachmentBase64: string;
  attachmentFilename: string;
  attachmentMime: string;
  /** @deprecated use attachmentBase64 */
  excelBase64?: string;
  /** @deprecated use attachmentFilename */
  excelFilename?: string;
}

export interface SubmitPayrollApprovalResult {
  ok: boolean;
  payroll_report_id: string;
  whats_task_id: string;
  reused?: boolean;
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return token;
}

export async function submitPayrollForApproval(
  input: SubmitPayrollApprovalInput & { submittedByEmail?: string; submittedByUserId?: string }
): Promise<SubmitPayrollApprovalResult> {
  let token: string | null = null
  try {
    token = await getAccessToken()
  } catch {
    token = null
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-payroll-approval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      company_id: input.companyId,
      payroll_report_id: input.payrollReportId,
      year: input.year,
      month: input.month,
      department: input.department ?? 'all',
      title: input.title,
      description: input.description,
      submitted_by_email: input.submittedByEmail,
      submitted_by_user_id: input.submittedByUserId,
      attachment_base64: input.attachmentBase64,
      attachment_filename: input.attachmentFilename,
      attachment_mime: input.attachmentMime,
      excel_base64: input.attachmentBase64,
      excel_filename: input.attachmentFilename,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? `Failed to submit for approval (${res.status})`);
  }
  return data as SubmitPayrollApprovalResult;
}

export interface SyncPayrollApprovalResult {
  ok: boolean;
  synced?: boolean;
  approval_status?: string;
  skipped?: boolean;
  reason?: string;
}

export async function syncPayrollApprovalStatus(
  companyId: string,
  payrollReportId: string,
): Promise<SyncPayrollApprovalResult> {
  let token: string | null = null
  try {
    token = await getAccessToken()
  } catch {
    token = null
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/payroll-sync-approval-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      company_id: companyId,
      payroll_report_id: payrollReportId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? `Failed to sync approval status (${res.status})`);
  }
  return data as SyncPayrollApprovalResult;
}

import i18n from '@/utils/i18n';

export function payrollApprovalStatusLabel(status?: string): string {
  const key = status || 'draft';
  return i18n.t(`payroll.approvalStatus.${key}`, { defaultValue: key });
}
