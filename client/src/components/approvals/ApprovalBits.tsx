import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';
import { CheckCircle2, FileCheck2, FileSearch, Loader2, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ACTION_META,
  STAGE_META,
  approvalFlowService,
  describeApproval,
  type ApprovalAction,
  type ApprovalKind,
  type ApprovalStage,
  type RequestApproval,
} from '@/services/approvalFlowService';

const TONE: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25',
  green: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/25',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
  gray: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/25',
};

/** Translated labels for the approval flow (falls back to English). */
export function useApprovalLabels() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  return {
    t,
    isAr,
    stage: (s: ApprovalStage) => t(`approvalFlow.stage.${s}`, { defaultValue: STAGE_META[s]?.label ?? s }),
    action: (a: ApprovalAction) => t(`approvalFlow.action.${a}`, { defaultValue: ACTION_META[a]?.label ?? a }),
    short: (a: ApprovalAction | 'cannot_issue') => t(`approvalFlow.short.${a}`, { defaultValue: a === 'cannot_issue' ? 'Cannot issue' : ACTION_META[a]?.label ?? a }),
    kind: (k: ApprovalKind) => t(`approvalFlow.kind.${k}`, { defaultValue: k }),
    ago: (iso?: string) => {
      if (!iso) return '—';
      try {
        return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: isAr ? arLocale : undefined });
      } catch {
        return '—';
      }
    },
  };
}

export function ApprovalStageBadge({ stage, className }: { stage: ApprovalStage; className?: string }) {
  const L = useApprovalLabels();
  const meta = STAGE_META[stage] ?? STAGE_META.cancelled;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONE[meta.tone],
        className,
      )}
    >
      {L.stage(stage)}
    </span>
  );
}

/** Short button label for an action, e.g. "To HR". */
export function ApprovalActionLabel({ action, short = true }: { action: ApprovalAction | 'cannot_issue'; short?: boolean }) {
  const L = useApprovalLabels();
  return <>{short || action === 'cannot_issue' ? L.short(action) : L.action(action)}</>;
}

/** "#12 · WhatsApp flow" caption shown under a status badge. */
export function ApprovalFlowCaption({ approval }: { approval: RequestApproval }) {
  const L = useApprovalLabels();
  return (
    <span className="text-[11px] text-muted-foreground">
      #{approval.ref_no} · {L.t('approvalFlow.whatsappFlow', { defaultValue: 'WhatsApp flow' })}
    </span>
  );
}

/** GM → (HR documents → GM) → (HR prepares) → done, with the current step highlighted. */
export function ApprovalPipeline({ approval }: { approval: RequestApproval }) {
  const L = useApprovalLabels();
  const p = (k: string, d: string) => L.t(`approvalFlow.pipeline.${k}`, { defaultValue: d });
  const history = approval.history ?? [];
  const isDoc = approval.kind === 'document';
  const wentToHr = approval.stage === 'pending_hr_docs' || history.some((h) => h.to === 'pending_hr_docs');
  const final = approval.stage === 'approved' || approval.stage === 'completed';
  const rejected = approval.stage === 'rejected' || approval.stage === 'cancelled';
  const gmDecided =
    final || approval.stage === 'pending_hr_doc_prep' || (rejected && history.some((h) => h.from === 'pending_gm' && h.to === 'rejected'));

  type Step = { key: string; label: string; state: 'done' | 'current' | 'todo' | 'failed' };
  const steps: Step[] = [];
  steps.push({ key: 'gm', label: p('gm', 'GM'), state: wentToHr ? 'done' : approval.stage === 'pending_gm' ? 'current' : gmDecided ? 'done' : 'todo' });
  if (wentToHr) {
    steps.push({ key: 'hr_docs', label: p('hrDocs', 'HR docs'), state: approval.stage === 'pending_hr_docs' ? 'current' : 'done' });
    steps.push({ key: 'gm2', label: p('gm', 'GM'), state: approval.stage === 'pending_gm' ? 'current' : gmDecided ? 'done' : 'todo' });
  }
  if (isDoc) {
    steps.push({ key: 'prep', label: p('prep', 'HR prepares'), state: approval.stage === 'pending_hr_doc_prep' ? 'current' : approval.stage === 'completed' ? 'done' : 'todo' });
  }
  steps.push({ key: 'end', label: rejected ? p('rejected', 'Rejected') : p('done', 'Done'), state: rejected ? 'failed' : final ? 'done' : 'todo' });

  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 border',
              s.state === 'done' && 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
              s.state === 'current' && 'border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold',
              s.state === 'todo' && 'border-border text-muted-foreground',
              s.state === 'failed' && 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-muted-foreground">{L.isAr ? '←' : '→'}</span>}
        </div>
      ))}
    </div>
  );
}

const ACTION_ICON: Record<ApprovalAction, typeof CheckCircle2> = {
  approve: CheckCircle2,
  reject: XCircle,
  to_hr: FileSearch,
  docs_received: Send,
  ready: FileCheck2,
};

export function ApprovalActionIcon({ action, className }: { action: ApprovalAction; className?: string }) {
  const Icon = ACTION_ICON[action];
  return <Icon className={className ?? 'w-3.5 h-3.5'} />;
}

/** Confirm dialog for an approval action (optional note goes to the employee / HR on WhatsApp). */
export function ApprovalActionDialog({
  approval,
  action,
  open,
  onOpenChange,
  onDone,
}: {
  approval: RequestApproval | null;
  action: ApprovalAction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const L = useApprovalLabels();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!approval || !action) return null;
  const meta = ACTION_META[action];
  const s = approval.snapshot;
  const desc = describeApproval(approval);

  const submit = async () => {
    try {
      setBusy(true);
      const res = await approvalFlowService.act(approval.id, action, note);
      toast.success(L.t('approvalFlow.toast.done', { ref: res.ref_no, stage: L.stage(res.to), defaultValue: `#${res.ref_no}: ${res.to}` }));
      setNote('');
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : L.t('approvalFlow.toast.failed', { defaultValue: 'Action failed' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ApprovalActionIcon action={action} className="w-5 h-5" />
            {L.action(action)} — #{approval.ref_no}
          </DialogTitle>
          <DialogDescription>
            {s.employee_name} · {s.title}
            {desc ? ` · ${desc}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>{L.t('approvalFlow.dialog.note', { defaultValue: 'Note (optional)' })}</Label>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              action === 'to_hr'
                ? L.t('approvalFlow.dialog.notePlaceholderDocs', { defaultValue: 'Which documents are needed?' })
                : L.t('approvalFlow.dialog.notePlaceholder', { defaultValue: 'Shown to the employee and HR on WhatsApp' })
            }
          />
          <p className="text-xs text-muted-foreground">{L.t('approvalFlow.dialog.info')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {L.t('approvalFlow.dialog.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button variant={meta.variant === 'outline' ? 'default' : meta.variant} onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {L.action(action)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
