import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Mail, 
  Phone, 
  MapPin,
  User,
  Copy,
  Clock,
  Calendar,
  Check,
  Timer,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '../components/common/UIComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import Modal from '../components/common/Modal';
import { employeeService, Employee } from '../services/employeeService';
import { departmentService, Department } from '../services/departmentService';
import { roleService, Role } from '../services/roleService';
import { jobService, Job } from '../services/jobService';
import { companySettingsService, EmployeeShift } from '../services/companySettingsService';
import { employeeEducationService, EmployeeEducation } from '../services/employeeEducationService';
import { employeeBankDetailsService } from '../services/employeeBankDetailsService';
import { useAuth } from '../contexts/AuthContext';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { GraduationCap, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeeListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  // Shifts state - array of shifts for each day (0=Sunday, 1=Monday, ..., 6=Saturday)
  const [shifts, setShifts] = useState<Record<number, Array<{
    id?: string;
    shift_name: string;
    start_time: string;
    end_time: string;
    break_duration_minutes: number;
  }>>>({
    0: [], // Sunday
    1: [], // Monday
    2: [], // Tuesday
    3: [], // Wednesday
    4: [], // Thursday
    5: [], // Friday
    6: []  // Saturday
  });
  
  // Masters data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  
  // Form State
  const [fingerprintCodeError, setFingerprintCodeError] = useState<string>('');
  const [newEmployee, setNewEmployee] = useState({
    // Basic Information
    first_name: '',
    last_name: '',
    email: '',
    fingerprint_machine_code: '', // Machine code from fingerprint device
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
    base_salary: '',
    work_location: 'Office',
    reporting_manager_id: '',
    
    // Salary Allowances
    housing_allowance: '',
    transport_allowance: '',
    meal_allowance: '',
    medical_allowance: '',
    other_allowances: '',
    
    // Additional
    notes: '',
    
    // Legacy field (kept for backward compatibility)
    flexible_hours: false
  });

  // Education records state (array of education entries)
  const [educationRecords, setEducationRecords] = useState<Array<{
    institution_name: string;
    place_of_graduation: string;
    graduation_year: number;
    degree_type: string;
    field_of_study: string;
    grade_or_gpa: string;
    is_primary: boolean;
    notes: string;
  }>>([]);

  // Bank details state
  const [bankDetails, setBankDetails] = useState({
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
  
  // Calculate total salary (base + allowances)
  const totalSalary = useMemo(() => {
    const base = parseFloat(newEmployee.base_salary) || 0;
    const housing = parseFloat(newEmployee.housing_allowance) || 0;
    const transport = parseFloat(newEmployee.transport_allowance) || 0;
    const meal = parseFloat(newEmployee.meal_allowance) || 0;
    const medical = parseFloat(newEmployee.medical_allowance) || 0;
    const other = parseFloat(newEmployee.other_allowances) || 0;
    return base + housing + transport + meal + medical + other;
  }, [newEmployee.base_salary, newEmployee.housing_allowance, newEmployee.transport_allowance, newEmployee.meal_allowance, newEmployee.medical_allowance, newEmployee.other_allowances]);

  // Real-time API validation for fingerprint machine code with debouncing
  useEffect(() => {
    if (!newEmployee.fingerprint_machine_code || newEmployee.fingerprint_machine_code.trim() === '') {
      setFingerprintCodeError('');
      return;
    }

    const machineCode = newEmployee.fingerprint_machine_code.trim();
    
    // Debounce: wait 500ms after user stops typing before making API call
    const timeoutId = setTimeout(async () => {
      if (machineCode) {
        try {
          const exists = await employeeService.checkFingerprintCodeExists(
            machineCode,
            editingEmployee?.id
          );
          
          if (exists) {
            setFingerprintCodeError(t('employees.fingerprintCodeExists') || 'This fingerprint machine code is already assigned to another employee.');
          } else {
            setFingerprintCodeError('');
          }
        } catch (error) {
          console.error('Error validating fingerprint code:', error);
          // Don't show error on API failure, allow user to continue
          setFingerprintCodeError('');
        }
      } else {
        setFingerprintCodeError('');
      }
    }, 500); // 500ms debounce delay

    // Cleanup timeout on next keystroke
    return () => clearTimeout(timeoutId);
  }, [newEmployee.fingerprint_machine_code, editingEmployee?.id, t]);

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

  // Load salary config when role and job are selected
  useEffect(() => {
    const loadSalaryConfig = async () => {
      // Only load config if both role_id and job_id are selected and we're creating a new employee
      if (newEmployee.role_id && newEmployee.job_id && !editingEmployee && user?.company_id) {
        try {
          const configs = await companySettingsService.getRoleSalaryConfigs(
            user.company_id,
            newEmployee.role_id,
            newEmployee.job_id
          );
          
          // Get the most recent active config (already sorted by created_at desc)
          const config = configs.find(c => c.is_active) || configs[0];
          
          if (config) {
            // Pre-fill salary fields with config values, but only if fields are empty
            // This allows users to edit the values if they've already entered something
            setNewEmployee(prev => {
              // Helper to check if a field is truly empty
              const isEmpty = (value: string) => !value || value.trim() === '';
              
              return {
                ...prev,
                base_salary: isEmpty(prev.base_salary) ? config.base_salary.toString() : prev.base_salary,
                housing_allowance: isEmpty(prev.housing_allowance) ? config.housing_allowance.toString() : prev.housing_allowance,
                transport_allowance: isEmpty(prev.transport_allowance) ? config.transport_allowance.toString() : prev.transport_allowance,
                meal_allowance: isEmpty(prev.meal_allowance) ? config.meal_allowance.toString() : prev.meal_allowance,
                medical_allowance: isEmpty(prev.medical_allowance) ? config.medical_allowance.toString() : prev.medical_allowance,
                other_allowances: isEmpty(prev.other_allowances) ? config.other_allowances.toString() : prev.other_allowances,
              };
            });
          }
        } catch (error) {
          console.error('Error loading salary config:', error);
          // Silently fail - don't prevent user from creating employee
        }
      }
    };

    loadSalaryConfig();
  }, [newEmployee.role_id, newEmployee.job_id, editingEmployee, user?.company_id]);

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

  // Calculate hours from start and end time
  const calculateHours = (start: string, end: string, breakMinutes: number = 60) => {
    if (!start || !end) return 0;
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    const totalMinutes = endTotal - startTotal - breakMinutes;
    return Math.max(0, totalMinutes / 60);
  };

  // Add a new shift to a day (dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday)
  const addShift = (dayOfWeek: number) => {
    setShifts({
      ...shifts,
      [dayOfWeek]: [
        ...shifts[dayOfWeek],
        {
          shift_name: '',
          start_time: '09:00',
          end_time: '17:00',
          break_duration_minutes: 60
        }
      ]
    });
  };

  // Remove a shift from a day
  const removeShift = (dayOfWeek: number, index: number) => {
    setShifts({
      ...shifts,
      [dayOfWeek]: shifts[dayOfWeek].filter((_, i) => i !== index)
    });
  };

  // Update a shift
  const updateShift = (dayOfWeek: number, index: number, field: string, value: any) => {
    const updatedShifts = [...shifts[dayOfWeek]];
    updatedShifts[index] = { ...updatedShifts[index], [field]: value };
    setShifts({ ...shifts, [dayOfWeek]: updatedShifts });
  };

  // Calculate total hours for a day
  const calculateDayHours = (dayOfWeek: number): number => {
    return shifts[dayOfWeek].reduce((total, shift) => {
      return total + calculateHours(shift.start_time, shift.end_time, shift.break_duration_minutes);
    }, 0);
  };

  // Duplicate shifts to other days
  const duplicateShifts = (sourceDayOfWeek: number, targetDaysOfWeek: number[]) => {
    const sourceShifts = shifts[sourceDayOfWeek];
    const updates: any = {};
    targetDaysOfWeek.forEach(day => {
      updates[day] = sourceShifts.map(shift => ({ ...shift }));
    });
    setShifts({ ...shifts, ...updates });
  };

  // Load employee data into form for editing
  const handleEditEmployee = async (employee: Employee) => {
    setEditingEmployee(employee);
    
    // Load shifts from database
    let loadedShifts: Record<number, Array<{
      id?: string;
      shift_name: string;
      start_time: string;
      end_time: string;
      break_duration_minutes: number;
    }>> = {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    };

    if (employee.id) {
      try {
        const employeeShifts = await companySettingsService.getEmployeeShifts(employee.id);
        // Group shifts by day_of_week
        employeeShifts.forEach(shift => {
          const dayOfWeek = shift.day_of_week;
          // Parse time from HH:MM:SS to HH:MM format
          const parseTime = (timeStr: string) => {
            if (!timeStr) return '09:00';
            const parts = timeStr.split(':');
            return `${parts[0]}:${parts[1]}`;
          };

          if (!loadedShifts[dayOfWeek]) {
            loadedShifts[dayOfWeek] = [];
          }
          loadedShifts[dayOfWeek].push({
            id: shift.id,
            shift_name: shift.shift_name || '',
            start_time: parseTime(shift.start_time),
            end_time: parseTime(shift.end_time),
            break_duration_minutes: shift.break_duration_minutes || 0
          });
        });
      } catch (error) {
        console.error('Failed to load shifts:', error);
      }
    }

    setShifts(loadedShifts);

    // Load education records
    if (employee.id) {
      try {
        const educationData = await employeeEducationService.getByEmployee(employee.id);
        setEducationRecords(educationData.map(edu => ({
          institution_name: edu.institution_name,
          place_of_graduation: edu.place_of_graduation,
          graduation_year: edu.graduation_year,
          degree_type: edu.degree_type || '',
          field_of_study: edu.field_of_study || '',
          grade_or_gpa: edu.grade_or_gpa || '',
          is_primary: edu.is_primary || false,
          notes: edu.notes || ''
        })));
      } catch (error) {
        console.error('Failed to load education records:', error);
        setEducationRecords([]);
      }

      // Load bank details
      try {
        const bankData = await employeeBankDetailsService.getByEmployee(employee.id);
        if (bankData) {
          setBankDetails({
            bank_name: bankData.bank_name || '',
            account_number: bankData.account_number || '',
            account_holder_name: bankData.account_holder_name || '',
            branch_name: bankData.branch_name || '',
            branch_code: bankData.branch_code || '',
            iban: bankData.iban || '',
            swift_code: bankData.swift_code || '',
            account_type: bankData.account_type || '',
            currency: bankData.currency || 'USD',
            notes: bankData.notes || ''
          });
        } else {
          // Reset to default if no bank details
          setBankDetails({
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
        console.error('Failed to load bank details:', error);
        setBankDetails({
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
    }

    // Populate form with employee data
    setNewEmployee({
      first_name: employee.first_name || employee.firstName || '',
      last_name: employee.last_name || employee.lastName || '',
      email: employee.email || '',
      fingerprint_machine_code: (employee as any).external_id || employee.employee_id || employee.employeeId || '',
      phone: employee.phone || '',
      alternate_phone: employee.alternate_phone || '',
      date_of_birth: employee.date_of_birth || '',
      gender: employee.gender || '',
      marital_status: employee.marital_status || '',
      nationality: employee.nationality || '',
      address: employee.address || '',
      city: employee.city || '',
      state: employee.state || '',
      country: employee.country || '',
      postal_code: employee.postal_code || '',
      emergency_contact_name: employee.emergency_contact_name || '',
      emergency_contact_phone: employee.emergency_contact_phone || '',
      emergency_contact_relationship: employee.emergency_contact_relationship || '',
      department_id: employee.department_id || '',
      role_id: employee.role_id || '',
      job_id: employee.job_id || '',
      employment_type: employee.employment_type || employee.employmentType || 'Full Time',
      join_date: employee.join_date || employee.hireDate || new Date().toISOString().split('T')[0],
      base_salary: (employee as any).base_salary || employee.salary || '',
      work_location: employee.work_location || 'Office',
      reporting_manager_id: employee.reporting_manager_id || '',
      housing_allowance: (employee as any).housing_allowance || '',
      transport_allowance: (employee as any).transport_allowance || '',
      meal_allowance: (employee as any).meal_allowance || '',
      medical_allowance: (employee as any).medical_allowance || '',
      other_allowances: (employee as any).other_allowances || '',
      notes: employee.notes || '',
      flexible_hours: employee.flexible_hours || false
    });

    // Set role and load jobs if role is set
    if (employee.role_id) {
      setSelectedRoleId(employee.role_id);
      await loadJobsForRole(employee.role_id);
    }

    setActiveTab('basic');
    setIsModalOpen(true);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if there's a validation error (real-time validation should have caught it)
    if (fingerprintCodeError) {
      return; // Don't submit if there's a validation error
    }
    
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
        base_salary: newEmployee.base_salary ? parseFloat(newEmployee.base_salary) : null,
        housing_allowance: newEmployee.housing_allowance ? parseFloat(newEmployee.housing_allowance) : 0,
        transport_allowance: newEmployee.transport_allowance ? parseFloat(newEmployee.transport_allowance) : 0,
        meal_allowance: newEmployee.meal_allowance ? parseFloat(newEmployee.meal_allowance) : 0,
        medical_allowance: newEmployee.medical_allowance ? parseFloat(newEmployee.medical_allowance) : 0,
        other_allowances: newEmployee.other_allowances ? parseFloat(newEmployee.other_allowances) : 0,
        // Calculate total salary for backward compatibility
        salary: totalSalary || null,
        work_location: newEmployee.work_location || null,
        reporting_manager_id: newEmployee.reporting_manager_id && newEmployee.reporting_manager_id !== 'none' ? newEmployee.reporting_manager_id : null,
        notes: newEmployee.notes || null,
        // Handle fingerprint machine code
        ...(editingEmployee ? {
          // When editing, update external_id if machine code is provided
          ...(newEmployee.fingerprint_machine_code ? {
            external_id: newEmployee.fingerprint_machine_code
          } : {})
        } : {
          // For new employees, use fingerprint machine code as employee_id and external_id
          employee_id: newEmployee.fingerprint_machine_code || `EMP-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
          external_id: newEmployee.fingerprint_machine_code || null, // Store machine code for attendance mapping
          status: 'Active',
          avatar_url: `https://ui-avatars.com/api/?name=${newEmployee.first_name}+${newEmployee.last_name}`,
        }),
        // Automatically assign to admin's company if user is admin
        company_id: user?.company_id || null
      };
      
      let employeeId: string;
      if (editingEmployee) {
        // Update existing employee
        await employeeService.update(editingEmployee.id, payload);
        employeeId = editingEmployee.id;
      } else {
        // Create new employee
        const createdEmployee = await employeeService.create(payload);
        employeeId = createdEmployee.id;
      }
      
      await loadEmployees();
      
      // Save shifts to employee_shifts table
      if (user?.company_id && employeeId) {
        try {
          // If editing, delete existing shifts first
          if (editingEmployee) {
            const existingShifts = await companySettingsService.getEmployeeShifts(employeeId);
            for (const shift of existingShifts) {
              await companySettingsService.deleteEmployeeShift(shift.id);
            }
          }

          // Save all shifts for all days
          for (const dayOfWeek of [0, 1, 2, 3, 4, 5, 6]) {
            const dayShifts = shifts[dayOfWeek] || [];
            for (const shift of dayShifts) {
              if (shift.start_time && shift.end_time) {
                await companySettingsService.createEmployeeShift({
                  employee_id: employeeId,
                  company_id: user.company_id,
                  day_of_week: dayOfWeek,
                  shift_name: shift.shift_name || undefined,
                  start_time: `${shift.start_time}:00`,
                  end_time: `${shift.end_time}:00`,
                  break_duration_minutes: shift.break_duration_minutes || 0,
                  effective_from: new Date().toISOString().split('T')[0],
                  is_active: true
                });
              }
            }
          }
        } catch (error) {
          console.error('Failed to save shifts:', error);
          // Don't fail the entire operation if shifts save fails
        }
      }

      // Save education records
      if (employeeId) {
        try {
          // If editing, delete existing education records first
          if (editingEmployee) {
            const existingEducation = await employeeEducationService.getByEmployee(employeeId);
            for (const edu of existingEducation) {
              await employeeEducationService.delete(edu.id);
            }
          }

          // Create new education records
          for (const edu of educationRecords) {
            if (edu.institution_name && edu.place_of_graduation && edu.graduation_year) {
              await employeeEducationService.create({
                employee_id: employeeId,
                institution_name: edu.institution_name,
                place_of_graduation: edu.place_of_graduation,
                graduation_year: edu.graduation_year,
                degree_type: edu.degree_type || undefined,
                field_of_study: edu.field_of_study || undefined,
                grade_or_gpa: edu.grade_or_gpa || undefined,
                is_primary: edu.is_primary,
                notes: edu.notes || undefined
              });
            }
          }
        } catch (error) {
          console.error('Failed to save education records:', error);
          toast.error(editingEmployee ? 'Employee updated but failed to save some education records' : 'Employee created but failed to save some education records');
        }
      }

      // Save bank details
      if (bankDetails.bank_name && bankDetails.account_number && bankDetails.account_holder_name && employeeId) {
        try {
          await employeeBankDetailsService.upsert({
            employee_id: employeeId,
            bank_name: bankDetails.bank_name,
            account_number: bankDetails.account_number,
            account_holder_name: bankDetails.account_holder_name,
            branch_name: bankDetails.branch_name || undefined,
            branch_code: bankDetails.branch_code || undefined,
            iban: bankDetails.iban || undefined,
            swift_code: bankDetails.swift_code || undefined,
            account_type: bankDetails.account_type || undefined,
            currency: bankDetails.currency || 'USD',
            is_primary: true,
            notes: bankDetails.notes || undefined
          });
        } catch (error) {
          console.error('Failed to save bank details:', error);
          toast.error('Employee created but failed to save bank details');
        }
      }
      
      setIsModalOpen(false);
      setActiveTab('basic'); // Reset to first tab
      setEditingEmployee(null); // Clear editing state
      // Reset form
      setNewEmployee({
        first_name: '',
        last_name: '',
        email: '',
        fingerprint_machine_code: '',
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
        base_salary: '',
        housing_allowance: '',
        transport_allowance: '',
        meal_allowance: '',
        medical_allowance: '',
        other_allowances: '',
        work_location: 'Office',
        reporting_manager_id: '',
        notes: '',
        flexible_hours: false
      });
      // Reset education and bank details
      setEducationRecords([]);
      setBankDetails({
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
      // Reset shifts
      setShifts({
        0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
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

  const weekDays = [
    { key: 'monday', label: t('employees.monday'), dayOfWeek: 1 },
    { key: 'tuesday', label: t('employees.tuesday'), dayOfWeek: 2 },
    { key: 'wednesday', label: t('employees.wednesday'), dayOfWeek: 3 },
    { key: 'thursday', label: t('employees.thursday'), dayOfWeek: 4 },
    { key: 'friday', label: t('employees.friday'), dayOfWeek: 5 },
    { key: 'saturday', label: t('employees.saturday'), dayOfWeek: 6 },
    { key: 'sunday', label: t('employees.sunday'), dayOfWeek: 0 }
  ];

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
      <Modal isOpen={isModalOpen} onClose={() => {
        setIsModalOpen(false);
        setActiveTab('basic'); // Reset to first tab when closing
        setEditingEmployee(null); // Clear editing state
        // Reset education and bank details
        setEducationRecords([]);
        setBankDetails({
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
      }} title={editingEmployee ? (t('employees.editEmployee') || 'Edit Employee') : t('employees.addEmployee')} size="2xl">
        <form onSubmit={handleAddEmployee} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7 bg-white/5 p-1 rounded-lg h-11">
              <TabsTrigger 
                value="basic" 
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all text-xs"
              >
                {t('employees.basicInfo')}
              </TabsTrigger>
              <TabsTrigger 
                value="contact"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all text-xs"
              >
                {t('employees.contactInfo')}
              </TabsTrigger>
              <TabsTrigger 
                value="employment"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all text-xs"
              >
                {t('employees.employmentDetails')}
              </TabsTrigger>
              <TabsTrigger 
                value="emergency"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all text-xs"
              >
                {t('employees.emergencyContact')}
              </TabsTrigger>
              <TabsTrigger 
                value="working-hours"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all text-xs"
              >
                {t('employees.workingHours')}
              </TabsTrigger>
              <TabsTrigger 
                value="education"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all text-xs"
              >
                Education
              </TabsTrigger>
              <TabsTrigger 
                value="bank"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all text-xs"
              >
                Bank Details
              </TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="mt-6 space-y-5">
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
                  placeholder={t('employees.emailPlaceholder') || 'john@example.com'} 
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('employees.fingerprintMachineCode')} *</label>
                <Input 
                  required
                  type="number"
                  value={newEmployee.fingerprint_machine_code}
                  onChange={e => {
                    setNewEmployee({...newEmployee, fingerprint_machine_code: e.target.value});
                    // Validation will be handled by useEffect in real-time
                  }}
                  placeholder={t('employees.fingerprintMachineCodePlaceholder') || 'e.g., 1234'} 
                  className={`h-11 ${fingerprintCodeError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
                {fingerprintCodeError && (
                  <p className="text-xs text-red-400 mt-1">{fingerprintCodeError}</p>
                )}
                {!fingerprintCodeError && (
                  <p className="text-xs text-muted-foreground mt-1">{t('employees.fingerprintMachineCodeDesc') || 'Enter the employee code from the fingerprint machine. This will be used to map attendance records.'}</p>
                )}
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
                      <SelectValue placeholder={t('employees.selectGender') || 'Select gender'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">{t('employees.male')}</SelectItem>
                      <SelectItem value="Female">{t('employees.female')}</SelectItem>
                      <SelectItem value="Other">{t('employees.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.maritalStatus')}</label>
                  <Select value={newEmployee.marital_status} onValueChange={(value) => setNewEmployee({...newEmployee, marital_status: value})}>
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder={t('employees.selectStatus') || 'Select status'} />
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
                    placeholder={t('employees.nationalityPlaceholder') || 'e.g., Kuwaiti, Saudi'} 
                    className="h-11"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Contact Information Tab */}
            <TabsContent value="contact" className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.phone')}</label>
                  <Input 
                    type="tel"
                    value={newEmployee.phone}
                    onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})}
                    placeholder={t('employees.phonePlaceholder') || '+965 1234 5678'} 
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.alternatePhone')}</label>
                  <Input 
                    type="tel"
                    value={newEmployee.alternate_phone}
                    onChange={e => setNewEmployee({...newEmployee, alternate_phone: e.target.value})}
                    placeholder={t('employees.alternatePhonePlaceholder') || '+965 9876 5432'} 
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
                    placeholder={t('employees.postalCodePlaceholder') || '12345'} 
                    className="h-11"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Employment Details Tab */}
            <TabsContent value="employment" className="mt-6 space-y-5">
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
                  <label className="text-sm font-medium text-foreground">{t('employees.joinDate')} *</label>
                  <Input 
                    type="date"
                    required
                    value={newEmployee.join_date}
                    onChange={e => setNewEmployee({...newEmployee, join_date: e.target.value})}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('employees.reportingManager')}</label>
                <Select 
                  value={newEmployee.reporting_manager_id || 'none'} 
                  onValueChange={(value) => setNewEmployee({...newEmployee, reporting_manager_id: value === 'none' ? '' : value})}
                >
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder={t('employees.selectManager') || 'Select manager'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('common.none') || 'None'}</SelectItem>
                    {employees.filter(emp => emp.id !== editingEmployee?.id).map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('employees.workLocation')}</label>
                <Select value={newEmployee.work_location} onValueChange={(value) => setNewEmployee({...newEmployee, work_location: value})}>
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder={t('employees.workLocation')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Office">{t('employees.office')}</SelectItem>
                    <SelectItem value="Remote">{t('employees.remote')}</SelectItem>
                    <SelectItem value="Hybrid">{t('employees.hybrid')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Salary Section */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h4 className="text-sm font-semibold">{t('employees.salary')}</h4>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.baseSalary')} *</label>
                  <Input 
                    type="number"
                    step="0.01"
                    required
                    value={newEmployee.base_salary}
                    onChange={e => setNewEmployee({...newEmployee, base_salary: e.target.value})}
                    placeholder={t('employees.baseSalaryPlaceholder') || '5000.00'} 
                    className="h-11"
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('employees.housingAllowance')}</label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={newEmployee.housing_allowance}
                      onChange={e => setNewEmployee({...newEmployee, housing_allowance: e.target.value})}
                      placeholder={t('employees.allowancePlaceholder') || '0.00'} 
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('employees.transportAllowance')}</label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={newEmployee.transport_allowance}
                      onChange={e => setNewEmployee({...newEmployee, transport_allowance: e.target.value})}
                      placeholder={t('employees.allowancePlaceholder') || '0.00'} 
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('employees.mealAllowance')}</label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={newEmployee.meal_allowance}
                      onChange={e => setNewEmployee({...newEmployee, meal_allowance: e.target.value})}
                      placeholder={t('employees.allowancePlaceholder') || '0.00'} 
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('employees.medicalAllowance')}</label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={newEmployee.medical_allowance}
                      onChange={e => setNewEmployee({...newEmployee, medical_allowance: e.target.value})}
                      placeholder={t('employees.allowancePlaceholder') || '0.00'} 
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('employees.otherAllowances')}</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={newEmployee.other_allowances}
                    onChange={e => setNewEmployee({...newEmployee, other_allowances: e.target.value})}
                    placeholder="0.00" 
                    className="h-11"
                  />
                </div>

                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t('employees.totalSalary') || 'Total Salary'}:</span>
                    <span className="text-lg font-bold text-primary">{totalSalary.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Emergency Contact Tab */}
            <TabsContent value="emergency" className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('employees.emergencyContactName')}</label>
                <Input 
                  value={newEmployee.emergency_contact_name}
                  onChange={e => setNewEmployee({...newEmployee, emergency_contact_name: e.target.value})}
                  placeholder={t('employees.emergencyContactName')} 
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('employees.emergencyContactPhone')}</label>
                <Input 
                  type="tel"
                  value={newEmployee.emergency_contact_phone}
                  onChange={e => setNewEmployee({...newEmployee, emergency_contact_phone: e.target.value})}
                  placeholder={t('employees.phonePlaceholder') || '+965 1234 5678'} 
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('employees.relationship')}</label>
                <Select value={newEmployee.emergency_contact_relationship} onValueChange={(value) => setNewEmployee({...newEmployee, emergency_contact_relationship: value})}>
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder={t('employees.selectRelationship') || 'Select relationship'} />
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('common.notes')}</label>
                <textarea
                  value={newEmployee.notes}
                  onChange={e => setNewEmployee({...newEmployee, notes: e.target.value})}
                  placeholder={t('common.notes')}
                  className="w-full min-h-[100px] p-3 rounded-lg border border-white/10 bg-white/5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </TabsContent>

            {/* Working Hours Tab - Multiple Shifts Per Day */}
            <TabsContent value="working-hours" className="mt-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{t('employees.workingHours')}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{t('employees.multipleShiftsDesc') || 'Add multiple shifts for each day of the week'}</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const weekdays = [1, 2, 3, 4, 5]; // Monday to Friday
                      duplicateShifts(1, weekdays.filter(d => d !== 1));
                    }}
                    className="text-xs"
                  >
                    <Copy size={14} className="mr-1.5" />
                    {t('employees.copyMondayToWeekdays') || 'Copy Monday to Weekdays'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allDays = [0, 1, 2, 3, 4, 5, 6]; // All days
                      duplicateShifts(1, allDays.filter(d => d !== 1));
                    }}
                    className="text-xs"
                  >
                    <Copy size={14} className="mr-1.5" />
                    {t('employees.copyMondayToAll') || 'Copy Monday to All Days'}
                  </Button>
                </div>

                {/* Days with Multiple Shifts */}
                <div className="space-y-4">
                  {weekDays.map((day) => {
                    const dayShifts = shifts[day.dayOfWeek] || [];
                    const totalHours = calculateDayHours(day.dayOfWeek);
                    const isWorkingDay = dayShifts.length > 0;
                    const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                    
                    return (
                      <Card 
                        key={day.key} 
                        className={`transition-all duration-200 ${
                          isWorkingDay 
                            ? 'bg-primary/5 border-primary/20 hover:border-primary/30' 
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                isWorkingDay 
                                  ? 'bg-primary/10 text-primary' 
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                <Calendar size={16} />
                              </div>
                              <div>
                                <label className={`text-sm font-semibold block ${
                                  isWorkingDay ? 'text-foreground' : 'text-muted-foreground'
                                }`}>
                                  {day.label}
                                </label>
                                {isWeekend && (
                                  <span className="text-xs text-muted-foreground">{t('employees.weekend') || 'Weekend'}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {totalHours > 0 && (
                                <Badge variant="success" className="text-xs">
                                  {totalHours.toFixed(2)} {t('employees.hours')}
                                </Badge>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addShift(day.dayOfWeek)}
                                className="text-xs"
                              >
                                <Plus size={14} className="mr-1.5" />
                                {t('employees.addShift') || 'Add Shift'}
                              </Button>
                            </div>
                          </div>

                          {/* Shifts List */}
                          <div className="space-y-3">
                            {dayShifts.length === 0 ? (
                              <div className="text-center py-6 text-muted-foreground text-sm">
                                {t('employees.noShifts') || 'No shifts added. Click "Add Shift" to add one.'}
                              </div>
                            ) : (
                              dayShifts.map((shift, shiftIndex) => {
                                const shiftHours = calculateHours(shift.start_time, shift.end_time, shift.break_duration_minutes);
                                return (
                                  <Card key={shiftIndex} className="bg-white/5 border-white/10">
                                    <CardContent className="p-4">
                                      <div className="grid grid-cols-12 gap-3 items-end">
                                        {/* Shift Name (Optional) */}
                                        <div className="col-span-12 md:col-span-2 space-y-1.5">
                                          <label className="text-xs font-medium text-muted-foreground">
                                            {t('employees.shiftName') || 'Shift Name'}
                                          </label>
                                          <Input
                                            type="text"
                                            placeholder={t('employees.shiftNamePlaceholder') || 'e.g., Morning'}
                                            value={shift.shift_name}
                                            onChange={e => updateShift(day.dayOfWeek, shiftIndex, 'shift_name', e.target.value)}
                                            className="h-9 text-sm"
                                          />
                                        </div>

                                        {/* Start Time */}
                                        <div className="col-span-6 md:col-span-2 space-y-1.5">
                                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                            <Clock size={12} />
                                            {t('employees.startTime')}
                                          </label>
                                          <Input
                                            type="time"
                                            value={shift.start_time}
                                            onChange={e => updateShift(day.dayOfWeek, shiftIndex, 'start_time', e.target.value)}
                                            className="h-9 font-medium"
                                          />
                                        </div>

                                        {/* End Time */}
                                        <div className="col-span-6 md:col-span-2 space-y-1.5">
                                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                            <Clock size={12} />
                                            {t('employees.endTime')}
                                          </label>
                                          <Input
                                            type="time"
                                            value={shift.end_time}
                                            onChange={e => updateShift(day.dayOfWeek, shiftIndex, 'end_time', e.target.value)}
                                            className="h-9 font-medium"
                                          />
                                        </div>

                                        {/* Break Duration */}
                                        <div className="col-span-6 md:col-span-2 space-y-1.5">
                                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                            <Timer size={12} />
                                            {t('employees.break') || 'Break'}
                                          </label>
                                          <Input
                                            type="number"
                                            min="0"
                                            max="480"
                                            value={shift.break_duration_minutes}
                                            onChange={e => updateShift(day.dayOfWeek, shiftIndex, 'break_duration_minutes', parseInt(e.target.value) || 0)}
                                            className="h-9 text-center"
                                          />
                                        </div>

                                        {/* Hours Display */}
                                        <div className="col-span-6 md:col-span-2 space-y-1.5">
                                          <label className="text-xs font-medium text-muted-foreground">{t('employees.hours')}</label>
                                          <div className="relative">
                                            <Input
                                              type="number"
                                              step="0.25"
                                              min="0"
                                              max="24"
                                              value={shiftHours.toFixed(2)}
                                              readOnly
                                              className="h-9 font-bold text-center bg-primary/10 border-primary/30 text-primary"
                                            />
                                            <Badge 
                                              variant="success" 
                                              className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0"
                                            >
                                              {shiftHours.toFixed(1)}h
                                            </Badge>
                                          </div>
                                        </div>

                                        {/* Remove Button */}
                                        <div className="col-span-12 md:col-span-2 flex justify-end">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeShift(day.dayOfWeek, shiftIndex)}
                                            className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          >
                                            <Trash2 size={14} />
                                          </Button>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Education Tab */}
            <TabsContent value="education" className="mt-6 space-y-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <GraduationCap size={20} /> Education
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Add education records (schooling, higher studies, etc.)</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEducationRecords([...educationRecords, {
                      institution_name: '',
                      place_of_graduation: '',
                      graduation_year: new Date().getFullYear(),
                      degree_type: '',
                      field_of_study: '',
                      grade_or_gpa: '',
                      is_primary: false,
                      notes: ''
                    }]);
                  }}
                  className="gap-2"
                >
                  <Plus size={16} /> Add Education
                </Button>
              </div>

              {educationRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No education records added. Click "Add Education" to add one.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {educationRecords.map((edu, index) => (
                    <Card key={index} className="bg-white/5 border-white/10">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-semibold">Education #{index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEducationRecords(educationRecords.filter((_, i) => i !== index));
                            }}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <X size={16} />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Institution Name *</Label>
                            <Input
                              value={edu.institution_name}
                              onChange={(e) => {
                                const updated = [...educationRecords];
                                updated[index].institution_name = e.target.value;
                                setEducationRecords(updated);
                              }}
                              placeholder="University, School, College name"
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Place of Graduation *</Label>
                            <Input
                              value={edu.place_of_graduation}
                              onChange={(e) => {
                                const updated = [...educationRecords];
                                updated[index].place_of_graduation = e.target.value;
                                setEducationRecords(updated);
                              }}
                              placeholder="City, Country"
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Graduation Year *</Label>
                            <Input
                              type="number"
                              value={edu.graduation_year}
                              onChange={(e) => {
                                const updated = [...educationRecords];
                                updated[index].graduation_year = parseInt(e.target.value) || new Date().getFullYear();
                                setEducationRecords(updated);
                              }}
                              min="1900"
                              max={new Date().getFullYear() + 10}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Degree Type</Label>
                            <Select
                              value={edu.degree_type}
                              onValueChange={(value) => {
                                const updated = [...educationRecords];
                                updated[index].degree_type = value;
                                setEducationRecords(updated);
                              }}
                            >
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="Select degree type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="High School">High School</SelectItem>
                                <SelectItem value="Diploma">Diploma</SelectItem>
                                <SelectItem value="Bachelor">Bachelor</SelectItem>
                                <SelectItem value="Master">Master</SelectItem>
                                <SelectItem value="PhD">PhD</SelectItem>
                                <SelectItem value="Certificate">Certificate</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Field of Study</Label>
                            <Input
                              value={edu.field_of_study}
                              onChange={(e) => {
                                const updated = [...educationRecords];
                                updated[index].field_of_study = e.target.value;
                                setEducationRecords(updated);
                              }}
                              placeholder="e.g., Computer Science"
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Grade/GPA</Label>
                            <Input
                              value={edu.grade_or_gpa}
                              onChange={(e) => {
                                const updated = [...educationRecords];
                                updated[index].grade_or_gpa = e.target.value;
                                setEducationRecords(updated);
                              }}
                              placeholder="e.g., 3.8, A+, 85%"
                              className="h-10"
                            />
                          </div>
                          <div className="col-span-2 flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`is_primary_${index}`}
                              checked={edu.is_primary}
                              onChange={(e) => {
                                const updated = [...educationRecords];
                                updated[index].is_primary = e.target.checked;
                                // If this is marked as primary, unmark others
                                if (e.target.checked) {
                                  updated.forEach((ed, i) => {
                                    if (i !== index) updated[i].is_primary = false;
                                  });
                                }
                                setEducationRecords(updated);
                              }}
                              className="w-4 h-4"
                            />
                            <Label htmlFor={`is_primary_${index}`} className="cursor-pointer">Mark as primary qualification</Label>
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                              value={edu.notes}
                              onChange={(e) => {
                                const updated = [...educationRecords];
                                updated[index].notes = e.target.value;
                                setEducationRecords(updated);
                              }}
                              placeholder="Additional notes"
                              rows={2}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Bank Details Tab */}
            <TabsContent value="bank" className="mt-6 space-y-5">
              <div className="mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard size={20} /> Bank Details
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Bank account information for payroll</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bank Name *</Label>
                  <Input
                    value={bankDetails.bank_name}
                    onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                    placeholder="Bank name"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number *</Label>
                  <Input
                    value={bankDetails.account_number}
                    onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
                    placeholder="Account number"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Holder Name *</Label>
                  <Input
                    value={bankDetails.account_holder_name}
                    onChange={(e) => setBankDetails({ ...bankDetails, account_holder_name: e.target.value })}
                    placeholder="Name on account"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Branch Name</Label>
                  <Input
                    value={bankDetails.branch_name}
                    onChange={(e) => setBankDetails({ ...bankDetails, branch_name: e.target.value })}
                    placeholder="Branch name"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Branch Code</Label>
                  <Input
                    value={bankDetails.branch_code}
                    onChange={(e) => setBankDetails({ ...bankDetails, branch_code: e.target.value })}
                    placeholder="Branch code"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IBAN</Label>
                  <Input
                    value={bankDetails.iban}
                    onChange={(e) => setBankDetails({ ...bankDetails, iban: e.target.value })}
                    placeholder="International Bank Account Number"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SWIFT Code</Label>
                  <Input
                    value={bankDetails.swift_code}
                    onChange={(e) => setBankDetails({ ...bankDetails, swift_code: e.target.value })}
                    placeholder="SWIFT/BIC code"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select
                    value={bankDetails.account_type}
                    onValueChange={(value) => setBankDetails({ ...bankDetails, account_type: value })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Savings">Savings</SelectItem>
                      <SelectItem value="Current">Current</SelectItem>
                      <SelectItem value="Checking">Checking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={bankDetails.currency}
                    onValueChange={(value) => setBankDetails({ ...bankDetails, currency: value })}
                  >
                    <SelectTrigger className="h-10">
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
                <div className="col-span-2 space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={bankDetails.notes}
                    onChange={(e) => setBankDetails({ ...bankDetails, notes: e.target.value })}
                    placeholder="Additional notes"
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="pt-6 mt-6 flex justify-end gap-3 border-t border-white/10">
            <Button type="button" variant="outline" onClick={() => {
              setIsModalOpen(false);
              setActiveTab('basic'); // Reset to first tab
              setEditingEmployee(null); // Clear editing state
              // Reset education and bank details
              setEducationRecords([]);
              setBankDetails({
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
            }} className="min-w-[100px]">
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" className="min-w-[100px]">
              {t('common.save')}
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
          <div className="col-span-full text-center py-12 text-muted-foreground">{t('common.loading')}</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">{t('common.noData')}</div>
        ) : filteredEmployees.map((employee) => (
          <Card 
            key={employee.id} 
            className="group hover:border-primary/50 transition-colors"
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/employees/${employee.id}`;
                  }}
                >
                  {t('common.view')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditEmployee(employee);
                  }}
                  className="flex-1"
                >
                  <Edit size={14} className="mr-1.5" />
                  {t('common.edit')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
