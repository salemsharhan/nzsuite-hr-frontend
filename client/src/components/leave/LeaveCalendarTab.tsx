import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { leaveService, LeaveRequest } from '@/services/leaveService';
import { useAuth } from '@/contexts/AuthContext';
import { employeeService } from '@/services/employeeService';

interface CalendarEvent {
  id: string;
  employee: string;
  leaveType: string;
  color: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  department?: string;
}

export default function LeaveCalendarTab() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all');
  const [leaveEvents, setLeaveEvents] = useState<CalendarEvent[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    loadCalendarData();
  }, [currentDate, departmentFilter, leaveTypeFilter, user?.company_id]);

  const loadCalendarData = async () => {
    if (!user?.company_id) return;
    
    try {
      setLoading(true);
      
      // Calculate date range for the current month view
      // We need to fetch leaves that overlap with the month, so we'll fetch a wider range
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      
      // Fetch leaves that might overlap with the current month
      // Use extended range to catch leaves that span across months
      const extendedStart = new Date(year, month - 1, 1); // Previous month start
      const extendedEnd = new Date(year, month + 2, 0); // Next month end
      
      const filters = {
        status: 'all' as const, // Get both approved and pending for calendar
        date_from: extendedStart.toISOString().split('T')[0],
        date_to: extendedEnd.toISOString().split('T')[0],
      };
      
      const [leaveRequests, employeesData] = await Promise.all([
        leaveService.getAll(filters),
        employeeService.getAll(user.company_id)
      ]);
      
      // Get unique departments
      const uniqueDepartments = Array.from(new Set(
        employeesData.map(emp => emp.department).filter(Boolean)
      )) as string[];
      setDepartments(uniqueDepartments);
      
      // Map leave requests to calendar events
      const events: CalendarEvent[] = leaveRequests
        .filter(req => {
          // Only show approved and pending leaves on calendar
          if (req.status === 'Rejected') return false;
          
          // Check if leave overlaps with the current month
          const leaveStart = new Date(req.start_date);
          const leaveEnd = new Date(req.end_date);
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const monthStart = new Date(year, month, 1);
          const monthEnd = new Date(year, month + 1, 0);
          
          // Leave overlaps if it starts before or during month and ends during or after month
          const overlaps = leaveStart <= monthEnd && leaveEnd >= monthStart;
          if (!overlaps) return false;
          
          // Filter by leave type
          if (leaveTypeFilter !== 'all' && req.leave_type !== leaveTypeFilter) {
            return false;
          }
          
          // Filter by department
          if (departmentFilter !== 'all') {
            const employee = employeesData.find(emp => emp.id === req.employee_id);
            if (employee?.department !== departmentFilter) {
              return false;
            }
          }
          
          return true;
        })
        .map(req => {
          const employee = employeesData.find(emp => emp.id === req.employee_id);
          const employeeName = employee 
            ? `${employee.firstName || employee.first_name || ''} ${employee.lastName || employee.last_name || ''}`.trim() || 'Unknown'
            : 'Unknown';
          
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
          
          const start = new Date(req.start_date);
          const end = new Date(req.end_date);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          
          return {
            id: req.id,
            employee: employeeName,
            leaveType: req.leave_type,
            color: getLeaveTypeColor(req.leave_type),
            startDate: req.start_date,
            endDate: req.end_date,
            days: diffDays,
            status: req.status,
            department: employee?.department
          };
        });
      
      setLeaveEvents(events);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getEventsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaveEvents.filter((event) => {
      return dateStr >= event.startDate && dateStr <= event.endDate;
    });
  };

  const isPublicHoliday = (day: number) => {
    // TODO: Fetch public holidays from company settings
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return null; // Placeholder for future public holidays feature
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const calendarDays = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={previousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center min-w-[200px]">
              <h3 className="text-xl font-semibold">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
            </div>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
          </div>

          <div className="flex gap-2">
            <Select value={departmentFilter} onValueChange={(value) => {
              setDepartmentFilter(value);
            }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={leaveTypeFilter} onValueChange={(value) => {
              setLeaveTypeFilter(value);
            }}>
              <SelectTrigger className="w-[150px]">
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
          </div>
        </div>
      </Card>

      {/* Legend */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium">Legend:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span className="text-sm">Annual Leave</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span className="text-sm">Sick Leave</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-500" />
            <span className="text-sm">Emergency Leave</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-500" />
            <span className="text-sm">Maternity Leave</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-500" />
            <span className="text-sm">Unpaid Leave</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span className="text-sm">Public Holiday</span>
          </div>
        </div>
      </Card>

      {/* Calendar Grid */}
      <Card className="p-6">
        <div className="grid grid-cols-7 gap-2">
          {/* Day Headers */}
          {dayNames.map((day) => (
            <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="min-h-[120px]" />;
            }

            const events = getEventsForDate(day);
            const holiday = isPublicHoliday(day);
            const isToday =
              day === new Date().getDate() &&
              currentDate.getMonth() === new Date().getMonth() &&
              currentDate.getFullYear() === new Date().getFullYear();

            return (
              <div
                key={day}
                className={`min-h-[120px] p-2 border rounded-lg ${
                  isToday ? 'border-primary border-2 bg-primary/5' : 'border-border'
                } ${holiday ? 'bg-green-500/10' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${isToday ? 'text-primary' : ''}`}>{day}</span>
                  {holiday && (
                    <Badge variant="outline" className="text-xs bg-green-500/20 border-green-500">
                      Holiday
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  {events.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
                      style={{ backgroundColor: `${event.color}20`, color: event.color }}
                      title={`${event.employee} - ${event.leaveType} (${event.status})`}
                    >
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: event.color }}
                      />
                      <span className="truncate">{event.employee.split(' ')[0]}</span>
                      {event.status === 'Pending' && (
                        <span className="text-[10px] opacity-75">(P)</span>
                      )}
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">+{events.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Upcoming Leaves Summary */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Leaves This Month</h4>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : leaveEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No leaves scheduled for this month</div>
        ) : (
          <div className="space-y-2">
            {leaveEvents
              .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
              .map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: event.color }} />
                    <div>
                      <p className="font-medium text-sm">{event.employee}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.leaveType}
                        {event.department && ` • ${event.department}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {new Date(event.startDate).toLocaleDateString()} to {new Date(event.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {event.days} {event.days === 1 ? 'day' : 'days'} • {event.status}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}
