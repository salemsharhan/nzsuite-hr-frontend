import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Clock, Calendar, DollarSign, AlertCircle, Download, Eye, FileText, Save, Send, TrendingUp, CheckCircle2, XCircle, BarChart3, Activity } from 'lucide-react';
import { selfServiceApi, Request, Payslip } from '../services/selfServiceApi';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { SubmitRequestModal } from '../components/selfservice/SubmitRequestModal';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getEmployeeLeaveBalance } from '../services/leaveBalanceService';
import { attendanceService, AttendanceLog } from '../services/attendanceService';
import { timesheetService, TimesheetEntry } from '../services/timesheetService';
import { leaveService, LeaveRequest } from '../services/leaveService';
import { getEmployeeDisplayName } from '../utils/employeeName';
import Modal from '../components/common/Modal';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/common/UIComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function EmployeeDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    checkInTime: '--:--' as string | null,
    leaveBalance: 0,
    nextPayday: 'TBD' as string | null,
    pendingRequestsCount: 0,
    weeklyHours: 0,
    monthlyHours: 0,
    attendanceThisMonth: 0,
    attendanceRate: 0
  });
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);
  const [recentPayslips, setRecentPayslips] = useState<Payslip[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceLog[]>([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState<LeaveRequest[]>([]);
  const [recentTimesheets, setRecentTimesheets] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [todayTimesheet, setTodayTimesheet] = useState<TimesheetEntry | null>(null);
  const [isTimesheetModalOpen, setIsTimesheetModalOpen] = useState(false);
  const [isSubmittingTimesheet, setIsSubmittingTimesheet] = useState(false);
  const [timesheetForm, setTimesheetForm] = useState({
    hours_worked: 0,
    description: '',
    project_name: '',
    task_type: ''
  });

  // Get employee name (Arabic when language is Arabic)
  const employeeDataRaw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('employee_data') : null;
  const employeeDataObj = employeeDataRaw ? (() => { try { return JSON.parse(employeeDataRaw); } catch { return null; } })() : null;
  const employeeFirstName = user && employeeDataObj ? getEmployeeDisplayName(employeeDataObj as any) || 'Employee' : (user ? 'Employee' : 'Employee');

  useEffect(() => {
    loadDashboardData();
    loadTodayTimesheet();
  }, []);

  useEffect(() => {
    if (todayTimesheet) {
      setTimesheetForm({
        hours_worked: todayTimesheet.hours_worked || 0,
        description: todayTimesheet.description || '',
        project_name: todayTimesheet.project_name || '',
        task_type: todayTimesheet.task_type || ''
      });
    }
  }, [todayTimesheet]);

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
      const [leaveBalance, attendanceLogs, allRequests, recentRequests, payslips, leaveRequests, timesheetEntries] = await Promise.all([
        getEmployeeLeaveBalance(employeeId, companyId),
        attendanceService.getByEmployee(employeeId),
        selfServiceApi.getAllRequests(),
        selfServiceApi.getRecentRequests(5),
        selfServiceApi.getRecentPayslips(3),
        leaveService.getByEmployee(employeeId),
        timesheetService.getByEmployee(employeeId, { dateFrom: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0] })
      ]);

      // Get today's check-in time
      const today = new Date().toISOString().split('T')[0];
      const todayLog = attendanceLogs.find(log => log.date === today);
      const checkInTime = todayLog?.check_in 
        ? new Date(todayLog.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

      // Calculate weekly hours (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weeklyHours = timesheetEntries
        .filter(entry => new Date(entry.date) >= weekAgo)
        .reduce((sum, entry) => sum + (entry.hours_worked || 0), 0);

      // Calculate monthly hours (last 30 days)
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthlyHours = timesheetEntries
        .filter(entry => new Date(entry.date) >= monthAgo)
        .reduce((sum, entry) => sum + (entry.hours_worked || 0), 0);

      // Calculate attendance stats for current month
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthAttendance = attendanceLogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
      });
      const attendanceThisMonth = monthAttendance.length;
      
      // Calculate attendance rate (assuming 22 working days per month)
      const workingDaysThisMonth = 22; // Could be calculated more accurately
      const attendanceRate = workingDaysThisMonth > 0 
        ? Math.round((attendanceThisMonth / workingDaysThisMonth) * 100) 
        : 0;

      // Get recent attendance (last 5 days)
      const recentAttendanceLogs = attendanceLogs
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      // Get upcoming approved leaves
      const upcomingLeavesList = leaveRequests
        .filter(leave => 
          leave.status === 'Approved' && 
          new Date(leave.start_date) >= new Date()
        )
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
        .slice(0, 3);

      // Get recent timesheet entries (last 5)
      const recentTimesheetEntries = timesheetEntries
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      setDashboardData({
        checkInTime,
        leaveBalance: Math.floor(totalLeaveBalance),
        nextPayday,
        pendingRequestsCount,
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        monthlyHours: Math.round(monthlyHours * 10) / 10,
        attendanceThisMonth,
        attendanceRate
      });
      setRecentRequests(recentRequests);
      setRecentPayslips(payslips);
      setRecentAttendance(recentAttendanceLogs);
      setUpcomingLeaves(upcomingLeavesList);
      setRecentTimesheets(recentTimesheetEntries);
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

  const loadTodayTimesheet = async () => {
    const employeeId = user?.employee_id || 
      (sessionStorage.getItem('employee_data') 
        ? JSON.parse(sessionStorage.getItem('employee_data') || '{}')?.id 
        : null);
    
    if (!employeeId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const entry = await timesheetService.getByDate(employeeId, today);
      setTodayTimesheet(entry);
    } catch (error) {
      console.error('Failed to load today timesheet:', error);
    }
  };

  const handleSaveTimesheet = async () => {
    const employeeId = user?.employee_id || 
      (sessionStorage.getItem('employee_data') 
        ? JSON.parse(sessionStorage.getItem('employee_data') || '{}')?.id 
        : null);
    
    if (!employeeId) {
      toast.error(t('timesheet.employeeIdNotFound'));
      return;
    }

    if (timesheetForm.hours_worked <= 0) {
      toast.error(t('timesheet.pleaseEnterHours'));
      return;
    }

    try {
      setIsSubmittingTimesheet(true);
      const today = new Date().toISOString().split('T')[0];
      await timesheetService.upsert({
        employee_id: employeeId,
        date: today,
        hours_worked: timesheetForm.hours_worked,
        description: timesheetForm.description,
        project_name: timesheetForm.project_name,
        task_type: timesheetForm.task_type
      });
      toast.success(t('timesheet.savedSuccessfully'));
      await loadTodayTimesheet();
      setIsTimesheetModalOpen(false);
    } catch (error: any) {
      console.error('Failed to save timesheet:', error);
      toast.error(error.message || 'Failed to save timesheet');
    } finally {
      setIsSubmittingTimesheet(false);
    }
  };

  const handleSubmitTimesheetReport = async (type: 'daily' | 'weekly') => {
    const employeeId = user?.employee_id || 
      (sessionStorage.getItem('employee_data') 
        ? JSON.parse(sessionStorage.getItem('employee_data') || '{}')?.id 
        : null);
    
    if (!employeeId) {
      toast.error(t('timesheet.employeeIdNotFound'));
      return;
    }

    try {
      setIsSubmittingTimesheet(true);
      
      if (type === 'daily') {
        // First save if not saved
        if (!todayTimesheet) {
          const today = new Date().toISOString().split('T')[0];
          await timesheetService.upsert({
            employee_id: employeeId,
            date: today,
            hours_worked: timesheetForm.hours_worked,
            description: timesheetForm.description,
            project_name: timesheetForm.project_name,
            task_type: timesheetForm.task_type
          });
        }
        
        const today = new Date().toISOString().split('T')[0];
        await timesheetService.submitDaily(employeeId, today);
        toast.success(t('timesheet.submittedSuccessfully'));
      } else {
        // Weekly submission
        const today = new Date();
        const dayOfWeek = today.getDay();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayOfWeek); // Get Sunday of current week
        const weekStartDate = weekStart.toISOString().split('T')[0];
        
        await timesheetService.submitWeekly(employeeId, weekStartDate);
        toast.success(t('timesheet.submittedSuccessfully'));
      }
      
      await loadTodayTimesheet();
      setIsTimesheetModalOpen(false);
    } catch (error: any) {
      console.error('Failed to submit timesheet report:', error);
      toast.error(error.message || 'Failed to submit timesheet report');
    } finally {
      setIsSubmittingTimesheet(false);
    }
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
        <h1 className="text-2xl font-bold text-foreground mb-1">{t('employeeDashboard.welcomeBack')}</h1>
        <p className="text-muted-foreground text-sm">{employeeFirstName}</p>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          {t('employeeDashboard.submitRequest')}
        </button>
        <button
          onClick={() => setIsTimesheetModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium shadow-lg shadow-blue-500/20"
        >
          <Clock className="w-4 h-4" />
          {todayTimesheet ? t('employeeDashboard.editTimesheet') : t('employeeDashboard.logTime')}
        </button>
      </div>

      {/* KPI Cards - Mobile App Style (2 columns) */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard
          icon={Clock}
          title={t('employeeDashboard.checkInTime')}
          value={dashboardData.checkInTime || '--:--'}
        />
        <KPICard
          icon={Calendar}
          title={t('employeeDashboard.leaveBalance')}
          value={`${dashboardData.leaveBalance} ${t('employeeDashboard.days')}`}
        />
        <KPICard
          icon={BarChart3}
          title={t('employeeDashboard.weeklyHours')}
          value={`${dashboardData.weeklyHours}h`}
        />
        <KPICard
          icon={TrendingUp}
          title={t('employeeDashboard.monthlyHours')}
          value={`${dashboardData.monthlyHours}h`}
        />
        <KPICard
          icon={Activity}
          title={t('employeeDashboard.attendanceRate')}
          value={`${dashboardData.attendanceRate}%`}
        />
        <KPICard
          icon={AlertCircle}
          title={t('employeeDashboard.pendingRequests')}
          value={dashboardData.pendingRequestsCount}
        />
      </div>

      {/* Additional Data Panels - Mobile App Style (Stacked) */}
      <div className="space-y-4">
        {/* Recent Attendance */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">{t('employeeDashboard.recentAttendance')}</h2>
            <a href="/self-service/attendance" className="text-xs text-primary hover:underline font-medium">
              {t('employeeDashboard.viewAll')}
            </a>
          </div>

          {recentAttendance.length === 0 ? (
            <EmptyState
              icon={Clock}
              title={t('employeeDashboard.noAttendanceRecords')}
              description={t('employeeDashboard.attendanceRecordsWillAppear')}
            />
          ) : (
            <div className="space-y-2">
              {recentAttendance.map((log, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">
                      {new Date(log.date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {log.check_in && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                          In: {new Date(log.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {log.check_out && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-red-400" />
                          Out: {new Date(log.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                  {log.check_in && log.check_out && (() => {
                    const inMs = new Date(log.check_in).getTime();
                    const outMs = new Date(log.check_out).getTime();
                    const hours = (outMs - inMs) / (1000 * 60 * 60);
                    return hours > 0 ? (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{hours.toFixed(1)}h</p>
                      </div>
                    ) : null;
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Leaves */}
        {upcomingLeaves.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">{t('employeeDashboard.upcomingLeaves')}</h2>
              <a href="/self-service/leaves" className="text-xs text-primary hover:underline font-medium">
                View All
              </a>
            </div>
            <div className="space-y-2">
              {upcomingLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">{leave.leave_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={leave.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Timesheets */}
        {recentTimesheets.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">{t('employeeDashboard.recentTimesheets')}</h2>
              <a href="/self-service/timesheet" className="text-xs text-primary hover:underline font-medium">
                View All
              </a>
            </div>
            <div className="space-y-2">
              {recentTimesheets.slice(0, 3).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">
                      {new Date(entry.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    {entry.project_name && (
                      <p className="text-xs text-muted-foreground">{entry.project_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{entry.hours_worked}h</span>
                    <StatusBadge status={entry.is_submitted ? 'Completed' : 'Draft'} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

      {/* Timesheet Entry Card */}
      {todayTimesheet && (
        <div className="bg-card border border-border rounded-2xl p-3 md:p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-sm md:text-base font-semibold text-foreground">{t('employeeDashboard.todayTimesheet')}</h2>
            <StatusBadge status={todayTimesheet.is_submitted ? 'Completed' : 'Draft'} />
          </div>
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-muted-foreground">{t('employeeDashboard.hoursWorked')}</span>
              <span className="font-semibold text-sm md:text-base">{todayTimesheet.hours_worked}h</span>
            </div>
            {todayTimesheet.description && (
              <div className="text-xs md:text-sm">
                <span className="text-muted-foreground">{t('employeeDashboard.description')}: </span>
                <span className="line-clamp-2">{todayTimesheet.description}</span>
              </div>
            )}
            {todayTimesheet.project_name && (
              <div className="text-xs md:text-sm">
                <span className="text-muted-foreground">{t('employeeDashboard.project')}: </span>
                <span>{todayTimesheet.project_name}</span>
              </div>
            )}
            {todayTimesheet.task_type && (
              <div className="text-xs md:text-sm">
                <span className="text-muted-foreground">Type: </span>
                <span>{todayTimesheet.task_type}</span>
              </div>
            )}
          </div>
          {!todayTimesheet.is_submitted && (
            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setIsTimesheetModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 md:py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                {t('common.edit')}
              </button>
                <button
                  onClick={() => handleSubmitTimesheetReport('daily')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 md:py-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-medium"
                >
                  <Send className="w-4 h-4" />
                  {t('employeeDashboard.submitReport')}
                </button>
              </div>
            )}
        </div>
      )}

      {/* Submit Request Modal */}
      <SubmitRequestModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={handleRequestSubmitted}
      />

      {/* Timesheet Entry Modal */}
      <Modal
        isOpen={isTimesheetModalOpen}
        onClose={() => setIsTimesheetModalOpen(false)}
        title={todayTimesheet ? t('timesheet.editTimesheet') : t('timesheet.logTime')}
        size="md"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('timesheet.hoursWorked')} *</Label>
            <Input
              type="number"
              step="0.25"
              min="0"
              max="24"
              value={timesheetForm.hours_worked || ''}
              onChange={(e) => setTimesheetForm({ ...timesheetForm, hours_worked: parseFloat(e.target.value) || 0 })}
              placeholder="8.5"
            />
            <p className="text-xs text-muted-foreground">Enter hours worked today (e.g., 8.5 for 8 hours 30 minutes)</p>
          </div>

          <div className="space-y-2">
            <Label>{t('timesheet.projectName')}</Label>
            <Input
              value={timesheetForm.project_name || ''}
              onChange={(e) => setTimesheetForm({ ...timesheetForm, project_name: e.target.value })}
              placeholder="Project name (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('timesheet.taskType')}</Label>
            <Select
              value={timesheetForm.task_type || ''}
              onValueChange={(value) => setTimesheetForm({ ...timesheetForm, task_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select task type (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Development">Development</SelectItem>
                <SelectItem value="Meeting">Meeting</SelectItem>
                <SelectItem value="Support">Support</SelectItem>
                <SelectItem value="Testing">Testing</SelectItem>
                <SelectItem value="Documentation">Documentation</SelectItem>
                <SelectItem value="Training">Training</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('timesheet.description')}</Label>
            <Textarea
              value={timesheetForm.description || ''}
              onChange={(e) => setTimesheetForm({ ...timesheetForm, description: e.target.value })}
              placeholder="What work did you do today? (optional)"
              rows={4}
            />
          </div>

          <div className="flex gap-2 pt-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={() => setIsTimesheetModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTimesheet}
              disabled={isSubmittingTimesheet || timesheetForm.hours_worked <= 0}
              className="flex-1"
            >
              {isSubmittingTimesheet ? 'Saving...' : 'Save Timesheet'}
            </Button>
            {!todayTimesheet?.is_submitted && (
              <Button
                onClick={() => handleSubmitTimesheetReport('daily')}
                disabled={isSubmittingTimesheet || timesheetForm.hours_worked <= 0}
                variant="secondary"
                className="flex-1"
              >
                <Send className="w-4 h-4 mr-2" />
                Save & Submit
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
