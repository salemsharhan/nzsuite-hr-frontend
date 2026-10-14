import { CheckCircle2, Clock, FileWarning, Loader, MessageCircle, UserCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApprovalLabels } from './ApprovalBits';

/**
 * Employee-facing view of where a request is. Built from the status fields on the request itself
 * (the WhatsApp approval flow keeps them up to date), so it works for self-service users.
 */
export type EmployeeStage = 'received' | 'dept' | 'gm' | 'docs' | 'prep' | 'approved' | 'completed' | 'rejected';

const FLOW_TO_EMPLOYEE: Record<string, EmployeeStage> = {
  pending_dept_head: 'dept',
  pending_gm: 'gm',
  pending_hr_docs: 'docs',
  pending_hr_doc_prep: 'prep',
  approved: 'approved',
  completed: 'completed',
  rejected: 'rejected',
  cancelled: 'rejected',
};

export function employeeStage(
  status?: string | null,
  currentApprover?: string | null,
  category?: string | null,
  flowStage?: string | null,
): EmployeeStage {
  if (flowStage && FLOW_TO_EMPLOYEE[flowStage]) return FLOW_TO_EMPLOYEE[flowStage];
  const s = String(status ?? '').trim();
  const who = String(currentApprover ?? '').toLowerCase();
  const isDocument = /letter|certificat|document|شهادة|مستند/i.test(String(category ?? ''));
  if (s === 'Approved') return 'approved';
  if (s === 'Completed') return 'completed';
  if (s === 'Rejected' || s === 'Cancelled') return 'rejected';
  if (s === 'Pending_Dept_Head' || who.includes('department head')) return 'dept';
  if (s === 'Pending_GM' || who === 'gm') return 'gm';
  if (s === 'On_Hold') return 'docs';
  if (s === 'In Progress') return 'prep';
  if (s === 'In Review' && who.includes('hr')) return isDocument ? 'prep' : 'docs';
  return 'received';
}

const TONE: Record<EmployeeStage, string> = {
  received: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
  dept: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/25',
  gm: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
  docs: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/25',
  prep: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/25',
  approved: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/25',
  completed: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/25',
  rejected: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25',
};

const ICON: Record<EmployeeStage, typeof Clock> = {
  received: Clock,
  dept: UserCheck,
  gm: UserCheck,
  docs: FileWarning,
  prep: Loader,
  approved: CheckCircle2,
  completed: CheckCircle2,
  rejected: XCircle,
};

export function EmployeeStatusBadge({
  status,
  currentApprover,
  category,
  flowStage,
  className,
}: {
  status?: string | null;
  currentApprover?: string | null;
  category?: string | null;
  flowStage?: string | null;
  className?: string;
}) {
  const { t } = useApprovalLabels();
  const stage = employeeStage(status, currentApprover, category, flowStage);
  const Icon = ICON[stage];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONE[stage],
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {t(`approvalFlow.employee.status.${stage}`)}
    </span>
  );
}

/** Translate stored approver values ("GM", "Department Head", "HR") for display. */
export function useApproverLabel() {
  const { t } = useApprovalLabels();
  return (approver?: string | null) => {
    const a = String(approver ?? '').toLowerCase();
    if (!a) return '—';
    if (a.includes('department head')) return t('approvalFlow.employee.dept');
    if (a === 'gm' || a.includes('general manager')) return t('approvalFlow.employee.gm');
    if (a === 'hr' || a.includes('hr')) return t('approvalFlow.settings.hr');
    return approver as string;
  };
}

/** Step tracker: received → (department head) → general manager → (documents / preparing) → result. */
export function EmployeeRequestSteps({
  status,
  currentApprover,
  category,
  flowStage,
  viaDeptHead,
}: {
  status?: string | null;
  currentApprover?: string | null;
  category?: string | null;
  flowStage?: string | null;
  /** The request went (or goes) through the department head */
  viaDeptHead?: boolean;
}) {
  const { t } = useApprovalLabels();
  const stage = employeeStage(status, currentApprover, category, flowStage);
  const order: EmployeeStage[] = ['received'];
  if (stage === 'dept' || viaDeptHead) order.push('dept');
  order.push('gm');
  if (stage === 'docs') order.push('docs');
  if (stage === 'prep' || stage === 'completed') order.push('prep');
  const final: EmployeeStage = stage === 'rejected' ? 'rejected' : stage === 'completed' ? 'completed' : 'approved';
  order.push(final);
  const currentIndex = stage === 'approved' || stage === 'completed' || stage === 'rejected' ? order.length - 1 : order.indexOf(stage);

  const label = (s: EmployeeStage) =>
    s === 'approved' || s === 'completed' || s === 'rejected'
      ? stage === 'rejected'
        ? t('approvalFlow.employee.rejected')
        : stage === 'approved' || stage === 'completed'
          ? t('approvalFlow.employee.approved')
          : t('approvalFlow.employee.done')
      : t(`approvalFlow.employee.${s}`);

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{t('approvalFlow.employee.progress')}</div>
      <ol className="flex flex-wrap items-center gap-2">
        {order.map((s, i) => {
          const done = i < currentIndex || (i === currentIndex && (stage === 'approved' || stage === 'completed'));
          const current = i === currentIndex && !done;
          const failed = i === order.length - 1 && stage === 'rejected';
          return (
            <li key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs',
                  done && 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
                  current && 'border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold',
                  failed && 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 font-semibold',
                  !done && !current && !failed && 'border-border text-muted-foreground',
                )}
              >
                <span className="font-mono">{i + 1}</span>
                {label(s)}
              </span>
              {i < order.length - 1 && <span className="text-muted-foreground rtl:rotate-180">→</span>}
            </li>
          );
        })}
      </ol>
      {stage === 'docs' && (
        <p className="text-sm rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-300 px-3 py-2">
          {t('approvalFlow.employee.docsHint')}
        </p>
      )}
      {stage === 'prep' && (
        <p className="text-sm rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-300 px-3 py-2">
          {t('approvalFlow.employee.prepHint')}
        </p>
      )}
      {stage !== 'approved' && stage !== 'completed' && stage !== 'rejected' && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5" /> {t('approvalFlow.employee.waHint')}
        </p>
      )}
    </div>
  );
}
