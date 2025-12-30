import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Clock, Plus, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from '../components/common/UIComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import Modal from '../components/common/Modal';
import { useTranslation } from 'react-i18next';
import { leaveService, LeaveRequest } from '../services/leaveService';
import { employeeService, Employee } from '../services/employeeService';

export default function LeavesPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [newRequest, setNewRequest] = useState({
    employee_id: '',
    leave_type: 'Annual Leave',
    start_date: '',
    end_date: '',
    reason: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [leavesData, employeesData] = await Promise.all([
        leaveService.getAll(),
        employeeService.getAll()
      ]);
      setRequests(leavesData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await leaveService.create(newRequest);
      await loadData();
      setIsModalOpen(false);
      setNewRequest({
        employee_id: '',
        leave_type: 'Annual Leave',
        start_date: '',
        end_date: '',
        reason: ''
      });
    } catch (error) {
      console.error('Failed to create request:', error);
      alert('Failed to create leave request');
    }
  };

  const handleStatusUpdate = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await leaveService.updateStatus(id, status);
      await loadData();
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status');
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'Pending');
  const approvedRequests = requests.filter(r => r.status === 'Approved');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">{t('leaves.title')}</h1>
          <p className="text-muted-foreground">Track and approve employee time off</p>
        </div>
        <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> {t('leaves.newRequest')}
        </Button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('leaves.newRequest')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('employees.name')}</label>
            <Select 
              value={newRequest.employee_id} 
              onValueChange={(value) => setNewRequest({...newRequest, employee_id: value})}
              required
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name || emp.firstName} {emp.last_name || emp.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Leave Type</label>
            <Select 
              value={newRequest.leave_type} 
              onValueChange={(value) => setNewRequest({...newRequest, leave_type: value})}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={t('leaves.annualLeave')}>{t('leaves.annualLeave')}</SelectItem>
                <SelectItem value={t('leaves.sickLeave')}>{t('leaves.sickLeave')}</SelectItem>
                <SelectItem value={t('leaves.unpaidLeave')}>{t('leaves.unpaidLeave')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input 
                type="date" 
                value={newRequest.start_date}
                onChange={e => setNewRequest({...newRequest, start_date: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input 
                type="date" 
                value={newRequest.end_date}
                onChange={e => setNewRequest({...newRequest, end_date: e.target.value})}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Input 
              value={newRequest.reason}
              onChange={e => setNewRequest({...newRequest, reason: e.target.value})}
              placeholder="Optional reason..."
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.submit')}</Button>
          </div>
        </form>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('leaves.calendar')}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter size={16} className="mr-2" /> Filter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Simple List View for Approved Leaves instead of complex calendar for now */}
            <div className="space-y-4">
              {approvedRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-white/5 rounded-lg border border-white/10">
                  <CalendarIcon size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No approved leaves scheduled.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {approvedRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border-l-4 border-emerald-500">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                          {req.employees?.first_name[0]}{req.employees?.last_name[0]}
                        </div>
                        <div>
                          <p className="font-bold">{req.employees?.first_name} {req.employees?.last_name}</p>
                          <p className="text-sm text-muted-foreground">{req.leave_type} • {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Badge variant="success">Approved</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('leaves.pendingApprovals')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No pending requests.</div>
              ) : pendingRequests.map((req) => (
                <div key={req.id} className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {req.employees?.first_name[0]}{req.employees?.last_name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{req.employees?.first_name} {req.employees?.last_name}</p>
                      <p className="text-xs text-muted-foreground">{req.leave_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-muted-foreground">
                      {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                    </span>
                    <Badge variant="warning">Pending</Badge>
                  </div>
                  {req.reason && (
                    <p className="text-xs text-muted-foreground mb-3 italic">"{req.reason}"</p>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="primary" 
                      className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleStatusUpdate(req.id, 'Approved')}
                    >
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="flex-1 h-8 text-xs"
                      onClick={() => handleStatusUpdate(req.id, 'Rejected')}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
