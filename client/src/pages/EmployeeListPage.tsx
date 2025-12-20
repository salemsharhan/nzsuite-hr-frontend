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
import { Card, CardContent, Button, Input, Badge } from '../components/common/UIComponents';
import Modal from '../components/common/Modal';
import { employeeService, Employee } from '../services/employeeService';

export default function EmployeeListPage() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [newEmployee, setNewEmployee] = useState({
    first_name: '',
    last_name: '',
    email: '',
    department: 'Engineering',
    position: '',
    salary: 0,
    joining_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await employeeService.getAll();
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
      // Create payload without salary as it's not in the schema
      const { salary, ...employeeData } = newEmployee;
      
      await employeeService.create({
        first_name: employeeData.first_name,
        last_name: employeeData.last_name,
        email: employeeData.email,
        department: employeeData.department,
        employee_id: `EMP-${Math.floor(Math.random() * 10000)}`,
        status: 'Active',
        avatar_url: `https://ui-avatars.com/api/?name=${employeeData.first_name}+${employeeData.last_name}`,
        phone: null as any, // Send null for optional fields
        designation: employeeData.position,
        join_date: employeeData.joining_date
      });
      
      await loadEmployees();
      setIsModalOpen(false);
      // Reset form
      setNewEmployee({
        first_name: '',
        last_name: '',
        email: '',
        department: 'Engineering',
        position: '',
        salary: 0,
        joining_date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Failed to add employee:', error);
      alert('Failed to add employee. Please check console.');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.first_name} ${emp.last_name}`;
    const matchesSearch = fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'All' || emp.department === filterDept;
    return matchesSearch && matchesDept;
  });

  const departments = ['All', ...Array.from(new Set(employees.map(e => e.department || 'Unassigned')))];

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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('employees.addEmployee')}>
        <form onSubmit={handleAddEmployee} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">First Name</label>
              <Input 
                required
                value={newEmployee.first_name}
                onChange={e => setNewEmployee({...newEmployee, first_name: e.target.value})}
                placeholder="John" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Last Name</label>
              <Input 
                required
                value={newEmployee.last_name}
                onChange={e => setNewEmployee({...newEmployee, last_name: e.target.value})}
                placeholder="Doe" 
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('employees.email')}</label>
            <Input 
              required
              type="email"
              value={newEmployee.email}
              onChange={e => setNewEmployee({...newEmployee, email: e.target.value})}
              placeholder="john@example.com" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('employees.department')}</label>
              <select 
                className="w-full h-10 bg-white/5 border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-primary"
                value={newEmployee.department}
                onChange={e => setNewEmployee({...newEmployee, department: e.target.value})}
              >
                <option value="Engineering">Engineering</option>
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="HR">HR</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Position</label>
              <Input 
                value={newEmployee.position}
                onChange={e => setNewEmployee({...newEmployee, position: e.target.value})}
                placeholder="Software Engineer" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Joining Date</label>
              <Input 
                type="date"
                value={newEmployee.joining_date}
                onChange={e => setNewEmployee({...newEmployee, joining_date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Salary</label>
              <Input 
                type="number"
                value={newEmployee.salary}
                onChange={e => setNewEmployee({...newEmployee, salary: Number(e.target.value)})}
                placeholder="5000" 
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.save')}</Button>
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
              {departments.map(dept => (
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
                      <span>{employee.first_name[0]}{employee.last_name[0]}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{employee.first_name} {employee.last_name}</h3>
                    <p className="text-xs text-muted-foreground">{employee.designation}</p>
                  </div>
                </div>
                <Badge variant={employee.status === 'Active' ? 'success' : 'warning'}>
                  {employee.status}
                </Badge>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User size={14} className="shrink-0" />
                  <span>{employee.employee_id}</span>
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
