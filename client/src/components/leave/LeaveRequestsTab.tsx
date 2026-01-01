import { useState, useEffect } from 'react';
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
import { leaveService, LeaveRequest } from '@/services/leaveService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Interface for display
interface DisplayLeaveRequest {
  id: string;
  requestId: string;
  employee: { 
    id: string; 
    name: string; 
    department: string; 
    avatar?: string;
    reportingManager?: {
      id: string;
      name: string;
    };
  };
  leaveType: { name: string; color: string };
  startDate: string;
  endDate: string;
  duration: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewComments?: string;
  attachments?: Array<{ name: string; url: string }>;
}

// Helper function to map API response to display format
function mapLeaveRequestToDisplay(request: LeaveRequest): DisplayLeaveRequest {
  const employeeName = request.employees 
    ? `${request.employees.first_name || ''} ${request.employees.last_name || ''}`.trim() || 'Unknown'
    : 'Unknown';
  
  const reportingManagerName = request.employees?.reporting_manager
    ? `${request.employees.reporting_manager.first_name || ''} ${request.employees.reporting_manager.last_name || ''}`.trim() || 'N/A'
    : 'N/A';
  
  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case 'Annual Leave': return '#3b82f6';
      case 'Sick Leave': return '#ef4444';
      case 'Emergency Leave': return '#f59e0b';
      case 'Maternity Leave': return '#8b5cf6';
      case 'Unpaid Leave': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const start = new Date(request.start_date);
  const end = new Date(request.end_date);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive

  return {
    id: request.id,
    requestId: `LR-${request.id.substring(0, 8).toUpperCase()}`,
    employee: {
      id: request.employee_id,
      name: employeeName,
      department: request.employees?.department || 'N/A',
      avatar: request.employees?.avatar_url,
      reportingManager: request.employees?.reporting_manager ? {
        id: request.employees.reporting_manager.id,
        name: reportingManagerName
      } : undefined
    },
    leaveType: {
      name: request.leave_type,
      color: getLeaveTypeColor(request.leave_type)
    },
    startDate: request.start_date,
    endDate: request.end_date,
    duration: diffDays,
    reason: request.reason || '',
    status: request.status,
    submittedAt: new Date(request.created_at).toLocaleString(),
    attachments: []
  };
}

interface LeaveRequestsTabProps {
  onRequestUpdated?: () => void;
}

export default function LeaveRequestsTab({ onRequestUpdated }: LeaveRequestsTabProps = {}) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DisplayLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Pending' | 'Approved' | 'Rejected' | 'all'>('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DisplayLeaveRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionComments, setActionComments] = useState('');

  useEffect(() => {
    loadRequests();
  }, [currentPage, itemsPerPage, statusFilter, leaveTypeFilter, dateFromFilter, dateToFilter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const filters = {
        status: statusFilter,
        leave_type: leaveTypeFilter !== 'all' ? leaveTypeFilter : undefined,
        date_from: dateFromFilter || undefined,
        date_to: dateToFilter || undefined,
        page: currentPage,
        limit: itemsPerPage
      };
      
      const [data, count] = await Promise.all([
        leaveService.getAll(filters),
        leaveService.getCount(filters)
      ]);
      
      const mappedRequests = data.map(mapLeaveRequestToDisplay);
      setRequests(mappedRequests);
      setTotalCount(count);
    } catch (error) {
      console.error('Error loading leave requests:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  // Client-side search filter (since we're already paginating server-side)
  const filteredRequests = requests.filter((req) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      req.employee.name.toLowerCase().includes(query) ||
      req.requestId.toLowerCase().includes(query) ||
      req.reason.toLowerCase().includes(query) ||
      (req.employee.reportingManager?.name.toLowerCase().includes(query) || false)
    );
  });
  
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRequests(filteredRequests.map((r) => r.id));
    } else {
      setSelectedRequests([]);
    }
  };

  const handleSelectRequest = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedRequests([...selectedRequests, id]);
    } else {
      setSelectedRequests(selectedRequests.filter((reqId) => reqId !== id));
    }
  };

  const handleViewRequest = (request: DisplayLeaveRequest) => {
    setSelectedRequest(request);
    setViewModalOpen(true);
  };

  const handleAction = (request: DisplayLeaveRequest, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(type);
    setActionComments('');
    setActionModalOpen(true);
  };

  const handleSubmitAction = async () => {
    if (!selectedRequest) return;
    
    try {
      const newStatus = actionType === 'approve' ? 'Approved' : 'Rejected';
      await leaveService.updateStatus(selectedRequest.id, newStatus);
      
      // Update local state
      setRequests(
        requests.map((req) =>
          req.id === selectedRequest.id
            ? {
                ...req,
                status: newStatus,
                reviewedAt: new Date().toLocaleString(),
                reviewedBy: user?.email || 'Admin',
                reviewComments: actionComments,
              }
            : req
        )
      );
      
      toast.success(`Leave request ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setActionModalOpen(false);
      setSelectedRequest(null);
      setActionComments('');
      // Notify parent to refresh data
      if (onRequestUpdated) {
        onRequestUpdated();
      }
    } catch (error) {
      console.error('Error updating leave status:', error);
      toast.error(`Failed to ${actionType} leave request`);
    }
  };

  const handleBulkAction = async (type: 'approve' | 'reject') => {
    const selectedReqs = requests.filter((r) => selectedRequests.includes(r.id) && r.status === 'Pending');
    if (selectedReqs.length === 0) {
      toast.error('Please select pending requests');
      return;
    }
    
    try {
      const newStatus = type === 'approve' ? 'Approved' : 'Rejected';
      
      // Update all selected requests
      await Promise.all(
        selectedReqs.map(req => leaveService.updateStatus(req.id, newStatus))
      );
      
      // Update local state
      setRequests(
        requests.map((req) =>
          selectedRequests.includes(req.id) && req.status === 'Pending'
            ? {
                ...req,
                status: newStatus,
                reviewedAt: new Date().toLocaleString(),
                reviewedBy: user?.email || 'Admin',
                reviewComments: `Bulk ${type}d`,
              }
            : req
        )
      );
      
      toast.success(`${selectedReqs.length} leave request(s) ${type === 'approve' ? 'approved' : 'rejected'} successfully`);
      setSelectedRequests([]);
      // Notify parent to refresh data
      if (onRequestUpdated) {
        onRequestUpdated();
      }
    } catch (error) {
      console.error('Error in bulk action:', error);
      toast.error(`Failed to ${type} selected requests`);
    }
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
          <Select value={statusFilter} onValueChange={(value: any) => {
            setStatusFilter(value);
            setCurrentPage(1);
          }}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={leaveTypeFilter} onValueChange={(value) => {
            setLeaveTypeFilter(value);
            setCurrentPage(1);
          }}>
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

          {/* Date From Filter */}
          <Input
            type="date"
            placeholder="Date From"
            value={dateFromFilter}
            onChange={(e) => {
              setDateFromFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full lg:w-[150px]"
          />

          {/* Date To Filter */}
          <Input
            type="date"
            placeholder="Date To"
            value={dateToFilter}
            onChange={(e) => {
              setDateToFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full lg:w-[150px]"
            min={dateFromFilter}
          />

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
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Reporting Manager</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Leave Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Duration</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Reason</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Applied</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    Loading leave requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    No leave requests found
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr key={request.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4">
                      {request.status === 'Pending' && (
                        <Checkbox
                          checked={selectedRequests.includes(request.id)}
                          onCheckedChange={(checked) => handleSelectRequest(request.id, checked as boolean)}
                        />
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium">{request.requestId}</td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium">{request.employee.name}</p>
                        <p className="text-xs text-muted-foreground">{request.employee.department}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm">{request.employee.reportingManager?.name || 'N/A'}</p>
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
                        {new Date(request.startDate).toLocaleDateString()} to {new Date(request.endDate).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm max-w-xs truncate" title={request.reason}>
                      {request.reason || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {new Date(request.submittedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={request.status as any} />
                    </td>
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} requests
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || loading}
              >
                Next
              </Button>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              variant={actionType === 'reject' ? 'destructive' : 'default'}
            >
              {actionType === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
