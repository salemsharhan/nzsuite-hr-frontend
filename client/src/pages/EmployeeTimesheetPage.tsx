import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Calendar, Save, Send, Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '../components/common/UIComponents';
import { timesheetService, TimesheetEntry } from '../services/timesheetService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import Modal from '../components/common/Modal';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { StatusBadge } from '../components/common/StatusBadge';

export default function EmployeeTimesheetPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timesheetForm, setTimesheetForm] = useState({
    hours_worked: 0,
    description: '',
    project_name: '',
    task_type: ''
  });
  const [dateFilter, setDateFilter] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadTimesheetEntries();
  }, [dateFilter]);

  const loadTimesheetEntries = async () => {
    const employeeId = user?.employee_id || 
      (sessionStorage.getItem('employee_data') 
        ? JSON.parse(sessionStorage.getItem('employee_data') || '{}')?.id 
        : null);
    
    if (!employeeId) return;

    try {
      setLoading(true);
      const entries = await timesheetService.getByEmployee(employeeId, {
        dateFrom: dateFilter.from,
        dateTo: dateFilter.to
      });
      setTimesheetEntries(entries);
    } catch (error) {
      console.error('Failed to load timesheet entries:', error);
      toast.error(t('timesheet.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (entry?: TimesheetEntry, date?: string) => {
    if (entry) {
      setEditingEntry(entry);
      setSelectedDate(entry.date);
      setTimesheetForm({
        hours_worked: entry.hours_worked || 0,
        description: entry.description || '',
        project_name: entry.project_name || '',
        task_type: entry.task_type || ''
      });
    } else {
      setEditingEntry(null);
      setSelectedDate(date || new Date().toISOString().split('T')[0]);
      setTimesheetForm({
        hours_worked: 0,
        description: '',
        project_name: '',
        task_type: ''
      });
    }
    setIsModalOpen(true);
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
      setIsSubmitting(true);
      await timesheetService.upsert({
        employee_id: employeeId,
        date: selectedDate,
        hours_worked: timesheetForm.hours_worked,
        description: timesheetForm.description,
        project_name: timesheetForm.project_name,
        task_type: timesheetForm.task_type
      });
      toast.success(t('timesheet.savedSuccessfully'));
      await loadTimesheetEntries();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Failed to save timesheet:', error);
      toast.error(error.message || t('timesheet.failedToSave'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDaily = async (date: string) => {
    const employeeId = user?.employee_id || 
      (sessionStorage.getItem('employee_data') 
        ? JSON.parse(sessionStorage.getItem('employee_data') || '{}')?.id 
        : null);
    
    if (!employeeId) {
      toast.error(t('timesheet.employeeIdNotFound'));
      return;
    }

    try {
      setIsSubmitting(true);
      await timesheetService.submitDaily(employeeId, date);
      toast.success(t('timesheet.dailySubmittedSuccessfully'));
      await loadTimesheetEntries();
    } catch (error: any) {
      console.error('Failed to submit timesheet:', error);
      toast.error(error.message || t('timesheet.failedToSubmit'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitWeekly = async () => {
    const employeeId = user?.employee_id || 
      (sessionStorage.getItem('employee_data') 
        ? JSON.parse(sessionStorage.getItem('employee_data') || '{}')?.id 
        : null);
    
    if (!employeeId) {
      toast.error(t('timesheet.employeeIdNotFound'));
      return;
    }

    try {
      setIsSubmitting(true);
      const today = new Date();
      const dayOfWeek = today.getDay();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - dayOfWeek);
      const weekStartDate = weekStart.toISOString().split('T')[0];
      
      await timesheetService.submitWeekly(employeeId, weekStartDate);
      toast.success(t('timesheet.weeklySubmittedSuccessfully'));
      await loadTimesheetEntries();
    } catch (error: any) {
      console.error('Failed to submit weekly timesheet:', error);
      toast.error(error.message || t('timesheet.failedToSubmitWeekly'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('timesheet.confirmDelete'))) return;
    
    const employeeId = user?.employee_id || 
      (sessionStorage.getItem('employee_data') 
        ? JSON.parse(sessionStorage.getItem('employee_data') || '{}')?.id 
        : null);
    
    if (!employeeId) {
      toast.error(t('timesheet.employeeIdNotFound'));
      return;
    }
    
    try {
      await timesheetService.delete(id, employeeId);
      toast.success(t('timesheet.deleteSuccessfully'));
      await loadTimesheetEntries();
    } catch (error: any) {
      console.error('Failed to delete timesheet:', error);
      toast.error(error.message || t('timesheet.failedToDelete'));
    }
  };

  // Calculate weekly totals
  const getWeeklyTotals = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    const weekStartDate = weekStart.toISOString().split('T')[0];
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndDate = weekEnd.toISOString().split('T')[0];

    const weekEntries = timesheetEntries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= weekStart && entryDate <= weekEnd;
    });

    const totalHours = weekEntries.reduce((sum, e) => sum + (e.hours_worked || 0), 0);
    const submittedCount = weekEntries.filter(e => e.is_submitted).length;
    const totalEntries = weekEntries.length;

    return { totalHours, submittedCount, totalEntries, weekStartDate, weekEndDate };
  };

  const weeklyTotals = getWeeklyTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('timesheet.myTimesheet')}</h1>
          <p className="text-sm text-muted-foreground">{t('timesheet.subtitle')}</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus size={18} />
          {t('timesheet.logTime')}
        </Button>
      </div>

      {/* Weekly Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar size={20} />
            {t('timesheet.weeklySummary')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-500/10 dark:bg-blue-500/10 rounded-lg border border-blue-500/30 dark:border-blue-500/20">
              <div className="text-xs text-muted-foreground mb-1">{t('timesheet.totalHours')}</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{weeklyTotals.totalHours.toFixed(1)}h</div>
            </div>
            <div className="text-center p-3 bg-green-500/10 dark:bg-green-500/10 rounded-lg border border-green-500/30 dark:border-green-500/20">
              <div className="text-xs text-muted-foreground mb-1">{t('timesheet.submitted')}</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{weeklyTotals.submittedCount}/{weeklyTotals.totalEntries}</div>
            </div>
            <div className="text-center p-3 bg-purple-500/10 dark:bg-purple-500/10 rounded-lg border border-purple-500/30 dark:border-purple-500/20">
              <div className="text-xs text-muted-foreground mb-1">{t('timesheet.week')}</div>
              <div className="text-sm font-semibold">
                {new Date(weeklyTotals.weekStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(weeklyTotals.weekEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
          {weeklyTotals.totalEntries > 0 && weeklyTotals.submittedCount < weeklyTotals.totalEntries && (
            <Button
              onClick={handleSubmitWeekly}
              disabled={isSubmitting}
              className="w-full gap-2"
              variant="secondary"
            >
              <Send size={18} />
              {t('timesheet.submitWeeklyReport')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Date Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('timesheet.fromDate')}</Label>
              <Input
                type="date"
                value={dateFilter.from}
                onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">{t('timesheet.toDate')}</Label>
              <Input
                type="date"
                value={dateFilter.to}
                onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Entries */}
      <Card>
        <CardHeader>
          <CardTitle>{t('timesheet.timesheetEntries')}</CardTitle>
        </CardHeader>
        <CardContent>
          {timesheetEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock size={48} className="mx-auto mb-4 opacity-50" />
              <p>{t('timesheet.noEntriesFound')}</p>
              <Button onClick={() => handleOpenModal()} variant="outline" className="mt-4">
                <Plus size={18} className="mr-2" />
                {t('timesheet.addEntry')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {timesheetEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 md:p-4 bg-card rounded-lg border border-border hover:border-border/80 transition-colors"
                >
                  {/* Header: Date and Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Calendar size={14} className="text-muted-foreground flex-shrink-0" />
                      <span className="font-semibold text-sm md:text-base">
                        {new Date(entry.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                      <StatusBadge status={entry.is_submitted ? 'Completed' : 'Draft'} />
                    </div>
                  </div>

                  {/* Details: Hours, Project, Type */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock size={14} className="flex-shrink-0" />
                      <span className="font-medium text-foreground">{entry.hours_worked}h</span>
                    </span>
                    {entry.project_name && (
                      <span className="text-sm text-muted-foreground">
                        <span className="font-medium">{t('timesheet.project')}:</span> {entry.project_name}
                      </span>
                    )}
                    {entry.task_type && (
                      <span className="text-sm text-muted-foreground">
                        <span className="font-medium">{t('timesheet.type')}:</span> {entry.task_type}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {entry.description && (
                    <p className="text-sm mt-2 mb-3 text-muted-foreground line-clamp-2">{entry.description}</p>
                  )}

                  {/* Action Buttons */}
                  {!entry.is_submitted && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenModal(entry)}
                        className="flex-1 sm:flex-initial h-9 md:h-8"
                      >
                        <Edit2 size={14} className="sm:mr-2" />
                        <span className="hidden sm:inline">{t('timesheet.edit')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(entry.id)}
                        className="text-red-400 hover:text-red-300 flex-1 sm:flex-initial h-9 md:h-8"
                      >
                        <Trash2 size={14} className="sm:mr-2" />
                        <span className="hidden sm:inline">{t('timesheet.delete')}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSubmitDaily(entry.date)}
                        disabled={isSubmitting}
                        className="flex-1 sm:flex-initial gap-1.5 h-9 md:h-8"
                      >
                        <Send size={14} />
                        <span>{t('timesheet.submit')}</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timesheet Entry Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEntry ? t('timesheet.editTimesheetEntry') : t('timesheet.logTime')}
        size="md"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('timesheet.date')} *</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

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
            <p className="text-xs text-muted-foreground">{t('timesheet.enterHoursWorked')}</p>
          </div>

          <div className="space-y-2">
            <Label>{t('timesheet.projectName')}</Label>
            <Input
              value={timesheetForm.project_name}
              onChange={(e) => setTimesheetForm({ ...timesheetForm, project_name: e.target.value })}
              placeholder={t('timesheet.projectNamePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('timesheet.taskType')}</Label>
            <Select
              value={timesheetForm.task_type}
              onValueChange={(value) => setTimesheetForm({ ...timesheetForm, task_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('timesheet.selectTaskType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Development">{t('timesheet.development')}</SelectItem>
                <SelectItem value="Meeting">{t('timesheet.meeting')}</SelectItem>
                <SelectItem value="Support">{t('timesheet.support')}</SelectItem>
                <SelectItem value="Testing">{t('timesheet.testing')}</SelectItem>
                <SelectItem value="Documentation">{t('timesheet.documentation')}</SelectItem>
                <SelectItem value="Training">{t('timesheet.training')}</SelectItem>
                <SelectItem value="Other">{t('timesheet.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('timesheet.description')}</Label>
            <Textarea
              value={timesheetForm.description}
              onChange={(e) => setTimesheetForm({ ...timesheetForm, description: e.target.value })}
              placeholder={t('timesheet.descriptionPlaceholder')}
              rows={4}
            />
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSaveTimesheet}
              disabled={isSubmitting || timesheetForm.hours_worked <= 0}
              className="flex-1"
            >
              {isSubmitting ? t('timesheet.saving') : t('timesheet.save')}
            </Button>
            {!editingEntry?.is_submitted && (
              <Button
                onClick={() => {
                  handleSaveTimesheet().then(() => {
                    if (timesheetForm.hours_worked > 0) {
                      setTimeout(() => handleSubmitDaily(selectedDate), 500);
                    }
                  });
                }}
                disabled={isSubmitting || timesheetForm.hours_worked <= 0}
                variant="secondary"
                className="flex-1"
              >
                <Send className="w-4 h-4 mr-2" />
                {t('timesheet.saveAndSubmit')}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

