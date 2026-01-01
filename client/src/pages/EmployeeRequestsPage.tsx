import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/common/StatusBadge';
import { employeeRequestService, EmployeeRequest } from '@/services/employeeRequestService';
import { documentRequestService, DocumentRequest } from '@/services/documentRequestService';
import { leaveService, LeaveRequest } from '@/services/leaveService';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Search, 
  Filter, 
  FileText, 
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface CombinedRequest {
  id: string;
  type: string;
  category: string;
  employee: {
    id: string;
    name: string;
    employee_id: string;
    department?: string;
  };
  formData: Record<string, any>;
  status: string;
  submittedAt: string;
  source: 'employee_request' | 'document_request' | 'leave_request';
  originalData: any;
}

export default function EmployeeRequestsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [requests, setRequests] = useState<CombinedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'In Review' | 'Approved' | 'Rejected' | 'Completed' | 'Cancelled'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<CombinedRequest | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionComments, setActionComments] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 25;

  useEffect(() => {
    if (user?.company_id) {
      loadRequests();
    }
  }, [user?.company_id, statusFilter, categoryFilter, currentPage]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      
      // Fetch all types of requests
      const [empRequests, docRequests, leaveReqs] = await Promise.all([
        employeeRequestService.getAll({
          status: statusFilter !== 'all' ? statusFilter as any : undefined,
          page: currentPage,
          limit: itemsPerPage
        }),
        documentRequestService.getAll({
          status: statusFilter !== 'all' ? (statusFilter === 'Completed' ? 'Completed' : statusFilter as any) : 'all',
          page: currentPage,
          limit: itemsPerPage
        }),
        leaveService.getAll({
          status: statusFilter !== 'all' ? statusFilter as any : undefined,
          page: currentPage,
          limit: itemsPerPage
        })
      ]);
      
      // Combine and map all requests
      const combined: CombinedRequest[] = [
        ...empRequests.map(req => ({
          id: req.id,
          type: req.request_type,
          category: req.request_category,
          employee: {
            id: req.employee_id,
            name: `${req.employees?.first_name || ''} ${req.employees?.last_name || ''}`.trim() || 'Unknown',
            employee_id: req.employees?.employee_id || '',
            department: req.employees?.department
          },
          formData: req.form_data,
          status: req.status,
          submittedAt: req.submitted_at,
          source: 'employee_request' as const,
          originalData: req
        })),
        ...docRequests.map(req => ({
          id: req.id,
          type: req.document_type,
          category: 'Letters & Certificates',
          employee: {
            id: req.employee_id,
            name: `${req.employees?.first_name || ''} ${req.employees?.last_name || ''}`.trim() || 'Unknown',
            employee_id: req.employees?.employee_id || '',
            department: req.employees?.department
          },
          formData: {
            documentType: req.document_type,
            purpose: req.purpose,
            language: req.language,
            destination: req.destination
          },
          status: req.status === 'Completed' ? 'Approved' : req.status,
          submittedAt: req.requested_at,
          source: 'document_request' as const,
          originalData: req
        })),
        ...leaveReqs.map(req => ({
          id: req.id,
          type: 'Leave Request',
          category: 'Attendance & Leaves',
          employee: {
            id: req.employee_id,
            name: `${req.employees?.first_name || ''} ${req.employees?.last_name || ''}`.trim() || 'Unknown',
            employee_id: req.employees?.employee_id || '',
            department: req.employees?.department
          },
          formData: {
            leaveType: req.leave_type,
            fromDate: req.start_date,
            toDate: req.end_date,
            reason: req.reason
          },
          status: req.status,
          submittedAt: req.created_at,
          source: 'leave_request' as const,
          originalData: req
        }))
      ];
      
      // Sort by submitted date (newest first)
      combined.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      
      setRequests(combined);
      setTotalCount(combined.length);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequest = (request: CombinedRequest) => {
    setSelectedRequest(request);
    setViewModalOpen(true);
  };

  const handleAction = (request: CombinedRequest, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(type);
    setActionComments('');
    setActionModalOpen(true);
  };

  const handleSubmitAction = async () => {
    if (!selectedRequest || !user?.id) return;
    
    try {
      const newStatus = actionType === 'approve' ? 'Approved' : 'Rejected';
      
      if (selectedRequest.source === 'employee_request') {
        await employeeRequestService.updateStatus(
          selectedRequest.id,
          newStatus as any,
          user.id,
          actionComments
        );
      } else if (selectedRequest.source === 'document_request') {
        await documentRequestService.updateStatus(
          selectedRequest.id,
          newStatus === 'Approved' ? 'Completed' : 'Rejected',
          user.id,
          actionComments
        );
      } else if (selectedRequest.source === 'leave_request') {
        await leaveService.updateStatus(
          selectedRequest.id,
          newStatus as 'Approved' | 'Rejected'
        );
      }
      
      toast.success(`Request ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setActionModalOpen(false);
      setSelectedRequest(null);
      await loadRequests();
    } catch (error) {
      console.error('Error updating request status:', error);
      toast.error('Failed to update request status');
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.employee.employee_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return <StatusBadge status="Approved" />;
      case 'Rejected':
        return <StatusBadge status="Rejected" />;
      case 'In Review':
        return <StatusBadge status="In Review" />;
      case 'Pending':
        return <StatusBadge status="Pending" />;
      default:
        return <StatusBadge status={status as any} />;
    }
  };

  // Get unique categories for filter
  const categories = Array.from(new Set(requests.map(r => r.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Requests</h1>
          <p className="text-muted-foreground mt-1">View and manage all employee self-service requests</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by employee name, ID, or request type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="In Review">In Review</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Requests ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No requests found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Request ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Employee</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Submitted</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono text-muted-foreground">
                          {request.id.substring(0, 8)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{request.employee.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {request.employee.employee_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span>{request.type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{request.category}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-muted-foreground">
                          {new Date(request.submittedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewRequest(request)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {(request.status === 'Pending' || request.status === 'In Review') && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleAction(request, 'approve')}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleAction(request, 'reject')}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Request Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>
              View complete information about this request
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Employee</Label>
                  <p className="font-medium">{selectedRequest.employee.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.employee.employee_id}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Request Type</Label>
                  <p className="font-medium">{selectedRequest.type}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <p className="font-medium">{selectedRequest.category}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Submitted</Label>
                  <p className="font-medium">
                    {new Date(selectedRequest.submittedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground mb-2">Form Data</Label>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  {Object.entries(selectedRequest.formData || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-sm font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {String(value || 'N/A')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Modal */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve' : 'Reject'} Request
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' ? (
                'Approve this request and add optional comments'
              ) : (
                'Reject this request and provide a reason'
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Comments (Optional)</Label>
              <Textarea
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                placeholder={actionType === 'approve' 
                  ? 'Add approval comments...'
                  : 'Provide reason for rejection...'}
                rows={4}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setActionModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitAction}
                variant={actionType === 'approve' ? 'default' : 'destructive'}
              >
                {actionType === 'approve' ? 'Approve' : 'Reject'} Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

