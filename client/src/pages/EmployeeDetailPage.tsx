import React, { useState, useEffect, useRef } from 'react';
import { useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import i18n from '../utils/i18n';
import { User, FileText, Clock, DollarSign, Shield, ArrowLeft, Upload, Download, MapPin, Phone, Mail, Calendar, Briefcase, Building2, X, Trash2, GraduationCap, CheckCircle, CreditCard, Plus, Edit2, Globe, FileCheck, AlertCircle, Users, Home, Fingerprint, CheckCircle2, HelpCircle, ChevronRight, ChevronLeft, Camera, XCircle, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '../components/common/UIComponents';
import { employeeService, Employee } from '../services/employeeService';
import { documentService, Document } from '../services/documentService';
import { employeeEducationService, EmployeeEducation } from '../services/employeeEducationService';
import { employeeBankDetailsService, EmployeeBankDetails } from '../services/employeeBankDetailsService';
import { employeeImmigrationService, EmployeeImmigration } from '../services/employeeImmigrationService';
import { employeeAttendanceLocationService, EmployeeAttendanceLocation } from '../services/employeeAttendanceLocationService';
import { attendanceLocationService } from '../services/attendanceLocationService';
import { getEmployeeLeaveBalance, LeaveBalance } from '../services/leaveBalanceService';
import { employeeRequestService, EmployeeRequest } from '../services/employeeRequestService';
import { documentRequestService, DocumentRequest } from '../services/documentRequestService';
import { leaveService, LeaveRequest } from '../services/leaveService';
import { companySettingsService, EmployeeShift, EmployeeWorkingHours } from '../services/companySettingsService';
import { timesheetService, TimesheetEntry } from '../services/timesheetService';
import { attendanceService, AttendanceLog } from '../services/attendanceService';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/common/Modal';
import { getEmployeeDisplayName, getEmployeeInitials, getEmployeeFirstName, getEmployeeLastName } from '../utils/employeeName';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { StatusBadge } from '../components/common/StatusBadge';
import { Calendar as CalendarIcon, FileText as FileTextIcon, Clock as ClockIcon } from 'lucide-react';

// Helper function to calculate days until expiry
const calculateDaysUntilExpiry = (expiryDate: string | undefined): number | null => {
  if (!expiryDate) return null;
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Helper function to get document status
const getDocumentStatus = (daysUntilExpiry: number | null, status?: string): { label: string; color: string; priority: string } => {
  if (daysUntilExpiry === null) {
    return { label: status || 'Valid', color: 'text-green-400', priority: 'safe' };
  }
  if (daysUntilExpiry < 0) {
    return { label: 'CRITICAL - Overdue!', color: 'text-red-400', priority: 'critical' };
  }
  if (daysUntilExpiry <= 14) {
    return { label: 'URGENT - ' + Math.abs(daysUntilExpiry) + ' days left', color: 'text-red-400', priority: 'urgent' };
  }
  if (daysUntilExpiry <= 30) {
    return { label: 'Attention - ' + daysUntilExpiry + ' days left', color: 'text-orange-400', priority: 'attention' };
  }
  return { label: 'Safe - ' + daysUntilExpiry + ' days left', color: 'text-green-400', priority: 'safe' };
};

// Helper function to calculate immigration statistics
const calculateImmigrationStats = (immigration: EmployeeImmigration | null) => {
  if (!immigration) {
    return { totalDocuments: 0, requireAction: 0, validDocuments: 0, nextDeadline: null };
  }

  const documents = [
    { expiryDate: immigration.civil_id_expiry_date, status: immigration.civil_id_status },
    { expiryDate: immigration.passport_expiry_date, status: immigration.passport_status },
    { expiryDate: immigration.work_permit_expiry_date, status: immigration.work_permit_status },
    { expiryDate: immigration.health_insurance_expiry_date, status: immigration.health_insurance_status },
    { expiryDate: immigration.residence_permit_expiry_date, status: immigration.residence_permit_status },
    { expiryDate: null, status: 'Active' } // Fingerprint Registration
  ].map(doc => ({
    ...doc,
    daysUntilExpiry: calculateDaysUntilExpiry(doc.expiryDate || undefined),
    statusInfo: getDocumentStatus(calculateDaysUntilExpiry(doc.expiryDate || undefined), doc.status)
  }));

  const totalDocuments = documents.length;
  const requireAction = documents.filter(d => d.statusInfo.priority === 'urgent' || d.statusInfo.priority === 'critical' || d.statusInfo.priority === 'attention').length;
  const validDocuments = documents.filter(d => d.statusInfo.priority === 'safe').length;
  
  const upcomingDeadlines = documents
    .filter(d => d.expiryDate)
    .map(d => ({ expiryDate: d.expiryDate!, date: new Date(d.expiryDate!) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const nextDeadline = upcomingDeadlines[0] || null;

  return { totalDocuments, requireAction, validDocuments, nextDeadline };
};

// Admin Immigration View Component (for Employee Detail Page)
function AdminImmigrationView({ 
  immigration, 
  employee,
  onEdit,
  onRenewal
}: { 
  immigration: EmployeeImmigration; 
  employee: Employee;
  onEdit: () => void;
  onRenewal: () => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Calculate document statuses
  const documents = [
    {
      type: 'Civil ID',
      number: immigration.civil_id_number || 'N/A',
      expiryDate: immigration.civil_id_expiry_date,
      status: immigration.civil_id_status,
      icon: Users,
      color: 'blue'
    },
    {
      type: 'Passport',
      number: immigration.passport_number || 'N/A',
      expiryDate: immigration.passport_expiry_date,
      status: immigration.passport_status,
      icon: Globe,
      color: 'green'
    },
    {
      type: 'Work Permit',
      number: immigration.work_permit_number || 'N/A',
      expiryDate: immigration.work_permit_expiry_date,
      status: immigration.work_permit_status,
      icon: FileCheck,
      color: 'purple'
    },
    {
      type: 'Health Insurance',
      number: immigration.health_insurance_number || immigration.health_insurance_provider || 'N/A',
      expiryDate: immigration.health_insurance_expiry_date,
      status: immigration.health_insurance_status,
      icon: Shield,
      color: 'cyan'
    },
    {
      type: 'Residence Permit (Article 18)',
      number: immigration.residence_permit_number || 'N/A',
      expiryDate: immigration.residence_permit_expiry_date,
      status: immigration.residence_permit_status,
      icon: Home,
      color: 'indigo'
    },
    {
      type: 'Fingerprint Registration',
      number: immigration.civil_id_number || 'N/A',
      expiryDate: null,
      status: 'Active',
      icon: Fingerprint,
      color: 'gray'
    }
  ].map(doc => ({
    ...doc,
    daysUntilExpiry: calculateDaysUntilExpiry(doc.expiryDate || undefined),
    statusInfo: getDocumentStatus(calculateDaysUntilExpiry(doc.expiryDate || undefined), doc.status)
  }));

  // Calculate statistics
  const totalDocuments = documents.length;
  const requireAction = documents.filter(d => d.statusInfo.priority === 'urgent' || d.statusInfo.priority === 'critical' || d.statusInfo.priority === 'attention').length;
  const validDocuments = documents.filter(d => d.statusInfo.priority === 'safe').length;
  
  // Find next deadline
  const upcomingDeadlines = documents
    .filter(d => d.expiryDate)
    .map(d => ({ ...d, date: new Date(d.expiryDate!) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const nextDeadline = upcomingDeadlines[0];

  // Generate tasks based on document statuses
  const tasks = documents
    .filter(d => d.expiryDate && (d.daysUntilExpiry !== null && d.daysUntilExpiry <= 30))
    .map(doc => ({
      id: doc.type,
      title: `${doc.type === 'Passport' ? 'Submit passport renewal application' : doc.type === 'Work Permit' ? 'Upload work permit supporting documents' : doc.type === 'Health Insurance' ? 'Complete health insurance renewal form' : doc.type === 'Residence Permit (Article 18)' ? 'Submit residence permit photos' : 'Update ' + doc.type.toLowerCase()}`,
      dueDate: doc.expiryDate ? new Date(doc.expiryDate) : null,
      priority: doc.statusInfo.priority === 'critical' || doc.statusInfo.priority === 'urgent' ? 'HIGH' : 'MEDIUM',
      completed: false
    }));

  const completedTasks = 2; // Mock - would come from task tracking
  const totalTasks = tasks.length + completedTasks;

  // Generate notifications
  const notifications = documents
    .filter(d => d.expiryDate && (d.daysUntilExpiry !== null && d.daysUntilExpiry <= 30))
    .map(doc => ({
      type: doc.statusInfo.priority === 'critical' || doc.statusInfo.priority === 'urgent' ? 'error' : 'warning',
      message: `${doc.type} ${doc.daysUntilExpiry && doc.daysUntilExpiry < 0 ? 'overdue' : doc.daysUntilExpiry && doc.daysUntilExpiry <= 14 ? 'expires in ' + doc.daysUntilExpiry + ' days' : 'needs attention'} - ${doc.statusInfo.priority === 'critical' || doc.statusInfo.priority === 'urgent' ? 'Immediate action required' : 'Start renewal process'}.`
    }));

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getEventsForDate = (day: number) => {
    if (!day) return [];
    return upcomingDeadlines.filter(d => {
      const dDate = new Date(d.expiryDate!);
      return dDate.getDate() === day && 
             dDate.getMonth() === currentMonth.getMonth() && 
             dDate.getFullYear() === currentMonth.getFullYear();
    });
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Document Cards Section */}
      <div>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
            <FileCheck size={16} className="md:w-[18px] md:h-[18px]" />
            <span className="hidden md:inline">Immigration Documents</span>
            <span className="md:hidden">Documents</span>
          </h3>
          <div className="flex gap-1 md:gap-2">
            <Button variant="outline" size="sm" onClick={onRenewal} className="text-xs md:text-sm px-2 md:px-3">
              <Calendar size={14} className="md:mr-2 md:w-4 md:h-4" />
              <span className="hidden md:inline">Yearly Renewal</span>
            </Button>
            <Button size="sm" onClick={onEdit} className="text-xs md:text-sm px-2 md:px-3">
              <Edit2 size={14} className="md:mr-2 md:w-4 md:h-4" />
              <span className="hidden md:inline">Edit</span>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
          {documents.map((doc, idx) => {
            const Icon = doc.icon;
            const isOverdue = doc.daysUntilExpiry !== null && doc.daysUntilExpiry < 0;
            const isUrgent = doc.statusInfo.priority === 'urgent' || doc.statusInfo.priority === 'critical';
            
            return (
              <Card key={idx} className={`p-3 md:p-4 border-2 ${
                isUrgent ? 'border-red-500/50 bg-red-500/10' :
                doc.statusInfo.priority === 'attention' ? 'border-orange-500/50 bg-orange-500/10' :
                'border-green-500/50 bg-green-500/10'
              }`}>
                <div className="flex items-start justify-between mb-2 md:mb-3">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg ${
                    doc.color === 'blue' ? 'bg-blue-500/20' :
                    doc.color === 'green' ? 'bg-green-500/20' :
                    doc.color === 'purple' ? 'bg-purple-500/20' :
                    doc.color === 'cyan' ? 'bg-cyan-500/20' :
                    doc.color === 'indigo' ? 'bg-indigo-500/20' :
                    'bg-gray-500/20'
                  } flex items-center justify-center flex-shrink-0`}>
                    <Icon size={16} className={`md:w-5 md:h-5 ${
                      doc.color === 'blue' ? 'text-blue-400' :
                      doc.color === 'green' ? 'text-green-400' :
                      doc.color === 'purple' ? 'text-purple-400' :
                      doc.color === 'cyan' ? 'text-cyan-400' :
                      doc.color === 'indigo' ? 'text-indigo-400' :
                      'text-gray-400'
                    }`} />
                  </div>
                  {isUrgent && (
                    <Badge variant="destructive" className="text-[10px] md:text-xs px-1 md:px-2 py-0.5">URGENT</Badge>
                  )}
                </div>
                <div className="mb-1.5 md:mb-2">
                  <div className="text-[10px] md:text-xs text-muted-foreground mb-0.5 md:mb-1 line-clamp-1">{doc.type}</div>
                  <div className="font-bold text-xs md:text-sm truncate">{doc.number}</div>
                </div>
                {doc.expiryDate && (
                  <div className="mb-1.5 md:mb-2">
                    <div className="text-[10px] md:text-xs text-muted-foreground">Expires:</div>
                    <div className="text-xs md:text-sm font-semibold">
                      {new Date(doc.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                )}
                <div className="mb-2 md:mb-3">
                  <div className={`text-[10px] md:text-xs font-semibold ${doc.statusInfo.color} line-clamp-1`}>
                    {doc.statusInfo.label}
                  </div>
                  <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {isOverdue ? 'Immediate Action Required' : isUrgent ? 'Action Required' : doc.statusInfo.priority === 'attention' ? 'Pending Documents' : 'Valid'}
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant={isUrgent ? 'destructive' : doc.statusInfo.priority === 'attention' ? 'secondary' : 'outline'}
                  className="w-full text-[10px] md:text-xs h-7 md:h-8"
                  onClick={onEdit}
                >
                  <span className="truncate">
                    {isOverdue ? 'Update Now' : isUrgent ? 'Start Renewal' : doc.statusInfo.priority === 'attention' ? 'Upload Docs' : 'View Details'}
                  </span>
                  <ChevronRight size={10} className="ml-1 md:w-3 md:h-3" />
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tasks & Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Tasks & To-Do List */}
        <Card className="p-3 md:p-4">
          <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3 flex items-center gap-2">
            <ClockIcon size={16} className="md:w-[18px] md:h-[18px]" />
            <span className="text-sm md:text-base">My Tasks & To-Do List</span>
          </h3>
          <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4 max-h-[400px] overflow-y-auto">
            {tasks.slice(0, 5).map((task, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                <input type="checkbox" className="mt-0.5 md:mt-1 w-3.5 h-3.5 md:w-4 md:h-4" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs md:text-sm font-medium line-clamp-1">{task.title}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1 flex-wrap">
                    <span>Due: {task.dueDate ? task.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                    <Badge variant={task.priority === 'HIGH' ? 'destructive' : 'warning'} className="text-[10px] md:text-xs px-1.5 py-0.5">
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
            {/* Mock completed tasks */}
            <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 opacity-60">
              <CheckCircle2 size={14} className="mt-0.5 md:mt-1 text-green-400 md:w-4 md:h-4" />
              <div className="flex-1 min-w-0">
                <div className="text-xs md:text-sm font-medium line-through line-clamp-1">Update contact information</div>
                <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">Completed: Dec 28, 2025</div>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 opacity-60">
              <CheckCircle2 size={14} className="mt-0.5 md:mt-1 text-green-400 md:w-4 md:h-4" />
              <div className="flex-1 min-w-0">
                <div className="text-xs md:text-sm font-medium line-through line-clamp-1">Submit residence permit photos</div>
                <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">Completed: Dec 20, 2025</div>
              </div>
            </div>
          </div>
          <div className="pt-2 md:pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-[10px] md:text-xs mb-1.5 md:mb-2">
              <span className="text-muted-foreground">{completedTasks} of {totalTasks} tasks completed</span>
              <span className="font-semibold">{Math.round((completedTasks / totalTasks) * 100)}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 md:h-2">
              <div 
                className="bg-green-400 h-1.5 md:h-2 rounded-full transition-all"
                style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Calendar View */}
        <Card className="p-3 md:p-4">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
              <CalendarIcon size={16} className="md:w-[18px] md:h-[18px]" />
              <span className="text-sm md:text-base">My Upcoming Deadlines</span>
            </h3>
            <div className="flex items-center gap-1 md:gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="h-7 w-7 md:h-8 md:w-8 p-0">
                <ChevronLeft size={14} className="md:w-4 md:h-4" />
              </Button>
              <span className="text-xs md:text-sm font-medium min-w-[100px] md:min-w-[120px] text-center">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="h-7 w-7 md:h-8 md:w-8 p-0">
                <ChevronRight size={14} className="md:w-4 md:h-4" />
              </Button>
            </div>
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-2 md:mb-3">
            {dayNames.map(day => (
              <div key={day} className="text-[10px] md:text-xs text-center text-muted-foreground p-0.5 md:p-1 font-semibold">
                {day}
              </div>
            ))}
            {getDaysInMonth(currentMonth).map((day, idx) => {
              const events = getEventsForDate(day || 0);
              const isToday = day === new Date().getDate() && 
                            currentMonth.getMonth() === new Date().getMonth() &&
                            currentMonth.getFullYear() === new Date().getFullYear();
              
              return (
                <div 
                  key={idx} 
                  className={`aspect-square p-0.5 md:p-1 text-[10px] md:text-xs ${
                    !day ? 'bg-transparent' :
                    isToday ? 'bg-primary/20 border border-primary rounded' :
                    events.length > 0 ? 'bg-white/5 rounded' :
                    'hover:bg-white/5 rounded'
                  }`}
                >
                  {day && (
                    <>
                      <div className={`font-semibold ${isToday ? 'text-primary' : ''}`}>{day}</div>
                      {events.map((event, eIdx) => {
                        const days = calculateDaysUntilExpiry(event.expiryDate!);
                        const isOverdue = days !== null && days < 0;
                        const isUrgent = days !== null && days <= 14;
                        return (
                          <div 
                            key={eIdx} 
                            className={`text-[7px] md:text-[8px] mt-0.5 md:mt-1 p-0.5 md:p-1 rounded truncate ${
                              isOverdue || isUrgent ? 'bg-red-500/50 text-white' :
                              'bg-orange-500/50 text-white'
                            }`}
                            title={event.type}
                          >
                            {event.type}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Timeline */}
          <div className="pt-2 md:pt-3 border-t border-white/10">
            <div className="space-y-1.5 md:space-y-2">
              {upcomingDeadlines.slice(0, 4).map((deadline, idx) => {
                const days = calculateDaysUntilExpiry(deadline.expiryDate!);
                const isOverdue = days !== null && days < 0;
                const isUrgent = days !== null && days <= 14;
                return (
                  <div key={idx} className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs">
                    <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full flex-shrink-0 ${
                      isOverdue || isUrgent ? 'bg-red-400' :
                      days !== null && days <= 30 ? 'bg-orange-400' :
                      'bg-green-400'
                    }`} />
                    <span className="text-muted-foreground flex-shrink-0">
                      {new Date(deadline.expiryDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="font-medium truncate">- {deadline.type}</span>
                    <Badge variant={isOverdue || isUrgent ? 'destructive' : days !== null && days <= 30 ? 'warning' : 'default'} className="text-[9px] md:text-xs px-1.5 py-0.5 ml-auto flex-shrink-0">
                      {isOverdue ? 'Overdue!' : isUrgent ? 'Action' : 'Safe'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Notifications & Help Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Notifications */}
        <Card className="p-3 md:p-4">
          <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3 flex items-center gap-2">
            <AlertCircle size={16} className="md:w-[18px] md:h-[18px]" />
            <span className="text-sm md:text-base">Notifications</span>
          </h3>
          <div className="space-y-1.5 md:space-y-2">
            {notifications.slice(0, 3).map((notif, idx) => (
              <div key={idx} className={`flex items-start gap-1.5 md:gap-2 p-2 rounded-lg ${
                notif.type === 'error' ? 'bg-red-500/10 border border-red-500/20' :
                'bg-orange-500/10 border border-orange-500/20'
              }`}>
                <AlertCircle size={14} className={`mt-0.5 flex-shrink-0 md:w-4 md:h-4 ${notif.type === 'error' ? 'text-red-400' : 'text-orange-400'}`} />
                <div className="text-[10px] md:text-xs flex-1 leading-relaxed">{notif.message}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Help & Kuwait Law */}
        <div className="space-y-3 md:space-y-4">
          <Card className="p-3 md:p-4">
            <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3 flex items-center gap-2">
              <HelpCircle size={16} className="md:w-[18px] md:h-[18px]" />
              <span className="text-sm md:text-base">Need Help?</span>
            </h3>
            <div className="space-y-1.5 md:space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start text-xs md:text-sm h-8 md:h-9">
                Contact HR Department
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs md:text-sm h-8 md:h-9">
                View Renewal Guidelines
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs md:text-sm h-8 md:h-9">
                Download Required Forms
              </Button>
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3 flex items-center gap-2">
              <Globe size={16} className="md:w-[18px] md:h-[18px]" />
              <span className="text-sm md:text-base">Kuwait Law Information</span>
            </h3>
            <div className="space-y-1.5 md:space-y-2">
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="text-[10px] md:text-xs font-semibold mb-0.5 md:mb-1">6-Month Travel Limit</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">Monitor your days outside Kuwait.</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="text-[10px] md:text-xs font-semibold mb-0.5 md:mb-1">Article 18 Requirements</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">Keep work permit current.</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="text-[10px] md:text-xs font-semibold mb-0.5 md:mb-1">Document Checklist</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">View required documents for renewal.</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [match, params] = useRoute('/employees/:id');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('General');
  const [educationRecords, setEducationRecords] = useState<EmployeeEducation[]>([]);
  const [bankDetails, setBankDetails] = useState<EmployeeBankDetails | null>(null);
  const [immigration, setImmigration] = useState<EmployeeImmigration | null>(null);
  const [isImmigrationModalOpen, setIsImmigrationModalOpen] = useState(false);
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [immigrationForm, setImmigrationForm] = useState<Partial<EmployeeImmigration>>({});
  const [renewalType, setRenewalType] = useState<'work_permit' | 'residence_permit' | 'health_insurance' | 'passport' | 'civil_id'>('work_permit');
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [employeeRequests, setEmployeeRequests] = useState<EmployeeRequest[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employeeShifts, setEmployeeShifts] = useState<EmployeeShift[]>([]);
  const [workingHours, setWorkingHours] = useState<EmployeeWorkingHours | null>(null);
  const [isEducationModalOpen, setIsEducationModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingEducation, setEditingEducation] = useState<EmployeeEducation | null>(null);
  const [educationForm, setEducationForm] = useState({
    institution_name: '',
    place_of_graduation: '',
    graduation_year: new Date().getFullYear(),
    degree_type: '',
    field_of_study: '',
    grade_or_gpa: '',
    is_primary: false,
    notes: ''
  });
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_number: '',
    account_holder_name: '',
    branch_name: '',
    branch_code: '',
    iban: '',
    swift_code: '',
    account_type: '',
    currency: 'USD',
    notes: ''
  });
  const [employeeAttendanceLocation, setEmployeeAttendanceLocation] = useState<EmployeeAttendanceLocation | null>(null);
  const [isAttendanceLocationModalOpen, setIsAttendanceLocationModalOpen] = useState(false);
  const [attendanceLocationForm, setAttendanceLocationForm] = useState({
    location_name: '',
    google_maps_link: '',
    radius_meters: 100,
    is_active: true,
    use_company_default: true
  });
  const [reportingManagerChain, setReportingManagerChain] = useState<Employee[]>([]);
  const [reportingManager, setReportingManager] = useState<Employee | null>(null);
  const [timesheetEntries, setTimesheetEntries] = useState<any[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Attendance state
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceDateFrom, setAttendanceDateFrom] = useState('');
  const [attendanceDateTo, setAttendanceDateTo] = useState('');

  useEffect(() => {
    if (params?.id) {
      loadEmployee(params.id);
    }
  }, [params?.id]);

  useEffect(() => {
    if (employee?.id && activeTab === 'documents') {
      loadDocuments();
    }
    if (employee?.id && activeTab === 'education') {
      loadEducation();
    }
    if (employee?.id && activeTab === 'bank') {
      loadBankDetails();
    }
    if (employee?.id && activeTab === 'immigration') {
      loadImmigration();
    }
    if (employee?.id && activeTab === 'attendance-location') {
      loadEmployeeAttendanceLocation();
    }
    if (employee?.id && activeTab === 'leave-balance') {
      loadLeaveBalance();
    }
    if (employee?.id && activeTab === 'requests') {
      loadRequests();
    }
    if (employee?.id && activeTab === 'working-hours') {
      loadWorkingHours();
    }
    if (employee?.id && activeTab === 'timesheet') {
      loadTimesheetEntries();
    }
  }, [employee?.id, activeTab]);

  useEffect(() => {
    if (employee?.id && user?.company_id) {
      loadLeaveBalance();
    }
  }, [employee?.id, user?.company_id]);

  useEffect(() => {
    if (employee?.id) {
      loadReportingManagerChain();
      loadReportingManager();
    }
  }, [employee?.id]);

  const handleDeleteEmployee = async () => {
    if (!employee?.id) return;
    
    try {
      setDeleting(true);
      await employeeService.delete(employee.id);
      toast.success(t('employees.employeeDeleted') || 'Employee deleted successfully');
      // Navigate back to employees list
      window.location.href = '/employees';
    } catch (error: any) {
      console.error('Failed to delete employee:', error);
      toast.error(error?.message || t('employees.failedToDeleteEmployee') || 'Failed to delete employee');
    } finally {
      setDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const loadEmployee = async (id: string) => {
    try {
      setLoading(true);
      const all = await employeeService.getAll();
      const found = all.find(e => e.id.toString() === id || (e.employee_id || e.employeeId) === id);
      if (found) setEmployee(found);
    } catch (error) {
      console.error('Failed to load employee details', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    if (!employee?.id) return;
    try {
      setDocumentsLoading(true);
      const docs = await documentService.getAll(employee.id);
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents', error);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !employee?.id) return;
    
    try {
      setUploading(true);
      
      // Upload document (handles storage errors gracefully)
      await documentService.upload(
        selectedFile,
        null, // folderId
        selectedCategory, // folderName/category
        employee.id // employeeId
        // Note: uploadedBy is not passed to avoid foreign key constraint issues
        // since user?.id is from auth.users, not employees
      );
      
      // Reload documents
      await loadDocuments();
      
      // Reset form
      setSelectedFile(null);
      setSelectedCategory('General');
      setIsUploadModalOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Show success message
      // Note: Document is saved even if storage bucket doesn't exist
    } catch (error: any) {
      // Only show error if it's not a storage bucket error
      const isStorageError = 
        error?.message?.includes('Bucket not found') ||
        error?.statusCode === 404 ||
        error?.error === 'Bucket not found';
      
      if (!isStorageError) {
        console.error('Failed to upload document', error);
        alert(t('documents.uploadError') || 'Failed to upload document. Please try again.');
      } else {
        // Storage bucket error - document was still saved, just show info
        console.info('Document saved (storage bucket not configured yet)');
        // Still reload and close modal since document was saved
        await loadDocuments();
        setSelectedFile(null);
        setSelectedCategory('General');
        setIsUploadModalOpen(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm(t('documents.confirmDelete') || 'Are you sure you want to delete this document?')) {
      return;
    }
    
    try {
      await documentService.delete(docId);
      await loadDocuments();
    } catch (error) {
      console.error('Failed to delete document', error);
      alert(t('documents.deleteError') || 'Failed to delete document. Please try again.');
    }
  };

  const handleDownload = (url: string, name: string) => {
    // Open in new tab for download
    window.open(url, '_blank');
  };

  const loadEducation = async () => {
    if (!employee?.id) return;
    try {
      const records = await employeeEducationService.getByEmployee(employee.id);
      setEducationRecords(records);
    } catch (error) {
      console.error('Failed to load education records', error);
      toast.error('Failed to load education records');
    }
  };

  const loadBankDetails = async () => {
    if (!employee?.id) return;
    try {
      const details = await employeeBankDetailsService.getByEmployee(employee.id);
      setBankDetails(details);
      if (details) {
        setBankForm({
          bank_name: details.bank_name || '',
          account_number: details.account_number || '',
          account_holder_name: details.account_holder_name || '',
          branch_name: details.branch_name || '',
          branch_code: details.branch_code || '',
          iban: details.iban || '',
          swift_code: details.swift_code || '',
          account_type: details.account_type || '',
          currency: details.currency || 'USD',
          notes: details.notes || ''
        });
      } else {
        // Reset form if no bank details exist
        setBankForm({
          bank_name: '',
          account_number: '',
          account_holder_name: employee.first_name + ' ' + employee.last_name || '',
          branch_name: '',
          branch_code: '',
          iban: '',
          swift_code: '',
          account_type: '',
          currency: 'USD',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Failed to load bank details', error);
      toast.error('Failed to load bank details');
    }
  };

  const loadImmigration = async () => {
    if (!employee?.id) return;
    try {
      const immigrationData = await employeeImmigrationService.getByEmployee(employee.id);
      setImmigration(immigrationData);
      if (immigrationData) {
        setImmigrationForm({
          work_permit_number: immigrationData.work_permit_number,
          work_permit_issue_date: immigrationData.work_permit_issue_date,
          work_permit_expiry_date: immigrationData.work_permit_expiry_date,
          work_permit_status: immigrationData.work_permit_status,
          residence_permit_number: immigrationData.residence_permit_number,
          residence_permit_issue_date: immigrationData.residence_permit_issue_date,
          residence_permit_expiry_date: immigrationData.residence_permit_expiry_date,
          residence_permit_status: immigrationData.residence_permit_status,
          residence_permit_article: immigrationData.residence_permit_article,
          passport_number: immigrationData.passport_number,
          passport_issue_date: immigrationData.passport_issue_date,
          passport_expiry_date: immigrationData.passport_expiry_date,
          passport_issue_country: immigrationData.passport_issue_country,
          passport_status: immigrationData.passport_status,
          health_insurance_number: immigrationData.health_insurance_number,
          health_insurance_provider: immigrationData.health_insurance_provider,
          health_insurance_issue_date: immigrationData.health_insurance_issue_date,
          health_insurance_expiry_date: immigrationData.health_insurance_expiry_date,
          health_insurance_status: immigrationData.health_insurance_status,
          civil_id_number: immigrationData.civil_id_number,
          civil_id_expiry_date: immigrationData.civil_id_expiry_date,
          civil_id_status: immigrationData.civil_id_status,
          visa_type: immigrationData.visa_type,
          sponsor_name: immigrationData.sponsor_name,
          entry_date: immigrationData.entry_date,
          notes: immigrationData.notes
        });
      }
    } catch (error) {
      console.error('Failed to load immigration data', error);
      toast.error('Failed to load immigration data');
    }
  };

  const loadEmployeeAttendanceLocation = async () => {
    if (!employee?.id) return;
    try {
      const location = await employeeAttendanceLocationService.getByEmployee(employee.id);
      setEmployeeAttendanceLocation(location);
      if (location) {
        setAttendanceLocationForm({
          location_name: location.location_name,
          google_maps_link: location.google_maps_link || '',
          radius_meters: location.radius_meters,
          is_active: location.is_active,
          use_company_default: location.use_company_default
        });
      } else {
        // Reset form if no location exists
        setAttendanceLocationForm({
          location_name: '',
          google_maps_link: '',
          radius_meters: 100,
          is_active: true,
          use_company_default: true
        });
      }
    } catch (error) {
      console.error('Failed to load employee attendance location', error);
      toast.error('Failed to load attendance location');
    }
  };

  const handleSaveAttendanceLocation = async () => {
    if (!employee?.id) return;
    try {
      // Parse Google Maps link to extract coordinates
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (attendanceLocationForm.google_maps_link && !attendanceLocationForm.use_company_default) {
        const coords = await attendanceLocationService.parseGoogleMapsLink(attendanceLocationForm.google_maps_link);
        if (coords) {
          latitude = coords.latitude;
          longitude = coords.longitude;
        } else {
          toast.error('Could not parse Google Maps link. Please ensure it contains coordinates.');
          return;
        }
      }

      await employeeAttendanceLocationService.upsert({
        employee_id: employee.id,
        location_name: attendanceLocationForm.location_name,
        google_maps_link: attendanceLocationForm.use_company_default ? null : (attendanceLocationForm.google_maps_link || null),
        latitude,
        longitude,
        radius_meters: attendanceLocationForm.radius_meters,
        is_active: attendanceLocationForm.is_active,
        use_company_default: attendanceLocationForm.use_company_default
      });

      toast.success('Attendance location saved successfully!');
      setIsAttendanceLocationModalOpen(false);
      loadEmployeeAttendanceLocation();
    } catch (error: any) {
      console.error('Failed to save attendance location', error);
      toast.error(error.message || 'Failed to save attendance location');
    }
  };

  const handleSaveImmigration = async () => {
    if (!employee?.id) return;

    try {
      const renewalInfo = employeeImmigrationService.calculateRenewalInfo(immigrationForm as EmployeeImmigration);
      
      await employeeImmigrationService.upsert({
        employee_id: employee.id,
        ...immigrationForm,
        is_expatriate: true,
        next_renewal_date: renewalInfo.nextRenewalDate || undefined,
        next_renewal_action: renewalInfo.nextRenewalAction,
        renewal_priority: renewalInfo.priority,
        last_renewal_processed_by: user?.employee_id || undefined,
        last_renewal_processed_date: new Date().toISOString()
      });
      toast.success('Immigration record saved successfully');
      setIsImmigrationModalOpen(false);
      loadImmigration();
    } catch (error) {
      console.error('Failed to save immigration record', error);
      toast.error('Failed to save immigration record');
    }
  };

  const handleYearlyRenewal = async (type: 'work_permit' | 'residence_permit' | 'health_insurance' | 'passport' | 'civil_id') => {
    if (!immigration || !employee?.id) return;

    try {
      const today = new Date();
      const nextYear = new Date(today);
      nextYear.setFullYear(nextYear.getFullYear() + 1);

      const updates: Partial<EmployeeImmigration> = {
        last_renewal_processed_by: user?.employee_id || undefined,
        last_renewal_processed_date: new Date().toISOString()
      };

      switch (type) {
        case 'work_permit':
          updates.work_permit_last_renewed_date = today.toISOString().split('T')[0];
          updates.work_permit_expiry_date = nextYear.toISOString().split('T')[0];
          updates.work_permit_status = 'Active';
          updates.work_permit_next_renewal_date = nextYear.toISOString().split('T')[0];
          break;
        case 'residence_permit':
          updates.residence_permit_last_renewed_date = today.toISOString().split('T')[0];
          updates.residence_permit_expiry_date = nextYear.toISOString().split('T')[0];
          updates.residence_permit_status = 'Active';
          updates.residence_permit_next_renewal_date = nextYear.toISOString().split('T')[0];
          break;
        case 'health_insurance':
          updates.health_insurance_last_renewed_date = today.toISOString().split('T')[0];
          updates.health_insurance_expiry_date = nextYear.toISOString().split('T')[0];
          updates.health_insurance_status = 'Active';
          updates.health_insurance_next_renewal_date = nextYear.toISOString().split('T')[0];
          break;
        case 'passport':
          // Passport renewal might have different validity period
          updates.passport_status = 'Valid';
          break;
        case 'civil_id':
          updates.civil_id_last_updated_date = today.toISOString().split('T')[0];
          updates.civil_id_status = 'Valid';
          break;
      }

      // Recalculate renewal info
      const updatedImmigration = { ...immigration, ...updates };
      const renewalInfo = employeeImmigrationService.calculateRenewalInfo(updatedImmigration as EmployeeImmigration);
      updates.next_renewal_date = renewalInfo.nextRenewalDate || undefined;
      updates.next_renewal_action = renewalInfo.nextRenewalAction;
      updates.renewal_priority = renewalInfo.priority;

      await employeeImmigrationService.update(immigration.id, updates);
      toast.success(`${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} renewed successfully for 1 year`);
      setIsRenewalModalOpen(false);
      loadImmigration();
    } catch (error) {
      console.error('Failed to renew document', error);
      toast.error('Failed to renew document');
    }
  };

  const handleOpenEducationModal = (education?: EmployeeEducation) => {
    if (education) {
      setEditingEducation(education);
      setEducationForm({
        institution_name: education.institution_name || '',
        place_of_graduation: education.place_of_graduation || '',
        graduation_year: education.graduation_year || new Date().getFullYear(),
        degree_type: education.degree_type || '',
        field_of_study: education.field_of_study || '',
        grade_or_gpa: education.grade_or_gpa || '',
        is_primary: education.is_primary || false,
        notes: education.notes || ''
      });
    } else {
      setEditingEducation(null);
      setEducationForm({
        institution_name: '',
        place_of_graduation: '',
        graduation_year: new Date().getFullYear(),
        degree_type: '',
        field_of_study: '',
        grade_or_gpa: '',
        is_primary: false,
        notes: ''
      });
    }
    setIsEducationModalOpen(true);
  };

  const handleSaveEducation = async () => {
    if (!employee?.id) return;
    if (!educationForm.institution_name || !educationForm.place_of_graduation || !educationForm.graduation_year) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingEducation) {
        await employeeEducationService.update(editingEducation.id, educationForm);
        toast.success('Education record updated successfully');
      } else {
        await employeeEducationService.create({
          ...educationForm,
          employee_id: employee.id
        });
        toast.success('Education record added successfully');
      }
      await loadEducation();
      setIsEducationModalOpen(false);
    } catch (error) {
      console.error('Failed to save education record', error);
      toast.error('Failed to save education record');
    }
  };

  const handleDeleteEducation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this education record?')) return;
    try {
      await employeeEducationService.delete(id);
      toast.success('Education record deleted successfully');
      await loadEducation();
    } catch (error) {
      console.error('Failed to delete education record', error);
      toast.error('Failed to delete education record');
    }
  };

  const handleSaveBankDetails = async () => {
    if (!employee?.id) return;
    if (!bankForm.bank_name || !bankForm.account_number || !bankForm.account_holder_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await employeeBankDetailsService.upsert({
        ...bankForm,
        employee_id: employee.id,
        is_primary: true
      });
      toast.success('Bank details saved successfully');
      await loadBankDetails();
      setIsBankModalOpen(false);
    } catch (error) {
      console.error('Failed to save bank details', error);
      toast.error('Failed to save bank details');
    }
  };

  const loadLeaveBalance = async () => {
    if (!employee?.id || !user?.company_id) return;
    try {
      const balance = await getEmployeeLeaveBalance(employee.id, user.company_id);
      setLeaveBalance(balance);
    } catch (error) {
      console.error('Failed to load leave balance', error);
    }
  };

  const loadRequests = async () => {
    if (!employee?.id) return;
    try {
      const [empReqs, docReqs, leaveReqs] = await Promise.all([
        employeeRequestService.getByEmployee(employee.id),
        documentRequestService.getByEmployee(employee.id),
        leaveService.getByEmployee(employee.id)
      ]);
      setEmployeeRequests(empReqs);
      setDocumentRequests(docReqs);
      setLeaveRequests(leaveReqs);
    } catch (error) {
      console.error('Failed to load requests', error);
    }
  };

  const loadWorkingHours = async () => {
    if (!employee?.id) return;
    try {
      const [shifts, hours] = await Promise.all([
        companySettingsService.getEmployeeShifts(employee.id),
        companySettingsService.getEmployeeWorkingHours(employee.id)
      ]);
      setEmployeeShifts(shifts);
      setWorkingHours(hours);
    } catch (error) {
      console.error('Failed to load working hours', error);
    }
  };

  const loadReportingManager = async () => {
    if (!employee?.reporting_manager_id) {
      setReportingManager(null);
      return;
    }
    try {
      const manager = await employeeService.getById(employee.reporting_manager_id);
      setReportingManager(manager);
    } catch (error) {
      console.error('Failed to load reporting manager', error);
      setReportingManager(null);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert(t('employees.invalidImageFile') || 'Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert(t('employees.imageTooLarge') || 'Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingAvatar(true);
      const avatarUrl = await employeeService.uploadAvatar(employee.id, file);
      
      // Update local employee state
      setEmployee({ ...employee, avatar_url: avatarUrl });
      
      // Reload employee to get fresh data
      await loadEmployee(employee.id);
    } catch (error: any) {
      console.error('Failed to upload avatar:', error);
      alert(error.message || t('employees.avatarUploadFailed') || 'Failed to upload profile image');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const loadReportingManagerChain = async () => {
    if (!employee?.id) return;
    try {
      const chain = await employeeService.getFullReportingHierarchy(employee.id);
      setReportingManagerChain(chain);
    } catch (error) {
      console.error('Failed to load reporting manager chain', error);
    }
  };

  const loadTimesheetEntries = async () => {
    if (!employee?.id) return;
    try {
      const entries = await timesheetService.getByEmployee(employee.id, {
        is_submitted: true // Only show submitted entries to admin
      });
      setTimesheetEntries(entries);
    } catch (error) {
      console.error('Failed to load timesheet entries', error);
    }
  };

  const loadAttendanceLogs = async () => {
    if (!employee?.id) return;
    try {
      setLoadingAttendance(true);
      
      // Use the same approach as AttendancePage - use getAll with employee filter
      // This ensures we use the same aggregation logic with shift information
      const employees = await employeeService.getAll();
      const emp = employees.find(e => e.id === employee.id);
      
      if (!emp) {
        setAttendanceLogs([]);
        return;
      }
      
      // Find integer employee_id
      let integerEmployeeId: number | null = null;
      const externalId = (emp as any).external_id;
      if (externalId && !isNaN(Number(externalId))) {
        integerEmployeeId = Number(externalId);
      } else {
        const employeeIdText = emp.employee_id || emp.employeeId || '';
        const match = employeeIdText.match(/\d+/);
        if (match) {
          integerEmployeeId = parseInt(match[0], 10);
        } else if (!isNaN(Number(employeeIdText))) {
          integerEmployeeId = Number(employeeIdText);
        }
      }
      
      if (!integerEmployeeId) {
        console.warn(`Could not find integer employee_id for UUID: ${employee.id}`);
        setAttendanceLogs([]);
        return;
      }
      
      // Build filters for attendanceService.getAll (same logic as AttendancePage)
      const filters: any = {
        employeeIds: [integerEmployeeId],
        companyId: user?.company_id
      };
      
      if (attendanceDateFrom) {
        filters.dateFrom = attendanceDateFrom;
      }
      
      if (attendanceDateTo) {
        filters.dateTo = attendanceDateTo;
      }
      
      // Fetch using getAll which properly handles aggregation with shifts
      // This will return ALL entries per day (multiple shifts are handled)
      const response = await attendanceService.getAll(filters);
      const logs = response.data || [];
      
      // Filter to only this employee (in case of any edge cases)
      const employeeLogs = logs.filter(log => log.employee_id === employee.id);
      
      // Sort by date descending, then by check-in time descending
      employeeLogs.sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        // Same date - sort by check-in time (latest first)
        const aTime = a.check_in ? new Date(a.check_in).getTime() : (a.check_out ? new Date(a.check_out).getTime() : 0);
        const bTime = b.check_in ? new Date(b.check_in).getTime() : (b.check_out ? new Date(b.check_out).getTime() : 0);
        return bTime - aTime;
      });
      
      setAttendanceLogs(employeeLogs);
    } catch (error) {
      console.error('Failed to load attendance logs:', error);
      toast.error(t('attendance.failedToLoad') || 'Failed to load attendance records');
    } finally {
      setLoadingAttendance(false);
    }
  };

  // Load attendance when tab is active or filters change
  useEffect(() => {
    if (activeTab === 'attendance' && employee?.id) {
      loadAttendanceLogs();
    }
  }, [activeTab, employee?.id, attendanceDateFrom, attendanceDateTo]);

  const handleDownloadAttendanceReport = () => {
    if (attendanceLogs.length === 0) {
      toast.error(t('attendance.noDataToExport') || 'No attendance data to export');
      return;
    }

    // Create CSV content
    const headers = [
      t('attendance.date') || 'Date',
      t('attendance.checkIn') || 'Check In',
      t('attendance.checkOut') || 'Check Out',
      t('attendance.late') || 'Late (min)',
      t('attendance.overtime') || 'Overtime (min)',
      t('attendance.status') || 'Status'
    ];

    const rows = attendanceLogs.map(log => [
      new Date(log.date).toLocaleDateString(),
      log.check_in ? new Date(log.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
      log.check_out ? new Date(log.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
      log.late_minutes > 0 ? log.late_minutes.toString() : '0',
      log.overtime_minutes > 0 ? log.overtime_minutes.toString() : '0',
      log.status
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_report_${employee?.first_name || 'employee'}_${employee?.last_name || ''}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(t('attendance.reportDownloaded') || 'Attendance report downloaded successfully');
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

  // Calculate hours from shift times
  const calculateHours = (startTime: string, endTime: string, breakMinutes: number = 0): number => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    const diffMinutes = endTotal - startTotal - breakMinutes;
    return Math.max(0, diffMinutes / 60);
  };

  // Get shifts for a specific day
  const getShiftsForDay = (dayOfWeek: number): EmployeeShift[] => {
    return employeeShifts.filter(shift => shift.day_of_week === dayOfWeek);
  };

  // Get total hours for a day from shifts
  const getTotalHoursForDay = (dayOfWeek: number): number => {
    const dayShifts = getShiftsForDay(dayOfWeek);
    return dayShifts.reduce((total, shift) => {
      return total + calculateHours(shift.start_time, shift.end_time, shift.break_duration_minutes);
    }, 0);
  };

  // Get hours from old working hours system
  const getHoursFromWorkingHours = (dayOfWeek: number): number => {
    if (!workingHours) return 0;
    switch (dayOfWeek) {
      case 0: return workingHours.sunday_hours || 0;
      case 1: return workingHours.monday_hours || 0;
      case 2: return workingHours.tuesday_hours || 0;
      case 3: return workingHours.wednesday_hours || 0;
      case 4: return workingHours.thursday_hours || 0;
      case 5: return workingHours.friday_hours || 0;
      case 6: return workingHours.saturday_hours || 0;
      default: return 0;
    }
  };

  if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!employee) return <div className="p-8 text-center">{t('common.noData')}</div>;

  const emp = employee; // Shorthand

  return (
    <div className="space-y-6 pb-6">
      {/* Modern Header Profile Card */}
      <div className="relative">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-2xl blur-3xl -z-10" />
        
        <div className="flex items-start gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => window.history.back()}
            className="rounded-full hover:bg-white/10 transition-all"
          >
          <ArrowLeft size={20} />
        </Button>
        
        {/* Delete Button - Only show for admins */}
        {user?.role !== 'employee' && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsDeleteModalOpen(true)}
            className="rounded-full hover:bg-destructive/10 text-destructive hover:text-destructive transition-all"
            title={t('employees.deleteEmployee') || 'Delete Employee'}
          >
            <Trash2 size={20} />
          </Button>
        )}
          
          <Card className="flex-1 border-0 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="relative">
              {/* Decorative gradient overlay */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              
              <CardContent className="p-8 relative">
                <div className="flex items-start gap-6">
                  {/* Enhanced Avatar */}
                  <div className="relative group">
                    <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center text-4xl font-bold text-white shadow-lg shadow-primary/30 border-4 border-white/20 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                      {(emp.avatar_url && emp.avatar_url !== `https://ui-avatars.com/api/?name=${emp.first_name}+${emp.last_name}`) ? (
                        <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="relative z-10">
                          {getEmployeeInitials(emp)}
                        </span>
                      )}
                      {/* Upload Overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-2xl" onClick={() => avatarInputRef.current?.click()}>
                        <Camera size={24} className="text-white" />
                      </div>
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-2xl">
                          <div className="text-white text-sm">{t('common.uploading') || 'Uploading...'}</div>
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-green-500 border-4 border-card flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Employee Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent mb-2" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
                          {getEmployeeDisplayName(emp)}
                        </h1>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
                            <Briefcase size={16} className="text-primary" />
                            <span className="text-sm font-medium">
                              {(emp as any).jobs?.name || emp.designation || emp.position || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <Building2 size={16} className="text-blue-400" />
                            <span className="text-sm font-medium">
                              {(emp as any).departments?.name || emp.department || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge 
                        variant={emp.status === 'Active' ? 'success' : 'warning'} 
                        className="text-base px-5 py-2 rounded-full shadow-lg"
                      >
                        {emp.status}
                  </Badge>
                </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                          <User size={16} className="text-primary" />
                  </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{t('employees.employeeId')}</p>
                          <p className="text-sm font-semibold truncate">{emp.employee_id || emp.employeeId}</p>
                  </div>
                  </div>
                      <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <Calendar size={16} className="text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{t('employees.joinDate')}</p>
                          <p className="text-sm font-semibold">
                            {emp.join_date || emp.hireDate ? new Date(emp.join_date || emp.hireDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          </p>
                        </div>
                      </div>
                      {emp.reporting_manager_id && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Shield size={16} className="text-purple-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{t('employees.manager')}</p>
                            <p className="text-sm font-semibold truncate">
                              {reportingManager 
                                ? getEmployeeDisplayName(reportingManager)
                                : t('employees.assigned')
                              }
                            </p>
                          </div>
                        </div>
                      )}
                      {(emp as any).external_id && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                            <User size={16} className="text-orange-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{t('employees.fingerprintMachineCode')}</p>
                            <p className="text-sm font-semibold">{(emp as any).external_id}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Immigration Statistics - Only show if immigration data exists */}
                    {immigration && (() => {
                      const stats = calculateImmigrationStats(immigration);
                      return (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground">{t('employees.documents')}</div>
                              <div className="text-lg font-bold">{stats.totalDocuments} {t('employeeProfile.total')}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground">{t('employeeProfile.requireAction')}</div>
                              <div className="text-lg font-bold text-orange-400">{stats.requireAction}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground">{t('employeeProfile.valid')}</div>
                              <div className="text-lg font-bold text-green-400">{stats.validDocuments}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground">{t('employeeProfile.nextDeadline')}</div>
                              <div className="text-xs font-bold text-red-400">
                                {stats.nextDeadline ? new Date(stats.nextDeadline.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>
            </CardContent>
            </div>
          </Card>
        </div>
      </div>

      {/* Modern Tabs Navigation - Redesigned */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="relative mb-6">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl blur-xl -z-10" />
          
          {/* Scrollable Tab Container */}
          <div className="relative bg-card/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl overflow-hidden">
            {/* Scrollable Tabs */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {[
                { value: 'personal', icon: User, label: t('employees.personalInfo'), color: 'from-blue-500 to-cyan-500' },
                { value: 'contact', icon: Phone, label: t('employees.contactInfo'), color: 'from-green-500 to-emerald-500' },
                { value: 'employment', icon: Briefcase, label: t('employees.employmentDetails'), color: 'from-purple-500 to-violet-500' },
                { value: 'working-hours', icon: Clock, label: t('employees.workingHours'), color: 'from-orange-500 to-amber-500' },
                { value: 'payroll', icon: DollarSign, label: t('employees.payrollInfo') || 'Payroll', color: 'from-yellow-500 to-yellow-400' },
                { value: 'leave-balance', icon: Calendar, label: t('employees.leaveBalance'), color: 'from-pink-500 to-rose-500' },
                { value: 'education', icon: GraduationCap, label: t('employees.education'), color: 'from-indigo-500 to-blue-500' },
                { value: 'bank', icon: CreditCard, label: t('employees.bank'), color: 'from-teal-500 to-cyan-500' },
                { value: 'immigration', icon: Globe, label: t('employees.immigration'), color: 'from-violet-500 to-purple-500' },
                { value: 'attendance-location', icon: MapPin, label: t('employees.attendanceLocation'), color: 'from-red-500 to-orange-500' },
                { value: 'timesheet', icon: Clock, label: t('employees.timesheet'), color: 'from-slate-500 to-gray-500' },
                { value: 'attendance', icon: CheckCircle2, label: t('employees.attendance') || 'Attendance', color: 'from-emerald-500 to-green-500' },
                { value: 'requests', icon: FileTextIcon, label: t('employees.requests'), color: 'from-cyan-500 to-blue-500' },
                { value: 'documents', icon: FileText, label: t('employees.documents'), color: 'from-blue-500 to-indigo-500' },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;
                
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`
                      group relative flex-shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-xl
                      transition-all duration-300 ease-out
                      ${isActive 
                        ? `bg-gradient-to-br ${tab.color} text-white shadow-lg shadow-primary/30 scale-105` 
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                      }
                      min-w-[100px] md:min-w-[120px]
                    `}
                  >
                    {/* Active Indicator Glow */}
                    {isActive && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${tab.color} opacity-20 blur-md -z-10 rounded-xl`} />
                    )}
                    
                    {/* Icon Container */}
                    <div className={`
                      relative w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center
                      transition-all duration-300
                      ${isActive 
                        ? 'bg-white/20 shadow-lg' 
                        : 'bg-white/5 group-hover:bg-white/10'
                      }
                    `}>
                      <Icon 
                        size={isActive ? 22 : 20} 
                        className={`
                          transition-all duration-300
                          ${isActive ? 'text-white scale-110' : 'text-muted-foreground group-hover:text-foreground'}
                        `}
                      />
                      {/* Active Pulse Effect */}
                      {isActive && (
                        <div className="absolute inset-0 rounded-xl bg-white/30 animate-ping opacity-75" />
                      )}
                    </div>
                    
                    {/* Label */}
                    <span className={`
                      text-[10px] md:text-xs font-semibold text-center leading-tight
                      transition-all duration-300
                      ${isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'}
                      line-clamp-2 max-w-[100px] md:max-w-[120px]
                    `}>
                      {tab.label}
                    </span>
                    
                    {/* Active Bottom Border */}
                    {isActive && (
                      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r ${tab.color} rounded-full`} />
                    )}
                    
                    {/* Hover Effect */}
                    {!isActive && (
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/5 group-hover:to-transparent transition-all duration-300" />
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Scroll Indicator Shadows */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card/80 to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card/80 to-transparent pointer-events-none z-10" />
          </div>
        </div>

        {/* Personal Info Tab */}
        <TabsContent value="personal" className="mt-6 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-xl">
                <User size={24} className="text-primary" />
                {t('employees.personalInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <User size={14} className="text-primary" />
                    {t('common.firstName')}
                  </label>
                  <p className="text-lg font-semibold mt-2" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>{getEmployeeFirstName(emp)}</p>
                </div>
                {(emp.middle_name || emp.middleName) && (
                  <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <User size={14} className="text-primary" />
                      {t('employees.middleName') || 'Middle Name'}
                    </label>
                    <p className="text-lg font-semibold mt-2" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
                      {i18n.language === 'ar' 
                        ? (emp.arabic_middle_name || emp.arabicMiddleName || emp.middle_name || emp.middleName)
                        : (emp.middle_name || emp.middleName || emp.arabic_middle_name || emp.arabicMiddleName)
                      }
                    </p>
                  </div>
                )}
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <User size={14} className="text-primary" />
                    {t('common.lastName')}
                  </label>
                  <p className="text-lg font-semibold mt-2" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>{getEmployeeLastName(emp)}</p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} className="text-blue-400" />
                    {t('employees.dateOfBirth')}
                  </label>
                  <p className="text-lg font-semibold mt-2">
                    {emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }) : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <User size={14} className="text-purple-400" />
                    {t('employees.gender')}
                  </label>
                  <p className="text-lg font-semibold mt-2">{emp.gender || 'N/A'}</p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-orange-500/5 to-transparent border border-orange-500/10">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <User size={14} className="text-orange-400" />
                    {t('employees.maritalStatus')}
                  </label>
                  <p className="text-lg font-semibold mt-2">{emp.marital_status || 'N/A'}</p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/10">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <MapPin size={14} className="text-green-400" />
                    {t('employees.nationality')}
                  </label>
                  <p className="text-lg font-semibold mt-2">{emp.nationality || 'N/A'}</p>
                </div>
              </div>
              
              {/* Show alternate name (Arabic when in English mode, English when in Arabic mode) */}
              {(() => {
                const currentLang = i18n.language || 'en';
                const isArabic = currentLang === 'ar';
                const showAlternate = isArabic 
                  ? (emp.first_name || emp.firstName) // Show English name when in Arabic mode
                  : (emp.arabic_first_name || emp.arabicFirstName || emp.arabic_middle_name || emp.arabicMiddleName || emp.arabic_last_name || emp.arabicLastName); // Show Arabic name when in English mode
                
                if (!showAlternate) return null;
                
                return (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <h3 className="text-sm font-semibold mb-4">
                      {isArabic ? (t('common.name') || 'Name') + ' (English)' : (t('employees.arabicName') || 'Arabic Name')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {isArabic ? (
                        <>
                          {emp.first_name && (
                            <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <User size={14} className="text-blue-400" />
                                {t('common.firstName')}
                              </label>
                              <p className="text-lg font-semibold mt-2">{emp.first_name || emp.firstName}</p>
                            </div>
                          )}
                          {emp.middle_name && (
                            <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <User size={14} className="text-blue-400" />
                                {t('employees.middleName') || 'Middle Name'}
                              </label>
                              <p className="text-lg font-semibold mt-2">{emp.middle_name || emp.middleName}</p>
                            </div>
                          )}
                          {emp.last_name && (
                            <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <User size={14} className="text-blue-400" />
                                {t('common.lastName')}
                              </label>
                              <p className="text-lg font-semibold mt-2">{emp.last_name || emp.lastName}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {(emp.arabic_first_name || emp.arabicFirstName) && (
                            <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <User size={14} className="text-blue-400" />
                                {t('employees.arabicFirstName') || 'Arabic First Name'}
                              </label>
                              <p className="text-lg font-semibold mt-2" dir="rtl">{emp.arabic_first_name || emp.arabicFirstName}</p>
                            </div>
                          )}
                          {(emp.arabic_middle_name || emp.arabicMiddleName) && (
                            <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <User size={14} className="text-blue-400" />
                                {t('employees.arabicMiddleName') || 'Arabic Middle Name'}
                              </label>
                              <p className="text-lg font-semibold mt-2" dir="rtl">{emp.arabic_middle_name || emp.arabicMiddleName}</p>
                            </div>
                          )}
                          {(emp.arabic_last_name || emp.arabicLastName) && (
                            <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <User size={14} className="text-blue-400" />
                                {t('employees.arabicLastName') || 'Arabic Last Name'}
                              </label>
                              <p className="text-lg font-semibold mt-2" dir="rtl">{emp.arabic_last_name || emp.arabicLastName}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Information Tab */}
        <TabsContent value="contact" className="mt-6 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Phone size={24} className="text-blue-400" />
                {t('employees.contactInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10 hover:border-blue-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Mail size={14} className="text-blue-400" />
                    {t('common.email')}
                  </label>
                  <p className="text-lg font-semibold mt-2 break-all">{emp.email}</p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/10 hover:border-green-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Phone size={14} className="text-green-400" />
                    {t('employees.phone')}
                  </label>
                  <p className="text-lg font-semibold mt-2">{emp.phone || 'N/A'}</p>
                </div>
                {emp.alternate_phone && (
                  <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10 hover:border-purple-500/20 transition-colors">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Phone size={14} className="text-purple-400" />
                      {t('employees.alternatePhone')}
                    </label>
                    <p className="text-lg font-semibold mt-2">{emp.alternate_phone}</p>
                  </div>
                )}
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-orange-500/5 to-transparent border border-orange-500/10 hover:border-orange-500/20 transition-colors md:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <MapPin size={14} className="text-orange-400" />
                    {t('employees.address')}
                  </label>
                  <p className="text-lg font-semibold mt-2">{emp.address || 'N/A'}</p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-cyan-500/5 to-transparent border border-cyan-500/10 hover:border-cyan-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('employees.city')}</label>
                  <p className="text-lg font-semibold mt-2">{emp.city || 'N/A'}</p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-pink-500/5 to-transparent border border-pink-500/10 hover:border-pink-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('employees.state')}</label>
                  <p className="text-lg font-semibold mt-2">{emp.state || 'N/A'}</p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-indigo-500/5 to-transparent border border-indigo-500/10 hover:border-indigo-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('employees.country')}</label>
                  <p className="text-lg font-semibold mt-2">{emp.country || 'N/A'}</p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-teal-500/5 to-transparent border border-teal-500/10 hover:border-teal-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('employees.postalCode')}</label>
                  <p className="text-lg font-semibold mt-2">{emp.postal_code || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Shield size={24} className="text-red-400" />
                {t('employees.emergencyContact')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-red-500/5 to-transparent border border-red-500/10">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('common.name')}</label>
                  <p className="text-lg font-semibold mt-2">{emp.emergency_contact_name || 'N/A'}</p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-red-500/5 to-transparent border border-red-500/10">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('employees.phone')}</label>
                  <p className="text-lg font-semibold mt-2">{emp.emergency_contact_phone || 'N/A'}</p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-red-500/5 to-transparent border border-red-500/10">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('employees.relationship')}</label>
                  <p className="text-lg font-semibold mt-2">{emp.emergency_contact_relationship || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employment Details Tab */}
        <TabsContent value="employment" className="mt-6 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Briefcase size={24} className="text-indigo-400" />
                {t('employees.employmentDetails')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-indigo-500/5 to-transparent border border-indigo-500/10 hover:border-indigo-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Building2 size={14} className="text-indigo-400" />
                    {t('employees.department')}
                  </label>
                  <p className="text-lg font-semibold mt-2">{(emp as any).departments?.name || emp.department || 'N/A'}</p>
                  {(emp as any).department_id && (
                    <p className="text-xs text-muted-foreground mt-1">ID: {(emp as any).department_id.substring(0, 8)}...</p>
                  )}
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10 hover:border-purple-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Briefcase size={14} className="text-purple-400" />
                    {t('common.role')}
                  </label>
                  <p className="text-lg font-semibold mt-2">{(emp as any).roles?.name || (emp.role_id ? 'Role ID: ' + emp.role_id : 'N/A')}</p>
                  {emp.role_id && (
                    <p className="text-xs text-muted-foreground mt-1">ID: {emp.role_id.substring(0, 8)}...</p>
                  )}
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10 hover:border-blue-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Briefcase size={14} className="text-blue-400" />
                    {t('common.job')}
                  </label>
                  <p className="text-lg font-semibold mt-2">{(emp as any).jobs?.name || emp.position || emp.designation || 'N/A'}</p>
                  {(emp as any).job_id && (
                    <p className="text-xs text-muted-foreground mt-1">ID: {(emp as any).job_id.substring(0, 8)}...</p>
                  )}
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/10 hover:border-green-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('employees.employmentType')}</label>
                  <Badge variant="outline" className="mt-2">{emp.employment_type || emp.employmentType || 'N/A'}</Badge>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-orange-500/5 to-transparent border border-orange-500/10 hover:border-orange-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} className="text-orange-400" />
                    {t('employees.joinDate')}
                  </label>
                  <p className="text-lg font-semibold mt-2">
                    {emp.join_date || emp.hireDate ? new Date(emp.join_date || emp.hireDate!).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }) : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-yellow-500/5 to-transparent border border-yellow-500/10 hover:border-yellow-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <DollarSign size={14} className="text-yellow-400" />
                    {t('employees.salary')} (Total)
                  </label>
                  <p className="text-xl font-bold text-yellow-400 mt-2">
                    {emp.salary ? `${parseFloat(emp.salary.toString()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                  </p>
                </div>
                {(emp as any).base_salary && (
                  <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-emerald-500/5 to-transparent border border-emerald-500/10 hover:border-emerald-500/20 transition-colors">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base Salary</label>
                    <p className="text-lg font-semibold text-emerald-400 mt-2">
                      {parseFloat((emp as any).base_salary || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-cyan-500/5 to-transparent border border-cyan-500/10 hover:border-cyan-500/20 transition-colors">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('employees.workLocation')}</label>
                  <Badge variant="outline" className="mt-2">{emp.work_location || 'N/A'}</Badge>
                </div>
                {/* Reporting Manager Chain */}
                {reportingManagerChain.length > 0 && (
                  <div className="md:col-span-2 space-y-1 p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10 hover:border-purple-500/20 transition-colors">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
                      <Shield size={14} className="text-purple-400" />
                      Reporting Manager Chain
                    </label>
                    <div className="space-y-2">
                      {reportingManagerChain.map((manager, index) => (
                        <div key={manager.id} className="flex items-center gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                              {manager.avatar_url && manager.avatar_url !== `https://ui-avatars.com/api/?name=${manager.first_name}+${manager.last_name}` ? (
                                <img src={manager.avatar_url} alt="" className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <span className="text-xs font-bold text-purple-400">
                                  {getEmployeeInitials(manager)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
                                {getEmployeeDisplayName(manager)}
                                {index === 0 && <span className="ml-2 text-xs text-muted-foreground">(Current Employee)</span>}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {(manager as any).jobs?.name || manager.position || manager.designation || 'N/A'} • {(manager as any).departments?.name || manager.department || 'N/A'}
                              </p>
                            </div>
                          </div>
                          {index < reportingManagerChain.length - 1 && (
                            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(emp as any).external_id && (
                  <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-amber-500/5 to-transparent border border-amber-500/10 hover:border-amber-500/20 transition-colors">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fingerprint Machine Code</label>
                    <p className="text-lg font-semibold text-amber-400 mt-2 font-mono">{(emp as any).external_id}</p>
                  </div>
                )}
                {(emp as any).contract_start_date && (
                  <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-teal-500/5 to-transparent border border-teal-500/10 hover:border-teal-500/20 transition-colors">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Calendar size={14} className="text-teal-400" />
                      Contract Start Date
                    </label>
                    <p className="text-lg font-semibold mt-2">
                      {new Date((emp as any).contract_start_date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                )}
                {(emp as any).contract_end_date && (
                  <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-rose-500/5 to-transparent border border-rose-500/10 hover:border-rose-500/20 transition-colors">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Calendar size={14} className="text-rose-400" />
                      Contract End Date
                    </label>
                    <p className="text-lg font-semibold mt-2">
                      {new Date((emp as any).contract_end_date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                )}
                {(emp as any).company_id && (
                  <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-violet-500/5 to-transparent border border-violet-500/10 hover:border-violet-500/20 transition-colors">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company ID</label>
                    <p className="text-sm font-semibold text-muted-foreground mt-2 font-mono">{(emp as any).company_id.substring(0, 8)}...</p>
                  </div>
                )}
                {(emp as any).synced_from_external !== undefined && (
                  <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-slate-500/5 to-transparent border border-slate-500/10 hover:border-slate-500/20 transition-colors">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Synced from External</label>
                    <div className="mt-2">
                      <Badge variant={(emp as any).synced_from_external ? 'success' : 'outline'} className="text-sm">
                        {(emp as any).synced_from_external ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                )}
                {(emp as any).last_synced_at && (
                  <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-slate-500/5 to-transparent border border-slate-500/10 hover:border-slate-500/20 transition-colors">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Clock size={14} className="text-slate-400" />
                      Last Synced At
                    </label>
                    <p className="text-sm font-semibold mt-2 text-muted-foreground">
                      {new Date((emp as any).last_synced_at).toLocaleString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
                {emp.notes && (
                  <div className="md:col-span-2 space-y-1 p-4 rounded-lg bg-gradient-to-br from-slate-500/5 to-transparent border border-slate-500/10">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('employees.notes')}</label>
                    <p className="text-base mt-2 leading-relaxed">{emp.notes}</p>
                  </div>
                )}
                {((emp as any).skills && Array.isArray((emp as any).skills) && (emp as any).skills.length > 0) && (
                  <div className="md:col-span-2 space-y-1 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Briefcase size={14} className="text-primary" />
                      Skills
                    </label>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(emp as any).skills.map((skill: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-3 py-1 text-sm bg-primary/10 border-primary/20 hover:bg-primary/20 transition-colors">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {((emp as any).certifications && Array.isArray((emp as any).certifications) && (emp as any).certifications.length > 0) && (
                  <div className="md:col-span-2 space-y-1 p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <FileText size={14} className="text-blue-400" />
                      Certifications
                    </label>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(emp as any).certifications.map((cert: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-3 py-1 text-sm bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Working Hours Tab */}
        <TabsContent value="working-hours" className="mt-6 space-y-6">
          {/* Shifts-based Working Hours */}
          {employeeShifts.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Clock size={24} className="text-cyan-400" />
                  {t('employees.workingHours')} - Shifts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {[
                  { day: 0, label: t('employees.sunday') || 'Sunday', name: 'sunday' },
                  { day: 1, label: t('employees.monday') || 'Monday', name: 'monday' },
                  { day: 2, label: t('employees.tuesday') || 'Tuesday', name: 'tuesday' },
                  { day: 3, label: t('employees.wednesday') || 'Wednesday', name: 'wednesday' },
                  { day: 4, label: t('employees.thursday') || 'Thursday', name: 'thursday' },
                  { day: 5, label: t('employees.friday') || 'Friday', name: 'friday' },
                  { day: 6, label: t('employees.saturday') || 'Saturday', name: 'saturday' }
                ].map(({ day, label, name }) => {
                  const dayShifts = getShiftsForDay(day);
                  const totalHours = getTotalHoursForDay(day);
                  
                  return (
                    <div key={day} className="border border-white/10 rounded-xl p-5 bg-gradient-to-br from-cyan-500/5 to-transparent hover:border-cyan-500/20 transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <Calendar size={18} className="text-cyan-400" />
                          {label}
                        </h3>
                        <Badge variant="outline" className="text-sm px-3 py-1 bg-cyan-500/10 border-cyan-500/20">
                          {totalHours.toFixed(2)} {t('employees.hours') || 'hours'}
                        </Badge>
                      </div>
                      {dayShifts.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No shifts scheduled</p>
                      ) : (
                        <div className="space-y-3">
                          {dayShifts.map((shift, idx) => {
                            const shiftHours = calculateHours(shift.start_time, shift.end_time, shift.break_duration_minutes);
                            const parseTime = (time: string) => {
                              const parts = time.split(':');
                              return `${parts[0]}:${parts[1]}`;
                            };
                            return (
                              <div key={shift.id || idx} className="bg-white/5 rounded-lg p-4 flex justify-between items-center border border-white/10 hover:bg-white/10 transition-colors">
                                <div className="flex-1">
                                  {shift.shift_name && (
                                    <p className="font-semibold text-base mb-2 text-cyan-400">{shift.shift_name}</p>
                                  )}
                                  <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                      <Clock size={14} className="text-muted-foreground" />
                                      <span className="font-medium">{parseTime(shift.start_time)} - {parseTime(shift.end_time)}</span>
                                    </div>
                                    {shift.break_duration_minutes > 0 && (
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <span>Break: {shift.break_duration_minutes} min</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="success" className="ml-4 px-3 py-1.5 text-sm font-semibold">
                                  {shiftHours.toFixed(2)}h
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : workingHours ? (
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Clock size={24} className="text-cyan-400" />
                  {t('employees.workingHours')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { day: 0, label: t('employees.sunday') || 'Sunday', hours: workingHours.sunday_hours || 0 },
                    { day: 1, label: t('employees.monday') || 'Monday', hours: workingHours.monday_hours || 0 },
                    { day: 2, label: t('employees.tuesday') || 'Tuesday', hours: workingHours.tuesday_hours || 0 },
                    { day: 3, label: t('employees.wednesday') || 'Wednesday', hours: workingHours.wednesday_hours || 0 },
                    { day: 4, label: t('employees.thursday') || 'Thursday', hours: workingHours.thursday_hours || 0 },
                    { day: 5, label: t('employees.friday') || 'Friday', hours: workingHours.friday_hours || 0 },
                    { day: 6, label: t('employees.saturday') || 'Saturday', hours: workingHours.saturday_hours || 0 }
                  ].map(({ day, label, hours }) => (
                    <div key={day}>
                      <label className="text-xs text-muted-foreground uppercase font-bold">{label}</label>
                      <p className="text-lg">{hours} {t('employees.hours') || 'hours'}</p>
                    </div>
                  ))}
                </div>
                {workingHours.flexible_hours && (
                  <div className="pt-4 border-t border-white/10 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t('employees.flexibleHours')}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {workingHours.start_time && (
              <div>
                          <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.startTime')}</label>
                          <p className="text-lg">{workingHours.start_time.split(':').slice(0, 2).join(':')}</p>
              </div>
                      )}
                      {workingHours.end_time && (
              <div>
                          <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.endTime')}</label>
                          <p className="text-lg">{workingHours.end_time.split(':').slice(0, 2).join(':')}</p>
              </div>
                      )}
                      {workingHours.break_duration_minutes > 0 && (
              <div>
                          <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.breakDuration')}</label>
                          <p className="text-lg">{workingHours.break_duration_minutes} {t('common.minutes') || 'minutes'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No working hours configured</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Payroll Info Tab */}
        <TabsContent value="payroll" className="mt-6 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-xl">
                <DollarSign size={24} className="text-emerald-400" />
                {t('employees.salaryStructure') || 'Salary Structure'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* EARNINGS Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-green-600 rounded-full" />
                    <h3 className="text-xl font-bold text-green-400">{t('employees.earnings') || 'EARNINGS'}</h3>
                  </div>
                  <div className="space-y-3">
                    {(emp as any).base_salary && (
                      <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 rounded-xl p-4 hover:border-green-500/50 transition-all shadow-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">{t('employees.baseSalary')}</span>
                          <span className="text-white font-bold text-lg">{parseFloat((emp as any).base_salary || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(emp as any).housing_allowance && parseFloat((emp as any).housing_allowance || '0') > 0 && (
                      <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 rounded-xl p-4 hover:border-green-500/50 transition-all">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">{t('employees.housingAllowance')}</span>
                          <span className="text-white font-bold">{parseFloat((emp as any).housing_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(emp as any).transport_allowance && parseFloat((emp as any).transport_allowance || '0') > 0 && (
                      <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 rounded-xl p-4 hover:border-green-500/50 transition-all">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">{t('employees.transportAllowance')}</span>
                          <span className="text-white font-bold">{parseFloat((emp as any).transport_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(emp as any).meal_allowance && parseFloat((emp as any).meal_allowance || '0') > 0 && (
                      <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 rounded-xl p-4 hover:border-green-500/50 transition-all">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">{t('employees.mealAllowance')}</span>
                          <span className="text-white font-bold">{parseFloat((emp as any).meal_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(emp as any).medical_allowance && parseFloat((emp as any).medical_allowance || '0') > 0 && (
                      <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 rounded-xl p-4 hover:border-green-500/50 transition-all">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">{t('employees.medicalAllowance')}</span>
                          <span className="text-white font-bold">{parseFloat((emp as any).medical_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(emp as any).other_allowances && parseFloat((emp as any).other_allowances || '0') > 0 && (
                      <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 rounded-xl p-4 hover:border-green-500/50 transition-all">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">{t('employees.otherAllowances')}</span>
                          <span className="text-white font-bold">{parseFloat((emp as any).other_allowances || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(!(emp as any).base_salary && !(emp as any).housing_allowance && !(emp as any).transport_allowance && !(emp as any).meal_allowance && !(emp as any).medical_allowance && !(emp as any).other_allowances) && (
                      <div className="text-muted-foreground text-center py-4">{t('common.noData')}</div>
                    )}
                  </div>
                </div>

                {/* DEDUCTIONS Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-gradient-to-b from-red-400 to-red-600 rounded-full" />
                    <h3 className="text-xl font-bold text-red-400">{t('employees.deductions') || 'DEDUCTIONS'}</h3>
                  </div>
                  <div className="space-y-3">
                    {/* Social Security / GOSI */}
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const gosiRate = 0.105; // 10.5% GOSI rate (can be made configurable)
                      const gosiAmount = baseSalary * gosiRate;
                      return gosiAmount > 0 ? (
                        <div className="bg-gradient-to-br from-red-500/20 to-red-500/10 border border-red-500/30 rounded-xl p-4 hover:border-red-500/50 transition-all shadow-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-semibold">{t('employees.socialSecurity') || 'Social Security (GOSI)'}</span>
                            <span className="text-white font-bold text-lg">{gosiAmount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {/* Tax Deduction */}
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const taxRate = 0; // Can be fetched from role_salary_config
                      const taxAmount = baseSalary * taxRate;
                      return taxAmount > 0 ? (
                        <div className="bg-gradient-to-br from-red-500/20 to-red-500/10 border border-red-500/30 rounded-xl p-4 hover:border-red-500/50 transition-all">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-semibold">{t('employees.tax') || 'Tax'}</span>
                            <span className="text-white font-bold">{taxAmount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {/* Insurance Deduction */}
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const insuranceRate = 0; // Can be fetched from role_salary_config
                      const insuranceAmount = baseSalary * insuranceRate;
                      return insuranceAmount > 0 ? (
                        <div className="bg-gradient-to-br from-red-500/20 to-red-500/10 border border-red-500/30 rounded-xl p-4 hover:border-red-500/50 transition-all">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-semibold">{t('employees.insurance') || 'Insurance'}</span>
                            <span className="text-white font-bold">{insuranceAmount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const gosiRate = 0.105;
                      const gosiAmount = baseSalary * gosiRate;
                      return gosiAmount === 0 ? (
                        <div className="text-muted-foreground text-center py-4">{t('common.noData')}</div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              {/* Net Salary */}
              <div className="pt-6 mt-6 border-t-2 border-white/20">
                <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent rounded-xl p-6 border border-primary/30">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-white flex items-center gap-2">
                      <DollarSign size={24} className="text-primary" />
                      {t('employees.netSalary') || 'Net Salary'}
                    </span>
                    <span className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                      {(() => {
                        const baseSalary = parseFloat((emp as any).base_salary || '0');
                        const housing = parseFloat((emp as any).housing_allowance || '0');
                        const transport = parseFloat((emp as any).transport_allowance || '0');
                        const meal = parseFloat((emp as any).meal_allowance || '0');
                        const medical = parseFloat((emp as any).medical_allowance || '0');
                        const other = parseFloat((emp as any).other_allowances || '0');
                        const totalEarnings = baseSalary + housing + transport + meal + medical + other;
                        
                        const gosiRate = 0.105;
                        const gosiAmount = baseSalary * gosiRate;
                        const totalDeductions = gosiAmount;
                        
                        const netSalary = totalEarnings - totalDeductions;
                        return netSalary.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                      })()} KD
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Balance Tab */}
        <TabsContent value="leave-balance" className="mt-6 space-y-6">
          {leaveBalance ? (
            <>
              {/* Annual Leave */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-b border-white/10">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Calendar size={24} className="text-blue-400" />
                    {t('leaves.annualLeave')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-5 bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-xl border border-blue-500/30 hover:border-blue-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('leaves.accrued')}</p>
                      <p className="text-3xl font-bold text-blue-400 mb-1">{leaveBalance.annual_leave.accrued.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{t('leaves.days')}</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-orange-500/20 to-orange-500/10 rounded-xl border border-orange-500/30 hover:border-orange-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('leaves.used')}</p>
                      <p className="text-3xl font-bold text-orange-400 mb-1">{leaveBalance.annual_leave.used}</p>
                      <p className="text-xs text-muted-foreground">{t('leaves.days')}</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-yellow-500/20 to-yellow-500/10 rounded-xl border border-yellow-500/30 hover:border-yellow-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('leaves.pending')}</p>
                      <p className="text-3xl font-bold text-yellow-400 mb-1">{leaveBalance.annual_leave.pending}</p>
                      <p className="text-xs text-muted-foreground">{t('leaves.days')}</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-xl border border-green-500/30 hover:border-green-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('leaves.available')}</p>
                      <p className="text-3xl font-bold text-green-400 mb-1">{leaveBalance.annual_leave.available.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{t('leaves.days')}</p>
                    </div>
                  </div>
                  {leaveBalance.annual_leave.expired && leaveBalance.annual_leave.expired > 0 && (
                    <div className="p-4 bg-gradient-to-r from-red-500/20 to-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                        <span className="text-xl">⚠️</span>
              </div>
              <div>
                        <p className="text-sm font-semibold text-red-400">
                          {t('leaves.expiredLeave')}: {leaveBalance.annual_leave.expired.toFixed(2)} {t('leaves.days')}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('leaves.expiredLeaveDesc')}</p>
              </div>
                    </div>
                  )}
                  {leaveBalance.annual_leave.expiringSoon && leaveBalance.annual_leave.expiringSoon > 0 && (
                    <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <span className="text-xl">⏰</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-yellow-400">
                          {t('leaves.expiringSoon')}: {leaveBalance.annual_leave.expiringSoon.toFixed(2)} {t('leaves.days')}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('leaves.expiringSoonDesc')}</p>
                      </div>
                    </div>
                  )}
                  {!leaveBalance.annual_leave.eligible && (
                    <div className="p-4 bg-gradient-to-r from-slate-500/20 to-slate-500/10 border border-slate-500/30 rounded-xl flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-500/20 flex items-center justify-center">
                        <span className="text-xl">ℹ️</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          {t('leaves.notEligibleYet')}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('leaves.annualLeaveRestriction')}</p>
                      </div>
                    </div>
                  )}
            </CardContent>
          </Card>

              {/* Sick Leave */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent border-b border-white/10">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Clock size={24} className="text-purple-400" />
                    Sick Leave
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-5 bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-xl border border-blue-500/30 hover:border-blue-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Accrued</p>
                      <p className="text-3xl font-bold text-blue-400 mb-1">{leaveBalance.sick_leave.accrued.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-orange-500/20 to-orange-500/10 rounded-xl border border-orange-500/30 hover:border-orange-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Used</p>
                      <p className="text-3xl font-bold text-orange-400 mb-1">{leaveBalance.sick_leave.used}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-yellow-500/20 to-yellow-500/10 rounded-xl border border-yellow-500/30 hover:border-yellow-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pending</p>
                      <p className="text-3xl font-bold text-yellow-400 mb-1">{leaveBalance.sick_leave.pending}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-xl border border-green-500/30 hover:border-green-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Available</p>
                      <p className="text-3xl font-bold text-green-400 mb-1">{leaveBalance.sick_leave.available.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Leave */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-b border-white/10">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Clock size={24} className="text-rose-400" />
                    Emergency Leave
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-5 bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-xl border border-blue-500/30 hover:border-blue-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Accrued</p>
                      <p className="text-3xl font-bold text-blue-400 mb-1">{leaveBalance.emergency_leave.accrued.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">days</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-orange-500/20 to-orange-500/10 rounded-xl border border-orange-500/30 hover:border-orange-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Used</p>
                      <p className="text-3xl font-bold text-orange-400 mb-1">{leaveBalance.emergency_leave.used}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-yellow-500/20 to-yellow-500/10 rounded-xl border border-yellow-500/30 hover:border-yellow-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pending</p>
                      <p className="text-3xl font-bold text-yellow-400 mb-1">{leaveBalance.emergency_leave.pending}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-xl border border-green-500/30 hover:border-green-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Available</p>
                      <p className="text-3xl font-bold text-green-400 mb-1">{leaveBalance.emergency_leave.available.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Leave balance information not available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timesheet Tab */}
        <TabsContent value="timesheet" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={20} /> Submitted Timesheet Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timesheetEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No submitted timesheet reports found</p>
                  <p className="text-xs mt-2">Only submitted reports are visible to admin</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {timesheetEntries.map((entry) => (
                    <div key={entry.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar size={16} className="text-muted-foreground" />
                            <span className="font-semibold">
                              {new Date(entry.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                            <Badge variant={entry.report_type === 'weekly' ? 'secondary' : 'default'}>
                              {entry.report_type || 'daily'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock size={14} />
                              {entry.hours_worked}h
                            </span>
                            {entry.project_name && (
                              <span>Project: {entry.project_name}</span>
                            )}
                            {entry.task_type && (
                              <Badge variant="outline" className="text-xs">{entry.task_type}</Badge>
                            )}
                          </div>
                          {entry.description && (
                            <p className="text-sm mt-2 text-muted-foreground">{entry.description}</p>
                          )}
                          {entry.submitted_at && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Submitted: {new Date(entry.submitted_at).toLocaleString('en-US')}
                            </p>
                          )}
                        </div>
                        <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="mt-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-emerald-500/10 border-emerald-500/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-500">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('attendance.present') || 'Present'}</p>
                  <p className="text-2xl font-bold text-emerald-500">
                    {attendanceLogs.filter(l => l.status === 'Present').length}
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
                  <p className="text-sm text-muted-foreground">{t('attendance.late') || 'Late'}</p>
                  <p className="text-2xl font-bold text-amber-500">
                    {attendanceLogs.filter(l => l.status === 'Late').length}
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
                  <p className="text-sm text-muted-foreground">{t('attendance.absent') || 'Absent'}</p>
                  <p className="text-2xl font-bold text-destructive">
                    {attendanceLogs.filter(l => l.status === 'Absent').length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Download */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 size={20} />
                  {t('attendance.title') || 'Attendance Records'}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadAttendanceReport}>
                    <Download size={16} className="mr-2 rtl:ml-2 rtl:mr-0" />
                    {t('attendance.export') || 'Download Report'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Date Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label>{t('attendance.dateFrom') || 'Date From'}</Label>
                  <Input
                    type="date"
                    value={attendanceDateFrom}
                    onChange={e => setAttendanceDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('attendance.dateTo') || 'Date To'}</Label>
                  <Input
                    type="date"
                    value={attendanceDateTo}
                    onChange={e => setAttendanceDateTo(e.target.value)}
                  />
                </div>
              </div>

              {/* Clear Filters */}
              {(attendanceDateFrom || attendanceDateTo) && (
                <div className="mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAttendanceDateFrom('');
                      setAttendanceDateTo('');
                    }}
                  >
                    <X size={16} className="mr-2 rtl:ml-2 rtl:mr-0" />
                    {t('attendance.clearFilters') || 'Clear Filters'}
                  </Button>
                </div>
              )}

              {/* Attendance Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left rtl:text-right">
                  <thead className="text-xs text-muted-foreground uppercase bg-white/5">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg rtl:rounded-r-lg rtl:rounded-l-none">{t('attendance.date') || 'Date'}</th>
                      <th className="px-4 py-3">{t('attendance.checkIn') || 'Check In'}</th>
                      <th className="px-4 py-3">{t('attendance.checkOut') || 'Check Out'}</th>
                      <th className="px-4 py-3">{t('attendance.late') || 'Late'} (min)</th>
                      <th className="px-4 py-3">{t('attendance.overtime') || 'Overtime'} (min)</th>
                      <th className="px-4 py-3 rounded-r-lg rtl:rounded-l-lg rtl:rounded-r-none">{t('attendance.status') || 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAttendance ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t('attendance.loading') || 'Loading attendance records...'}
                        </td>
                      </tr>
                    ) : attendanceLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t('attendance.noRecords') || 'No attendance records found.'}
                        </td>
                      </tr>
                    ) : attendanceLogs.map((record) => (
                      <tr key={record.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-mono text-primary">
                          {record.check_in ? new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-4 py-3 font-mono text-primary">
                          {record.check_out ? new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-destructive font-bold">
                          {record.late_minutes > 0 ? `${record.late_minutes}m` : '-'}
                        </td>
                        <td className="px-4 py-3 text-emerald-500 font-bold">
                          {record.overtime_minutes > 0 ? `${record.overtime_minutes}m` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={getStatusColor(record.status) as any}>
                            {record.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="mt-6 space-y-6">
          {/* Leave Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon size={20} /> Leave Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No leave requests</p>
              ) : (
                <div className="space-y-3">
                  {leaveRequests.map((req) => (
                    <div key={req.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold">{req.leave_type}</p>
                            <StatusBadge status={req.status} />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                          </p>
                          {req.reason && (
                            <p className="text-sm mt-2">{req.reason}</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon size={20} /> Document Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No document requests</p>
              ) : (
                <div className="space-y-3">
                  {documentRequests.map((req) => (
                    <div key={req.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold">{req.document_type}</p>
                            <StatusBadge status={req.status} />
                          </div>
                          {req.purpose && (
                            <p className="text-sm text-muted-foreground mb-1">Purpose: {req.purpose}</p>
                          )}
                          {req.language && (
                            <p className="text-xs text-muted-foreground">Language: {req.language.toUpperCase()}</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* General Employee Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon size={20} /> General Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employeeRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No general requests</p>
              ) : (
                <div className="space-y-3">
                  {employeeRequests.map((req) => (
                    <div key={req.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold">{req.request_type}</p>
                            <StatusBadge status={req.status} />
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">Category: {req.request_category}</p>
                          {req.current_approver && (
                            <p className="text-xs text-muted-foreground">Current Approver: {req.current_approver}</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Education Tab */}
        <TabsContent value="education" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap size={20} /> Education
              </CardTitle>
              <Button 
                size="sm" 
                className="gap-2"
                onClick={() => handleOpenEducationModal()}
              >
                <Plus size={16}/> {t('employees.addEducation')}
              </Button>
            </CardHeader>
            <CardContent>
              {educationRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap size={48} className="mx-auto mb-4 opacity-50" />
                  <p>{t('employees.noEducationRecords')}</p>
                </div>
              ) : (
              <div className="space-y-4">
                  {educationRecords.map((edu) => (
                    <div key={edu.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-bold text-lg">{edu.institution_name}</h3>
                            {edu.is_primary && (
                              <Badge variant="default" className="text-xs">{t('employees.primary')}</Badge>
                            )}
                      </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                              <span className="text-muted-foreground">{t('employees.place')}:</span>
                              <p className="font-medium">{edu.place_of_graduation}</p>
                      </div>
                            <div>
                              <span className="text-muted-foreground">{t('employees.year')}:</span>
                              <p className="font-medium">{edu.graduation_year}</p>
                    </div>
                            {edu.degree_type && (
                              <div>
                                <span className="text-muted-foreground">{t('employees.degree')}:</span>
                                <p className="font-medium">{edu.degree_type}</p>
                              </div>
                            )}
                            {edu.field_of_study && (
                              <div>
                                <span className="text-muted-foreground">{t('employees.field')}:</span>
                                <p className="font-medium">{edu.field_of_study}</p>
                              </div>
                            )}
                            {edu.grade_or_gpa && (
                              <div>
                                <span className="text-muted-foreground">{t('employees.gradeGpa')}:</span>
                                <p className="font-medium">{edu.grade_or_gpa}</p>
                              </div>
                            )}
                          </div>
                          {edu.notes && (
                            <div className="mt-2">
                              <span className="text-muted-foreground text-sm">{t('employees.notes')}:</span>
                              <p className="text-sm">{edu.notes}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleOpenEducationModal(edu)}
                            title={t('common.edit')}
                          >
                            <Edit2 size={18}/>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteEducation(edu.id)}
                            title={t('common.delete')}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={18}/>
                          </Button>
                        </div>
                      </div>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Details Tab */}
        <TabsContent value="bank" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard size={20} /> {t('employees.bankDetails')}
              </CardTitle>
              <Button 
                size="sm" 
                className="gap-2"
                onClick={() => setIsBankModalOpen(true)}
              >
                <Edit2 size={16}/> {bankDetails ? t('employees.editBankDetails') : t('employees.addBankDetails')}
              </Button>
            </CardHeader>
            <CardContent>
              {!bankDetails ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                  <p>{t('employees.noBankDetails')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.bankName')}</label>
                    <p className="text-lg">{bankDetails.bank_name}</p>
                </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.accountNumber')}</label>
                    <p className="text-lg">{bankDetails.account_number}</p>
              </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.accountHolderName')}</label>
                    <p className="text-lg">{bankDetails.account_holder_name}</p>
                  </div>
                  {bankDetails.branch_name && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.branchName')}</label>
                      <p className="text-lg">{bankDetails.branch_name}</p>
                    </div>
                  )}
                  {bankDetails.branch_code && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.branchCode')}</label>
                      <p className="text-lg">{bankDetails.branch_code}</p>
                    </div>
                  )}
                  {bankDetails.iban && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.iban')}</label>
                      <p className="text-lg">{bankDetails.iban}</p>
                    </div>
                  )}
                  {bankDetails.swift_code && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.swiftCode')}</label>
                      <p className="text-lg">{bankDetails.swift_code}</p>
                    </div>
                  )}
                  {bankDetails.account_type && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.accountType')}</label>
                      <p className="text-lg">{bankDetails.account_type}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground uppercase font-bold">Currency</label>
                    <p className="text-lg">{bankDetails.currency || 'USD'}</p>
                  </div>
                  {bankDetails.notes && (
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground uppercase font-bold">Notes</label>
                      <p className="text-lg">{bankDetails.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Immigration Tab */}
        <TabsContent value="immigration" className="mt-6 space-y-6">
          {!immigration ? (
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Globe size={64} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">No immigration records found</p>
                  <p className="text-sm mb-4">Immigration data will be displayed here once added</p>
                  <Button onClick={() => setIsImmigrationModalOpen(true)}>
                    <Plus size={16} className="mr-2" />
                    Add Immigration Record
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : employee ? (
            <AdminImmigrationView
              immigration={immigration}
              employee={employee}
              onEdit={() => setIsImmigrationModalOpen(true)}
              onRenewal={() => setIsRenewalModalOpen(true)}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Globe size={64} className="mx-auto mb-4 opacity-50" />
              <p>Loading employee data...</p>
            </div>
          )}
        </TabsContent>

        {/* Attendance Location Tab */}
        <TabsContent value="attendance-location" className="mt-6 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-b border-white/10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <MapPin size={24} className="text-blue-400" />
                  Attendance Location Settings
                </CardTitle>
                <Button
                  onClick={() => setIsAttendanceLocationModalOpen(true)}
                  size="sm"
                  className="gap-2"
                >
                  <Edit2 size={16} />
                  {employeeAttendanceLocation ? 'Edit' : 'Add'} Location
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {!employeeAttendanceLocation ? (
                <div className="text-center py-12">
                  <MapPin className="mx-auto mb-4 text-muted-foreground" size={64} />
                  <p className="text-lg mb-2">No attendance location configured</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {employeeAttendanceLocation?.use_company_default 
                      ? 'Using company default location'
                      : 'Configure a dedicated location for this employee'}
                  </p>
                  <Button onClick={() => setIsAttendanceLocationModalOpen(true)}>
                    Configure Location
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{employeeAttendanceLocation.location_name}</h3>
                      <Badge variant={employeeAttendanceLocation.is_active ? 'success' : 'outline'}>
                        {employeeAttendanceLocation.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {employeeAttendanceLocation.use_company_default ? (
                      <div className="text-sm text-muted-foreground">
                        Using company default location settings
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {employeeAttendanceLocation.latitude && employeeAttendanceLocation.longitude && (
                          <div>
                            <span className="text-muted-foreground">Coordinates: </span>
                            <span className="font-mono">
                              {employeeAttendanceLocation.latitude.toFixed(6)}, {employeeAttendanceLocation.longitude.toFixed(6)}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Allowed Radius: </span>
                          <span className="font-semibold">{employeeAttendanceLocation.radius_meters}m</span>
                        </div>
                        {employeeAttendanceLocation.google_maps_link && (
                          <div>
                            <span className="text-muted-foreground">Google Maps: </span>
                            <a
                              href={employeeAttendanceLocation.google_maps_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              View on Maps
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('employees.documents')}</CardTitle>
              <Button 
                size="sm" 
                className="gap-2"
                onClick={() => setIsUploadModalOpen(true)}
              >
                <Upload size={16}/> {t('documents.uploadDocument') || 'Upload Document'}
              </Button>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText size={48} className="mx-auto mb-4 opacity-50" />
                  <p>{t('documents.noDocuments') || 'No documents uploaded yet'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
                          <FileText size={20} />
                  </div>
                        <div>
                          <p className="font-bold">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.folder || doc.category || 'General'} • {t('common.uploaded') || 'Uploaded'} {
                              doc.upload_date 
                                ? new Date(doc.upload_date).toLocaleDateString() 
                                : doc.created_at 
                                  ? new Date(doc.created_at).toLocaleDateString() 
                                  : 'N/A'
                            }
                          </p>
                </div>
              </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDownload(doc.url, doc.name)}
                          title={t('common.download') || 'Download'}
                        >
                          <Download size={18}/>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteDocument(doc.id)}
                          title={t('common.delete') || 'Delete'}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={18}/>
                        </Button>
              </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Document Modal */}
      <Modal 
        isOpen={isUploadModalOpen} 
        onClose={() => {
          setIsUploadModalOpen(false);
          setSelectedFile(null);
          setSelectedCategory('General');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }} 
        title={t('documents.uploadDocument') || 'Upload Document'}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('documents.selectFile') || 'Select File'} *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="w-full p-2 border border-white/10 rounded-lg bg-white/5 text-foreground"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                {t('documents.selectedFile') || 'Selected'}: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('documents.category') || 'Category'} *
            </label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full h-11">
                <SelectValue placeholder={t('documents.selectCategory') || 'Select category'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Contract">{t('documents.contract') || 'Contract'}</SelectItem>
                <SelectItem value="ID">{t('documents.id') || 'ID'}</SelectItem>
                <SelectItem value="Education">{t('documents.education') || 'Education'}</SelectItem>
                <SelectItem value="General">{t('documents.general') || 'General'}</SelectItem>
                <SelectItem value="Payroll">{t('documents.payroll') || 'Payroll'}</SelectItem>
                <SelectItem value="Visa">{t('documents.visa') || 'Visa'}</SelectItem>
                <SelectItem value="Other">{t('documents.other') || 'Other'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadModalOpen(false);
                setSelectedFile(null);
                setSelectedCategory('General');
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? t('common.uploading') || 'Uploading...' : t('common.upload') || 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Education Modal */}
      <Modal 
        isOpen={isEducationModalOpen} 
        onClose={() => {
          setIsEducationModalOpen(false);
          setEditingEducation(null);
        }} 
        title={editingEducation ? t('employees.editEducation') : t('employees.addEducation')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('employees.institutionName')} *</Label>
            <Input
              value={educationForm.institution_name}
              onChange={(e) => setEducationForm({ ...educationForm, institution_name: e.target.value })}
              placeholder={t('employees.institutionNamePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('employees.placeOfGraduation')} *</Label>
            <Input
              value={educationForm.place_of_graduation}
              onChange={(e) => setEducationForm({ ...educationForm, place_of_graduation: e.target.value })}
              placeholder={t('employees.placeOfGraduationPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('employees.graduationYear')} *</Label>
              <Input
                type="number"
                value={educationForm.graduation_year}
                onChange={(e) => setEducationForm({ ...educationForm, graduation_year: parseInt(e.target.value) || new Date().getFullYear() })}
                min="1900"
                max={new Date().getFullYear() + 10}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('employees.degreeType')}</Label>
              <Select value={educationForm.degree_type} onValueChange={(value) => setEducationForm({ ...educationForm, degree_type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('employees.selectDegreeType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High School">{t('employees.highSchool')}</SelectItem>
                  <SelectItem value="Diploma">{t('employees.diploma')}</SelectItem>
                  <SelectItem value="Bachelor">{t('employees.bachelor')}</SelectItem>
                  <SelectItem value="Master">{t('employees.master')}</SelectItem>
                  <SelectItem value="PhD">{t('employees.phd')}</SelectItem>
                  <SelectItem value="Certificate">{t('employees.certificate')}</SelectItem>
                  <SelectItem value="Other">{t('employees.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('employees.fieldOfStudy')}</Label>
            <Input
              value={educationForm.field_of_study}
              onChange={(e) => setEducationForm({ ...educationForm, field_of_study: e.target.value })}
              placeholder={t('employees.fieldOfStudyPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('employees.gradeOrGpa')}</Label>
            <Input
              value={educationForm.grade_or_gpa}
              onChange={(e) => setEducationForm({ ...educationForm, grade_or_gpa: e.target.value })}
              placeholder={t('employees.gradeOrGpaPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={educationForm.is_primary}
              onChange={(e) => setEducationForm({ ...educationForm, is_primary: e.target.checked })}
              className="w-4 h-4"
            />
            <Label htmlFor="is_primary" className="cursor-pointer">{t('employees.markAsPrimary')}</Label>
          </div>
          <div className="space-y-2">
            <Label>{t('employees.notes')}</Label>
            <Textarea
              value={educationForm.notes}
              onChange={(e) => setEducationForm({ ...educationForm, notes: e.target.value })}
              placeholder={t('employees.additionalNotes')}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsEducationModalOpen(false);
                setEditingEducation(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveEducation}>
              {editingEducation ? t('employees.updateEducation') : t('employees.addEducation')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bank Details Modal */}
      <Modal 
        isOpen={isBankModalOpen} 
        onClose={() => setIsBankModalOpen(false)} 
        title={bankDetails ? t('employees.editBankDetails') : t('employees.addBankDetails')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('employees.bankName')} *</Label>
            <Input
              value={bankForm.bank_name}
              onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
              placeholder={t('employees.bankNamePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('employees.accountNumber')} *</Label>
              <Input
                value={bankForm.account_number}
                onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                placeholder={t('employees.accountNumberPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('employees.accountHolderName')} *</Label>
              <Input
                value={bankForm.account_holder_name}
                onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                placeholder={t('employees.nameOnAccountPlaceholder')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('employees.branchName')}</Label>
              <Input
                value={bankForm.branch_name}
                onChange={(e) => setBankForm({ ...bankForm, branch_name: e.target.value })}
                placeholder={t('employees.branchNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('employees.branchCode')}</Label>
              <Input
                value={bankForm.branch_code}
                onChange={(e) => setBankForm({ ...bankForm, branch_code: e.target.value })}
                placeholder={t('employees.branchCodePlaceholder')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('employees.iban')}</Label>
              <Input
                value={bankForm.iban}
                onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })}
                placeholder={t('employees.ibanPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('employees.swiftCode')}</Label>
              <Input
                value={bankForm.swift_code}
                onChange={(e) => setBankForm({ ...bankForm, swift_code: e.target.value })}
                placeholder={t('employees.swiftCodePlaceholder')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('employees.accountType')}</Label>
              <Select value={bankForm.account_type} onValueChange={(value) => setBankForm({ ...bankForm, account_type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('employees.selectAccountType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Savings">{t('employees.savings')}</SelectItem>
                  <SelectItem value="Current">{t('employees.current')}</SelectItem>
                  <SelectItem value="Checking">{t('employees.checking')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('employees.currency')}</Label>
              <Select value={bankForm.currency} onValueChange={(value) => setBankForm({ ...bankForm, currency: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="KWD">KWD</SelectItem>
                  <SelectItem value="SAR">SAR</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('employees.notes')}</Label>
            <Textarea
              value={bankForm.notes}
              onChange={(e) => setBankForm({ ...bankForm, notes: e.target.value })}
              placeholder={t('employees.additionalNotes')}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsBankModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveBankDetails}>
              {bankDetails ? t('employees.updateBankDetails') : t('employees.saveBankDetails')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Immigration Edit Modal */}
      <Modal 
        isOpen={isImmigrationModalOpen} 
        onClose={() => {
          setIsImmigrationModalOpen(false);
          if (immigration) {
            loadImmigration(); // Reload to reset form
          }
        }} 
        title={immigration ? 'Edit Immigration Record' : 'Add Immigration Record'}
        size="xl"
      >
        <div className="space-y-6">
          {/* Work Permit Section */}
          <div className="space-y-4 p-4 border border-blue-500/20 dark:border-blue-500/20 rounded-lg bg-blue-500/5 dark:bg-blue-500/5">
            <h3 className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <FileCheck size={18} />
              Work Permit (Public Authority for Manpower)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Work Permit Number</Label>
                <Input
                  value={immigrationForm.work_permit_number || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, work_permit_number: e.target.value })}
                  placeholder="Enter work permit number"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={immigrationForm.work_permit_status} 
                  onValueChange={(value) => setImmigrationForm({ ...immigrationForm, work_permit_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending Renewal">Pending Renewal</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={immigrationForm.work_permit_issue_date || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, work_permit_issue_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date *</Label>
                <Input
                  type="date"
                  value={immigrationForm.work_permit_expiry_date || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, work_permit_expiry_date: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Residence Permit Section */}
          <div className="space-y-4 p-4 border border-purple-500/20 dark:border-purple-500/20 rounded-lg bg-purple-500/5 dark:bg-purple-500/5">
            <h3 className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-2">
              <FileCheck size={18} />
              Residence Permit (Article 18) - Ministry of Interior
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Residence Permit Number</Label>
                <Input
                  value={immigrationForm.residence_permit_number || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, residence_permit_number: e.target.value })}
                  placeholder="Enter residence permit number"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={immigrationForm.residence_permit_status} 
                  onValueChange={(value) => setImmigrationForm({ ...immigrationForm, residence_permit_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending Renewal">Pending Renewal</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={immigrationForm.residence_permit_issue_date || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, residence_permit_issue_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date *</Label>
                <Input
                  type="date"
                  value={immigrationForm.residence_permit_expiry_date || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, residence_permit_expiry_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Article</Label>
                <Select 
                  value={immigrationForm.residence_permit_article} 
                  onValueChange={(value) => setImmigrationForm({ ...immigrationForm, residence_permit_article: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Article 18">Article 18 (Work)</SelectItem>
                    <SelectItem value="Article 17">Article 17 (Family)</SelectItem>
                    <SelectItem value="Article 19">Article 19 (Investor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Passport Section */}
          <div className="space-y-4 p-4 border border-green-500/20 dark:border-green-500/20 rounded-lg bg-green-500/5 dark:bg-green-500/5">
            <h3 className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
              <FileCheck size={18} />
              Passport Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Passport Number</Label>
                <Input
                  value={immigrationForm.passport_number || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, passport_number: e.target.value })}
                  placeholder="Enter passport number"
                />
              </div>
              <div className="space-y-2">
                <Label>Issue Country</Label>
                <Input
                  value={immigrationForm.passport_issue_country || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, passport_issue_country: e.target.value })}
                  placeholder="Enter country"
                />
              </div>
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={immigrationForm.passport_issue_date || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, passport_issue_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date *</Label>
                <Input
                  type="date"
                  value={immigrationForm.passport_expiry_date || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, passport_expiry_date: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Health Insurance Section */}
          <div className="space-y-4 p-4 border border-cyan-500/20 dark:border-cyan-500/20 rounded-lg bg-cyan-500/5 dark:bg-cyan-500/5">
            <h3 className="font-semibold text-cyan-600 dark:text-cyan-400 flex items-center gap-2">
              <FileCheck size={18} />
              Health Insurance
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Insurance Number</Label>
                <Input
                  value={immigrationForm.health_insurance_number || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, health_insurance_number: e.target.value })}
                  placeholder="Enter insurance number"
                />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Input
                  value={immigrationForm.health_insurance_provider || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, health_insurance_provider: e.target.value })}
                  placeholder="Enter insurance provider"
                />
              </div>
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={immigrationForm.health_insurance_issue_date || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, health_insurance_issue_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={immigrationForm.health_insurance_expiry_date || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, health_insurance_expiry_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Civil ID Section */}
          <div className="space-y-4 p-4 border border-orange-500/20 dark:border-orange-500/20 rounded-lg bg-orange-500/5 dark:bg-orange-500/5">
            <h3 className="font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2">
              <FileCheck size={18} />
              Civil ID
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Civil ID Number</Label>
                <Input
                  value={immigrationForm.civil_id_number || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, civil_id_number: e.target.value })}
                  placeholder="Enter Civil ID number"
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={immigrationForm.civil_id_expiry_date || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, civil_id_expiry_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* General Information */}
          <div className="space-y-4 p-4 border border-indigo-500/20 dark:border-indigo-500/20 rounded-lg bg-indigo-500/5 dark:bg-indigo-500/5">
            <h3 className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <Globe size={18} />
              General Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Visa Type</Label>
                <Select 
                  value={immigrationForm.visa_type} 
                  onValueChange={(value) => setImmigrationForm({ ...immigrationForm, visa_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select visa type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Work Visa">Work Visa</SelectItem>
                    <SelectItem value="Family Visa">Family Visa</SelectItem>
                    <SelectItem value="Investor Visa">Investor Visa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sponsor Name</Label>
                <Input
                  value={immigrationForm.sponsor_name || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, sponsor_name: e.target.value })}
                  placeholder="Company or individual name"
                />
              </div>
              <div className="space-y-2">
                <Label>Entry Date</Label>
                <Input
                  type="date"
                  value={immigrationForm.entry_date || ''}
                  onChange={(e) => setImmigrationForm({ ...immigrationForm, entry_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={immigrationForm.notes || ''}
              onChange={(e) => setImmigrationForm({ ...immigrationForm, notes: e.target.value })}
              placeholder="Additional notes about immigration status..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsImmigrationModalOpen(false);
                if (immigration) {
                  loadImmigration();
                }
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveImmigration}>
              {immigration ? 'Update' : 'Save'} Immigration Record
            </Button>
          </div>
        </div>
      </Modal>

      {/* Yearly Renewal Modal */}
      <Modal 
        isOpen={isRenewalModalOpen} 
        onClose={() => setIsRenewalModalOpen(false)} 
        title="Yearly Renewal - Kuwait Expat Law"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-muted-foreground mb-3">
              According to Kuwait expat law, expatriate employees must renew their documents annually. Select the document to renew for 1 year.
            </p>
            <div className="space-y-2">
              <Label>Select Document to Renew *</Label>
              <Select 
                value={renewalType} 
                onValueChange={(value: any) => setRenewalType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work_permit">Work Permit (Public Authority for Manpower)</SelectItem>
                  <SelectItem value="residence_permit">Residence Permit (Article 18) - Ministry of Interior</SelectItem>
                  <SelectItem value="health_insurance">Health Insurance</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="civil_id">Civil ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {immigration && (
            <div className="p-4 bg-white/5 rounded-lg space-y-2">
              <p className="text-sm font-semibold">Current Expiry Dates:</p>
              {renewalType === 'work_permit' && immigration.work_permit_expiry_date && (
                <p className="text-sm text-muted-foreground">
                  Work Permit: {new Date(immigration.work_permit_expiry_date).toLocaleDateString()}
                </p>
              )}
              {renewalType === 'residence_permit' && immigration.residence_permit_expiry_date && (
                <p className="text-sm text-muted-foreground">
                  Residence Permit: {new Date(immigration.residence_permit_expiry_date).toLocaleDateString()}
                </p>
              )}
              {renewalType === 'health_insurance' && immigration.health_insurance_expiry_date && (
                <p className="text-sm text-muted-foreground">
                  Health Insurance: {new Date(immigration.health_insurance_expiry_date).toLocaleDateString()}
                </p>
              )}
              {renewalType === 'passport' && immigration.passport_expiry_date && (
                <p className="text-sm text-muted-foreground">
                  Passport: {new Date(immigration.passport_expiry_date).toLocaleDateString()}
                </p>
              )}
              {renewalType === 'civil_id' && immigration.civil_id_expiry_date && (
                <p className="text-sm text-muted-foreground">
                  Civil ID: {new Date(immigration.civil_id_expiry_date).toLocaleDateString()}
                </p>
              )}
              <p className="text-sm font-semibold text-primary mt-2">
                New Expiry Date: {(() => {
                  const nextYear = new Date();
                  nextYear.setFullYear(nextYear.getFullYear() + 1);
                  return nextYear.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                })()}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsRenewalModalOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => handleYearlyRenewal(renewalType)}
              className="gap-2"
            >
              <Calendar size={16} />
              Renew for 1 Year
            </Button>
          </div>
        </div>
      </Modal>

      {/* Attendance Location Modal */}
      <Modal
        isOpen={isAttendanceLocationModalOpen}
        onClose={() => {
          setIsAttendanceLocationModalOpen(false);
          loadEmployeeAttendanceLocation();
        }}
        title="Employee Attendance Location Settings"
        size="lg"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveAttendanceLocation(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Use Company Default Location</Label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={attendanceLocationForm.use_company_default}
                onChange={(e) => setAttendanceLocationForm({ ...attendanceLocationForm, use_company_default: e.target.checked })}
                className="w-5 h-5 rounded border-white/20"
              />
              <span className="text-sm text-muted-foreground">
                Use the company's default attendance location instead of a custom location
              </span>
            </div>
          </div>

          {!attendanceLocationForm.use_company_default && (
            <>
              <div className="space-y-2">
                <Label>Location Name *</Label>
                <Input
                  required={!attendanceLocationForm.use_company_default}
                  value={attendanceLocationForm.location_name}
                  onChange={(e) => setAttendanceLocationForm({ ...attendanceLocationForm, location_name: e.target.value })}
                  placeholder="Employee's Work Location"
                />
              </div>

              <div className="space-y-2">
                <Label>Google Maps Link *</Label>
                <Input
                  required={!attendanceLocationForm.use_company_default}
                  value={attendanceLocationForm.google_maps_link}
                  onChange={(e) => setAttendanceLocationForm({ ...attendanceLocationForm, google_maps_link: e.target.value })}
                  placeholder="https://maps.app.goo.gl/..."
                />
                <p className="text-xs text-muted-foreground">
                  Paste a Google Maps link. The system will automatically extract coordinates.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Allowed Radius (meters) *</Label>
                <Input
                  type="number"
                  required={!attendanceLocationForm.use_company_default}
                  min="10"
                  max="1000"
                  value={attendanceLocationForm.radius_meters}
                  onChange={(e) => setAttendanceLocationForm({ ...attendanceLocationForm, radius_meters: parseInt(e.target.value) || 100 })}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">
                  Employee must be within this radius to mark attendance (10-1000 meters)
                </p>
              </div>
            </>
          )}

          <div className="space-y-2 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Enable or disable this location setting
                </p>
              </div>
              <input
                type="checkbox"
                checked={attendanceLocationForm.is_active}
                onChange={(e) => setAttendanceLocationForm({ ...attendanceLocationForm, is_active: e.target.checked })}
                className="w-5 h-5 rounded border-white/20"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAttendanceLocationModalOpen(false);
                loadEmployeeAttendanceLocation();
              }}
            >
              Cancel
            </Button>
            <Button type="submit">Save Settings</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => !deleting && setIsDeleteModalOpen(false)}
        title={t('employees.deleteEmployee') || 'Delete Employee'}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="text-destructive mt-0.5" size={20} />
            <div className="flex-1">
              <p className="font-semibold text-destructive mb-2">
                {t('employees.deleteEmployeeWarning') || 'Are you sure you want to delete this employee?'}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('employees.deleteEmployeeMessage')?.replace('{name}', getEmployeeDisplayName(emp)) || `This will permanently delete ${getEmployeeDisplayName(emp)} and all associated data. This action cannot be undone.`}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={deleting}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteEmployee}
              disabled={deleting}
            >
              {deleting ? (t('common.deleting') || 'Deleting...') : t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
