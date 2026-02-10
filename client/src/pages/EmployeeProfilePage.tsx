import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../utils/i18n';
import { getEmployeeDisplayName, getEmployeeInitials, getEmployeeFirstName, getEmployeeLastName } from '../utils/employeeName';
import { User, FileText, DollarSign, Shield, MapPin, Phone, Mail, Calendar, Briefcase, Building2, GraduationCap, CreditCard, Globe, FileCheck, AlertCircle, Download, Camera } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '../components/common/UIComponents';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion';
import { employeeService, Employee } from '../services/employeeService';
import { documentService, Document } from '../services/documentService';
import { employeeEducationService, EmployeeEducation } from '../services/employeeEducationService';
import { employeeBankDetailsService, EmployeeBankDetails } from '../services/employeeBankDetailsService';
import { employeeImmigrationService, EmployeeImmigration } from '../services/employeeImmigrationService';
import { getEmployeeLeaveBalance, LeaveBalance } from '../services/leaveBalanceService';
import { employeeRequestService, EmployeeRequest } from '../services/employeeRequestService';
import { documentRequestService, DocumentRequest } from '../services/documentRequestService';
import { leaveService, LeaveRequest } from '../services/leaveService';
import { companySettingsService, EmployeeShift, EmployeeWorkingHours } from '../services/companySettingsService';
import { timesheetService, TimesheetEntry } from '../services/timesheetService';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Calendar as CalendarIcon, FileText as FileTextIcon, Users, Home, Fingerprint, CheckCircle2, XCircle, Clock, HelpCircle, ExternalLink, ChevronRight, ChevronLeft } from 'lucide-react';

// Helper function to calculate days until expiry
const calculateDaysUntilExpiry = (expiryDate: string | undefined): number | null => {
  if (!expiryDate) return null;
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Helper function to get document status
const getDocumentStatus = (daysUntilExpiry: number | null, status?: string, t?: any): { label: string; color: string; priority: string } => {
  if (!t) {
    // Fallback if translation not available
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
  }
  
  if (daysUntilExpiry === null) {
    return { label: status || t('employeeProfile.validStatus'), color: 'text-green-400', priority: 'safe' };
  }
  if (daysUntilExpiry < 0) {
    return { label: t('employeeProfile.overdue'), color: 'text-red-400', priority: 'critical' };
  }
  if (daysUntilExpiry <= 14) {
    return { label: t('employeeProfile.actionRequired') + ' - ' + Math.abs(daysUntilExpiry) + ' ' + t('common.days') + ' left', color: 'text-red-400', priority: 'urgent' };
  }
  if (daysUntilExpiry <= 30) {
    return { label: 'Attention - ' + daysUntilExpiry + ' ' + t('common.days') + ' left', color: 'text-orange-400', priority: 'attention' };
  }
  return { label: t('employeeProfile.safe') + ' - ' + daysUntilExpiry + ' ' + t('common.days') + ' left', color: 'text-green-400', priority: 'safe' };
};

// Employee Immigration View Component
function EmployeeImmigrationView({ immigration, employee }: { immigration: EmployeeImmigration; employee: Employee }) {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Calculate document statuses
  const documents = [
    {
      type: t('employeeProfile.civilID'),
      number: immigration.civil_id_number || 'N/A',
      expiryDate: immigration.civil_id_expiry_date,
      status: immigration.civil_id_status,
      icon: Users,
      color: 'blue'
    },
    {
      type: t('employeeProfile.passport'),
      number: immigration.passport_number || 'N/A',
      expiryDate: immigration.passport_expiry_date,
      status: immigration.passport_status,
      icon: Globe,
      color: 'green'
    },
    {
      type: t('employeeProfile.workPermit'),
      number: immigration.work_permit_number || 'N/A',
      expiryDate: immigration.work_permit_expiry_date,
      status: immigration.work_permit_status,
      icon: FileCheck,
      color: 'purple'
    },
    {
      type: t('employeeProfile.healthInsurance'),
      number: immigration.health_insurance_number || immigration.health_insurance_provider || 'N/A',
      expiryDate: immigration.health_insurance_expiry_date,
      status: immigration.health_insurance_status,
      icon: Shield,
      color: 'cyan'
    },
    {
      type: t('employeeProfile.residencePermitArticle18'),
      number: immigration.residence_permit_number || 'N/A',
      expiryDate: immigration.residence_permit_expiry_date,
      status: immigration.residence_permit_status,
      icon: Home,
      color: 'indigo'
    },
    {
      type: t('employeeProfile.fingerprintRegistration'),
      number: immigration.civil_id_number || 'N/A',
      expiryDate: null,
      status: t('common.active'),
      icon: Fingerprint,
      color: 'gray'
    }
  ].map(doc => ({
    ...doc,
    daysUntilExpiry: calculateDaysUntilExpiry(doc.expiryDate || undefined),
    statusInfo: getDocumentStatus(calculateDaysUntilExpiry(doc.expiryDate || undefined), doc.status, t)
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
      title: `${doc.type === t('employeeProfile.passport') ? t('employeeProfile.submitPassportRenewalApplication') : doc.type === t('employeeProfile.workPermit') ? t('employeeProfile.uploadWorkPermitSupportingDocuments') : doc.type === t('employeeProfile.healthInsurance') ? t('employeeProfile.completeHealthInsuranceRenewalForm') : doc.type === t('employeeProfile.residencePermitArticle18') ? t('employeeProfile.submitResidencePermitPhotos') : t('employeeProfile.update') + ' ' + doc.type.toLowerCase()}`,
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
      message: `${doc.type} ${doc.daysUntilExpiry && doc.daysUntilExpiry < 0 ? t('employeeProfile.overdue') : doc.daysUntilExpiry && doc.daysUntilExpiry <= 14 ? t('common.to') + ' ' + doc.daysUntilExpiry + ' ' + t('common.days') : t('employeeProfile.actionRequired')} - ${doc.statusInfo.priority === 'critical' || doc.statusInfo.priority === 'urgent' ? t('employeeProfile.immediateActionRequired') : t('employeeProfile.startRenewal')}.`
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
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add days of the month
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

  const monthNames = [t('employeeProfile.january'), t('employeeProfile.february'), t('employeeProfile.march'), t('employeeProfile.april'), t('employeeProfile.may'), t('employeeProfile.june'), t('employeeProfile.july'), t('employeeProfile.august'), t('employeeProfile.september'), t('employeeProfile.october'), t('employeeProfile.november'), t('employeeProfile.december')];
  const dayNames = [t('employeeProfile.sun'), t('employeeProfile.mon'), t('employeeProfile.tue'), t('employeeProfile.wed'), t('employeeProfile.thu'), t('employeeProfile.fri'), t('employeeProfile.sat')];

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Globe size={18} className="md:w-5 md:h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-base md:text-2xl font-bold">{t('employeeProfile.immigrationDocuments')}</h2>
            <p className="text-[10px] md:text-sm text-muted-foreground">{t('employeeProfile.workPermitsVisasRenewals')}</p>
          </div>
        </div>
      </div>

      {/* Summary Statistics Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-3 md:p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {/* Documents Total */}
            <div className="flex flex-col items-center justify-center p-2 md:p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-1.5 md:mb-2">
                <span className="text-base md:text-lg font-bold text-blue-400">
                  {getEmployeeInitials(employee)}
                </span>
              </div>
              <div className="text-lg md:text-2xl font-bold text-blue-400">{totalDocuments}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground text-center">{t('employeeProfile.total')}</div>
            </div>

            {/* Require Action */}
            <div className="flex flex-col items-center justify-center p-2 md:p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="text-lg md:text-2xl font-bold text-orange-400 mb-0.5 md:mb-1">{requireAction}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground text-center">{t('employeeProfile.requireAction')}</div>
            </div>

            {/* Valid */}
            <div className="flex flex-col items-center justify-center p-2 md:p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-lg md:text-2xl font-bold text-green-400 mb-0.5 md:mb-1">{validDocuments}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground text-center">{t('employeeProfile.valid')}</div>
            </div>

            {/* Next Deadline */}
            <div className="flex flex-col items-center justify-center p-2 md:p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-sm md:text-lg font-bold text-red-400 mb-0.5 md:mb-1 line-clamp-1">
                {nextDeadline ? new Date(nextDeadline.expiryDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
              </div>
              <div className="text-[10px] md:text-xs text-muted-foreground text-center">{t('employeeProfile.nextDeadline')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Cards Section */}
      <div>
        <div className="flex items-center gap-2 mb-2 md:mb-3">
          <FileCheck size={14} className="md:w-4 md:h-4 text-muted-foreground" />
          <h3 className="text-sm md:text-base font-semibold">{t('employeeProfile.myImmigrationDocuments')}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
          {documents.map((doc, idx) => {
            const Icon = doc.icon;
            const isOverdue = doc.daysUntilExpiry !== null && doc.daysUntilExpiry < 0;
            const isUrgent = doc.statusInfo.priority === 'urgent' || doc.statusInfo.priority === 'critical';
            
            return (
              <Card key={idx} className={`p-2.5 md:p-4 border-2 transition-all hover:shadow-md ${
                isUrgent ? 'border-red-500/50 bg-red-500/10' :
                doc.statusInfo.priority === 'attention' ? 'border-orange-500/50 bg-orange-500/10' :
                'border-green-500/50 bg-green-500/10'
              }`}>
                {/* Icon and URGENT Badge */}
                <div className="flex items-start justify-between mb-2">
                  <div className={`w-7 h-7 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    doc.color === 'blue' ? 'bg-blue-500/20' :
                    doc.color === 'green' ? 'bg-green-500/20' :
                    doc.color === 'purple' ? 'bg-purple-500/20' :
                    doc.color === 'cyan' ? 'bg-cyan-500/20' :
                    doc.color === 'indigo' ? 'bg-indigo-500/20' :
                    'bg-gray-500/20'
                  }`}>
                    <Icon size={14} className={`md:w-5 md:h-5 ${
                      doc.color === 'blue' ? 'text-blue-400' :
                      doc.color === 'green' ? 'text-green-400' :
                      doc.color === 'purple' ? 'text-purple-400' :
                      doc.color === 'cyan' ? 'text-cyan-400' :
                      doc.color === 'indigo' ? 'text-indigo-400' :
                      'text-gray-400'
                    }`} />
                  </div>
                  {isUrgent && (
                    <Badge variant="destructive" className="text-[9px] md:text-xs px-1.5 py-0.5 h-4 md:h-5">{t('employeeProfile.actionRequired')}</Badge>
                  )}
                </div>

                {/* Document Type and Number */}
                <div className="mb-1.5">
                  <div className="text-[10px] md:text-xs text-muted-foreground mb-0.5 line-clamp-1">{doc.type}</div>
                  <div className="font-bold text-xs md:text-sm truncate">{doc.number}</div>
                </div>

                {/* Expiry Date */}
                {doc.expiryDate && (
                  <div className="mb-1.5">
                    <div className="text-[10px] md:text-xs text-muted-foreground">{t('employeeProfile.expires')}</div>
                    <div className="text-[10px] md:text-xs font-semibold">
                      {new Date(doc.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="mb-2">
                  <div className={`text-[10px] md:text-xs font-semibold ${doc.statusInfo.color} line-clamp-1 mb-0.5`}>
                    {doc.statusInfo.label}
                  </div>
                  <div className="text-[9px] md:text-[10px] text-muted-foreground line-clamp-1">
                    {isOverdue ? t('employeeProfile.immediateActionRequired') : isUrgent ? t('employeeProfile.actionRequired') : doc.statusInfo.priority === 'attention' ? t('employeeProfile.pendingDocuments') : t('employeeProfile.validStatus')}
                  </div>
                </div>

                {/* Action Button */}
                <Button 
                  size="sm" 
                  variant={isUrgent ? 'destructive' : doc.statusInfo.priority === 'attention' ? 'secondary' : 'outline'}
                  className="w-full text-[10px] md:text-xs h-7 md:h-8 mt-auto"
                >
                  <span className="truncate">
                    {isOverdue ? t('employeeProfile.updateNow') : isUrgent ? t('employeeProfile.startRenewal') : doc.statusInfo.priority === 'attention' ? t('employeeProfile.uploadDocs') : t('employeeProfile.viewDetails')}
                  </span>
                  <ChevronRight size={10} className="ml-1 md:w-3 md:h-3 flex-shrink-0" />
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tasks & Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {/* Tasks & To-Do List */}
        <Card className="p-3 md:p-4">
          <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3 flex items-center gap-2">
            <Clock size={14} className="md:w-4 md:h-4" />
            <span className="text-xs md:text-sm">{t('employeeProfile.myTasksTodoList')}</span>
          </h3>
          <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4 max-h-[400px] overflow-y-auto">
            {tasks.slice(0, 5).map((task, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                <input type="checkbox" className="mt-0.5 md:mt-1 w-3.5 h-3.5 md:w-4 md:h-4" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs md:text-sm font-medium line-clamp-1">{task.title}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1 flex-wrap">
                    <span>{t('employeeProfile.due')} {task.dueDate ? task.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                    <Badge variant={task.priority === 'HIGH' ? 'destructive' : 'warning'} className="text-[10px] md:text-xs px-1.5 py-0.5">
                      {task.priority === 'HIGH' ? t('employeeProfile.high') : t('employeeProfile.medium')}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
            {/* Mock completed tasks */}
            <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 opacity-60">
              <CheckCircle2 size={14} className="mt-0.5 md:mt-1 text-green-400 md:w-4 md:h-4" />
              <div className="flex-1 min-w-0">
                <div className="text-xs md:text-sm font-medium line-through line-clamp-1">{t('employeeProfile.updateContactInformation')}</div>
                <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">{t('employeeProfile.completed')} Dec 28, 2025</div>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 opacity-60">
              <CheckCircle2 size={14} className="mt-0.5 md:mt-1 text-green-400 md:w-4 md:h-4" />
              <div className="flex-1 min-w-0">
                <div className="text-xs md:text-sm font-medium line-through line-clamp-1">{t('employeeProfile.submitResidencePermitPhotos')}</div>
                <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">{t('employeeProfile.completed')} Dec 20, 2025</div>
              </div>
            </div>
          </div>
          <div className="pt-2 md:pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-[10px] md:text-xs mb-1.5 md:mb-2">
              <span className="text-muted-foreground">{completedTasks} {t('common.of')} {totalTasks} {t('employeeProfile.tasksCompleted')}</span>
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
            <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
              <CalendarIcon size={14} className="md:w-4 md:h-4" />
              <span className="text-xs md:text-sm">{t('employeeProfile.myUpcomingDeadlines')}</span>
            </h3>
            <div className="flex items-center gap-1 md:gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="h-7 w-7 md:h-8 md:w-8 p-0">
                <ChevronLeft size={14} className="md:w-4 md:h-4" />
              </Button>
              <span className="text-[10px] md:text-xs font-medium min-w-[100px] md:min-w-[120px] text-center">
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
                      {isOverdue ? t('employeeProfile.overdue') : isUrgent ? t('employeeProfile.action') : t('employeeProfile.safe')}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Notifications & Help Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {/* Notifications */}
        <Card className="p-3 md:p-4">
          <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3 flex items-center gap-2">
            <AlertCircle size={14} className="md:w-4 md:h-4" />
            <span className="text-xs md:text-sm">{t('employeeProfile.notifications')}</span>
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
            <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3 flex items-center gap-2">
              <HelpCircle size={14} className="md:w-4 md:h-4" />
              <span className="text-xs md:text-sm">{t('employeeProfile.needHelp')}</span>
            </h3>
            <div className="space-y-1.5 md:space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start text-xs md:text-sm h-8 md:h-9">
                {t('employeeProfile.contactHRDepartment')}
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs md:text-sm h-8 md:h-9">
                {t('employeeProfile.viewRenewalGuidelines')}
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs md:text-sm h-8 md:h-9">
                {t('employeeProfile.downloadRequiredForms')}
              </Button>
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3 flex items-center gap-2">
              <Globe size={14} className="md:w-4 md:h-4" />
              <span className="text-xs md:text-sm">{t('employeeProfile.kuwaitLawInformation')}</span>
            </h3>
            <div className="space-y-1.5 md:space-y-2">
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="text-[10px] md:text-xs font-semibold mb-0.5 md:mb-1">{t('employeeProfile.sixMonthTravelLimit')}</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">{t('employeeProfile.monitorDaysOutsideKuwait')}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="text-[10px] md:text-xs font-semibold mb-0.5 md:mb-1">{t('employeeProfile.article18Requirements')}</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">{t('employeeProfile.keepWorkPermitCurrent')}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="text-[10px] md:text-xs font-semibold mb-0.5 md:mb-1">{t('employeeProfile.documentChecklist')}</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">{t('employeeProfile.viewRequiredDocumentsForRenewal')}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [educationRecords, setEducationRecords] = useState<EmployeeEducation[]>([]);
  const [bankDetails, setBankDetails] = useState<EmployeeBankDetails | null>(null);
  const [immigration, setImmigration] = useState<EmployeeImmigration | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [employeeRequests, setEmployeeRequests] = useState<EmployeeRequest[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employeeShifts, setEmployeeShifts] = useState<EmployeeShift[]>([]);
  const [workingHours, setWorkingHours] = useState<EmployeeWorkingHours | null>(null);
  const [reportingManagerChain, setReportingManagerChain] = useState<Employee[]>([]);
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEmployee();
  }, []);

  useEffect(() => {
    if (employee?.id) {
      loadDocuments();
      loadEducation();
      loadBankDetails();
      loadImmigration();
      loadLeaveBalance();
      loadRequests();
      loadWorkingHours();
      loadReportingManagerChain();
      loadTimesheetEntries();
    }
  }, [employee?.id]);

  useEffect(() => {
    if (employee?.id && user?.company_id) {
      loadLeaveBalance();
    }
  }, [employee?.id, user?.company_id]);

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
      await loadEmployee();
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

  const loadEmployee = async () => {
    try {
      setLoading(true);
      let employeeId: string | null = null;
      
      if (user?.employee_id) {
        employeeId = user.employee_id;
      } else {
        const employeeDataStr = sessionStorage.getItem('employee_data');
        if (employeeDataStr) {
          const data = JSON.parse(employeeDataStr);
          employeeId = data.id;
        }
      }

      if (employeeId) {
        const all = await employeeService.getAll();
        const found = all.find(e => e.id.toString() === employeeId || (e.employee_id || e.employeeId) === employeeId);
        if (found) setEmployee(found);
      }
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

  const loadEducation = async () => {
    if (!employee?.id) return;
    try {
      const records = await employeeEducationService.getByEmployee(employee.id);
      setEducationRecords(records);
    } catch (error) {
      console.error('Failed to load education records', error);
    }
  };

  const loadBankDetails = async () => {
    if (!employee?.id) return;
    try {
      const details = await employeeBankDetailsService.getByEmployee(employee.id);
      setBankDetails(details);
    } catch (error) {
      console.error('Failed to load bank details', error);
    }
  };

  const loadImmigration = async () => {
    if (!employee?.id) return;
    try {
      const immigrationData = await employeeImmigrationService.getByEmployee(employee.id);
      setImmigration(immigrationData);
    } catch (error) {
      console.error('Failed to load immigration data', error);
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
      const entries = await timesheetService.getByEmployee(employee.id);
      setTimesheetEntries(entries);
    } catch (error) {
      console.error('Failed to load timesheet entries', error);
    }
  };

  const handleDownload = (url: string, name: string) => {
    window.open(url, '_blank');
  };

  const calculateHours = (startTime: string, endTime: string, breakMinutes: number = 0): number => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    const diffMinutes = endTotal - startTotal - breakMinutes;
    return Math.max(0, diffMinutes / 60);
  };

  const getShiftsForDay = (dayOfWeek: number): EmployeeShift[] => {
    return employeeShifts.filter(shift => shift.day_of_week === dayOfWeek);
  };

  const getTotalHoursForDay = (dayOfWeek: number): number => {
    const dayShifts = getShiftsForDay(dayOfWeek);
    return dayShifts.reduce((total, shift) => {
      return total + calculateHours(shift.start_time, shift.end_time, shift.break_duration_minutes);
    }, 0);
  };

  if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!employee) return <div className="p-8 text-center">{t('common.noData')}</div>;

  const emp = employee;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      {/* Compact Profile Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-white/10 mb-4">
        <Card className="border-0 rounded-none md:rounded-xl md:mx-4 md:mt-4 shadow-none md:shadow-lg">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative flex-shrink-0 group">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center text-2xl md:text-3xl font-bold text-white shadow-lg relative overflow-hidden">
                  {(emp.avatar_url && emp.avatar_url !== `https://ui-avatars.com/api/?name=${emp.first_name}+${emp.last_name}`) ? (
                    <img src={emp.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span>
                      {getEmployeeInitials(emp)}
                    </span>
                  )}
                  {/* Upload Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-xl" onClick={() => avatarInputRef.current?.click()}>
                    <Camera size={18} className="text-white md:w-5 md:h-5" />
                  </div>
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-xl">
                      <div className="text-white text-xs md:text-sm">{t('common.uploading') || 'Uploading...'}</div>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full bg-green-500 border-2 border-card" />
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>

              {/* Name and Basic Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-lg md:text-2xl font-bold truncate" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
                      {getEmployeeDisplayName(emp)}
                    </h1>
                  </div>
                  <Badge variant={emp.status === 'Active' ? 'success' : 'warning'} className="text-xs md:text-sm px-2 md:px-3 py-1">
                    {emp.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Briefcase size={12} />
                    {(emp as any).jobs?.name || emp.designation || 'N/A'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 size={12} />
                    {(emp as any).departments?.name || emp.department || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{t('employeeProfile.employeeIdLabel')} {emp.employee_id || emp.employeeId || t('employeeProfile.notApplicable')}</span>
                  {(emp as any).external_id && <span>• {t('employeeProfile.fingerprintCodeLabel')} {(emp as any).external_id}</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Cards */}
      {leaveBalance && (
        <div className="px-4 md:px-4 mb-4">
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <Card className="p-3 md:p-4 text-center border-primary/20 bg-primary/5">
              <div className="text-xs md:text-sm text-muted-foreground mb-1">{t('employeeProfile.annualLeave')}</div>
              <div className="text-lg md:text-2xl font-bold text-primary">
                {leaveBalance.annual_leave.available.toFixed(0)}
              </div>
              <div className="text-[10px] md:text-xs text-muted-foreground">{t('common.days')}</div>
            </Card>
            <Card className="p-3 md:p-4 text-center border-blue-500/20 bg-blue-500/5">
              <div className="text-xs md:text-sm text-muted-foreground mb-1">{t('employeeProfile.sickLeave')}</div>
              <div className="text-lg md:text-2xl font-bold text-blue-400">
                {leaveBalance.sick_leave.available.toFixed(0)}
              </div>
              <div className="text-[10px] md:text-xs text-muted-foreground">{t('common.days')}</div>
            </Card>
            <Card className="p-3 md:p-4 text-center border-purple-500/20 bg-purple-500/5">
              <div className="text-xs md:text-sm text-muted-foreground mb-1">{t('employeeProfile.emergencyLeave')}</div>
              <div className="text-lg md:text-2xl font-bold text-purple-400">
                {leaveBalance.emergency_leave.available.toFixed(0)}
              </div>
              <div className="text-[10px] md:text-xs text-muted-foreground">{t('common.days')}</div>
            </Card>
          </div>
        </div>
      )}

      {/* Accordion Sections */}
      <div className="px-4 md:px-4 space-y-3">
        <Accordion type="single" collapsible defaultValue="personal" className="w-full space-y-3">
          {/* Personal Information */}
          <AccordionItem value="personal" className="border border-white/10 rounded-xl overflow-hidden bg-card/50">
            <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <User size={20} className="text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">{t('employees.personalInfo')}</div>
                  <div className="text-xs text-muted-foreground">{t('employeeProfile.basicPersonalDetails')}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('common.firstName')}</div>
                  <div className="font-semibold" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>{getEmployeeFirstName(emp)}</div>
                </div>
                {(emp.middle_name || emp.middleName || (i18n.language === 'ar' && (emp.arabic_middle_name || emp.arabicMiddleName))) && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">{t('employees.middleName') || 'Middle Name'}</div>
                    <div className="font-semibold" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
                      {i18n.language === 'ar' 
                        ? (emp.arabic_middle_name || emp.arabicMiddleName || emp.middle_name || emp.middleName)
                        : (emp.middle_name || emp.middleName || emp.arabic_middle_name || emp.arabicMiddleName)
                      }
                    </div>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('common.lastName')}</div>
                  <div className="font-semibold" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>{getEmployeeLastName(emp)}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('employees.dateOfBirth')}</div>
                  <div className="font-semibold">
                    {emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('employees.gender')}</div>
                  <div className="font-semibold">{emp.gender || 'N/A'}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('employees.maritalStatus')}</div>
                  <div className="font-semibold">{emp.marital_status || 'N/A'}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('employees.nationality')}</div>
                  <div className="font-semibold">{emp.nationality || 'N/A'}</div>
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
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <h3 className="text-sm font-semibold mb-3">
                      {isArabic ? (t('common.name') || 'Name') + ' (English)' : (t('employees.arabicName') || 'Arabic Name')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      {isArabic ? (
                        <>
                          {emp.first_name && (
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="text-xs text-muted-foreground mb-1">{t('common.firstName')}</div>
                              <div className="font-semibold">{emp.first_name || emp.firstName}</div>
                            </div>
                          )}
                          {emp.middle_name && (
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="text-xs text-muted-foreground mb-1">{t('employees.middleName') || 'Middle Name'}</div>
                              <div className="font-semibold">{emp.middle_name || emp.middleName}</div>
                            </div>
                          )}
                          {emp.last_name && (
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="text-xs text-muted-foreground mb-1">{t('common.lastName')}</div>
                              <div className="font-semibold">{emp.last_name || emp.lastName}</div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {(emp.arabic_first_name || emp.arabicFirstName) && (
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="text-xs text-muted-foreground mb-1">{t('employees.arabicFirstName') || 'Arabic First Name'}</div>
                              <div className="font-semibold" dir="rtl">{emp.arabic_first_name || emp.arabicFirstName}</div>
                            </div>
                          )}
                          {(emp.arabic_middle_name || emp.arabicMiddleName) && (
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="text-xs text-muted-foreground mb-1">{t('employees.arabicMiddleName') || 'Arabic Middle Name'}</div>
                              <div className="font-semibold" dir="rtl">{emp.arabic_middle_name || emp.arabicMiddleName}</div>
                            </div>
                          )}
                          {(emp.arabic_last_name || emp.arabicLastName) && (
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="text-xs text-muted-foreground mb-1">{t('employees.arabicLastName') || 'Arabic Last Name'}</div>
                              <div className="font-semibold" dir="rtl">{emp.arabic_last_name || emp.arabicLastName}</div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </AccordionContent>
          </AccordionItem>

          {/* Contact Information */}
          <AccordionItem value="contact" className="border border-white/10 rounded-xl overflow-hidden bg-card/50">
            <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Phone size={20} className="text-blue-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">{t('employees.contactInfo')}</div>
                  <div className="text-xs text-muted-foreground">{t('employeeProfile.emailPhoneAddress')}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Mail size={12} /> {t('common.email')}
                    </div>
                    <div className="font-semibold text-sm break-all">{emp.email}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Phone size={12} /> {t('employees.phone')}
                    </div>
                    <div className="font-semibold">{emp.phone || 'N/A'}</div>
                  </div>
                  {emp.alternate_phone && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-xs text-muted-foreground mb-1">{t('employees.alternatePhone')}</div>
                      <div className="font-semibold">{emp.alternate_phone}</div>
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10 md:col-span-2">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <MapPin size={12} /> {t('employees.address')}
                    </div>
                    <div className="font-semibold">{emp.address || 'N/A'}</div>
                    {(emp.city || emp.state || emp.country) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {[emp.city, emp.state, emp.country].filter(Boolean).join(', ')}
                        {emp.postal_code && ` - ${emp.postal_code}`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="pt-4 border-t border-white/10">
                  <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Shield size={16} className="text-red-400" />
                    {t('employees.emergencyContact')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <div className="text-xs text-muted-foreground mb-1">{t('common.name')}</div>
                      <div className="font-semibold">{emp.emergency_contact_name || 'N/A'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <div className="text-xs text-muted-foreground mb-1">{t('employees.phone')}</div>
                      <div className="font-semibold">{emp.emergency_contact_phone || 'N/A'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <div className="text-xs text-muted-foreground mb-1">{t('employees.relationship')}</div>
                      <div className="font-semibold">{emp.emergency_contact_relationship || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Employment Details */}
          <AccordionItem value="employment" className="border border-white/10 rounded-xl overflow-hidden bg-card/50">
            <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <Briefcase size={20} className="text-indigo-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">{t('employees.employmentDetails')}</div>
                  <div className="text-xs text-muted-foreground">{t('employeeProfile.jobDepartmentSalary')}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('employees.department')}</div>
                  <div className="font-semibold">{(emp as any).departments?.name || emp.department || 'N/A'}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('common.job')}</div>
                  <div className="font-semibold">{(emp as any).jobs?.name || emp.position || emp.designation || 'N/A'}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('employees.employmentType')}</div>
                  <Badge variant="outline" className="mt-1">{emp.employment_type || 'N/A'}</Badge>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('employees.joinDate')}</div>
                  <div className="font-semibold">
                    {emp.join_date ? new Date(emp.join_date).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('employees.salary')}</div>
                  <div className="font-bold text-lg text-primary">
                    {emp.salary ? `${parseFloat(emp.salary.toString()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('employees.workLocation')}</div>
                  <Badge variant="outline" className="mt-1">{emp.work_location || 'N/A'}</Badge>
                </div>
                {/* Reporting Manager Chain */}
                {reportingManagerChain.length > 0 && (
                  <div className="md:col-span-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Shield size={12} className="text-purple-400" />
                      {t('employees.reportingManagerChain')}
                    </div>
                    <div className="space-y-2">
                      {reportingManagerChain.map((manager, index) => (
                        <div key={manager.id} className="flex items-center gap-2">
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
                              {index === 0 && <span className="ml-1 text-xs text-muted-foreground">{t('employeeProfile.you')}</span>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {(manager as any).jobs?.name || manager.position || manager.designation || 'N/A'}
                            </p>
                          </div>
                          {index < reportingManagerChain.length - 1 && (
                            <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Working Hours */}
          <AccordionItem value="working-hours" className="border border-white/10 rounded-xl overflow-hidden bg-card/50">
            <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Clock size={20} className="text-cyan-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">{t('employees.workingHours')}</div>
                  <div className="text-xs text-muted-foreground">{t('employeeProfile.scheduleAndShifts')}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              {employeeShifts.length > 0 ? (
                <div className="space-y-3">
                  {[
                    { day: 0, label: t('employeeProfile.sunday') },
                    { day: 1, label: t('employeeProfile.monday') },
                    { day: 2, label: t('employeeProfile.tuesday') },
                    { day: 3, label: t('employeeProfile.wednesday') },
                    { day: 4, label: t('employeeProfile.thursday') },
                    { day: 5, label: t('employeeProfile.friday') },
                    { day: 6, label: t('employeeProfile.saturday') }
                  ].map(({ day, label }) => {
                    const dayShifts = getShiftsForDay(day);
                    const totalHours = getTotalHoursForDay(day);
                    if (dayShifts.length === 0) return null;
                    
                    return (
                      <div key={day} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-semibold">{label}</div>
                          <Badge variant="outline" className="text-xs">{totalHours.toFixed(1)}h</Badge>
                        </div>
                        {dayShifts.map((shift, idx) => {
                          const hours = calculateHours(shift.start_time, shift.end_time, shift.break_duration_minutes);
                          return (
                            <div key={idx} className="text-sm text-muted-foreground">
                              {shift.shift_name && <span className="font-medium">{shift.shift_name}: </span>}
                              {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                              {shift.break_duration_minutes > 0 && ` (${shift.break_duration_minutes}m ${t('employeeProfile.break')})`}
                              <span className="ml-2 text-primary">({hours.toFixed(1)}h)</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : workingHours ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: t('employeeProfile.sunday'), hours: workingHours.sunday_hours || 0 },
                    { label: t('employeeProfile.monday'), hours: workingHours.monday_hours || 0 },
                    { label: t('employeeProfile.tuesday'), hours: workingHours.tuesday_hours || 0 },
                    { label: t('employeeProfile.wednesday'), hours: workingHours.wednesday_hours || 0 },
                    { label: t('employeeProfile.thursday'), hours: workingHours.thursday_hours || 0 },
                    { label: t('employeeProfile.friday'), hours: workingHours.friday_hours || 0 },
                    { label: t('employeeProfile.saturday'), hours: workingHours.saturday_hours || 0 }
                  ].map(({ label, hours }) => (
                    <div key={label} className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <div className="text-xs text-muted-foreground mb-1">{label}</div>
                      <div className="font-bold text-lg">{hours}h</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">{t('employeeProfile.noWorkingHoursConfigured')}</div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Payroll */}
          <AccordionItem value="payroll" className="border border-white/10 rounded-xl overflow-hidden bg-card/50">
            <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <DollarSign size={20} className="text-emerald-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">{t('employeeProfile.payrollInformation')}</div>
                  <div className="text-xs text-muted-foreground">{t('employeeProfile.salaryBreakdown')}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold mb-3 text-green-400">{t('employeeProfile.earnings')}</div>
                  <div className="space-y-2">
                    {(emp as any).base_salary && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm">{t('employeeProfile.baseSalary')}</span>
                        <span className="font-bold">{parseFloat((emp as any).base_salary || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                      </div>
                    )}
                    {(emp as any).housing_allowance && parseFloat((emp as any).housing_allowance || '0') > 0 && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm">{t('employeeProfile.housingAllowance')}</span>
                        <span className="font-bold">{parseFloat((emp as any).housing_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                      </div>
                    )}
                    {(emp as any).transport_allowance && parseFloat((emp as any).transport_allowance || '0') > 0 && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm">{t('employeeProfile.transportAllowance')}</span>
                        <span className="font-bold">{parseFloat((emp as any).transport_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                      </div>
                    )}
                    {(emp as any).meal_allowance && parseFloat((emp as any).meal_allowance || '0') > 0 && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm">{t('employeeProfile.mealAllowance')}</span>
                        <span className="font-bold">{parseFloat((emp as any).meal_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                      </div>
                    )}
                    {(emp as any).medical_allowance && parseFloat((emp as any).medical_allowance || '0') > 0 && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm">{t('employeeProfile.medicalAllowance')}</span>
                        <span className="font-bold">{parseFloat((emp as any).medical_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <div className="text-sm font-semibold mb-3 text-red-400">{t('employeeProfile.deductions')}</div>
                  <div className="space-y-2">
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const gosiAmount = baseSalary * 0.105;
                      return gosiAmount > 0 ? (
                        <div className="flex justify-between items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <span className="text-sm">{t('employeeProfile.socialSecurityGOSI')}</span>
                          <span className="font-bold">{gosiAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="pt-4 border-t-2 border-primary/30">
                  <div className="flex justify-between items-center p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="font-bold text-lg">{t('employeeProfile.netSalary')}</span>
                    <span className="font-bold text-2xl text-primary">
                      {(() => {
                        const baseSalary = parseFloat((emp as any).base_salary || '0');
                        const housing = parseFloat((emp as any).housing_allowance || '0');
                        const transport = parseFloat((emp as any).transport_allowance || '0');
                        const meal = parseFloat((emp as any).meal_allowance || '0');
                        const medical = parseFloat((emp as any).medical_allowance || '0');
                        const other = parseFloat((emp as any).other_allowances || '0');
                        const totalEarnings = baseSalary + housing + transport + meal + medical + other;
                        const gosiAmount = baseSalary * 0.105;
                        const netSalary = totalEarnings - gosiAmount;
                        return netSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()} KD
                    </span>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Leave Balance */}
          {leaveBalance && (
            <AccordionItem value="leave-balance" className="border border-white/10 rounded-xl overflow-hidden bg-card/50">
              <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Calendar size={20} className="text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-base">{t('employeeProfile.leaveBalance')}</div>
                    <div className="text-xs text-muted-foreground">{t('employeeProfile.availableLeaveDays')}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 md:px-6 pb-6">
                <div className="space-y-4">
                  {/* Annual Leave */}
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="font-semibold mb-3">{t('employeeProfile.annualLeave')}</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.accrued')}</div>
                        <div className="text-lg font-bold text-blue-400">{leaveBalance.annual_leave.accrued.toFixed(1)}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.used')}</div>
                        <div className="text-lg font-bold text-orange-400">{leaveBalance.annual_leave.used}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.pending')}</div>
                        <div className="text-lg font-bold text-yellow-400">{leaveBalance.annual_leave.pending}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.available')}</div>
                        <div className="text-lg font-bold text-green-400">{leaveBalance.annual_leave.available.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Sick Leave */}
                  <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <div className="font-semibold mb-3">{t('employeeProfile.sickLeave')}</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.accrued')}</div>
                        <div className="text-lg font-bold text-blue-400">{leaveBalance.sick_leave.accrued.toFixed(1)}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.used')}</div>
                        <div className="text-lg font-bold text-orange-400">{leaveBalance.sick_leave.used}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.pending')}</div>
                        <div className="text-lg font-bold text-yellow-400">{leaveBalance.sick_leave.pending}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.available')}</div>
                        <div className="text-lg font-bold text-green-400">{leaveBalance.sick_leave.available.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Leave */}
                  <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <div className="font-semibold mb-3">{t('employeeProfile.emergencyLeave')}</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.accrued')}</div>
                        <div className="text-lg font-bold text-blue-400">{leaveBalance.emergency_leave.accrued.toFixed(1)}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.used')}</div>
                        <div className="text-lg font-bold text-orange-400">{leaveBalance.emergency_leave.used}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.pending')}</div>
                        <div className="text-lg font-bold text-yellow-400">{leaveBalance.emergency_leave.pending}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">{t('employeeProfile.available')}</div>
                        <div className="text-lg font-bold text-green-400">{leaveBalance.emergency_leave.available.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Education */}
          <AccordionItem value="education" className="border border-white/10 rounded-xl overflow-hidden bg-card/50">
            <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <GraduationCap size={20} className="text-purple-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">{t('employeeProfile.education')}</div>
                  <div className="text-xs text-muted-foreground">{educationRecords.length} {educationRecords.length !== 1 ? t('employeeProfile.records') : t('employeeProfile.record')}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              {educationRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap size={48} className="mx-auto mb-4 opacity-50" />
                  <p>{t('employeeProfile.noEducationRecordsFound')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {educationRecords.map((edu) => (
                    <div key={edu.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-base">{edu.institution_name}</h3>
                        {edu.is_primary && <Badge variant="default" className="text-xs">{t('employeeProfile.primary')}</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">{t('employeeProfile.place')}</div>
                          <div className="font-medium">{edu.place_of_graduation}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{t('employeeProfile.year')}</div>
                          <div className="font-medium">{edu.graduation_year}</div>
                        </div>
                        {edu.degree_type && (
                          <div>
                            <div className="text-xs text-muted-foreground">{t('employeeProfile.degree')}</div>
                            <div className="font-medium">{edu.degree_type}</div>
                          </div>
                        )}
                        {edu.field_of_study && (
                          <div>
                            <div className="text-xs text-muted-foreground">{t('employeeProfile.field')}</div>
                            <div className="font-medium">{edu.field_of_study}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Bank Details */}
          <AccordionItem value="bank" className="border border-white/10 rounded-xl overflow-hidden bg-card/50">
            <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CreditCard size={20} className="text-green-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">{t('employeeProfile.bankDetails')}</div>
                  <div className="text-xs text-muted-foreground">{t('employeeProfile.accountInformation')}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              {!bankDetails ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                  <p>{t('employeeProfile.noBankDetailsFound')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">{t('employeeProfile.bankName')}</div>
                    <div className="font-semibold">{bankDetails.bank_name}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">{t('employeeProfile.accountNumber')}</div>
                    <div className="font-semibold font-mono">{bankDetails.account_number}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">{t('employeeProfile.accountHolder')}</div>
                    <div className="font-semibold">{bankDetails.account_holder_name}</div>
                  </div>
                  {bankDetails.branch_name && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-xs text-muted-foreground mb-1">{t('employeeProfile.branch')}</div>
                      <div className="font-semibold">{bankDetails.branch_name}</div>
                    </div>
                  )}
                  {bankDetails.iban && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 md:col-span-2">
                      <div className="text-xs text-muted-foreground mb-1">{t('employeeProfile.iban')}</div>
                      <div className="font-semibold font-mono">{bankDetails.iban}</div>
                    </div>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Immigration */}
          <AccordionItem value="immigration" className="border border-white/10 rounded-xl overflow-hidden bg-card/50">
            <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <Globe size={20} className="text-indigo-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">{t('employeeProfile.immigrationDocuments')}</div>
                  <div className="text-xs text-muted-foreground">{t('employeeProfile.workPermitsVisasRenewals')}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              {!immigration ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe size={48} className="mx-auto mb-4 opacity-50" />
                  <p>{t('employeeProfile.noImmigrationRecordsFound')}</p>
                </div>
              ) : (
                <EmployeeImmigrationView immigration={immigration} employee={emp} />
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Requests */}
          <AccordionItem value="requests" className="border border-white/10 rounded-xl overflow-hidden bg-card/50">
            <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <FileText size={20} className="text-orange-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">{t('employeeProfile.requests')}</div>
                  <div className="text-xs text-muted-foreground">
                    {leaveRequests.length + documentRequests.length + employeeRequests.length} {t('employeeProfile.totalRequests')}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              <div className="space-y-4">
                {leaveRequests.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <CalendarIcon size={16} /> {t('employeeProfile.leaveRequests')} ({leaveRequests.length})
                    </div>
                    <div className="space-y-2">
                      {leaveRequests.slice(0, 5).map((req) => (
                        <div key={req.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-sm">{req.leave_type}</span>
                            <StatusBadge status={req.status} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {documentRequests.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <FileTextIcon size={16} /> {t('employeeProfile.documentRequests')} ({documentRequests.length})
                    </div>
                    <div className="space-y-2">
                      {documentRequests.slice(0, 5).map((req) => (
                        <div key={req.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-sm">{req.document_type}</span>
                            <StatusBadge status={req.status} />
                          </div>
                          {req.purpose && <div className="text-xs text-muted-foreground">{req.purpose}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {employeeRequests.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <FileTextIcon size={16} /> {t('employeeProfile.generalRequests')} ({employeeRequests.length})
                    </div>
                    <div className="space-y-2">
                      {employeeRequests.slice(0, 5).map((req) => (
                        <div key={req.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-sm">{req.request_type}</span>
                            <StatusBadge status={req.status} />
                          </div>
                          <div className="text-xs text-muted-foreground">{req.request_category}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {leaveRequests.length === 0 && documentRequests.length === 0 && employeeRequests.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">{t('employeeProfile.noRequestsFound')}</div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Timesheet Section */}
          <AccordionItem value="timesheet">
            <AccordionTrigger className="px-4 md:px-6">
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-blue-400 md:w-5 md:h-5" />
                <div className="text-left">
                  <div className="font-semibold text-sm md:text-base">{t('employeeProfile.timesheet')}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">{t('employeeProfile.workHoursReports')}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              <div className="space-y-4">
                {timesheetEntries.length > 0 ? (
                  <>
                    <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Clock size={16} /> {t('employeeProfile.recentEntries')} ({timesheetEntries.length})
                    </div>
                    <div className="space-y-2">
                      {timesheetEntries.slice(0, 10).map((entry) => (
                        <div key={entry.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                          {/* Header: Date and Status */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Calendar size={14} className="text-muted-foreground flex-shrink-0" />
                            <span className="font-semibold text-xs md:text-sm">
                              {new Date(entry.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                            <StatusBadge status={entry.is_submitted ? 'Completed' : 'Draft'} />
                          </div>
                          
                          {/* Details: Hours, Project, Type */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 mb-2">
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock size={12} className="flex-shrink-0" />
                              <span className="font-medium text-foreground">{entry.hours_worked}h</span>
                            </span>
                            {entry.project_name && (
                              <span className="text-xs text-muted-foreground">
                                <span className="font-medium">{t('employeeProfile.project')}</span> {entry.project_name}
                              </span>
                            )}
                            {entry.task_type && (
                              <Badge variant="outline" className="text-xs w-fit">{entry.task_type}</Badge>
                            )}
                          </div>
                          
                          {/* Description */}
                          {entry.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <a
                        href="/self-service/timesheet"
                        className="text-sm text-primary hover:underline font-medium"
                      >
                        {t('employeeProfile.viewAllTimesheetEntries')}
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock size={48} className="mx-auto mb-4 opacity-50" />
                    <p>{t('employeeProfile.noTimesheetEntriesFound')}</p>
                    <a
                      href="/self-service/timesheet"
                      className="text-sm text-primary hover:underline mt-2 inline-block"
                    >
                      {t('employeeProfile.logTime')}
                    </a>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Documents */}
          <AccordionItem value="documents" className="border border-white/10 rounded-xl overflow-hidden bg-card/50">
            <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <FileText size={20} className="text-cyan-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base">{t('employees.documents')}</div>
                  <div className="text-xs text-muted-foreground">{documents.length} document{documents.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              {documentsLoading ? (
                <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText size={48} className="mx-auto mb-4 opacity-50" />
                  <p>{t('documents.noDocuments') || 'No documents uploaded yet'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <FileText size={18} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {doc.folder || doc.category || 'General'} • {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(doc.url, doc.name)}>
                        <Download size={18} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

