import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, PauseCircle, Plus, RefreshCw, Paperclip } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import {
  decideHrApprovalInApp,
  fileToBase64,
  hrApprovalService,
  submitHrApproval,
  type HrApprovalRequest,
  type HrApprovalStatus,
} from '@/services/hrApprovalService';
import { toast } from 'sonner';

export default function HrApprovalsPage() {
  const { user } = useAuth();
  const companyId = user?.company_id;
  const [rows, setRows] = useState<HrApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<HrApprovalStatus | 'all'>('all');
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [decideOpen, setDecideOpen] = useState(false);
  const [selected, setSelected] = useState<HrApprovalRequest | null>(null);
  const [decideStatus, setDecideStatus] = useState<'approved' | 'rejected' | 'on_hold'>('approved');
  const [decideNote, setDecideNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const data = await hrApprovalService.list(companyId, statusFilter);
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [companyId, statusFilter]);

  const handleRaise = async () => {
    if (!companyId) return;
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      setSubmitting(true);
      let attachment: { base64: string; filename: string; mime: string } | undefined;
      if (file) attachment = await fileToBase64(file);
      await submitHrApproval({
        companyId,
        title: title.trim(),
        body: body.trim(),
        source: 'manual',
        hrCreatedBy: user?.id,
        attachmentBase64: attachment?.base64,
        attachmentFilename: attachment?.filename,
        attachmentMime: attachment?.mime,
      });
      toast.success('Sent to GM for approval');
      setRaiseOpen(false);
      setTitle('');
      setBody('');
      setFile(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const openDecide = (row: HrApprovalRequest, status: 'approved' | 'rejected' | 'on_hold') => {
    setSelected(row);
    setDecideStatus(status);
    setDecideNote('');
    setDecideOpen(true);
  };

  const handleDecide = async () => {
    if (!selected) return;
    try {
      setSubmitting(true);
      await decideHrApprovalInApp({
        approvalRequestId: selected.id,
        status: decideStatus,
        note: decideNote,
      });
      toast.success('Decision saved');
      setDecideOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save decision');
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (s: string) => {
    if (s === 'pending_gm') return 'Pending GM';
    if (s === 'on_hold') return 'On Hold';
    if (s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    return s;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold font-heading">HR Approvals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Raise a request for the GM (text + optional file). Leave forwards also appear here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setRaiseOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Raise approval for GM
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as HrApprovalStatus | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending_gm">Pending GM</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 text-sm font-medium text-muted-foreground">Title</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-muted-foreground">Source</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-muted-foreground">Created</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-muted-foreground">GM note</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No approval requests yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-3 px-3 text-sm">
                      <div className="font-medium">{row.title}</div>
                      {row.body ? (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{row.body}</div>
                      ) : null}
                      {row.attachment_filename ? (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          {row.attachment_filename}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-3 text-sm capitalize">{row.source}</td>
                    <td className="py-3 px-3 text-sm">
                      <StatusBadge status={statusLabel(row.status) as any} />
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-3 text-sm max-w-[200px] truncate" title={row.gm_note || ''}>
                      {row.gm_note || '—'}
                    </td>
                    <td className="py-3 px-3">
                      {(row.status === 'pending_gm' || row.status === 'on_hold') && (
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" onClick={() => openDecide(row, 'approved')}>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => openDecide(row, 'rejected')}>
                            <XCircle className="w-3 h-3 mr-1" />
                            Reject
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openDecide(row, 'on_hold')}>
                            <PauseCircle className="w-3 h-3 mr-1" />
                            Hold
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={raiseOpen} onOpenChange={setRaiseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Raise approval for GM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea className="mt-1" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div>
              <Label>Attachment (optional)</Label>
              <Input
                type="file"
                className="mt-1"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRaiseOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleRaise()} disabled={submitting}>
              {submitting ? 'Sending…' : 'Send to GM'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={decideOpen} onOpenChange={setDecideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decideStatus === 'approved'
                ? 'Approve'
                : decideStatus === 'rejected'
                  ? 'Reject'
                  : 'Keep on hold'}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{selected.title}</p>
              <div>
                <Label>Note</Label>
                <Textarea
                  className="mt-1"
                  rows={4}
                  value={decideNote}
                  onChange={(e) => setDecideNote(e.target.value)}
                  placeholder="Note for HR / record…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecideOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleDecide()} disabled={submitting}>
              {submitting ? 'Saving…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
