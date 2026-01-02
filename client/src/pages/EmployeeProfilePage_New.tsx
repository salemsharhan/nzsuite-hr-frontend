import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, FileText, Clock, DollarSign, Shield, MapPin, Phone, Mail, Calendar, Briefcase, Building2, GraduationCap, CreditCard, Globe, FileCheck, AlertCircle, Download } from 'lucide-react';
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
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Calendar as CalendarIcon, FileText as FileTextIcon } from 'lucide-react';

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
    }
  }, [employee?.id]);

  useEffect(() => {
    if (employee?.id && user?.company_id) {
      loadLeaveBalance();
    }
  }, [employee?.id, user?.company_id]);

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
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center text-2xl md:text-3xl font-bold text-white shadow-lg">
                  {(emp.avatar_url && emp.avatar_url !== `https://ui-avatars.com/api/?name=${emp.first_name}+${emp.last_name}`) ? (
                    <img src={emp.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span>
                      {(emp.first_name || emp.firstName || 'U')[0]}{(emp.last_name || emp.lastName || 'N')[0]}
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full bg-green-500 border-2 border-card" />
              </div>

              {/* Name and Basic Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h1 className="text-lg md:text-2xl font-bold truncate">
                    {emp.first_name || emp.firstName} {emp.last_name || emp.lastName}
                  </h1>
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
                  <span>ID: {emp.employee_id || emp.employeeId || 'N/A'}</span>
                  {(emp as any).external_id && <span>• FP: {(emp as any).external_id}</span>}
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
              <div className="text-xs md:text-sm text-muted-foreground mb-1">Annual Leave</div>
              <div className="text-lg md:text-2xl font-bold text-primary">
                {leaveBalance.annual_leave.available.toFixed(0)}
              </div>
              <div className="text-[10px] md:text-xs text-muted-foreground">days</div>
            </Card>
            <Card className="p-3 md:p-4 text-center border-blue-500/20 bg-blue-500/5">
              <div className="text-xs md:text-sm text-muted-foreground mb-1">Sick Leave</div>
              <div className="text-lg md:text-2xl font-bold text-blue-400">
                {leaveBalance.sick_leave.available.toFixed(0)}
              </div>
              <div className="text-[10px] md:text-xs text-muted-foreground">days</div>
            </Card>
            <Card className="p-3 md:p-4 text-center border-purple-500/20 bg-purple-500/5">
              <div className="text-xs md:text-sm text-muted-foreground mb-1">Emergency</div>
              <div className="text-lg md:text-2xl font-bold text-purple-400">
                {leaveBalance.emergency_leave.available.toFixed(0)}
              </div>
              <div className="text-[10px] md:text-xs text-muted-foreground">days</div>
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
                  <div className="text-xs text-muted-foreground">Basic personal details</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('common.firstName')}</div>
                  <div className="font-semibold">{emp.first_name || emp.firstName}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-1">{t('common.lastName')}</div>
                  <div className="font-semibold">{emp.last_name || emp.lastName}</div>
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
                  <div className="text-xs text-muted-foreground">Email, phone, address</div>
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
                  <div className="text-xs text-muted-foreground">Job, department, salary</div>
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
                  <div className="text-xs text-muted-foreground">Schedule and shifts</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              {employeeShifts.length > 0 ? (
                <div className="space-y-3">
                  {[
                    { day: 0, label: 'Sunday' },
                    { day: 1, label: 'Monday' },
                    { day: 2, label: 'Tuesday' },
                    { day: 3, label: 'Wednesday' },
                    { day: 4, label: 'Thursday' },
                    { day: 5, label: 'Friday' },
                    { day: 6, label: 'Saturday' }
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
                              {shift.break_duration_minutes > 0 && ` (${shift.break_duration_minutes}m break)`}
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
                    { label: 'Sunday', hours: workingHours.sunday_hours || 0 },
                    { label: 'Monday', hours: workingHours.monday_hours || 0 },
                    { label: 'Tuesday', hours: workingHours.tuesday_hours || 0 },
                    { label: 'Wednesday', hours: workingHours.wednesday_hours || 0 },
                    { label: 'Thursday', hours: workingHours.thursday_hours || 0 },
                    { label: 'Friday', hours: workingHours.friday_hours || 0 },
                    { label: 'Saturday', hours: workingHours.saturday_hours || 0 }
                  ].map(({ label, hours }) => (
                    <div key={label} className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <div className="text-xs text-muted-foreground mb-1">{label}</div>
                      <div className="font-bold text-lg">{hours}h</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No working hours configured</div>
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
                  <div className="font-semibold text-base">Payroll Information</div>
                  <div className="text-xs text-muted-foreground">Salary breakdown</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold mb-3 text-green-400">EARNINGS</div>
                  <div className="space-y-2">
                    {(emp as any).base_salary && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm">Base Salary</span>
                        <span className="font-bold">{parseFloat((emp as any).base_salary || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                      </div>
                    )}
                    {(emp as any).housing_allowance && parseFloat((emp as any).housing_allowance || '0') > 0 && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm">Housing Allowance</span>
                        <span className="font-bold">{parseFloat((emp as any).housing_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                      </div>
                    )}
                    {(emp as any).transport_allowance && parseFloat((emp as any).transport_allowance || '0') > 0 && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm">Transport Allowance</span>
                        <span className="font-bold">{parseFloat((emp as any).transport_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                      </div>
                    )}
                    {(emp as any).meal_allowance && parseFloat((emp as any).meal_allowance || '0') > 0 && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm">Meal Allowance</span>
                        <span className="font-bold">{parseFloat((emp as any).meal_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                      </div>
                    )}
                    {(emp as any).medical_allowance && parseFloat((emp as any).medical_allowance || '0') > 0 && (
                      <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm">Medical Allowance</span>
                        <span className="font-bold">{parseFloat((emp as any).medical_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <div className="text-sm font-semibold mb-3 text-red-400">DEDUCTIONS</div>
                  <div className="space-y-2">
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const gosiAmount = baseSalary * 0.105;
                      return gosiAmount > 0 ? (
                        <div className="flex justify-between items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <span className="text-sm">Social Security (GOSI)</span>
                          <span className="font-bold">{gosiAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KD</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="pt-4 border-t-2 border-primary/30">
                  <div className="flex justify-between items-center p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="font-bold text-lg">Net Salary</span>
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
                    <div className="font-semibold text-base">Leave Balance</div>
                    <div className="text-xs text-muted-foreground">Available leave days</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 md:px-6 pb-6">
                <div className="space-y-4">
                  {/* Annual Leave */}
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="font-semibold mb-3">Annual Leave</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Accrued</div>
                        <div className="text-lg font-bold text-blue-400">{leaveBalance.annual_leave.accrued.toFixed(1)}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Used</div>
                        <div className="text-lg font-bold text-orange-400">{leaveBalance.annual_leave.used}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Pending</div>
                        <div className="text-lg font-bold text-yellow-400">{leaveBalance.annual_leave.pending}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Available</div>
                        <div className="text-lg font-bold text-green-400">{leaveBalance.annual_leave.available.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Sick Leave */}
                  <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <div className="font-semibold mb-3">Sick Leave</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Accrued</div>
                        <div className="text-lg font-bold text-blue-400">{leaveBalance.sick_leave.accrued.toFixed(1)}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Used</div>
                        <div className="text-lg font-bold text-orange-400">{leaveBalance.sick_leave.used}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Pending</div>
                        <div className="text-lg font-bold text-yellow-400">{leaveBalance.sick_leave.pending}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Available</div>
                        <div className="text-lg font-bold text-green-400">{leaveBalance.sick_leave.available.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Leave */}
                  <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <div className="font-semibold mb-3">Emergency Leave</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Accrued</div>
                        <div className="text-lg font-bold text-blue-400">{leaveBalance.emergency_leave.accrued.toFixed(1)}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Used</div>
                        <div className="text-lg font-bold text-orange-400">{leaveBalance.emergency_leave.used}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Pending</div>
                        <div className="text-lg font-bold text-yellow-400">{leaveBalance.emergency_leave.pending}</div>
                      </div>
                      <div className="text-center p-2 rounded bg-white/5">
                        <div className="text-xs text-muted-foreground">Available</div>
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
                  <div className="font-semibold text-base">Education</div>
                  <div className="text-xs text-muted-foreground">{educationRecords.length} record{educationRecords.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              {educationRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No education records found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {educationRecords.map((edu) => (
                    <div key={edu.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-base">{edu.institution_name}</h3>
                        {edu.is_primary && <Badge variant="default" className="text-xs">Primary</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Place</div>
                          <div className="font-medium">{edu.place_of_graduation}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Year</div>
                          <div className="font-medium">{edu.graduation_year}</div>
                        </div>
                        {edu.degree_type && (
                          <div>
                            <div className="text-xs text-muted-foreground">Degree</div>
                            <div className="font-medium">{edu.degree_type}</div>
                          </div>
                        )}
                        {edu.field_of_study && (
                          <div>
                            <div className="text-xs text-muted-foreground">Field</div>
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
                  <div className="font-semibold text-base">Bank Details</div>
                  <div className="text-xs text-muted-foreground">Account information</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              {!bankDetails ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No bank details found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">Bank Name</div>
                    <div className="font-semibold">{bankDetails.bank_name}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">Account Number</div>
                    <div className="font-semibold font-mono">{bankDetails.account_number}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">Account Holder</div>
                    <div className="font-semibold">{bankDetails.account_holder_name}</div>
                  </div>
                  {bankDetails.branch_name && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-xs text-muted-foreground mb-1">Branch</div>
                      <div className="font-semibold">{bankDetails.branch_name}</div>
                    </div>
                  )}
                  {bankDetails.iban && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 md:col-span-2">
                      <div className="text-xs text-muted-foreground mb-1">IBAN</div>
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
                  <div className="font-semibold text-base">Immigration</div>
                  <div className="text-xs text-muted-foreground">Work permits & visas</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              {!immigration ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No immigration records found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {immigration.next_renewal_date && (
                    <div className={`p-3 rounded-lg border-2 ${
                      immigration.renewal_priority === 'Urgent' ? 'bg-red-500/20 border-red-500/50' :
                      immigration.renewal_priority === 'High' ? 'bg-orange-500/20 border-orange-500/50' :
                      'bg-blue-500/20 border-blue-500/50'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={18} className={immigration.renewal_priority === 'Urgent' ? 'text-red-400' : 'text-orange-400'} />
                        <span className="font-semibold text-sm">Next Renewal</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {immigration.next_renewal_action} - {new Date(immigration.next_renewal_date).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {immigration.work_permit_number && (
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-xs text-muted-foreground mb-1">Work Permit</div>
                        <div className="font-semibold">{immigration.work_permit_number}</div>
                        {immigration.work_permit_expiry_date && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Expires: {new Date(immigration.work_permit_expiry_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                    {immigration.residence_permit_number && (
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-xs text-muted-foreground mb-1">Residence Permit</div>
                        <div className="font-semibold">{immigration.residence_permit_number}</div>
                        {immigration.residence_permit_expiry_date && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Expires: {new Date(immigration.residence_permit_expiry_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                    {immigration.passport_number && (
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-xs text-muted-foreground mb-1">Passport</div>
                        <div className="font-semibold">{immigration.passport_number}</div>
                        {immigration.passport_expiry_date && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Expires: {new Date(immigration.passport_expiry_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                    {immigration.civil_id_number && (
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-xs text-muted-foreground mb-1">Civil ID</div>
                        <div className="font-semibold">{immigration.civil_id_number}</div>
                      </div>
                    )}
                  </div>
                </div>
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
                  <div className="font-semibold text-base">Requests</div>
                  <div className="text-xs text-muted-foreground">
                    {leaveRequests.length + documentRequests.length + employeeRequests.length} total
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 md:px-6 pb-6">
              <div className="space-y-4">
                {leaveRequests.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <CalendarIcon size={16} /> Leave Requests ({leaveRequests.length})
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
                      <FileTextIcon size={16} /> Document Requests ({documentRequests.length})
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
                      <FileTextIcon size={16} /> General Requests ({employeeRequests.length})
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
                  <div className="text-center py-8 text-muted-foreground">No requests found</div>
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

