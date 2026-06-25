import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const UNLOCK_STORAGE_PREFIX = 'payroll-ceo-unlock:';

export interface CeoUnlockSession {
  unlockToken: string;
  unlockExpiresAt: string;
  reportId: string;
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return token;
}

async function callPayrollCeoOtp(body: Record<string, unknown>) {
  const token = await getAccessToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/payroll-ceo-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data;
}

export async function sendPayrollCeoOtp(companyId: string, payrollReportId: string) {
  return callPayrollCeoOtp({
    action: 'send',
    company_id: companyId,
    payroll_report_id: payrollReportId,
  }) as Promise<{ ok: boolean; expires_at: string; otp_length: number }>;
}

export async function verifyPayrollCeoOtp(
  companyId: string,
  payrollReportId: string,
  otp: string
) {
  return callPayrollCeoOtp({
    action: 'verify',
    company_id: companyId,
    payroll_report_id: payrollReportId,
    otp,
  }) as Promise<{ ok: boolean; unlock_token: string; unlock_expires_at: string }>;
}

export async function checkPayrollCeoUnlock(
  companyId: string,
  payrollReportId: string,
  unlockToken: string
) {
  return callPayrollCeoOtp({
    action: 'check',
    company_id: companyId,
    payroll_report_id: payrollReportId,
    unlock_token: unlockToken,
  }) as Promise<{ valid: boolean; unlock_expires_at?: string }>;
}

export function loadCeoUnlockSession(reportId: string): CeoUnlockSession | null {
  try {
    const raw = sessionStorage.getItem(`${UNLOCK_STORAGE_PREFIX}${reportId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CeoUnlockSession;
    if (!parsed.unlockToken || !parsed.unlockExpiresAt || parsed.reportId !== reportId) return null;
    if (new Date(parsed.unlockExpiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(`${UNLOCK_STORAGE_PREFIX}${reportId}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCeoUnlockSession(session: CeoUnlockSession) {
  sessionStorage.setItem(`${UNLOCK_STORAGE_PREFIX}${session.reportId}`, JSON.stringify(session));
}

export function clearCeoUnlockSession(reportId: string) {
  sessionStorage.removeItem(`${UNLOCK_STORAGE_PREFIX}${reportId}`);
}

export function isCeoUnlockSessionActive(session: CeoUnlockSession | null): boolean {
  if (!session) return false;
  return new Date(session.unlockExpiresAt).getTime() > Date.now();
}
