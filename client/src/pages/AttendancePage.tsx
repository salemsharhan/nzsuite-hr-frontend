import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Clock, 
  MapPin, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Calendar as CalendarIcon,
  Filter,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from '../components/common/UIComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import Modal from '../components/common/Modal';
import { attendanceService, AttendanceLog } from '../services/attendanceService';
import { employeeService, Employee } from '../services/employeeService';

export default function AttendancePage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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
  }, []);

  const loadData = async () => {
    try {
      const [logsData, employeesData] = await Promise.all([
        attendanceService.getAll(),
        employeeService.getAll()
      ]);
      setLogs(logsData);
      // Filter out Consultants from attendance tracking
      setEmployees(employeesData.filter(e => e.employment_type !== 'Consultant'));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-muted-foreground mt-1">System-controlled punch logs and regularization.</p>
        </div>
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
      </div>

      {/* Add Punch Modal */}
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
                {logs.filter(l => l.status === 'Present').length}
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
                {logs.filter(l => l.status === 'Late').length}
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
                {logs.filter(l => l.status === 'Absent').length}
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
                {logs.filter(l => l.status === 'On Leave').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Punch Log Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('attendance.punchLog')}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter size={16} className="mr-2 rtl:ml-2 rtl:mr-0" />
              Filter
            </Button>
            <Button variant="outline" size="sm">Export</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="text-xs text-muted-foreground uppercase bg-white/5">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg rtl:rounded-r-lg rtl:rounded-l-none">Employee</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Check In</th>
                  <th className="px-4 py-3">Check Out</th>
                  <th className="px-4 py-3">Late (min)</th>
                  <th className="px-4 py-3">Overtime (min)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-r-lg rtl:rounded-l-lg rtl:rounded-r-none">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Loading logs...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No attendance records found.</td></tr>
                ) : logs.map((record) => (
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
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
