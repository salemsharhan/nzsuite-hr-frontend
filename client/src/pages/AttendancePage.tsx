import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Clock, 
  MapPin, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Calendar as CalendarIcon,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from '../components/common/UIComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import Modal from '../components/common/Modal';
import { attendanceService, AttendanceLog, AttendanceFilters } from '../services/attendanceService';
import { employeeService, Employee } from '../services/employeeService';
import { useAuth } from '../contexts/AuthContext';

export default function AttendancePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [allLogs, setAllLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Check if user is an employee
  const isEmployee = user?.role === 'employee';
  
  // Filter state
  const [filters, setFilters] = useState({
    employeeName: '',
    dateFrom: '',
    dateTo: '',
    status: 'all',
    hasLate: 'all', // 'all', 'yes', 'no'
    hasOvertime: 'all', // 'all', 'yes', 'no'
    minLateMinutes: '',
    minOvertimeMinutes: ''
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // Form State
  const [newPunch, setNewPunch] = useState({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    check_in: '',
    check_out: '',
    status: 'Present'
  });

  useEffect(() => {
    loadData();
  }, [filters, currentPage, itemsPerPage, isEmployee, user?.employee_id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // If user is an employee, only show their own attendance
      if (isEmployee && user?.employee_id) {
        const employeeLogs = await attendanceService.getByEmployee(user.employee_id);
        setAllLogs(employeeLogs);
        setLoading(false);
        return;
      }
      
      // First, get all employees to build employee ID mapping
      const employeesData = await employeeService.getAll(user?.company_id);
      const filteredEmployees = employeesData.filter(e => e.employment_type !== 'Consultant');
      setEmployees(filteredEmployees);
      
      // Build filter parameters for API call
      const apiFilters: AttendanceFilters = {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page: currentPage,
        limit: itemsPerPage
      };
      
      // If employee name filter is set, find matching employee integer IDs
      if (filters.employeeName) {
        const searchTerm = filters.employeeName.toLowerCase();
        const matchingEmployees = filteredEmployees.filter(emp => {
          const fullName = `${emp.first_name || emp.firstName || ''} ${emp.last_name || emp.lastName || ''}`.toLowerCase();
          const employeeId = (emp.employee_id || emp.employeeId || '').toLowerCase();
          return fullName.includes(searchTerm) || employeeId.includes(searchTerm);
        });
        
        // Map employee UUIDs to integer IDs from attendances table
        // We need to get the integer employee_id for each matching employee
        // This requires checking external_id or parsing employee_id text
        const integerIds: number[] = [];
        matchingEmployees.forEach(emp => {
          // Try external_id first
          const externalId = (emp as any).external_id;
          if (externalId && !isNaN(Number(externalId))) {
            integerIds.push(Number(externalId));
          } else {
            // Try to extract from employee_id text
            const employeeIdText = emp.employee_id || emp.employeeId || '';
            const match = employeeIdText.match(/\d+/);
            if (match) {
              integerIds.push(parseInt(match[0], 10));
            } else if (!isNaN(Number(employeeIdText))) {
              integerIds.push(Number(employeeIdText));
            }
          }
        });
        
        if (integerIds.length > 0) {
          apiFilters.employeeIds = integerIds;
        } else {
          // No matching employees found, return empty
          setAllLogs([]);
          setLoading(false);
          return;
        }
      }
      
      // Fetch attendance records with API filters
      const response = await attendanceService.getAll(apiFilters);
      const logsData = response.data || [];
      setTotalCount(response.totalCount || logsData.length);
      
      // Apply client-side filters for late/overtime and status (since these are calculated)
      let filteredLogs = logsData;
      
      // Filter by status
      if (filters.status && filters.status !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.status === filters.status);
      }
      
      // Filter by late
      if (filters.hasLate === 'yes') {
        filteredLogs = filteredLogs.filter(log => log.late_minutes > 0);
      } else if (filters.hasLate === 'no') {
        filteredLogs = filteredLogs.filter(log => log.late_minutes === 0);
      }
      
      // Filter by minimum late minutes
      if (filters.minLateMinutes) {
        const minLate = parseInt(filters.minLateMinutes) || 0;
        filteredLogs = filteredLogs.filter(log => log.late_minutes >= minLate);
      }
      
      // Filter by overtime
      if (filters.hasOvertime === 'yes') {
        filteredLogs = filteredLogs.filter(log => log.overtime_minutes > 0);
      } else if (filters.hasOvertime === 'no') {
        filteredLogs = filteredLogs.filter(log => log.overtime_minutes === 0);
      }
      
      // Filter by minimum overtime minutes
      if (filters.minOvertimeMinutes) {
        const minOvertime = parseInt(filters.minOvertimeMinutes) || 0;
        filteredLogs = filteredLogs.filter(log => log.overtime_minutes >= minOvertime);
      }
      
      setAllLogs(filteredLogs);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Since filtering is done on the backend, allLogs already contains filtered results
  // We only need to handle client-side filtering for late/overtime which are calculated fields
  const filteredLogs = allLogs; // Already filtered by API
  
  // Pagination calculations (server-side pagination)
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs; // Already paginated by API
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.employeeName, filters.dateFrom, filters.dateTo]);
  
  const clearFilters = () => {
    setFilters({
      employeeName: '',
      dateFrom: '',
      dateTo: '',
      status: 'all',
      hasLate: 'all',
      hasOvertime: 'all',
      minLateMinutes: '',
      minOvertimeMinutes: ''
    });
  };
  
  const hasActiveFilters = filters.employeeName || filters.dateFrom || filters.dateTo || 
    filters.status !== 'all' || filters.hasLate !== 'all' || filters.hasOvertime !== 'all' ||
    filters.minLateMinutes || filters.minOvertimeMinutes;

  const handleAddPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Calculate late/overtime logic here if needed
      const checkInTime = new Date(`${newPunch.date}T${newPunch.check_in}`);
      const checkOutTime = newPunch.check_out ? new Date(`${newPunch.date}T${newPunch.check_out}`) : null;
      
      let status = newPunch.status;
      let lateMinutes = 0;
      
      // Simple logic: Late if after 9:00 AM
      if (checkInTime.getHours() > 9 || (checkInTime.getHours() === 9 && checkInTime.getMinutes() > 0)) {
        status = 'Late';
        lateMinutes = (checkInTime.getHours() - 9) * 60 + checkInTime.getMinutes();
      }

      await attendanceService.createPunch({
        employee_id: newPunch.employee_id,
        date: newPunch.date,
        check_in: checkInTime.toISOString(),
        check_out: checkOutTime ? checkOutTime.toISOString() : undefined,
        status,
        late_minutes: lateMinutes,
        overtime_minutes: 0,
        is_regularized: true
      });
      
      await loadData();
      setIsModalOpen(false);
      // Reset form
      setNewPunch({
        employee_id: '',
        date: new Date().toISOString().split('T')[0],
        check_in: '',
        check_out: '',
        status: 'Present'
      });
    } catch (error) {
      console.error('Failed to add punch:', error);
      alert('Failed to add punch. Please check console.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present': return 'success';
      case 'Late': return 'warning';
      case 'Absent': return 'destructive';
      case 'Early Departure': return 'warning';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading tracking-tight text-foreground">{t('attendance.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {isEmployee 
              ? (t('attendance.myAttendance') || 'View your attendance records')
              : 'System-controlled punch logs and regularization.'
            }
          </p>
        </div>
        {!isEmployee && (
          <div className="flex gap-2">
            <Button variant="outline">
              <CalendarIcon size={18} className="mr-2 rtl:ml-2 rtl:mr-0" />
              Dec 2025
            </Button>
            <Button variant="primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} className="mr-2 rtl:ml-2 rtl:mr-0" />
              Add Punch
            </Button>
          </div>
        )}
      </div>

      {/* Add Punch Modal - Only show for non-employees */}
      {!isEmployee && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Manual Punch">
        <form onSubmit={handleAddPunch} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Employee</label>
            <Select 
              value={newPunch.employee_id} 
              onValueChange={(value) => setNewPunch({...newPunch, employee_id: value})}
              required
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name || emp.firstName} {emp.last_name || emp.lastName} ({emp.employee_id || emp.employeeId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Input 
              type="date"
              value={newPunch.date}
              onChange={e => setNewPunch({...newPunch, date: e.target.value})}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Check In</label>
              <Input 
                type="time"
                value={newPunch.check_in}
                onChange={e => setNewPunch({...newPunch, check_in: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Check Out</label>
              <Input 
                type="time"
                value={newPunch.check_out}
                onChange={e => setNewPunch({...newPunch, check_out: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-500">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Present</p>
              <p className="text-2xl font-bold text-emerald-500">
                {filteredLogs.filter(l => l.status === 'Present').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-amber-500/20 text-amber-500">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Late</p>
              <p className="text-2xl font-bold text-amber-500">
                {filteredLogs.filter(l => l.status === 'Late').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-destructive/20 text-destructive">
              <XCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Absent</p>
              <p className="text-2xl font-bold text-destructive">
                {filteredLogs.filter(l => l.status === 'Absent').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-500/20 text-blue-500">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">On Leave</p>
              <p className="text-2xl font-bold text-blue-500">
                {filteredLogs.filter(l => l.status === 'On Leave').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section - Only show for non-employees */}
      {showFilters && !isEmployee && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter size={18} />
              {t('attendance.filters') || 'Filters'}
            </CardTitle>
            <div className="flex gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X size={16} className="mr-1" />
                  {t('attendance.clearFilters') || 'Clear'}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}>
                <X size={16} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Employee Name Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('attendance.filterByEmployee') || 'Employee Name'}</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={t('attendance.searchEmployee') || 'Search employee...'}
                    value={filters.employeeName}
                    onChange={e => setFilters({...filters, employeeName: e.target.value})}
                    className="pl-9"
                  />
                </div>
              </div>
              
              {/* Date From */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('attendance.dateFrom') || 'Date From'}</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilters({...filters, dateFrom: e.target.value})}
                />
              </div>
              
              {/* Date To */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('attendance.dateTo') || 'Date To'}</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilters({...filters, dateTo: e.target.value})}
                />
              </div>
              
              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('attendance.status') || 'Status'}</label>
                <Select value={filters.status} onValueChange={value => setFilters({...filters, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('attendance.allStatuses') || 'All Statuses'}</SelectItem>
                    <SelectItem value="Present">{t('attendance.present') || 'Present'}</SelectItem>
                    <SelectItem value="Late">{t('attendance.late') || 'Late'}</SelectItem>
                    <SelectItem value="Absent">{t('attendance.absent') || 'Absent'}</SelectItem>
                    <SelectItem value="On Leave">{t('attendance.onLeave') || 'On Leave'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Has Late Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('attendance.hasLate') || 'Has Late'}</label>
                <Select value={filters.hasLate} onValueChange={value => setFilters({...filters, hasLate: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('attendance.all') || 'All'}</SelectItem>
                    <SelectItem value="yes">{t('attendance.yes') || 'Yes'}</SelectItem>
                    <SelectItem value="no">{t('attendance.no') || 'No'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Min Late Minutes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('attendance.minLateMinutes') || 'Min Late (min)'}</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={filters.minLateMinutes}
                  onChange={e => setFilters({...filters, minLateMinutes: e.target.value})}
                />
              </div>
              
              {/* Has Overtime Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('attendance.hasOvertime') || 'Has Overtime'}</label>
                <Select value={filters.hasOvertime} onValueChange={value => setFilters({...filters, hasOvertime: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('attendance.all') || 'All'}</SelectItem>
                    <SelectItem value="yes">{t('attendance.yes') || 'Yes'}</SelectItem>
                    <SelectItem value="no">{t('attendance.no') || 'No'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Min Overtime Minutes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('attendance.minOvertimeMinutes') || 'Min Overtime (min)'}</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={filters.minOvertimeMinutes}
                  onChange={e => setFilters({...filters, minOvertimeMinutes: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Punch Log Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle>{t('attendance.punchLog')}</CardTitle>
            {hasActiveFilters && (
              <Badge variant="default" className="text-xs">
                {filteredLogs.length} {t('attendance.of') || 'of'} {allLogs.length} {t('attendance.records') || 'records'}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant={showFilters ? "primary" : "outline"} 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} className="mr-2 rtl:ml-2 rtl:mr-0" />
              {t('attendance.filter') || 'Filter'}
              {hasActiveFilters && (
                <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-[10px]">
                  {Object.values(filters).filter(v => v && v !== 'all').length}
                </Badge>
              )}
            </Button>
            <Button variant="outline" size="sm">{t('attendance.export') || 'Export'}</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="text-xs text-muted-foreground uppercase bg-white/5">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg rtl:rounded-r-lg rtl:rounded-l-none">{t('attendance.employee') || 'Employee'}</th>
                  <th className="px-4 py-3">{t('attendance.date') || 'Date'}</th>
                  <th className="px-4 py-3">{t('attendance.checkIn') || 'Check In'}</th>
                  <th className="px-4 py-3">{t('attendance.checkOut') || 'Check Out'}</th>
                  <th className="px-4 py-3">{t('attendance.late') || 'Late'} (min)</th>
                  <th className="px-4 py-3">{t('attendance.overtime') || 'Overtime'} (min)</th>
                  <th className="px-4 py-3">{t('attendance.status') || 'Status'}</th>
                  <th className="px-4 py-3 rounded-r-lg rtl:rounded-l-lg rtl:rounded-r-none">{t('attendance.action') || 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">{t('attendance.loading') || 'Loading logs...'}</td></tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">
                    {hasActiveFilters 
                      ? (t('attendance.noRecordsMatchFilters') || 'No records match the current filters.')
                      : (t('attendance.noRecords') || 'No attendance records found.')
                    }
                  </td></tr>
                ) : paginatedLogs.map((record) => (
                  <tr key={record.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {record.employees ? `${record.employees.first_name} ${record.employees.last_name}` : record.employee_id}
                    </td>
                    <td className="px-4 py-3">{new Date(record.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-mono text-primary">
                      {record.check_in ? new Date(record.check_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-primary">
                      {record.check_out ? new Date(record.check_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                    </td>
                    <td className="px-4 py-3 text-destructive font-bold">{record.late_minutes > 0 ? `${record.late_minutes}m` : '-'}</td>
                    <td className="px-4 py-3 text-emerald-500 font-bold">{record.overtime_minutes > 0 ? `${record.overtime_minutes}m` : '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusColor(record.status) as any}>
                        {record.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                        {t('attendance.details') || 'Details'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {t('attendance.showing') || 'Showing'} {(currentPage - 1) * itemsPerPage + 1} {t('attendance.to') || 'to'} {Math.min(currentPage * itemsPerPage, totalCount)} {t('attendance.of') || 'of'} {totalCount} {t('attendance.records') || 'records'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={itemsPerPage.toString()} onValueChange={value => {
                  setItemsPerPage(parseInt(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-20 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-9"
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "primary" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="h-9 min-w-[36px]"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-9"
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
