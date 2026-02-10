import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Filter, Download, Search, User, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '../components/common/UIComponents';
import { timesheetService, TimesheetEntry } from '../services/timesheetService';
import { employeeService, Employee } from '../services/employeeService';
import { toast } from 'sonner';
import { StatusBadge } from '../components/common/StatusBadge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../contexts/AuthContext';

export default function TimesheetsPage() {
  const { user } = useAuth();
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    employee_id: '',
    dateFrom: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    report_type: '' as 'daily' | 'weekly' | ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    loadTimesheetEntries();
  }, [filters, currentPage]);

  const loadEmployees = async () => {
    try {
      const allEmployees = await employeeService.getAll();
      setEmployees(allEmployees);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const loadTimesheetEntries = async () => {
    try {
      setLoading(true);
      const response = await timesheetService.getAll({
        ...filters,
        employee_id: filters.employee_id || undefined,
        report_type: filters.report_type || undefined,
        companyId: user?.role !== 'super_admin' ? user?.company_id : undefined,
        page: currentPage,
        limit: itemsPerPage
      });
      setTimesheetEntries(response.data);
      setTotalCount(response.totalCount);
    } catch (error) {
      console.error('Failed to load timesheet entries:', error);
      toast.error('Failed to load timesheet entries');
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    if (employee) {
      return `${employee.first_name || employee.firstName} ${employee.last_name || employee.lastName}`;
    }
    return employeeId;
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Timesheets</h1>
          <p className="text-muted-foreground">View submitted timesheet reports from employees</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter size={20} />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Employee</Label>
              <Select
                value={filters.employee_id || 'all'}
                onValueChange={(value) => setFilters({ ...filters, employee_id: value === 'all' ? '' : value, currentPage: 1 })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name || emp.firstName} {emp.last_name || emp.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From Date</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value, currentPage: 1 })}
              />
            </div>
            <div>
              <Label>To Date</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value, currentPage: 1 })}
              />
            </div>
            <div>
              <Label>Report Type</Label>
              <Select
                value={filters.report_type || 'all'}
                onValueChange={(value: 'daily' | 'weekly' | 'all') => setFilters({ ...filters, report_type: value === 'all' ? '' : value, currentPage: 1 })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Submitted Timesheet Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : timesheetEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar size={48} className="mx-auto mb-4 opacity-50" />
              <p>No submitted timesheet reports found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Employee</th>
                      <th className="px-4 py-3 text-center">Hours</th>
                      <th className="px-4 py-3 text-left">Project</th>
                      <th className="px-4 py-3 text-left">Task Type</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-center">Report Type</th>
                      <th className="px-4 py-3 text-center">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {timesheetEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          {new Date(entry.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-muted-foreground" />
                            <span className="font-medium">
                              {entry.employees 
                                ? `${entry.employees.first_name} ${entry.employees.last_name}`
                                : getEmployeeName(entry.employee_id)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold">
                          {entry.hours_worked}h
                        </td>
                        <td className="px-4 py-3">
                          {entry.project_name || 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          {entry.task_type ? (
                            <Badge variant="outline">{entry.task_type}</Badge>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate text-muted-foreground">
                            {entry.description || 'N/A'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={entry.report_type === 'weekly' ? 'secondary' : 'default'}>
                            {entry.report_type || 'daily'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                          {entry.submitted_at
                            ? new Date(entry.submitted_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
