import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, FileText, Clock, DollarSign, Shield, MapPin, Phone, Mail, Calendar, Briefcase, Building2, GraduationCap, CreditCard, Globe, FileCheck, AlertCircle, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '../components/common/UIComponents';
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
import { Calendar as CalendarIcon, FileText as FileTextIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion';

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
      // Load all data when employee is available
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
      // Try to get employee ID from user context or sessionStorage
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

  const emp = employee; // Shorthand

  return (
    <div className="space-y-4 md:space-y-6 pb-6">
      {/* Modern Header Profile Card - Mobile Optimized */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-xl md:rounded-2xl blur-3xl -z-10" />
        
        <Card className="flex-1 border-0 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="relative">
            <div className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <CardContent className="p-4 md:p-8 relative">
              {/* Mobile Layout: Centered Stack */}
              <div className="flex flex-col items-center md:flex-row md:items-start gap-4 md:gap-6">
                {/* Avatar Section - Centered on Mobile */}
                <div className="relative flex-shrink-0">
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center text-3xl md:text-4xl font-bold text-white shadow-lg shadow-primary/30 border-4 border-white/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                    {(emp.avatar_url && emp.avatar_url !== `https://ui-avatars.com/api/?name=${emp.first_name}+${emp.last_name}`) ? (
                      <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="relative z-10">
                        {(emp.first_name || emp.firstName || 'U')[0]}{(emp.last_name || emp.lastName || 'N')[0]}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 md:w-8 md:h-8 rounded-full bg-green-500 border-2 md:border-4 border-card flex items-center justify-center">
                    <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-400 animate-pulse" />
                  </div>
                </div>

                {/* Employee Info - Centered on Mobile */}
                <div className="flex-1 min-w-0 w-full text-center md:text-left">
                  {/* Name and Status Row */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div className="flex-1">
                      <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-2 break-words">
                        {emp.first_name || emp.firstName} {emp.last_name || emp.lastName}
                      </h1>
                      {/* Role and Department - Stacked on Mobile */}
                      <div className="flex flex-col sm:flex-row items-center md:items-start gap-2 md:gap-3 justify-center md:justify-start">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
                          <Briefcase size={14} className="text-primary flex-shrink-0" />
                          <span className="text-xs md:text-sm font-medium truncate max-w-[200px]">
                            {(emp as any).jobs?.name || emp.designation || emp.position || 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <Building2 size={14} className="text-blue-400 flex-shrink-0" />
                          <span className="text-xs md:text-sm font-medium truncate max-w-[200px]">
                            {(emp as any).departments?.name || emp.department || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge 
                      variant={emp.status === 'Active' ? 'success' : 'warning'} 
                      className="text-sm md:text-base px-4 md:px-5 py-2 rounded-full shadow-lg self-center md:self-start"
                    >
                      {emp.status}
                    </Badge>
                  </div>

                  {/* Info Cards - Grid Layout */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                    <div className="flex flex-col items-center md:items-start gap-1.5 p-2.5 md:p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <User size={14} className="text-primary md:w-4 md:h-4" />
                      </div>
                      <div className="text-center md:text-left w-full">
                        <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Employee ID</p>
                        <p className="text-xs md:text-sm font-semibold truncate">{emp.employee_id || emp.employeeId || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center md:items-start gap-1.5 p-2.5 md:p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Calendar size={14} className="text-blue-400 md:w-4 md:h-4" />
                      </div>
                      <div className="text-center md:text-left w-full">
                        <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Join Date</p>
                        <p className="text-xs md:text-sm font-semibold">
                          {emp.join_date || emp.hireDate ? new Date(emp.join_date || emp.hireDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    {emp.reporting_manager_id && (
                      <div className="flex flex-col items-center md:items-start gap-1.5 p-2.5 md:p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                          <Shield size={14} className="text-purple-400 md:w-4 md:h-4" />
                        </div>
                        <div className="text-center md:text-left w-full">
                          <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Manager</p>
                          <p className="text-xs md:text-sm font-semibold">Assigned</p>
                        </div>
                      </div>
                    )}
                    {(emp as any).external_id && (
                      <div className="flex flex-col items-center md:items-start gap-1.5 p-2.5 md:p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                          <User size={14} className="text-orange-400 md:w-4 md:h-4" />
                        </div>
                        <div className="text-center md:text-left w-full">
                          <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Fingerprint</p>
                          <p className="text-xs md:text-sm font-semibold truncate">{(emp as any).external_id}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>

      {/* Modern Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="relative">
          <TabsList className="flex w-full bg-card/50 backdrop-blur-md border border-white/10 p-1 md:p-1.5 rounded-xl shadow-lg overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 md:gap-1.5 min-w-full md:grid md:grid-cols-11">
              <TabsTrigger 
                value="personal" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg text-[10px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                {t('employees.personalInfo')}
              </TabsTrigger>
              <TabsTrigger 
                value="contact" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg text-[10px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                {t('employees.contactInfo')}
              </TabsTrigger>
              <TabsTrigger 
                value="employment" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg text-[10px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                {t('employees.employmentDetails')}
              </TabsTrigger>
              <TabsTrigger 
                value="working-hours" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg text-[10px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                {t('employees.workingHours')}
              </TabsTrigger>
              <TabsTrigger 
                value="payroll" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg text-[10px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                {t('employees.payrollInfo') || 'Payroll'}
              </TabsTrigger>
              <TabsTrigger 
                value="leave-balance" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg text-[10px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                Leave Balance
              </TabsTrigger>
              <TabsTrigger 
                value="education" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg text-[10px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                Education
              </TabsTrigger>
              <TabsTrigger 
                value="bank" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg text-[10px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                Bank
              </TabsTrigger>
              <TabsTrigger 
                value="immigration" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg text-[10px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                Immigration
              </TabsTrigger>
              <TabsTrigger 
                value="requests" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg text-[10px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                Requests
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-lg text-[10px] md:text-xs px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0"
              >
                {t('employees.documents')}
              </TabsTrigger>
            </div>
          </TabsList>
        </div>

        {/* Personal Info Tab */}
        <TabsContent value="personal" className="mt-6 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <User size={20} className="text-primary md:w-6 md:h-6" />
                {t('employees.personalInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-1 p-3 md:p-4 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                  <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <User size={12} className="text-primary md:w-3.5 md:h-3.5" />
                    {t('common.firstName')}
                  </label>
                  <p className="text-base md:text-lg font-semibold mt-2">{emp.first_name || emp.firstName}</p>
                </div>
                <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <User size={14} className="text-primary" />
                    {t('common.lastName')}
                  </label>
                  <p className="text-lg font-semibold mt-2">{emp.last_name || emp.lastName}</p>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Information Tab */}
        <TabsContent value="contact" className="mt-4 md:mt-6 space-y-4 md:space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Phone size={20} className="text-blue-400 md:w-6 md:h-6" />
                {t('employees.contactInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
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
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Shield size={20} className="text-red-400 md:w-6 md:h-6" />
                {t('employees.emergencyContact')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
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
        <TabsContent value="employment" className="mt-4 md:mt-6 space-y-4 md:space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Briefcase size={20} className="text-indigo-400 md:w-6 md:h-6" />
                {t('employees.employmentDetails')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
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
                {emp.reporting_manager_id && (
                  <div className="space-y-1 p-4 rounded-lg bg-gradient-to-br from-pink-500/5 to-transparent border border-pink-500/10 hover:border-pink-500/20 transition-colors">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Shield size={14} className="text-pink-400" />
                      {t('employees.reportingManager')}
                    </label>
                    <p className="text-sm font-semibold mt-2 text-muted-foreground">ID: {emp.reporting_manager_id.substring(0, 8)}...</p>
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
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const gosiRate = 0.105;
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
                    Annual Leave
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-5 bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-xl border border-blue-500/30 hover:border-blue-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Accrued</p>
                      <p className="text-3xl font-bold text-blue-400 mb-1">{leaveBalance.annual_leave.accrued.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-orange-500/20 to-orange-500/10 rounded-xl border border-orange-500/30 hover:border-orange-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Used</p>
                      <p className="text-3xl font-bold text-orange-400 mb-1">{leaveBalance.annual_leave.used}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-yellow-500/20 to-yellow-500/10 rounded-xl border border-yellow-500/30 hover:border-yellow-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pending</p>
                      <p className="text-3xl font-bold text-yellow-400 mb-1">{leaveBalance.annual_leave.pending}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-xl border border-green-500/30 hover:border-green-500/50 transition-all shadow-lg">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Available</p>
                      <p className="text-3xl font-bold text-green-400 mb-1">{leaveBalance.annual_leave.available.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                  </div>
                  {leaveBalance.annual_leave.expired && leaveBalance.annual_leave.expired > 0 && (
                    <div className="p-4 bg-gradient-to-r from-red-500/20 to-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                        <span className="text-xl">⚠️</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-red-400">
                          Expired: {leaveBalance.annual_leave.expired.toFixed(2)} days
                        </p>
                        <p className="text-xs text-muted-foreground">Unused leave expired after 2 years</p>
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
                          Expiring Soon: {leaveBalance.annual_leave.expiringSoon.toFixed(2)} days
                        </p>
                        <p className="text-xs text-muted-foreground">Will expire within 3 months</p>
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
                          Not eligible for annual leave yet
                        </p>
                        <p className="text-xs text-muted-foreground">Requires 9 months of service</p>
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

        {/* Education Tab */}
        <TabsContent value="education" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap size={20} /> Education
              </CardTitle>
            </CardHeader>
            <CardContent>
              {educationRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No education records found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {educationRecords.map((edu) => (
                    <div key={edu.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-lg">{edu.institution_name}</h3>
                          {edu.is_primary && (
                            <Badge variant="default" className="text-xs">Primary</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Place:</span>
                            <p className="font-medium">{edu.place_of_graduation}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Year:</span>
                            <p className="font-medium">{edu.graduation_year}</p>
                          </div>
                          {edu.degree_type && (
                            <div>
                              <span className="text-muted-foreground">Degree:</span>
                              <p className="font-medium">{edu.degree_type}</p>
                            </div>
                          )}
                          {edu.field_of_study && (
                            <div>
                              <span className="text-muted-foreground">Field:</span>
                              <p className="font-medium">{edu.field_of_study}</p>
                            </div>
                          )}
                          {edu.grade_or_gpa && (
                            <div>
                              <span className="text-muted-foreground">Grade/GPA:</span>
                              <p className="font-medium">{edu.grade_or_gpa}</p>
                            </div>
                          )}
                        </div>
                        {edu.notes && (
                          <div className="mt-2">
                            <span className="text-muted-foreground text-sm">Notes:</span>
                            <p className="text-sm">{edu.notes}</p>
                          </div>
                        )}
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard size={20} /> Bank Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!bankDetails ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No bank details found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs text-muted-foreground uppercase font-bold">Bank Name</label>
                    <p className="text-lg">{bankDetails.bank_name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase font-bold">Account Number</label>
                    <p className="text-lg">{bankDetails.account_number}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase font-bold">Account Holder Name</label>
                    <p className="text-lg">{bankDetails.account_holder_name}</p>
                  </div>
                  {bankDetails.branch_name && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">Branch Name</label>
                      <p className="text-lg">{bankDetails.branch_name}</p>
                    </div>
                  )}
                  {bankDetails.branch_code && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">Branch Code</label>
                      <p className="text-lg">{bankDetails.branch_code}</p>
                    </div>
                  )}
                  {bankDetails.iban && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">IBAN</label>
                      <p className="text-lg">{bankDetails.iban}</p>
                    </div>
                  )}
                  {bankDetails.swift_code && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">SWIFT Code</label>
                      <p className="text-lg">{bankDetails.swift_code}</p>
                    </div>
                  )}
                  {bankDetails.account_type && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">Account Type</label>
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
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Globe size={24} className="text-indigo-400" />
                Immigration & Residence Permit Management
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!immigration ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Globe size={64} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">No immigration records found</p>
                  <p className="text-sm">Immigration data will be displayed here once added</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Next Renewal Alert */}
                  {immigration.next_renewal_date && (
                    <div className={`p-4 rounded-xl border-2 ${
                      immigration.renewal_priority === 'Urgent' 
                        ? 'bg-red-500/20 border-red-500/50' 
                        : immigration.renewal_priority === 'High'
                        ? 'bg-orange-500/20 border-orange-500/50'
                        : 'bg-blue-500/20 border-blue-500/50'
                    }`}>
                      <div className="flex items-center gap-3">
                        <AlertCircle size={24} className={
                          immigration.renewal_priority === 'Urgent' ? 'text-red-400' : 
                          immigration.renewal_priority === 'High' ? 'text-orange-400' : 'text-blue-400'
                        } />
                        <div className="flex-1">
                          <p className="font-semibold">
                            Next Renewal: {immigration.next_renewal_action || 'N/A'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Due Date: {immigration.next_renewal_date ? new Date(immigration.next_renewal_date).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            }) : 'N/A'}
                          </p>
                        </div>
                        <Badge variant={immigration.renewal_priority === 'Urgent' ? 'destructive' : immigration.renewal_priority === 'High' ? 'warning' : 'outline'}>
                          {immigration.renewal_priority || 'Normal'}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Work Permit Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FileCheck size={20} className="text-blue-400" />
                      Work Permit (Public Authority for Manpower)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Work Permit Number</label>
                        <p className="text-lg font-semibold mt-2">{immigration.work_permit_number || 'N/A'}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                        <Badge variant={immigration.work_permit_status === 'Active' ? 'success' : 'warning'} className="mt-2">
                          {immigration.work_permit_status || 'N/A'}
                        </Badge>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Issue Date</label>
                        <p className="text-lg font-semibold mt-2">
                          {immigration.work_permit_issue_date ? new Date(immigration.work_permit_issue_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiry Date</label>
                        <p className="text-lg font-semibold mt-2">
                          {immigration.work_permit_expiry_date ? new Date(immigration.work_permit_expiry_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Renewed</label>
                        <p className="text-lg font-semibold mt-2">
                          {immigration.work_permit_last_renewed_date ? new Date(immigration.work_permit_last_renewed_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Renewal</label>
                        <p className="text-lg font-semibold mt-2">
                          {immigration.work_permit_next_renewal_date ? new Date(immigration.work_permit_next_renewal_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Residence Permit Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FileCheck size={20} className="text-purple-400" />
                      Residence Permit (Article 18) - Ministry of Interior
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Residence Permit Number</label>
                        <p className="text-lg font-semibold mt-2">{immigration.residence_permit_number || 'N/A'}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                        <Badge variant={immigration.residence_permit_status === 'Active' ? 'success' : 'warning'} className="mt-2">
                          {immigration.residence_permit_status || 'N/A'}
                        </Badge>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Article</label>
                        <p className="text-lg font-semibold mt-2">{immigration.residence_permit_article || 'Article 18'}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Issue Date</label>
                        <p className="text-lg font-semibold mt-2">
                          {immigration.residence_permit_issue_date ? new Date(immigration.residence_permit_issue_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiry Date</label>
                        <p className="text-lg font-semibold mt-2">
                          {immigration.residence_permit_expiry_date ? new Date(immigration.residence_permit_expiry_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Renewed</label>
                        <p className="text-lg font-semibold mt-2">
                          {immigration.residence_permit_last_renewed_date ? new Date(immigration.residence_permit_last_renewed_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Passport Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FileCheck size={20} className="text-green-400" />
                      Passport Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Passport Number</label>
                        <p className="text-lg font-semibold mt-2">{immigration.passport_number || 'N/A'}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                        <Badge variant={immigration.passport_status === 'Valid' ? 'success' : 'warning'} className="mt-2">
                          {immigration.passport_status || 'N/A'}
                        </Badge>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Issue Country</label>
                        <p className="text-lg font-semibold mt-2">{immigration.passport_issue_country || 'N/A'}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Issue Date</label>
                        <p className="text-lg font-semibold mt-2">
                          {immigration.passport_issue_date ? new Date(immigration.passport_issue_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiry Date</label>
                        <p className="text-lg font-semibold mt-2">
                          {immigration.passport_expiry_date ? new Date(immigration.passport_expiry_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      {immigration.passport_validity_days !== undefined && (
                        <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/10">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validity Days</label>
                          <p className="text-lg font-semibold mt-2">{immigration.passport_validity_days} days</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Health Insurance Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FileCheck size={20} className="text-cyan-400" />
                      Health Insurance
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-gradient-to-br from-cyan-500/5 to-transparent border border-cyan-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Insurance Number</label>
                        <p className="text-lg font-semibold mt-2">{immigration.health_insurance_number || 'N/A'}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-cyan-500/5 to-transparent border border-cyan-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Provider</label>
                        <p className="text-lg font-semibold mt-2">{immigration.health_insurance_provider || 'N/A'}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-cyan-500/5 to-transparent border border-cyan-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                        <Badge variant={immigration.health_insurance_status === 'Active' ? 'success' : 'warning'} className="mt-2">
                          {immigration.health_insurance_status || 'N/A'}
                        </Badge>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-cyan-500/5 to-transparent border border-cyan-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiry Date</label>
                        <p className="text-lg font-semibold mt-2">
                          {immigration.health_insurance_expiry_date ? new Date(immigration.health_insurance_expiry_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Civil ID Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FileCheck size={20} className="text-orange-400" />
                      Civil ID
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/5 to-transparent border border-orange-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Civil ID Number</label>
                        <p className="text-lg font-semibold mt-2">{immigration.civil_id_number || 'N/A'}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/5 to-transparent border border-orange-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                        <Badge variant={immigration.civil_id_status === 'Valid' ? 'success' : 'warning'} className="mt-2">
                          {immigration.civil_id_status || 'N/A'}
                        </Badge>
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/5 to-transparent border border-orange-500/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiry Date</label>
                        <p className="text-lg font-semibold mt-2">
                          {immigration.civil_id_expiry_date ? new Date(immigration.civil_id_expiry_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      {immigration.civil_id_update_reason && (
                        <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/5 to-transparent border border-orange-500/10">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Update Reason</label>
                          <p className="text-lg font-semibold mt-2">{immigration.civil_id_update_reason}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* General Information */}
                  {(immigration.visa_type || immigration.sponsor_name || immigration.entry_date) && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Globe size={20} className="text-indigo-400" />
                        General Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {immigration.visa_type && (
                          <div className="p-4 rounded-lg bg-gradient-to-br from-indigo-500/5 to-transparent border border-indigo-500/10">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visa Type</label>
                            <p className="text-lg font-semibold mt-2">{immigration.visa_type}</p>
                          </div>
                        )}
                        {immigration.sponsor_name && (
                          <div className="p-4 rounded-lg bg-gradient-to-br from-indigo-500/5 to-transparent border border-indigo-500/10">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sponsor</label>
                            <p className="text-lg font-semibold mt-2">{immigration.sponsor_name}</p>
                          </div>
                        )}
                        {immigration.entry_date && (
                          <div className="p-4 rounded-lg bg-gradient-to-br from-indigo-500/5 to-transparent border border-indigo-500/10">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entry Date</label>
                            <p className="text-lg font-semibold mt-2">
                              {new Date(immigration.entry_date).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {immigration.notes && (
                    <div className="p-4 rounded-lg bg-gradient-to-br from-slate-500/5 to-transparent border border-slate-500/10">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Notes</label>
                      <p className="text-base leading-relaxed">{immigration.notes}</p>
                    </div>
                  )}

                  {/* Renewal Notes */}
                  {immigration.renewal_notes && (
                    <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-500/5 to-transparent border border-yellow-500/20">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-2">
                        <Clock size={14} />
                        Renewal Notes
                      </label>
                      <p className="text-base leading-relaxed">{immigration.renewal_notes}</p>
                      {immigration.last_renewal_processed_date && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last processed: {new Date(immigration.last_renewal_processed_date).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
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

        {/* Documents Tab - TODO: Add full content */}
        <TabsContent value="documents" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('employees.documents')}</CardTitle>
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
