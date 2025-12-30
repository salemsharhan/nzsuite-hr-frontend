import { useState } from 'react';
import { Search, Filter, Download, Plus, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Mock data
const mockRequests = [
  {
    id: 1,
    requestId: 'LR-2025-001',
    employee: { id: 1, name: 'John Doe', department: 'Engineering', avatar: '' },
    leaveType: { name: 'Annual Leave', color: '#3b82f6' },
    startDate: '2025-01-05',
    endDate: '2025-01-10',
    duration: 5,
    reason: 'Family vacation',
    status: 'Pending',
    submittedAt: '2024-12-28 10:30 AM',
    attachments: [],
  },
  {
    id: 2,
    requestId: 'LR-2025-002',
    employee: { id: 2, name: 'Jane Smith', department: 'Sales', avatar: '' },
    leaveType: { name: 'Sick Leave', color: '#ef4444' },
    startDate: '2025-01-03',
    endDate: '2025-01-04',
    duration: 2,
    reason: 'Medical appointment',
    status: 'Approved',
    submittedAt: '2024-12-27 02:15 PM',
    reviewedAt: '2024-12-27 04:30 PM',
    reviewedBy: 'HR Manager',
    reviewComments: 'Approved as per policy',
    attachments: [{ name: 'medical_certificate.pdf', url: '#' }],
  },
  {
    id: 3,
    requestId: 'LR-2025-003',
    employee: { id: 3, name: 'Mike Johnson', department: 'Marketing', avatar: '' },
    leaveType: { name: 'Emergency Leave', color: '#f59e0b' },
    startDate: '2025-01-02',
    endDate: '2025-01-02',
    duration: 1,
    reason: 'Personal emergency',
    status: 'Pending',
    submittedAt: '2024-12-29 09:00 AM',
    attachments: [],
  },
  {
    id: 4,
    requestId: 'LR-2024-156',
    employee: { id: 4, name: 'Sarah Williams', department: 'HR', avatar: '' },
    leaveType: { name: 'Annual Leave', color: '#3b82f6' },
    startDate: '2024-12-20',
    endDate: '2024-12-27',
    duration: 7,
    reason: 'Year-end holiday',
    status: 'Approved',
    submittedAt: '2024-12-10 11:00 AM',
    reviewedAt: '2024-12-10 03:00 PM',
    reviewedBy: 'Admin',
    reviewComments: 'Approved',
    attachments: [],
  },
  {
    id: 5,
    requestId: 'LR-2024-145',
    employee: { id: 5, name: 'Tom Brown', department: 'Finance', avatar: '' },
    leaveType: { name: 'Sick Leave', color: '#ef4444' },
    startDate: '2024-12-15',
    endDate: '2024-12-16',
    duration: 2,
    reason: 'Flu symptoms',
    status: 'Rejected',
    submittedAt: '2024-12-14 08:30 AM',
    reviewedAt: '2024-12-14 10:00 AM',
    reviewedBy: 'HR Manager',
    reviewComments: 'Insufficient sick leave balance',
    attachments: [],
  },
];

export default function LeaveRequestsTab() {
  const [requests, setRequests] = useState(mockRequests);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all');
  const [selectedRequests, setSelectedRequests] = useState<number[]>([]);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionComments, setActionComments] = useState('');

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.requestId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesLeaveType = leaveTypeFilter === 'all' || req.leaveType.name === leaveTypeFilter;
    return matchesSearch && matchesStatus && matchesLeaveType;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRequests(filteredRequests.map((r) => r.id));
    } else {
      setSelectedRequests([]);
    }
  };

  const handleSelectRequest = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedRequests([...selectedRequests, id]);
    } else {
      setSelectedRequests(selectedRequests.filter((reqId) => reqId !== id));
    }
  };

  const handleViewRequest = (request: any) => {
    setSelectedRequest(request);
    setViewModalOpen(true);
  };

  const handleAction = (request: any, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(type);
    setActionComments('');
    setActionModalOpen(true);
  };

  const handleSubmitAction = () => {
    if (selectedRequest) {
      // Update request status
      setRequests(
        requests.map((req) =>
          req.id === selectedRequest.id
            ? {
                ...req,
                status: actionType === 'approve' ? 'Approved' : 'Rejected',
                reviewedAt: new Date().toLocaleString(),
                reviewedBy: 'Admin User',
                reviewComments: actionComments,
              }
            : req
        )
      );
      setActionModalOpen(false);
      setSelectedRequest(null);
    }
  };

  const handleBulkAction = (type: 'approve' | 'reject') => {
    const selectedReqs = requests.filter((r) => selectedRequests.includes(r.id) && r.status === 'Pending');
    if (selectedReqs.length === 0) {
      alert('Please select pending requests');
      return;
    }
    // Bulk update
    setRequests(
      requests.map((req) =>
        selectedRequests.includes(req.id) && req.status === 'Pending'
          ? {
              ...req,
              status: type === 'approve' ? 'Approved' : 'Rejected',
              reviewedAt: new Date().toLocaleString(),
              reviewedBy: 'Admin User',
              reviewComments: `Bulk ${type}d`,
            }
          : req
      )
    );
    setSelectedRequests([]);
  };

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name or request ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filters */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Leave Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Annual Leave">Annual Leave</SelectItem>
              <SelectItem value="Sick Leave">Sick Leave</SelectItem>
              <SelectItem value="Emergency Leave">Emergency Leave</SelectItem>
              <SelectItem value="Maternity Leave">Maternity Leave</SelectItem>
              <SelectItem value="Unpaid Leave">Unpaid Leave</SelectItem>
            </SelectContent>
          </Select>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Download className="w-4 h-4" />
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Request
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedRequests.length > 0 && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
            <span className="text-sm font-medium">{selectedRequests.length} selected</span>
            <Button size="sm" onClick={() => handleBulkAction('approve')}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve Selected
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction('reject')}>
              <XCircle className="w-4 h-4 mr-2" />
              Reject Selected
            </Button>
          </div>
        )}
      </Card>

      {/* Requests Table */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">
                  <Checkbox
                    checked={selectedRequests.length === filteredRequests.length && filteredRequests.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Request ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Employee</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Leave Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Duration</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Submitted</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-4">
                    <Checkbox
                      checked={selectedRequests.includes(request.id)}
                      onCheckedChange={(checked) => handleSelectRequest(request.id, checked as boolean)}
                    />
                  </td>
                  <td className="py-3 px-4 text-sm font-medium">{request.requestId}</td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium">{request.employee.name}</p>
                      <p className="text-xs text-muted-foreground">{request.employee.department}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: request.leaveType.color }}
                      />
                      <span className="text-sm">{request.leaveType.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {request.duration} {request.duration === 1 ? 'day' : 'days'}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {request.startDate} to {request.endDate}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={request.status as any} />
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{request.submittedAt}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      {request.status === 'Pending' && (
                        <>
                          <Button size="sm" onClick={() => handleAction(request, 'approve')}>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleAction(request, 'reject')}>
                            <XCircle className="w-3 h-3 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleViewRequest(request)}>
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRequests.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No leave requests found</p>
          </div>
        )}
      </Card>

      {/* View Request Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Request ID</Label>
                  <p className="font-medium">{selectedRequest.requestId}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <StatusBadge status={selectedRequest.status} />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Employee</Label>
                  <p className="font-medium">{selectedRequest.employee.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.employee.department}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Leave Type</Label>
                  <p className="font-medium">{selectedRequest.leaveType.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Start Date</Label>
                  <p className="font-medium">{selectedRequest.startDate}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">End Date</Label>
                  <p className="font-medium">{selectedRequest.endDate}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Duration</Label>
                  <p className="font-medium">
                    {selectedRequest.duration} {selectedRequest.duration === 1 ? 'day' : 'days'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted At</Label>
                  <p className="font-medium">{selectedRequest.submittedAt}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Reason</Label>
                <p className="mt-1">{selectedRequest.reason}</p>
              </div>
              {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Attachments</Label>
                  <div className="mt-2 space-y-2">
                    {selectedRequest.attachments.map((file: any, index: number) => (
                      <a
                        key={index}
                        href={file.url}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        📎 {file.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {selectedRequest.reviewedAt && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Review Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Reviewed By</Label>
                      <p className="font-medium">{selectedRequest.reviewedBy}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Reviewed At</Label>
                      <p className="font-medium">{selectedRequest.reviewedAt}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-muted-foreground">Comments</Label>
                    <p className="mt-1">{selectedRequest.reviewComments}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Modal (Approve/Reject) */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve' : 'Reject'} Leave Request
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  You are about to {actionType} the leave request for:
                </p>
                <p className="font-medium mt-1">
                  {selectedRequest.employee.name} - {selectedRequest.leaveType.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedRequest.startDate} to {selectedRequest.endDate} ({selectedRequest.duration} days)
                </p>
              </div>
              <div>
                <Label>Comments {actionType === 'reject' && <span className="text-red-500">*</span>}</Label>
                <Textarea
                  placeholder={`Enter ${actionType === 'reject' ? 'reason for rejection' : 'comments (optional)'}...`}
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAction}
              disabled={actionType === 'reject' && !actionComments.trim()}
            >
              {actionType === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
