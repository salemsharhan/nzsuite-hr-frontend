import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
  input: SubmitPayrollApprovalInput
): Promise<SubmitPayrollApprovalResult> {
  const token = await getAccessToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-payroll-approval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      company_id: input.companyId,
      payroll_report_id: input.payrollReportId,
      year: input.year,
      month: input.month,
      department: input.department ?? 'all',
      title: input.title,
      description: input.description,
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

export function payrollApprovalStatusLabel(status?: string): string {
  switch (status) {
    case 'pending_approval':
      return 'Pending Approval';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'on_hold':
      return 'On Hold';
    case 'need_update':
      return 'Needs Update';
    default:
      return 'Draft';
  }
}
