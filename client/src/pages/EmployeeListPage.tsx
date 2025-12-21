import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Mail, 
  Phone, 
  MapPin,
  User
} from 'lucide-react';
import { Card, CardContent, Button, Input, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '../components/common/UIComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import Modal from '../components/common/Modal';
import { employeeService, Employee } from '../services/employeeService';
import { departmentService, Department } from '../services/departmentService';
import { roleService, Role } from '../services/roleService';
import { jobService, Job } from '../services/jobService';
import { companySettingsService } from '../services/companySettingsService';
import { useAuth } from '../contexts/AuthContext';

export default function EmployeeListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Masters data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  
  // Form State
  const [newEmployee, setNewEmployee] = useState({
    // Basic Information
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    alternate_phone: '',
    date_of_birth: '',
    gender: '',
    marital_status: '',
    nationality: '',
    
    // Address
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    
    // Emergency Contact
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    
    // Employment Details
    department_id: '',
    role_id: '',
    job_id: '',
    employment_type: 'Full Time',
    join_date: new Date().toISOString().split('T')[0],
    salary: '',
    work_location: 'Office',
    reporting_manager_id: '',
    
    // Additional
    notes: '',
    
    // Working Hours
    monday_hours: 8,
    tuesday_hours: 8,
    wednesday_hours: 8,
    thursday_hours: 8,
    friday_hours: 8,
    saturday_hours: 0,
    sunday_hours: 0,
    flexible_hours: false,
    start_time: '09:00',
    end_time: '17:00',
    break_duration_minutes: 60
  });

  useEffect(() => {
    loadEmployees();
    loadMasters();
  }, []);

  useEffect(() => {
    if (selectedRoleId) {
      loadJobsForRole(selectedRoleId);
    } else {
      setAvailableJobs([]);
    }
  }, [selectedRoleId]);

  const loadMasters = async () => {
    try {
      const [depts, rolesData] = await Promise.all([
        departmentService.getAll(),
        roleService.getAll()
      ]);
      setDepartments(depts);
      setRoles(rolesData);
    } catch (error) {
      console.error('Failed to load masters:', error);
    }
  };

  const loadJobsForRole = async (roleId: string) => {
    try {
      const jobsData = await jobService.getByRoleId(roleId);
      setAvailableJobs(jobsData);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      setAvailableJobs([]);
    }
  };

  const loadEmployees = async () => {
    try {
      // Pass company_id for admin users to filter employees by company
      const data = await employeeService.getAll(user?.company_id);
      setEmployees(data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        first_name: newEmployee.first_name,
        last_name: newEmployee.last_name,
        email: newEmployee.email,
        phone: newEmployee.phone || null,
        alternate_phone: newEmployee.alternate_phone || null,
        date_of_birth: newEmployee.date_of_birth || null,
        gender: newEmployee.gender || null,
        marital_status: newEmployee.marital_status || null,
        nationality: newEmployee.nationality || null,
        address: newEmployee.address || null,
        city: newEmployee.city || null,
        state: newEmployee.state || null,
        country: newEmployee.country || null,
        postal_code: newEmployee.postal_code || null,
        emergency_contact_name: newEmployee.emergency_contact_name || null,
        emergency_contact_phone: newEmployee.emergency_contact_phone || null,
        emergency_contact_relationship: newEmployee.emergency_contact_relationship || null,
        department_id: newEmployee.department_id || null,
        job_id: newEmployee.job_id || null,
        role_id: newEmployee.role_id || null,
        // Keep legacy fields for backward compatibility
        department: departments.find(d => d.id === newEmployee.department_id)?.name || null,
        designation: jobs.find(j => j.id === newEmployee.job_id)?.name || null,
        employment_type: newEmployee.employment_type,
        employee_type: newEmployee.employment_type,
        join_date: newEmployee.join_date || null,
        salary: newEmployee.salary ? parseFloat(newEmployee.salary) : null,
        work_location: newEmployee.work_location || null,
        reporting_manager_id: newEmployee.reporting_manager_id && newEmployee.reporting_manager_id !== 'none' ? newEmployee.reporting_manager_id : null,
        notes: newEmployee.notes || null,
        employee_id: `EMP-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        status: 'Active',
        avatar_url: `https://ui-avatars.com/api/?name=${newEmployee.first_name}+${newEmployee.last_name}`,
        // Automatically assign to admin's company if user is admin
        company_id: user?.company_id || null
      };
      
      const createdEmployee = await employeeService.create(payload);
      await loadEmployees();
      
      // Save working hours if provided
      if (user?.company_id && createdEmployee?.id) {
        try {
          await companySettingsService.createEmployeeWorkingHours({
            employee_id: createdEmployee.id,
            company_id: user.company_id,
            monday_hours: newEmployee.monday_hours || 8,
            tuesday_hours: newEmployee.tuesday_hours || 8,
            wednesday_hours: newEmployee.wednesday_hours || 8,
            thursday_hours: newEmployee.thursday_hours || 8,
            friday_hours: newEmployee.friday_hours || 8,
            saturday_hours: newEmployee.saturday_hours || 0,
            sunday_hours: newEmployee.sunday_hours || 0,
            flexible_hours: newEmployee.flexible_hours || false,
            start_time: newEmployee.flexible_hours ? newEmployee.start_time : undefined,
            end_time: newEmployee.flexible_hours ? newEmployee.end_time : undefined,
            break_duration_minutes: newEmployee.break_duration_minutes || 60,
            effective_from: new Date().toISOString().split('T')[0],
            is_active: true
          });
        } catch (error) {
          console.error('Failed to save working hours:', error);
          // Don't fail the entire operation if working hours save fails
        }
      }
      
      setIsModalOpen(false);
      // Reset form
      setNewEmployee({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        alternate_phone: '',
        date_of_birth: '',
        gender: '',
        marital_status: '',
        nationality: '',
        address: '',
        city: '',
        state: '',
        country: '',
        postal_code: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: '',
        department_id: '',
        role_id: '',
        job_id: '',
        employment_type: 'Full Time',
        join_date: new Date().toISOString().split('T')[0],
        salary: '',
        work_location: 'Office',
        reporting_manager_id: '',
        notes: '',
        monday_hours: 8,
        tuesday_hours: 8,
        wednesday_hours: 8,
        thursday_hours: 8,
        friday_hours: 8,
        saturday_hours: 0,
        sunday_hours: 0,
        flexible_hours: false,
        start_time: '09:00',
        end_time: '17:00',
        break_duration_minutes: 60
      });
      setSelectedRoleId('');
      setAvailableJobs([]);
    } catch (error) {
      console.error('Failed to add employee:', error);
      alert('Failed to add employee. Please check console.');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.first_name || emp.firstName || ''} ${emp.last_name || emp.lastName || ''}`;
    const matchesSearch = fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (emp.employee_id || emp.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'All' || emp.department === filterDept;
    return matchesSearch && matchesDept;
  });

  const departmentNames = ['All', ...Array.from(new Set(employees.map(e => e.department || 'Unassigned')))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading tracking-tight text-foreground">{t('employees.title')}</h1>
          <p className="text-muted-foreground mt-1">Manage your organization's workforce.</p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} className="mr-2 rtl:ml-2 rtl:mr-0" />
          {t('employees.addEmployee')}
        </Button>
      </div>

      {/* Add Employee Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('employees.addEmployee')} size="2xl">
        <form onSubmit={handleAddEmployee} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="inline-flex h-12 items-center justify-start rounded-lg bg-white/5 p-1 text-muted-foreground w-full">
              <TabsTrigger 
                value="basic" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm flex-1"
              >
                {t('employees.basicInfo')}
              </TabsTrigger>
              <TabsTrigger 
                value="contact" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm flex-1"
              >
                {t('employees.contactInfo')}
              </TabsTrigger>
              <TabsTrigger 
                value="employment" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm flex-1"
              >
                {t('employees.employmentDetails')}
              </TabsTrigger>
              <TabsTrigger 
                value="emergency"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm flex-1"
              >
                {t('employees.emergencyContact')}
              </TabsTrigger>
              <TabsTrigger 
                value="working-hours"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm flex-1"
              >
                {t('employees.workingHours')}
              </TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="mt-6 space-y-5 focus-visible:outline-none">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('common.firstName')} *</label>
                  <Input 
                    required
                    value={newEmployee.first_name}
                    onChange={e => setNewEmployee({...newEmployee, first_name: e.target.value})}
                    placeholder={t('common.firstName')} 
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('common.lastName')} *</label>
                  <Input 
                    required
                    value={newEmployee.last_name}
                    onChange={e => setNewEmployee({...newEmployee, last_name: e.target.value})}
                    placeholder={t('common.lastName')} 
                    className="h-11"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('common.email')} *</label>
                <Input 
                  required
                  type="email"
                  value={newEmployee.email}
                  onChange={e => setNewEmployee({...newEmployee, email: e.target.value})}
                  placeholder="john@example.com" 
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.dateOfBirth')}</label>
                  <Input 
                    type="date"
                    value={newEmployee.date_of_birth}
                    onChange={e => setNewEmployee({...newEmployee, date_of_birth: e.target.value})}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.gender')}</label>
                  <Select value={newEmployee.gender} onValueChange={(value) => setNewEmployee({...newEmployee, gender: value})}>
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder={t('common.select') + ' ' + t('employees.gender').toLowerCase()} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">{t('employees.male')}</SelectItem>
                      <SelectItem value="Female">{t('employees.female')}</SelectItem>
                      <SelectItem value="Other">{t('employees.other')}</SelectItem>
                      <SelectItem value="Prefer not to say">{t('employees.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.maritalStatus')}</label>
                  <Select value={newEmployee.marital_status} onValueChange={(value) => setNewEmployee({...newEmployee, marital_status: value})}>
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder={t('common.select') + ' ' + t('common.status').toLowerCase()} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">{t('employees.single')}</SelectItem>
                      <SelectItem value="Married">{t('employees.married')}</SelectItem>
                      <SelectItem value="Divorced">{t('employees.divorced')}</SelectItem>
                      <SelectItem value="Widowed">{t('employees.widowed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.nationality')}</label>
                  <Input 
                    value={newEmployee.nationality}
                    onChange={e => setNewEmployee({...newEmployee, nationality: e.target.value})}
                    placeholder="e.g., Kuwaiti, Saudi" 
                    className="h-11"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Contact Information Tab */}
            <TabsContent value="contact" className="mt-6 space-y-5 focus-visible:outline-none">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.phone')}</label>
                  <Input 
                    type="tel"
                    value={newEmployee.phone}
                    onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})}
                    placeholder="+965 1234 5678" 
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.alternatePhone')}</label>
                  <Input 
                    type="tel"
                    value={newEmployee.alternate_phone}
                    onChange={e => setNewEmployee({...newEmployee, alternate_phone: e.target.value})}
                    placeholder="+965 9876 5432" 
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('employees.address')}</label>
                <Input 
                  value={newEmployee.address}
                  onChange={e => setNewEmployee({...newEmployee, address: e.target.value})}
                  placeholder={t('employees.address')} 
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.city')}</label>
                  <Input 
                    value={newEmployee.city}
                    onChange={e => setNewEmployee({...newEmployee, city: e.target.value})}
                    placeholder={t('employees.city')} 
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.state')}</label>
                  <Input 
                    value={newEmployee.state}
                    onChange={e => setNewEmployee({...newEmployee, state: e.target.value})}
                    placeholder={t('employees.state')} 
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.country')}</label>
                  <Input 
                    value={newEmployee.country}
                    onChange={e => setNewEmployee({...newEmployee, country: e.target.value})}
                    placeholder={t('employees.country')} 
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.postalCode')}</label>
                  <Input 
                    value={newEmployee.postal_code}
                    onChange={e => setNewEmployee({...newEmployee, postal_code: e.target.value})}
                    placeholder="12345" 
                    className="h-11"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Employment Details Tab */}
            <TabsContent value="employment" className="mt-6 space-y-5 focus-visible:outline-none">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('employees.department')} *</label>
                <Select value={newEmployee.department_id} onValueChange={(value) => setNewEmployee({...newEmployee, department_id: value})} required>
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder={t('common.select') + ' ' + t('employees.department').toLowerCase()} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('common.role')} *</label>
                  <Select 
                    value={selectedRoleId} 
                    onValueChange={(value) => {
                      setSelectedRoleId(value);
                      setNewEmployee({...newEmployee, role_id: value, job_id: ''});
                    }}
                    required
                  >
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder={t('common.select') + ' ' + t('common.role').toLowerCase()} />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('common.job')} *</label>
                  <Select 
                    value={newEmployee.job_id} 
                    onValueChange={(value) => setNewEmployee({...newEmployee, job_id: value})}
                    disabled={!selectedRoleId || availableJobs.length === 0}
                    required
                  >
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder={selectedRoleId ? t('common.select') + ' ' + t('common.job').toLowerCase() : t('common.select') + ' ' + t('common.role').toLowerCase() + ' ' + t('common.first')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableJobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.employmentType')} *</label>
                  <Select value={newEmployee.employment_type} onValueChange={(value) => setNewEmployee({...newEmployee, employment_type: value})}>
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder={t('common.select') + ' ' + t('common.type')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full Time">{t('employees.fullTime')}</SelectItem>
                      <SelectItem value="Part Time">{t('employees.partTime')}</SelectItem>
                      <SelectItem value="Consultant">{t('employees.contract')}</SelectItem>
                      <SelectItem value="Intern">{t('employees.intern')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.workLocation')}</label>
                  <Select value={newEmployee.work_location} onValueChange={(value) => setNewEmployee({...newEmployee, work_location: value})}>
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder={t('common.select') + ' ' + t('employees.workLocation').toLowerCase()} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Office">{t('employees.office')}</SelectItem>
                      <SelectItem value="Remote">{t('employees.remote')}</SelectItem>
                      <SelectItem value="Hybrid">{t('employees.hybrid')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.joinDate')} *</label>
                  <Input 
                    type="date"
                    required
                    value={newEmployee.join_date}
                    onChange={e => setNewEmployee({...newEmployee, join_date: e.target.value})}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.salary')}</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={newEmployee.salary}
                    onChange={e => setNewEmployee({...newEmployee, salary: e.target.value})}
                    placeholder="5000.00" 
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('employees.reportingManager')}</label>
                <Select value={newEmployee.reporting_manager_id} onValueChange={(value) => setNewEmployee({...newEmployee, reporting_manager_id: value === 'none' ? '' : value})}>
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder={t('common.select') + ' ' + t('employees.manager').toLowerCase()} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('common.none')}</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name || emp.firstName} {emp.last_name || emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Emergency Contact Tab */}
            <TabsContent value="emergency" className="mt-6 space-y-5 focus-visible:outline-none">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('employees.emergencyContact')} {t('common.name')}</label>
                <Input 
                  value={newEmployee.emergency_contact_name}
                  onChange={e => setNewEmployee({...newEmployee, emergency_contact_name: e.target.value})}
                  placeholder={t('employees.emergencyContact') + ' ' + t('common.name')} 
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.emergencyContact')} {t('employees.phone')}</label>
                  <Input 
                    type="tel"
                    value={newEmployee.emergency_contact_phone}
                    onChange={e => setNewEmployee({...newEmployee, emergency_contact_phone: e.target.value})}
                    placeholder="+965 1234 5678" 
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.relationship')}</label>
                  <Select value={newEmployee.emergency_contact_relationship} onValueChange={(value) => setNewEmployee({...newEmployee, emergency_contact_relationship: value})}>
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder={t('common.select') + ' ' + t('employees.relationship').toLowerCase()} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Spouse">{t('employees.spouse')}</SelectItem>
                      <SelectItem value="Parent">{t('employees.parent')}</SelectItem>
                      <SelectItem value="Sibling">{t('employees.sibling')}</SelectItem>
                      <SelectItem value="Child">{t('employees.child')}</SelectItem>
                      <SelectItem value="Other">{t('employees.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('employees.notes')}</label>
                <textarea
                  className="w-full min-h-[120px] rounded-lg border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-none"
                  value={newEmployee.notes}
                  onChange={e => setNewEmployee({...newEmployee, notes: e.target.value})}
                  placeholder={t('employees.notes')}
                />
              </div>
            </TabsContent>

            {/* Working Hours Tab */}
            <TabsContent value="working-hours" className="mt-6 space-y-5 focus-visible:outline-none">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('employees.workingHours')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('employees.monday')} {t('employees.hours')}</label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      value={newEmployee.monday_hours}
                      onChange={e => setNewEmployee({...newEmployee, monday_hours: parseFloat(e.target.value) || 0})}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('employees.tuesday')} {t('employees.hours')}</label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      value={newEmployee.tuesday_hours}
                      onChange={e => setNewEmployee({...newEmployee, tuesday_hours: parseFloat(e.target.value) || 0})}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('employees.wednesday')} {t('employees.hours')}</label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      value={newEmployee.wednesday_hours}
                      onChange={e => setNewEmployee({...newEmployee, wednesday_hours: parseFloat(e.target.value) || 0})}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('employees.thursday')} {t('employees.hours')}</label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      value={newEmployee.thursday_hours}
                      onChange={e => setNewEmployee({...newEmployee, thursday_hours: parseFloat(e.target.value) || 0})}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('employees.friday')} {t('employees.hours')}</label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      value={newEmployee.friday_hours}
                      onChange={e => setNewEmployee({...newEmployee, friday_hours: parseFloat(e.target.value) || 0})}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('employees.saturday')} {t('employees.hours')}</label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      value={newEmployee.saturday_hours}
                      onChange={e => setNewEmployee({...newEmployee, saturday_hours: parseFloat(e.target.value) || 0})}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('employees.sunday')} {t('employees.hours')}</label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      value={newEmployee.sunday_hours}
                      onChange={e => setNewEmployee({...newEmployee, sunday_hours: parseFloat(e.target.value) || 0})}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newEmployee.flexible_hours}
                      onChange={e => setNewEmployee({...newEmployee, flexible_hours: e.target.checked})}
                      className="rounded"
                    />
                    <label className="text-sm font-medium text-foreground">{t('employees.flexibleHours')}</label>
                  </div>
                  
                  {newEmployee.flexible_hours && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t('employees.startTime')}</label>
                        <Input
                          type="time"
                          value={newEmployee.start_time}
                          onChange={e => setNewEmployee({...newEmployee, start_time: e.target.value})}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t('employees.endTime')}</label>
                        <Input
                          type="time"
                          value={newEmployee.end_time}
                          onChange={e => setNewEmployee({...newEmployee, end_time: e.target.value})}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t('employees.breakDuration')}</label>
                        <Input
                          type="number"
                          min="0"
                          value={newEmployee.break_duration_minutes}
                          onChange={e => setNewEmployee({...newEmployee, break_duration_minutes: parseInt(e.target.value) || 0})}
                          className="h-11"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="pt-6 mt-6 flex justify-end gap-3 border-t border-white/10">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="min-w-[100px]">
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button type="submit" variant="primary" className="min-w-[100px]">
              {t('common.save') || 'Save Employee'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder={t('common.search')} 
                className="pl-10 rtl:pr-10 rtl:pl-3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {departmentNames.map(dept => (
                <Button 
                  key={dept}
                  variant={filterDept === dept ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setFilterDept(dept)}
                  className="whitespace-nowrap"
                >
                  {dept}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="icon">
              <Filter size={18} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">Loading employees...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">No employees found.</div>
        ) : filteredEmployees.map((employee) => (
          <Card 
            key={employee.id} 
            className="group hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => window.location.href = `/employees/${employee.id}`}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border border-white/10 overflow-hidden">
                    {employee.avatar_url ? (
                      <img src={employee.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{(employee.first_name || employee.firstName || 'U')[0]}{(employee.last_name || employee.lastName || 'N')[0]}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{employee.first_name || employee.firstName} {employee.last_name || employee.lastName}</h3>
                    <p className="text-xs text-muted-foreground">{employee.designation}</p>
                  </div>
                </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={employee.status === 'Active' ? 'success' : 'warning'}>
                      {employee.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {employee.employment_type || 'Full Time'}
                    </Badge>
                  </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User size={14} className="shrink-0" />
                  <span>{employee.employee_id || employee.employeeId}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail size={14} className="shrink-0" />
                  <span className="truncate">{employee.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone size={14} className="shrink-0" />
                  <span>{employee.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin size={14} className="shrink-0" />
                  <span>{employee.department}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                <Button variant="outline" size="sm" className="flex-1">
                  {t('common.view')}
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
