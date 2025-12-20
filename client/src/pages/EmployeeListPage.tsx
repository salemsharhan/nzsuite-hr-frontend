import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Mail, 
  Phone, 
  MapPin,
  FileText,
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '../components/common/UIComponents';
import Modal from '../components/common/Modal';
import { employeeService, Employee } from '../services/employeeService';
import { useEffect } from 'react';

export default function EmployeeListPage() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('employees.addEmployee')}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('employees.name')}</label>
            <Input placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('employees.email')}</label>
            <Input placeholder="john@example.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('employees.department')}</label>
            <select className="w-full h-10 bg-white/5 border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-primary">
              <option>Engineering</option>
              <option>Sales</option>
              <option>Marketing</option>
              <option>HR</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => setIsModalOpen(false)}>{t('common.save')}</Button>
          </div>
        </div>
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
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border border-white/10">
                    {employee.first_name[0]}{employee.last_name[0]}
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
                  <span>{employee.phone}</span>
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
