import { useState, useEffect } from 'react';
import { Plus, Clock, Calendar, DollarSign, AlertCircle, Download, Eye, FileText } from 'lucide-react';
import { selfServiceApi, Request, Payslip } from '../services/selfServiceApi';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { SubmitRequestModal } from '../components/selfservice/SubmitRequestModal';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getEmployeeLeaveBalance } from '../services/leaveBalanceService';
import { attendanceService } from '../services/attendanceService';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    checkInTime: '--:--' as string | null,
    leaveBalance: 0,
    nextPayday: 'TBD' as string | null,
    pendingRequestsCount: 0
  });
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);
  const [recentPayslips, setRecentPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Get employee name from session storage or user
  const employeeFirstName = user ? 
    (sessionStorage.getItem('employee_data') 
      ? JSON.parse(sessionStorage.getItem('employee_data') || '{}')?.first_name || 'Employee'
      : (user as any)?.first_name || 'Employee')
    : 'Employee';

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get employee ID from user or session storage
      const employeeId = user?.employee_id || 
        (sessionStorage.getItem('employee_data') 
          ? JSON.parse(sessionStorage.getItem('employee_data') || '{}')?.id 
          : null);
      
      const companyId = user?.company_id || 
        (sessionStorage.getItem('employee_data') 
          ? JSON.parse(sessionStorage.getItem('employee_data') || '{}')?.company_id 
          : null);

      if (!employeeId || !companyId) {
        console.warn('Employee ID or Company ID not found');
        setLoading(false);
        return;
      }

      // Fetch real data
      const [leaveBalance, attendanceLogs, allRequests, recentRequests, payslips] = await Promise.all([
        getEmployeeLeaveBalance(employeeId, companyId),
        attendanceService.getByEmployee(employeeId),
        selfServiceApi.getAllRequests(),
        selfServiceApi.getRecentRequests(5),
        selfServiceApi.getRecentPayslips(3)
      ]);

      // Get today's check-in time
      const today = new Date().toISOString().split('T')[0];
      const todayLog = attendanceLogs.find(log => log.date === today);
      const checkInTime = todayLog?.checkIn 
        ? new Date(todayLog.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;

      // Calculate total leave balance (annual + sick + emergency)
      const totalLeaveBalance = leaveBalance 
        ? (leaveBalance.annual_leave.available + leaveBalance.sick_leave.available + leaveBalance.emergency_leave.available)
        : 0;

      // Count pending requests
      const pendingRequestsCount = allRequests.filter(r => 
        r.status === 'Pending' || r.status === 'In Review'
      ).length;

      // Get next payday (for now, using a placeholder - would need payroll service)
      const nextPayday = 'TBD'; // TODO: Implement payroll service to get actual next payday

      setDashboardData({
        checkInTime,
        leaveBalance: Math.floor(totalLeaveBalance),
        nextPayday,
        pendingRequestsCount
      });
      setRecentRequests(recentRequests);
      setRecentPayslips(payslips);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSubmitted = () => {
    // Refresh dashboard data after request submission
    loadDashboardData();
    toast.success('Request submitted successfully!');
  };

  const KPICard = ({ icon: Icon, title, value, trend }: any) => (
    <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {trend && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            trend.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
          }`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Welcome Header - Mobile App Style */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back!</h1>
        <p className="text-muted-foreground text-sm">{employeeFirstName}</p>
      </div>

      {/* Quick Action Button */}
      <button
        onClick={() => setIsSubmitModalOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium shadow-lg shadow-primary/20"
      >
        <Plus className="w-5 h-5" />
        Submit Request
      </button>

      {/* KPI Cards - Mobile App Style (2 columns) */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard
          icon={Clock}
          title="Check-in Time"
          value={dashboardData.checkInTime || '--:--'}
          trend="+2.5%"
        />
        <KPICard
          icon={Calendar}
          title="Leave Balance"
          value={`${dashboardData.leaveBalance} Days`}
        />
        <KPICard
          icon={DollarSign}
          title="Next Payday"
          value={dashboardData.nextPayday || 'TBD'}
        />
        <KPICard
          icon={AlertCircle}
          title="Pending Requests"
          value={dashboardData.pendingRequestsCount}
          trend={dashboardData.pendingRequestsCount > 0 ? '-5%' : undefined}
        />
      </div>

      {/* Two Panels - Mobile App Style (Stacked) */}
      <div className="space-y-4">
        {/* Recent Payslips */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Recent Payslips</h2>
            <a href="/self-service/payslips" className="text-xs text-primary hover:underline font-medium">
              View All
            </a>
          </div>

          {recentPayslips.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No payslips available"
              description="Your payslips will appear here once generated"
            />
          ) : (
            <div className="space-y-3">
              {recentPayslips.map(payslip => (
                <div
                  key={payslip.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors mb-2"
                >
                  <div>
                    <p className="font-medium text-sm text-foreground">{payslip.month}</p>
                    <p className="text-xs text-muted-foreground">
                      Net: ${payslip.netSalary.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => window.open(payslip.downloadUrl, '_blank')}
                      className="p-2 hover:bg-background rounded-lg transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => selfServiceApi.downloadPayslip(payslip.id)}
                      className="p-2 hover:bg-background rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Requests */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">My Requests</h2>
            <a href="/self-service/requests" className="text-xs text-primary hover:underline font-medium">
              View All
            </a>
          </div>

          {recentRequests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No recent requests"
              description="Your submitted requests will appear here"
              action={{
                label: 'Submit Request',
                onClick: () => setIsSubmitModalOpen(true)
              }}
            />
          ) : (
            <div className="space-y-3">
              {recentRequests.map(request => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer mb-2"
                  onClick={() => window.location.href = `/self-service/requests/${request.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{request.type}</p>
                    <p className="text-xs text-muted-foreground">{request.date}</p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submit Request Modal */}
      <SubmitRequestModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={handleRequestSubmitted}
      />
    </div>
  );
}
