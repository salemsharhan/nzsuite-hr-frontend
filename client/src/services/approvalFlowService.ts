import { supabase } from './supabase';

/**
 * WhatsApp approval flow (GM + HR) for leave, employee and document requests.
 *
 * State lives in `request_approvals` and is driven by the n8n "HR Requests" workflow.
 * The app only reads it; every decision goes through the `approval-action` edge function,
 * which runs the same engine as the WhatsApp polls. That keeps the app, the GM/HR polls
 * and the employee notifications in sync.
 */

export type ApprovalStage =
  | 'pending_gm'
  | 'pending_hr_docs'
  | 'pending_hr_doc_prep'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type ApprovalAction = 'approve' | 'reject' | 'to_hr' | 'docs_received' | 'ready';
export type ApprovalSourceTable = 'leave_requests' | 'employee_requests' | 'document_requests';
export type ApprovalKind = 'leave' | 'request' | 'document';

export interface ApprovalHistoryEntry {
  at: string;
  event?: string;
  by?: 'gm' | 'hr' | 'app';
  action?: ApprovalAction;
  from?: ApprovalStage;
  to?: ApprovalStage;
  actor?: string;
  note?: string;
}

export interface ApprovalSnapshot {
  kind: ApprovalKind;
  title: string;
  details: {
    start_date?: string;
    end_date?: string;
    reason?: string;
    category?: string;
    purpose?: string;
    language?: string;
    destination?: string;
    form?: Record<string, unknown>;
  };
  created_at: string;
  employee_name: string;
  employee_code?: string;
  employee_phone?: string;
  company_name?: string;
  gm_name?: string;
  hr_name?: string;
}

export interface RequestApproval {
  id: string;
  ref_no: number;
  source_table: ApprovalSourceTable;
  source_id: string;
  kind: ApprovalKind;
  company_id: string | null;
  employee_id: string | null;
  stage: ApprovalStage;
  gm_note: string | null;
  hr_note: string | null;
  history: ApprovalHistoryEntry[];
  snapshot: ApprovalSnapshot;
  created_at: string;
  updated_at: string;
}

export const OPEN_STAGES: ApprovalStage[] = ['pending_gm', 'pending_hr_docs', 'pending_hr_doc_prep'];

export const STAGE_META: Record<ApprovalStage, { label: string; waitingOn: 'GM' | 'HR' | null; tone: string }> = {
  pending_gm: { label: 'Waiting for GM', waitingOn: 'GM', tone: 'blue' },
  pending_hr_docs: { label: 'HR collecting documents', waitingOn: 'HR', tone: 'orange' },
  pending_hr_doc_prep: { label: 'HR preparing document', waitingOn: 'HR', tone: 'violet' },
  approved: { label: 'Approved', waitingOn: null, tone: 'green' },
  completed: { label: 'Completed', waitingOn: null, tone: 'green' },
  rejected: { label: 'Rejected', waitingOn: null, tone: 'red' },
  cancelled: { label: 'Cancelled', waitingOn: null, tone: 'gray' },
};

export const ACTION_META: Record<ApprovalAction, { label: string; variant: 'default' | 'destructive' | 'outline' }> = {
  approve: { label: 'Approve', variant: 'default' },
  reject: { label: 'Reject', variant: 'destructive' },
  to_hr: { label: 'Send to HR for documents', variant: 'outline' },
  docs_received: { label: 'Documents received → back to GM', variant: 'default' },
  ready: { label: 'Document ready', variant: 'default' },
};

/** Actions possible at each stage (mirrors the n8n engine). */
export function actionsForStage(stage: ApprovalStage): ApprovalAction[] {
  if (stage === 'pending_gm') return ['approve', 'to_hr', 'reject'];
  if (stage === 'pending_hr_docs') return ['docs_received', 'reject'];
  if (stage === 'pending_hr_doc_prep') return ['ready', 'reject'];
  return [];
}

export const KIND_LABEL: Record<ApprovalKind, string> = {
  leave: 'Leave',
  request: 'Request',
  document: 'Document',
};

/** One-line description: dates / times / reason. */
export function describeApproval(a: Pick<RequestApproval, 'snapshot' | 'kind'>): string {
  const d = a.snapshot?.details ?? {};
  const f = (d.form ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (a.kind === 'leave') {
    if (d.start_date) parts.push(d.end_date && d.end_date !== d.start_date ? `${d.start_date} → ${d.end_date}` : String(d.start_date));
    if (d.reason) parts.push(String(d.reason));
  } else {
    if (f.date) parts.push(`${f.date}${f.fromTime ? ` ${f.fromTime}${f.toTime ? `–${f.toTime}` : ''}` : ''}`);
    const reason = f.reason ?? d.purpose ?? f.purpose;
    if (reason) parts.push(String(reason));
  }
  return parts.join(' · ');
}

export const approvalFlowService = {
  async list(params: { companyId?: string | null; stages?: ApprovalStage[] } = {}): Promise<RequestApproval[]> {
    let query = supabase.from('request_approvals').select('*').order('ref_no', { ascending: false }).limit(500);
    if (params.companyId) query = query.eq('company_id', params.companyId);
    if (params.stages?.length) query = query.in('stage', params.stages);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as RequestApproval[];
  },

  /** Approval rows for a set of source records, keyed by source id. */
  async mapForSources(sourceTable: ApprovalSourceTable, sourceIds: string[]): Promise<Record<string, RequestApproval>> {
    const ids = Array.from(new Set(sourceIds.filter(Boolean)));
    if (!ids.length) return {};
    const { data, error } = await supabase
      .from('request_approvals')
      .select('*')
      .eq('source_table', sourceTable)
      .in('source_id', ids);
    if (error) {
      console.warn('request_approvals lookup failed', error.message);
      return {};
    }
    return Object.fromEntries(((data ?? []) as RequestApproval[]).map((a) => [a.source_id, a]));
  },

  async act(approvalId: string, action: ApprovalAction, note?: string) {
    const { data, error } = await supabase.functions.invoke('approval-action', {
      body: { approval_id: approvalId, action, note: note?.trim() || undefined },
    });
    if (error) {
      // FunctionsHttpError carries the JSON body from the function
      let message = error.message;
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) message = body.error;
      } catch {
        /* keep default message */
      }
      throw new Error(message);
    }
    if (data && data.ok === false) throw new Error(data.error || 'Action failed');
    return data as { ok: true; approval_id: string; ref_no: number; from: ApprovalStage; to: ApprovalStage };
  },

  /** Live updates (WhatsApp votes, other admins). Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void {
    const channel = supabase
      .channel(`request_approvals_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'request_approvals' }, () => onChange())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
