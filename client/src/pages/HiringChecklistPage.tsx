import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Download,
  UserCheck,
  FileCheck,
  Calendar,
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from '../components/common/UIComponents';
import Modal from '../components/common/Modal';
import { hiringChecklistService, HiringChecklist, CHECKLIST_TEMPLATE } from '../services/hiringChecklistService';
import { employeeService, Employee } from '../services/employeeService';

export default function HiringChecklistPage() {
  const { t } = useTranslation();
  const [checklists, setChecklists] = useState<HiringChecklist[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedChecklist, setSelectedChecklist] = useState<HiringChecklist | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [checklistsData, employeesData] = await Promise.all([
        hiringChecklistService.getAll(),
        employeeService.getAll()
      ]);
      setChecklists(checklistsData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) return;

    try {
      await hiringChecklistService.create(selectedEmployeeId);
      await loadData();
      setIsModalOpen(false);
      setSelectedEmployeeId('');
    } catch (error) {
      console.error('Failed to create checklist:', error);
      alert('Failed to create checklist. Please check console.');
    }
  };

  const handleItemToggle = async (checklistId: string, itemId: string, currentStatus: boolean) => {
    try {
      await hiringChecklistService.updateItem(checklistId, itemId, {
        completed: !currentStatus,
        completed_date: !currentStatus ? new Date().toISOString() : undefined,
        completed_by: !currentStatus ? 'Current User' : undefined
      });
      await loadData();
      
      // Refresh selected checklist if open
      if (selectedChecklist && selectedChecklist.id === checklistId) {
        const updated = await hiringChecklistService.getByEmployeeId(selectedChecklist.employee_id);
        if (updated) setSelectedChecklist(updated);
      }
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const handleApproval = async (checklistId: string, type: 'hr' | 'manager') => {
    try {
      await hiringChecklistService.approve(checklistId, type, 'Current User');
      await loadData();
      
      // Refresh selected checklist if open
      if (selectedChecklist && selectedChecklist.id === checklistId) {
        const updated = await hiringChecklistService.getByEmployeeId(selectedChecklist.employee_id);
        if (updated) setSelectedChecklist(updated);
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const openDetailModal = (checklist: HiringChecklist) => {
    setSelectedChecklist(checklist);
    setIsDetailModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'success';
      case 'Pending Approval': return 'warning';
      case 'In Progress': return 'default';
      default: return 'default';
    }
  };

  const employeesWithoutChecklist = employees.filter(
    emp => !checklists.some(cl => cl.employee_id === emp.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading tracking-tight text-foreground">Hiring Checklist</h1>
          <p className="text-muted-foreground mt-1">Track employee onboarding progress through all hiring stages.</p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} className="mr-2 rtl:ml-2 rtl:mr-0" />
          New Checklist
        </Button>
      </div>

      {/* Create Checklist Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Hiring Checklist">
        <form onSubmit={handleCreateChecklist} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Employee</label>
            <select 
              className="w-full h-10 bg-white/5 border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-primary"
              value={selectedEmployeeId}
              onChange={e => setSelectedEmployeeId(e.target.value)}
              required
            >
              <option value="">Choose an employee...</option>
              {employeesWithoutChecklist.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_id})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      {selectedChecklist && (
        <Modal 
          isOpen={isDetailModalOpen} 
          onClose={() => setIsDetailModalOpen(false)} 
          title={`Hiring Checklist - ${selectedChecklist.employees?.first_name} ${selectedChecklist.employees?.last_name}`}
        >
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Overall Progress</span>
                <span className="text-muted-foreground">{selectedChecklist.progress_percentage}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${selectedChecklist.progress_percentage}%` }}
                />
              </div>
            </div>

            {/* Stages */}
            {CHECKLIST_TEMPLATE.map(stage => {
              const stageItems = JSON.parse(selectedChecklist.items as any).filter((item: any) => item.stage === stage.stage);
              const completedInStage = stageItems.filter((item: any) => item.completed).length;
              
              return (
                <div key={stage.stage} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">Stage {stage.stage}: {stage.stageName}</h3>
                    <Badge variant={completedInStage === stageItems.length ? 'success' : 'default'}>
                      {completedInStage}/{stageItems.length}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {stageItems.map((item: any, idx: number) => (
                      <div 
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        <button
                          onClick={() => handleItemToggle(selectedChecklist.id, item.id, item.completed)}
                          className="mt-0.5 shrink-0"
                        >
                          {item.completed ? (
                            <CheckCircle2 size={20} className="text-primary" />
                          ) : (
                            <Circle size={20} className="text-muted-foreground" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {item.item_name}
                          </p>
                          {item.completed && item.completed_date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Completed on {new Date(item.completed_date).toLocaleDateString()} by {item.completed_by}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Approval Section */}
            {selectedChecklist.progress_percentage === 100 && (
              <div className="space-y-3 pt-4 border-t border-white/10">
                <h3 className="font-bold">Final Approval</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={selectedChecklist.hr_approved ? 'primary' : 'outline'}
                    onClick={() => !selectedChecklist.hr_approved && handleApproval(selectedChecklist.id, 'hr')}
                    disabled={selectedChecklist.hr_approved}
                  >
                    <UserCheck size={16} className="mr-2" />
                    {selectedChecklist.hr_approved ? 'HR Approved' : 'HR Approve'}
                  </Button>
                  <Button
                    variant={selectedChecklist.manager_approved ? 'primary' : 'outline'}
                    onClick={() => !selectedChecklist.manager_approved && handleApproval(selectedChecklist.id, 'manager')}
                    disabled={selectedChecklist.manager_approved}
                  >
                    <FileCheck size={16} className="mr-2" />
                    {selectedChecklist.manager_approved ? 'Manager Approved' : 'Manager Approve'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Checklists</p>
                <p className="text-2xl font-bold text-blue-500">{checklists.length}</p>
              </div>
              <FileCheck size={32} className="text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-amber-500">
                  {checklists.filter(c => c.status === 'In Progress').length}
                </p>
              </div>
              <Calendar size={32} className="text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-500/10 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold text-purple-500">
                  {checklists.filter(c => c.status === 'Pending Approval').length}
                </p>
              </div>
              <UserCheck size={32} className="text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-emerald-500">
                  {checklists.filter(c => c.status === 'Completed').length}
                </p>
              </div>
              <CheckCircle2 size={32} className="text-emerald-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checklists List */}
      <Card>
        <CardHeader>
          <CardTitle>All Hiring Checklists</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="text-xs text-muted-foreground uppercase bg-white/5">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg rtl:rounded-r-lg rtl:rounded-l-none">Employee</th>
                  <th className="px-4 py-3">Current Stage</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">HR Approval</th>
                  <th className="px-4 py-3">Manager Approval</th>
                  <th className="px-4 py-3 rounded-r-lg rtl:rounded-l-lg rtl:rounded-r-none">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Loading checklists...</td></tr>
                ) : checklists.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No checklists found. Create one to get started.</td></tr>
                ) : checklists.map((checklist) => (
                  <tr key={checklist.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-muted-foreground" />
                        {checklist.employees ? 
                          `${checklist.employees.first_name} ${checklist.employees.last_name}` : 
                          checklist.employee_id
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      Stage {checklist.stage} / 6
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden max-w-[100px]">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${checklist.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{checklist.progress_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusColor(checklist.status) as any}>
                        {checklist.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {checklist.hr_approved ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <Circle size={16} className="text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {checklist.manager_approved ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <Circle size={16} className="text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openDetailModal(checklist)}
                        >
                          View Details
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download size={16} />
                        </Button>
                      </div>
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
