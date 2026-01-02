import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Plus,
  TrendingUp,
  FileText,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '../components/common/UIComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import Modal from '../components/common/Modal';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { getLeaveBalances, LeaveBalance } from '../services/leaveBalanceService';
import { leaveService, LeaveRequest } from '../services/leaveService';

export default function EmployeeLeavesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  
  // Form state for new leave request
  const [newRequest, setNewRequest] = useState({
    leave_type: 'Annual Leave',
    start_date: '',
    end_date: '',
    reason: ''
  });

  useEffect(() => {
    if (user?.employee_id) {
      loadData();
    }
  }, [user?.employee_id]);

  const loadData = async () => {
    if (!user?.employee_id || !user?.company_id) return;
    
    setLoading(true);
    try {
      // Load leave balance for this employee only
      const balances = await getLeaveBalances(user.company_id);
      const myBalance = balances.find(b => b.employee_id === user.employee_id);
      setLeaveBalance(myBalance || null);
      
      // Load leave requests for this employee
      const requests = await leaveService.getByEmployee(user.employee_id);
      setLeaveRequests(requests);
    } catch (error) {
      console.error('Error loading leave data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.employee_id) return;
    
    try {
      await leaveService.create({
        employee_id: user.employee_id,
        leave_type: newRequest.leave_type,
        start_date: newRequest.start_date,
        end_date: newRequest.end_date,
        reason: newRequest.reason
      });
      
      // Reset form and reload data
      setNewRequest({
        leave_type: 'Annual Leave',
        start_date: '',
        end_date: '',
        reason: ''
      });
      setIsRequestModalOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error creating leave request:', error);
      alert(t('leaves.requestFailed') || 'Failed to create leave request. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge variant="success" className="gap-1"><CheckCircle size={14} /> {t('leaves.approved') || 'Approved'}</Badge>;
      case 'Rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle size={14} /> {t('leaves.rejected') || 'Rejected'}</Badge>;
      case 'Pending':
        return <Badge variant="warning" className="gap-1"><Clock size={14} /> {t('leaves.pending') || 'Pending'}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const calculateDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Inclusive
  };

  // Calculate statistics
  const stats = {
    totalRequests: leaveRequests.length,
    pending: leaveRequests.filter(r => r.status === 'Pending').length,
    approved: leaveRequests.filter(r => r.status === 'Approved').length,
    rejected: leaveRequests.filter(r => r.status === 'Rejected').length,
    totalDaysTaken: leaveRequests
      .filter(r => r.status === 'Approved')
      .reduce((sum, r) => sum + calculateDays(r.start_date, r.end_date), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">{t('common.loading') || 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading">{t('leaves.myLeaves') || 'My Leaves'}</h1>
          <p className="text-muted-foreground mt-1">
            {t('leaves.myLeavesDesc') || 'View your leave balance and manage leave requests'}
          </p>
        </div>
        <Button onClick={() => setIsRequestModalOpen(true)} className="gap-2">
          <Plus size={16} />
          {t('leaves.newRequest') || 'New Request'}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('leaves.totalRequests') || 'Total Requests'}</p>
                <p className="text-2xl font-bold mt-1">{stats.totalRequests}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('leaves.pending') || 'Pending'}</p>
                <p className="text-2xl font-bold mt-1">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('leaves.approved') || 'Approved'}</p>
                <p className="text-2xl font-bold mt-1">{stats.approved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('leaves.rejected') || 'Rejected'}</p>
                <p className="text-2xl font-bold mt-1">{stats.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Balance Section */}
      {leaveBalance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t('leaves.leaveBalance') || 'Leave Balance'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Annual Leave */}
              <div className="space-y-2 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-blue-400">{t('leaves.annualLeave') || 'Annual Leave'}</h3>
                  <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    AL
                  </Badge>
                </div>
                <div className="space-y-1 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('leaves.accrued') || 'Accrued'}</span>
                    <span className="font-medium">{leaveBalance.annual_leave.accrued.toFixed(2)} {t('common.days') || 'days'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('leaves.used') || 'Used'}</span>
                    <span className="font-medium">{leaveBalance.annual_leave.used} {t('common.days') || 'days'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('leaves.pending') || 'Pending'}</span>
                    <span className="font-medium">{leaveBalance.annual_leave.pending} {t('common.days') || 'days'}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-blue-500/20">
                    <span className="text-muted-foreground font-semibold">{t('leaves.available') || 'Available'}</span>
                    <span className="font-bold text-blue-400">{leaveBalance.annual_leave.available.toFixed(2)} {t('common.days') || 'days'}</span>
                  </div>
                  {!leaveBalance.annual_leave.eligible && (
                    <div className="mt-2 p-2 rounded bg-yellow-500/20 border border-yellow-500/30">
                      <p className="text-xs text-yellow-400 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {t('leaves.notEligibleYet') || 'Eligible after 9 months from joining date'}
                      </p>
                    </div>
                  )}
                  {leaveBalance.annual_leave.expired && leaveBalance.annual_leave.expired > 0 && (
                    <div className="mt-2 p-2 rounded bg-red-500/20 border border-red-500/30">
                      <p className="text-xs text-red-400">
                        {t('leaves.expired') || 'Expired'}: {leaveBalance.annual_leave.expired.toFixed(2)} {t('common.days') || 'days'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sick Leave */}
              <div className="space-y-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-red-400">{t('leaves.sickLeave') || 'Sick Leave'}</h3>
                  <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                    SL
                  </Badge>
                </div>
                <div className="space-y-1 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('leaves.accrued') || 'Accrued'}</span>
                    <span className="font-medium">{leaveBalance.sick_leave.accrued.toFixed(2)} {t('common.days') || 'days'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('leaves.used') || 'Used'}</span>
                    <span className="font-medium">{leaveBalance.sick_leave.used} {t('common.days') || 'days'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('leaves.pending') || 'Pending'}</span>
                    <span className="font-medium">{leaveBalance.sick_leave.pending} {t('common.days') || 'days'}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-red-500/20">
                    <span className="text-muted-foreground font-semibold">{t('leaves.available') || 'Available'}</span>
                    <span className="font-bold text-red-400">{leaveBalance.sick_leave.available.toFixed(2)} {t('common.days') || 'days'}</span>
                  </div>
                </div>
              </div>

              {/* Emergency Leave */}
              <div className="space-y-2 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-orange-400">{t('leaves.emergencyLeave') || 'Emergency Leave'}</h3>
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                    EL
                  </Badge>
                </div>
                <div className="space-y-1 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('leaves.accrued') || 'Accrued'}</span>
                    <span className="font-medium">{leaveBalance.emergency_leave.accrued.toFixed(2)} {t('common.days') || 'days'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('leaves.used') || 'Used'}</span>
                    <span className="font-medium">{leaveBalance.emergency_leave.used} {t('common.days') || 'days'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('leaves.pending') || 'Pending'}</span>
                    <span className="font-medium">{leaveBalance.emergency_leave.pending} {t('common.days') || 'days'}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-orange-500/20">
                    <span className="text-muted-foreground font-semibold">{t('leaves.available') || 'Available'}</span>
                    <span className="font-bold text-orange-400">{leaveBalance.emergency_leave.available.toFixed(2)} {t('common.days') || 'days'}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leave Requests History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('leaves.myRequests') || 'My Leave Requests'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('leaves.noRequests') || 'No leave requests found'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('leaves.leaveType') || 'Leave Type'}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('leaves.startDate') || 'Start Date'}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('leaves.endDate') || 'End Date'}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('leaves.duration') || 'Duration'}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('leaves.status') || 'Status'}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('leaves.submittedAt') || 'Submitted'}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">{t('common.actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((request) => (
                    <tr key={request.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <Badge variant="outline">{request.leave_type}</Badge>
                      </td>
                      <td className="py-3 px-4">{new Date(request.start_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">{new Date(request.end_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">{calculateDays(request.start_date, request.end_date)} {t('common.days') || 'days'}</td>
                      <td className="py-3 px-4">{getStatusBadge(request.status)}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRequest(request)}
                        >
                          {t('common.view') || 'View'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Leave Request Modal */}
      <Modal 
        isOpen={isRequestModalOpen} 
        onClose={() => setIsRequestModalOpen(false)} 
        title={t('leaves.newRequest') || 'New Leave Request'}
      >
        <form onSubmit={handleSubmitRequest} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('leaves.leaveType') || 'Leave Type'}</Label>
            <Select 
              value={newRequest.leave_type} 
              onValueChange={(value) => setNewRequest({...newRequest, leave_type: value})}
              required
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('leaves.selectLeaveType') || 'Select leave type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Annual Leave">{t('leaves.annualLeave') || 'Annual Leave'}</SelectItem>
                <SelectItem value="Sick Leave">{t('leaves.sickLeave') || 'Sick Leave'}</SelectItem>
                <SelectItem value="Emergency Leave">{t('leaves.emergencyLeave') || 'Emergency Leave'}</SelectItem>
                <SelectItem value="Unpaid Leave">{t('leaves.unpaidLeave') || 'Unpaid Leave'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('leaves.startDate') || 'Start Date'}</Label>
              <Input
                type="date"
                value={newRequest.start_date}
                onChange={(e) => setNewRequest({...newRequest, start_date: e.target.value})}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('leaves.endDate') || 'End Date'}</Label>
              <Input
                type="date"
                value={newRequest.end_date}
                onChange={(e) => setNewRequest({...newRequest, end_date: e.target.value})}
                required
                min={newRequest.start_date || new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('leaves.reason') || 'Reason'}</Label>
            <Textarea
              value={newRequest.reason}
              onChange={(e) => setNewRequest({...newRequest, reason: e.target.value})}
              placeholder={t('leaves.reasonPlaceholder') || 'Please provide a reason for your leave request...'}
              rows={4}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsRequestModalOpen(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button type="submit">
              {t('common.submit') || 'Submit Request'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <Modal 
          isOpen={!!selectedRequest} 
          onClose={() => setSelectedRequest(null)} 
          title={t('leaves.requestDetails') || 'Leave Request Details'}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">{t('leaves.leaveType') || 'Leave Type'}</Label>
                <p className="font-medium">{selectedRequest.leave_type}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{t('leaves.status') || 'Status'}</Label>
                <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">{t('leaves.startDate') || 'Start Date'}</Label>
                <p className="font-medium">{new Date(selectedRequest.start_date).toLocaleDateString()}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{t('leaves.endDate') || 'End Date'}</Label>
                <p className="font-medium">{new Date(selectedRequest.end_date).toLocaleDateString()}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{t('leaves.duration') || 'Duration'}</Label>
                <p className="font-medium">{calculateDays(selectedRequest.start_date, selectedRequest.end_date)} {t('common.days') || 'days'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{t('leaves.submittedAt') || 'Submitted'}</Label>
                <p className="font-medium">{new Date(selectedRequest.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('leaves.reason') || 'Reason'}</Label>
              <p className="mt-1 p-3 bg-muted/30 rounded-lg">{selectedRequest.reason || t('leaves.noReason') || 'No reason provided'}</p>
            </div>
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                {t('common.close') || 'Close'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


