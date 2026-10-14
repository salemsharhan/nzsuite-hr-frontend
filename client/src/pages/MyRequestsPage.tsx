import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronDown, FileText, Loader2, Plus, Search, UserRound } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { SubmitRequestModal } from '../components/selfservice/SubmitRequestModal';
import { EmployeeRequestSteps, EmployeeStatusBadge, employeeStage } from '../components/approvals/EmployeeRequestProgress';
import { approvalFlowService, currentEmployeeId, requestTitle, type MyRequest } from '../services/approvalFlowService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Filter = 'all' | 'open' | 'approved' | 'rejected';

const FIELD_ORDER = ['date', 'fromTime', 'toTime', 'start_date', 'end_date', 'reason', 'purpose', 'language', 'destination'];

export default function MyRequestsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  const load = useCallback(async () => {
    const employeeId = currentEmployeeId();
    if (!employeeId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setRequests(await approvalFlowService.myRequests(employeeId));
    } catch (e) {
      console.error('Failed to load requests', e);
      toast.error(t('requests.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const stageOf = (r: MyRequest) => employeeStage(r.status, r.current_approver, r.category, r.stage);

  const counts = useMemo(() => {
    const c = { all: requests.length, open: 0, approved: 0, rejected: 0 };
    requests.forEach((r) => {
      const s = stageOf(r);
      if (s === 'approved' || s === 'completed') c.approved++;
      else if (s === 'rejected') c.rejected++;
      else c.open++;
    });
    return c;
  }, [requests]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      const s = stageOf(r);
      if (filter === 'open' && (s === 'approved' || s === 'completed' || s === 'rejected')) return false;
      if (filter === 'approved' && s !== 'approved' && s !== 'completed') return false;
      if (filter === 'rejected' && s !== 'rejected') return false;
      if (q) {
        const hay = `${r.ref_no ?? ''} ${r.title} ${requestTitle(r.title, lang)} ${JSON.stringify(r.details ?? {})}`.toLowerCase();
        if (!hay.includes(q.replace(/^#/, ''))) return false;
      }
      return true;
    });
  }, [requests, filter, search, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(lang?.startsWith('ar') ? 'ar-KW-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  const summaryLine = (r: MyRequest) => {
    const d = r.details ?? {};
    if (r.kind === 'leave') {
      const range = d.start_date ? (d.end_date && d.end_date !== d.start_date ? `${fmtDate(d.start_date)} → ${fmtDate(d.end_date)}` : fmtDate(d.start_date)) : '';
      return range;
    }
    if (d.date) return `${fmtDate(d.date)}${d.fromTime ? ` · ${d.fromTime}${d.toTime ? `–${d.toTime}` : ''}` : ''}`;
    return d.purpose ? String(d.purpose) : '';
  };

  const detailRows = (r: MyRequest): [string, string][] => {
    const d = r.details ?? {};
    return Object.entries(d)
      .filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
      .sort((a, b) => (FIELD_ORDER.indexOf(a[0]) + 100) % 100 - (FIELD_ORDER.indexOf(b[0]) + 100) % 100)
      .map(([k, v]) => {
        const key = k === 'start_date' ? 'from' : k === 'end_date' ? 'to' : k;
        const value = /date/i.test(k) || k === 'date' ? fmtDate(String(v)) : String(v);
        return [t(`approvalFlow.fields.${key}`, { defaultValue: k }), value];
      });
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t('approvalFlow.view.all') },
    { key: 'open', label: t('approvalFlow.employee.inProgress') },
    { key: 'approved', label: t('approvalFlow.employee.approved') },
    { key: 'rejected', label: t('approvalFlow.employee.rejected') },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('requests.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('requests.subtitle')}</p>
        </div>
        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('requests.newRequest')}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex w-full rounded-lg border border-border p-1 bg-card overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex-1 px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label} <span className="opacity-70">({counts[f.key]})</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('requests.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-9 pe-3 py-2 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('requests.noRequestsFound')}
          description={requests.length ? t('requests.noRequestsMatchFilters') : t('requests.noRequestsDescription')}
          action={{ label: t('requests.submitRequest'), onClick: () => setIsSubmitModalOpen(true) }}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const open = expanded === r.id;
            const line = summaryLine(r);
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : r.id)}
                  className="w-full text-start p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="rounded-lg p-2 bg-primary/10 text-primary shrink-0">
                    {r.kind === 'leave' ? <CalendarDays className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{requestTitle(r.title, lang)}</span>
                      {r.ref_no ? <span className="font-mono text-xs text-muted-foreground">#{r.ref_no}</span> : null}
                    </div>
                    {line ? <div className="text-sm text-muted-foreground mt-0.5">{line}</div> : null}
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('approvalFlow.fields.submitted')}: {fmtDate(r.submitted_at)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <EmployeeStatusBadge status={r.status} currentApprover={r.current_approver} category={r.category} flowStage={r.stage} />
                    <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
                  </div>
                </button>
                {open && (
                  <div className="border-t border-border p-4 space-y-4 bg-muted/10">
                    <EmployeeRequestSteps
                      status={r.status}
                      currentApprover={r.current_approver}
                      category={r.category}
                      flowStage={r.stage}
                      viaDeptHead={!!r.dept_head_name}
                    />
                    {r.dept_head_name ? (
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <UserRound className="w-4 h-4" /> {t('approvalFlow.fields.deptHead')}: {r.dept_head_name}
                      </div>
                    ) : null}
                    {detailRows(r).length > 0 && (
                      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-sm">
                        {detailRows(r).map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-muted-foreground">{k}</dt>
                            <dd className="break-words text-foreground">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SubmitRequestModal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} onSuccess={() => void load()} />
    </div>
  );
}
