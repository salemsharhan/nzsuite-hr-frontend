import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, FileText, History, Inbox, Loader2, MessageCircle, RefreshCw, Search, UserCheck, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ACTION_META,
  OPEN_STAGES,
  STAGE_META,
  actionsForStage,
  approvalFlowService,
  describeApproval,
  type ApprovalAction,
  type ApprovalHistoryEntry,
  type ApprovalKind,
  type RequestApproval,
} from '@/services/approvalFlowService';
import { ApprovalActionDialog, ApprovalActionIcon, ApprovalPipeline, ApprovalStageBadge, useApprovalLabels } from './ApprovalBits';

type View = 'open' | 'decided' | 'all';

const fmt = (iso?: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

/** Submission time of the original request (falls back to when the flow picked it up). */
const submittedAt = (r: RequestApproval) => r.snapshot?.created_at || r.created_at;

function historyText(h: ApprovalHistoryEntry, L: ReturnType<typeof useApprovalLabels>): string {
  const t = L.t;
  if (h.event === 'received') return t('approvalFlow.historyReceived');
  if (h.event === 'no_gm_whatsapp_configured') return t('approvalFlow.historyNoGm');
  const who =
    h.by === 'app'
      ? t('approvalFlow.by.app', { name: h.actor ?? 'Admin' })
      : h.by === 'gm'
        ? t('approvalFlow.by.gm')
        : h.by === 'hr'
          ? t('approvalFlow.by.hr')
          : t('approvalFlow.by.system');
  const what = h.action ? L.action(h.action) : '';
  const to = h.to ? ` → ${L.stage(h.to)}` : '';
  return `${who}: ${what}${to}`;
}

export function RequestApprovalsBoard() {
  const { user } = useAuth();
  const L = useApprovalLabels();
  const t = L.t;
  const ago = L.ago;
  const isSuperAdmin = user?.role === 'super_admin';
  const [rows, setRows] = useState<RequestApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('open');
  const [kind, setKind] = useState<ApprovalKind | 'all'>('all');
  const [company, setCompany] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<RequestApproval | null>(null);
  const [dialog, setDialog] = useState<{ approval: RequestApproval; action: ApprovalAction } | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      try {
        if (!quiet) setLoading(true);
        const data = await approvalFlowService.list({ companyId: isSuperAdmin ? null : user?.company_id });
        setRows(data);
        setDetail((d) => (d ? data.find((r) => r.id === d.id) ?? d : d));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('approvalFlow.toast.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [isSuperAdmin, user?.company_id],
  );

  useEffect(() => {
    void load();
    // WhatsApp votes and other admins update the table — refresh live
    const unsubscribe = approvalFlowService.subscribe(() => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => void load(true), 400);
    });
    return () => {
      unsubscribe();
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [load]);

  const companies = useMemo(
    () => Array.from(new Set(rows.map((r) => r.snapshot?.company_name).filter(Boolean))) as string[],
    [rows],
  );

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      gm: rows.filter((r) => r.stage === 'pending_gm').length,
      hr: rows.filter((r) => r.stage === 'pending_hr_docs' || r.stage === 'pending_hr_doc_prep').length,
      decidedToday: rows.filter((r) => !OPEN_STAGES.includes(r.stage) && new Date(r.updated_at).toDateString() === today).length,
      oldestOpen: rows.filter((r) => OPEN_STAGES.includes(r.stage)).sort((a, b) => submittedAt(a).localeCompare(submittedAt(b)))[0],
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const open = OPEN_STAGES.includes(r.stage);
      if (view === 'open' && !open) return false;
      if (view === 'decided' && open) return false;
      if (kind !== 'all' && r.kind !== kind) return false;
      if (company !== 'all' && r.snapshot?.company_name !== company) return false;
      if (q) {
        const hay = `#${r.ref_no} ${r.snapshot?.employee_name ?? ''} ${r.snapshot?.employee_code ?? ''} ${r.snapshot?.title ?? ''} ${describeApproval(r)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, view, kind, company, search]);

  const waitingOn = (r: RequestApproval) => {
    const w = STAGE_META[r.stage]?.waitingOn;
    if (w === 'GM') return r.snapshot?.gm_name || 'GM';
    if (w === 'HR') return r.snapshot?.hr_name || 'HR';
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={UserCheck} label={t('approvalFlow.stats.waitingGm')} value={stats.gm} tone="blue" onClick={() => setView('open')} />
        <StatCard icon={Users} label={t('approvalFlow.stats.waitingHr')} value={stats.hr} tone="orange" onClick={() => setView('open')} />
        <StatCard icon={Inbox} label={t('approvalFlow.stats.decidedToday')} value={stats.decidedToday} tone="green" onClick={() => setView('decided')} />
        <StatCard
          icon={Clock}
          label={t('approvalFlow.stats.oldestOpen')}
          value={stats.oldestOpen ? `#${stats.oldestOpen.ref_no}` : '—'}
          hint={stats.oldestOpen ? ago(submittedAt(stats.oldestOpen)) : t('approvalFlow.stats.nothingWaiting')}
          tone="gray"
          onClick={() => stats.oldestOpen && setDetail(stats.oldestOpen)}
        />
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(['open', 'decided', 'all'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1 text-sm rounded transition-colors',
                  view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'open' ? `${t('approvalFlow.view.open')} (${stats.gm + stats.hr})` : t(`approvalFlow.view.${v}`)}
              </button>
            ))}
          </div>
          <Select value={kind} onValueChange={(v) => setKind(v as ApprovalKind | 'all')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('approvalFlow.filters.allTypes')}</SelectItem>
              <SelectItem value="leave">{t('approvalFlow.filters.leave')}</SelectItem>
              <SelectItem value="request">{t('approvalFlow.filters.request')}</SelectItem>
              <SelectItem value="document">{t('approvalFlow.filters.document')}</SelectItem>
            </SelectContent>
          </Select>
          {companies.length > 1 && (
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('approvalFlow.filters.allCompanies')}</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder={t('approvalFlow.filters.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
            {t('approvalFlow.refresh')}
          </Button>
        </div>

        {loading && rows.length === 0 ? (
          <div className="py-12 flex justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('approvalFlow.loading')}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {view === 'open' ? t('approvalFlow.emptyOpen') : t('approvalFlow.emptyFiltered')}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {visible.map((r) => {
              const s = r.snapshot;
              const desc = describeApproval(r);
              const who = waitingOn(r);
              return (
                <div key={r.id} className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-muted/30 transition-colors">
                  <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setDetail(r)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">#{r.ref_no}</span>
                      <span className="font-semibold truncate">{s?.employee_name}</span>
                      {s?.employee_code ? <span className="text-xs text-muted-foreground">{s.employee_code}</span> : null}
                      <Badge variant="outline" className="text-[11px]">
                        {L.kind(r.kind)}
                      </Badge>
                      {s?.company_name && companies.length > 1 ? (
                        <span className="text-xs text-muted-foreground">{s.company_name}</span>
                      ) : null}
                    </div>
                    <div className="text-sm mt-0.5">
                      <span className="font-medium">{s?.title}</span>
                      {desc ? <span className="text-muted-foreground"> · {desc}</span> : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <ApprovalPipeline approval={r} />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {ago(submittedAt(r))}
                      </span>
                    </div>
                  </button>
                  <div className="flex flex-col items-start lg:items-end gap-2 lg:w-[340px]">
                    <div className="flex items-center gap-2">
                      <ApprovalStageBadge stage={r.stage} />
                      {who ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" /> {who}
                        </span>
                      ) : null}
                    </div>
                    {actionsForStage(r.stage).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 lg:justify-end">
                        {actionsForStage(r.stage).map((a) => (
                          <Button
                            key={a}
                            size="sm"
                            variant={ACTION_META[a].variant}
                            className="h-8"
                            onClick={() => setDialog({ approval: r, action: a })}
                          >
                            <ApprovalActionIcon action={a} className="w-3.5 h-3.5 mr-1" />
                            {L.short(a)}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t('approvalFlow.footer')}</p>
      </Card>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" /> #{detail.ref_no} · {detail.snapshot?.employee_name}
                </SheetTitle>
                <SheetDescription>
                  {L.kind(detail.kind)} · {detail.snapshot?.title}
                  {detail.snapshot?.company_name ? ` · ${detail.snapshot.company_name}` : ''}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <ApprovalStageBadge stage={detail.stage} />
                  <ApprovalPipeline approval={detail} />
                </div>

                <DetailFields approval={detail} />

                {(detail.gm_note || detail.hr_note) && (
                  <div className="space-y-1 text-sm">
                    {detail.gm_note ? <p><span className="text-muted-foreground">{t('approvalFlow.gmNote')}:</span> {detail.gm_note}</p> : null}
                    {detail.hr_note ? <p><span className="text-muted-foreground">{t('approvalFlow.hrNote')}:</span> {detail.hr_note}</p> : null}
                  </div>
                )}

                {actionsForStage(detail.stage).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {actionsForStage(detail.stage).map((a) => (
                      <Button key={a} size="sm" variant={ACTION_META[a].variant} onClick={() => setDialog({ approval: detail, action: a })}>
                        <ApprovalActionIcon action={a} className="w-3.5 h-3.5 mr-1" />
                        {L.action(a)}
                      </Button>
                    ))}
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <History className="w-4 h-4" /> {t('approvalFlow.history')}
                  </h4>
                  <ol className="relative border-l border-border ml-2 space-y-3">
                    {(detail.history ?? []).map((h, i) => (
                      <li key={i} className="ml-4">
                        <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary/70" />
                        <p className="text-sm">{historyText(h, L)}</p>
                        {h.note ? <p className="text-xs text-muted-foreground mt-0.5">📝 {h.note}</p> : null}
                        <p className="text-xs text-muted-foreground">{fmt(h.at)}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ApprovalActionDialog
        approval={dialog?.approval ?? null}
        action={dialog?.action ?? null}
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        onDone={() => void load(true)}
      />
    </div>
  );
}

function DetailFields({ approval }: { approval: RequestApproval }) {
  const L = useApprovalLabels();
  const f = (k: string, d: string) => L.t(`approvalFlow.fields.${k}`, { defaultValue: d });
  const s = approval.snapshot;
  const d = s?.details ?? {};
  const form = (d.form ?? {}) as Record<string, unknown>;
  const fields: [string, unknown][] = [];
  if (approval.kind === 'leave') {
    fields.push([f('from', 'From'), d.start_date], [f('to', 'To'), d.end_date], [f('reason', 'Reason'), d.reason]);
  } else {
    if (d.category) fields.push([f('category', 'Category'), d.category]);
    for (const [k, v] of Object.entries(form)) {
      if (v === null || v === '' || typeof v === 'object') continue;
      fields.push([f(k, k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')), v]);
    }
    for (const k of ['purpose', 'language', 'destination'] as const) if (d[k]) fields.push([f(k, k), d[k]]);
  }
  fields.push([f('submitted', 'Submitted'), fmt(s?.created_at)], [f('gm', 'GM'), s?.gm_name], [f('hr', 'HR'), s?.hr_name]);
  return (
    <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
      {fields
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground capitalize">{k}</dt>
            <dd className="break-words">{String(v)}</dd>
          </div>
        ))}
    </dl>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  icon: typeof Clock;
  label: string;
  value: number | string;
  hint?: string;
  tone: 'blue' | 'orange' | 'green' | 'gray';
  onClick?: () => void;
}) {
  const toneCls = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
    orange: 'text-orange-600 dark:text-orange-400 bg-orange-500/10',
    green: 'text-green-600 dark:text-green-400 bg-green-500/10',
    gray: 'text-muted-foreground bg-muted',
  }[tone];
  return (
    <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className={cn('rounded-lg p-2', toneCls)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
          {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
        </div>
      </div>
    </Card>
  );
}
