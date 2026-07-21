import { supabase } from './supabase';
import { adminApi } from './api';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type HrApprovalStatus = 'pending_gm' | 'approved' | 'rejected' | 'on_hold';
export type HrApprovalSource = 'manual' | 'leave';

export interface HrApprovalRequest {
  id: string;
  company_id: string;
  title: string;
  body?: string | null;
  status: HrApprovalStatus;
  source: HrApprovalSource;
  leave_request_id?: string | null;
  attachment_path?: string | null;
  attachment_mime?: string | null;
  attachment_filename?: string | null;
  gm_note?: string | null;
  hr_note?: string | null;
  hr_created_by?: string | null;
  whats_task_task_id?: string | null;
  integration_ref?: string | null;
  created_at?: string;
  updated_at?: string;
  decided_at?: string | null;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function notifyLeaveToHr(leaveRequestId: string, companyId?: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notify-leave-to-hr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      leave_request_id: leaveRequestId,
      company_id: companyId,
    }),
  });
  // Soft-fail: leave create should succeed even if WhatsApp is not configured
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.warn('notify-leave-to-hr failed', data);
  }
}

export async function submitHrApproval(input: {
  companyId: string;
  title: string;
  body?: string;
  source?: HrApprovalSource;
  leaveRequestId?: string;
  hrCreatedBy?: string;
  attachmentBase64?: string;
  attachmentFilename?: string;
  attachmentMime?: string;
}): Promise<{ ok: boolean; approval_request_id: string; whats_task_task_id?: string | null }> {
  const token = await getAccessToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-hr-approval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      company_id: input.companyId,
      title: input.title,
      body: input.body,
      source: input.source ?? 'manual',
      leave_request_id: input.leaveRequestId,
      hr_created_by: input.hrCreatedBy,
      attachment_base64: input.attachmentBase64,
      attachment_filename: input.attachmentFilename,
      attachment_mime: input.attachmentMime,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Submit failed (${res.status})`);
  }
  return data as { ok: boolean; approval_request_id: string; whats_task_task_id?: string | null };
}

export async function decideHrApprovalInApp(input: {
  approvalRequestId: string;
  status: 'approved' | 'rejected' | 'on_hold';
  note?: string;
}): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/hr-approval-callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      in_app: true,
      approval_request_id: input.approvalRequestId,
      status: input.status,
      gm_note: input.note,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Decision failed (${res.status})`);
  }
}

export const hrApprovalService = {
  async list(companyId: string, status?: HrApprovalStatus | 'all'): Promise<HrApprovalRequest[]> {
    let path = `/hr_approval_requests?company_id=eq.${companyId}&order=created_at.desc`;
    if (status && status !== 'all') {
      path += `&status=eq.${status}`;
    }
    const response = await adminApi.get(path);
    return (response.data ?? []) as HrApprovalRequest[];
  },

  async getById(id: string): Promise<HrApprovalRequest | null> {
    const response = await adminApi.get(`/hr_approval_requests?id=eq.${id}`);
    const rows = response.data as HrApprovalRequest[];
    return rows?.[0] ?? null;
  },
};

export async function fileToBase64(file: File): Promise<{ base64: string; filename: string; mime: string }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    base64: btoa(binary),
    filename: file.name,
    mime: file.type || 'application/octet-stream',
  };
}
