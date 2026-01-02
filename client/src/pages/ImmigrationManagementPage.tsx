import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '../components/common/UIComponents';
import { FileText } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { employeeImmigrationService, EmployeeImmigration } from '../services/employeeImmigrationService';
import { employeeService, Employee } from '../services/employeeService';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  Globe, 
  AlertCircle, 
  FileCheck, 
  Calendar,
  Clock,
  User,
  Filter,
  Eye,
  Edit,
  Plus
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { StatusBadge } from '../components/common/StatusBadge';

interface ImmigrationWithEmployee extends EmployeeImmigration {
  employee?: Employee;
  daysUntilExpiry?: number | null;
}

export default function ImmigrationManagementPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [immigrations, setImigrations] = useState<ImmigrationWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedImmigration, setSelectedImmigration] = useState<ImmigrationWithEmployee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<EmployeeImmigration>>({});
  const [addForm, setAddForm] = useState<Partial<EmployeeImmigration>>({
    is_expatriate: true,
    residence_permit_article: 'Article 18',
    work_permit_status: 'Active',
    residence_permit_status: 'Active',
    health_insurance_status: 'Active',
    passport_status: 'Valid',
    civil_id_status: 'Valid',
    renewal_priority: 'Normal'
  });

  useEffect(() => {
    loadData();
  }, [priorityFilter, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [immigrationData, employeeData] = await Promise.all([
        employeeImmigrationService.getAll({
          renewal_priority: priorityFilter !== 'all' ? priorityFilter : undefined,
          is_expatriate: true
        }),
        employeeService.getAll()
      ]);

      // Map employees to immigration records
      const mapped = immigrationData.map(imm => {
        const emp = employeeData.find(e => e.id === imm.employee_id);
        let daysUntilExpiry = null;
        
        if (imm.next_renewal_date) {
          const today = new Date();
          const expiry = new Date(imm.next_renewal_date);
          daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          ...imm,
          employee: emp,
          daysUntilExpiry
        };
      });

      setImigrations(mapped);
      setEmployees(employeeData);
    } catch (error) {
      console.error('Failed to load immigration data', error);
      toast.error('Failed to load immigration data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (immigration: ImmigrationWithEmployee) => {
    setSelectedImmigration(immigration);
    setViewModalOpen(true);
  };

  const handleEdit = (immigration: ImmigrationWithEmployee) => {
    setSelectedImmigration(immigration);
    setEditForm({
      work_permit_status: immigration.work_permit_status,
      residence_permit_status: immigration.residence_permit_status,
      health_insurance_status: immigration.health_insurance_status,
      passport_status: immigration.passport_status,
      civil_id_status: immigration.civil_id_status,
      renewal_notes: immigration.renewal_notes
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedImmigration) return;

    try {
      await employeeImmigrationService.update(selectedImmigration.id, {
        ...editForm,
        last_renewal_processed_by: user?.employee_id || undefined,
        last_renewal_processed_date: new Date().toISOString()
      });
      toast.success('Immigration record updated successfully');
      setEditModalOpen(false);
      setSelectedImmigration(null);
      loadData();
    } catch (error) {
      console.error('Failed to update immigration record', error);
      toast.error('Failed to update immigration record');
    }
  };

  const handleAdd = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    try {
      // Calculate next renewal info
      const renewalInfo = employeeImmigrationService.calculateRenewalInfo(addForm as EmployeeImmigration);
      
      await employeeImmigrationService.upsert({
        employee_id: selectedEmployee.id,
        ...addForm,
        next_renewal_date: renewalInfo.nextRenewalDate || undefined,
        next_renewal_action: renewalInfo.nextRenewalAction,
        renewal_priority: renewalInfo.priority,
        last_renewal_processed_by: user?.employee_id || undefined,
        last_renewal_processed_date: new Date().toISOString()
      });
      toast.success('Immigration record added successfully');
      setAddModalOpen(false);
      setSelectedEmployee(null);
      setAddForm({
        is_expatriate: true,
        residence_permit_article: 'Article 18',
        work_permit_status: 'Active',
        residence_permit_status: 'Active',
        health_insurance_status: 'Active',
        passport_status: 'Valid',
        civil_id_status: 'Valid',
        renewal_priority: 'Normal'
      });
      loadData();
    } catch (error) {
      console.error('Failed to add immigration record', error);
      toast.error('Failed to add immigration record');
    }
  };

  // Calculate statistics
  const stats = {
    total: immigrations.length,
    urgent: immigrations.filter(i => i.renewal_priority === 'Urgent').length,
    high: immigrations.filter(i => i.renewal_priority === 'High').length,
    expiringThisMonth: immigrations.filter(i => {
      if (!i.next_renewal_date) return false;
      const expiry = new Date(i.next_renewal_date);
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
      return expiry >= today && expiry <= nextMonth;
    }).length
  };

  // Filter data
  const filteredData = immigrations.filter(imm => {
    const matchesSearch = !searchQuery || 
      imm.employee?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      imm.employee?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      imm.employee?.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      imm.work_permit_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      imm.residence_permit_number?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || 
      imm.work_permit_status === statusFilter ||
      imm.residence_permit_status === statusFilter ||
      imm.health_insurance_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Sort by priority and renewal date
  const sortedData = [...filteredData].sort((a, b) => {
    const priorityOrder = { 'Urgent': 0, 'High': 1, 'Normal': 2, 'Low': 3 };
    const aPriority = priorityOrder[a.renewal_priority as keyof typeof priorityOrder] ?? 3;
    const bPriority = priorityOrder[b.renewal_priority as keyof typeof priorityOrder] ?? 3;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    if (a.next_renewal_date && b.next_renewal_date) {
      return new Date(a.next_renewal_date).getTime() - new Date(b.next_renewal_date).getTime();
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Globe size={32} className="text-primary" />
            Immigration Management
          </h1>
          <p className="text-muted-foreground mt-1">Manage residence permits, work permits, and immigration documents for expatriate employees</p>
        </div>
        <Button 
          onClick={() => setAddModalOpen(true)}
          className="gap-2"
        >
          <Plus size={20} />
          Add Immigration Record
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expatriates</p>
                <p className="text-3xl font-bold mt-2">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <User size={24} className="text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent Renewals</p>
                <p className="text-3xl font-bold text-red-400 mt-2">{stats.urgent}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className="text-3xl font-bold text-orange-400 mt-2">{stats.high}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Clock size={24} className="text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expiring This Month</p>
                <p className="text-3xl font-bold text-yellow-400 mt-2">{stats.expiringThisMonth}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Calendar size={24} className="text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by employee name, ID, or permit number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending Renewal">Pending Renewal</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Immigration Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Immigration Records ({sortedData.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : sortedData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe size={64} className="mx-auto mb-4 opacity-50" />
              <p>No immigration records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Employee</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Work Permit</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Residence Permit</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Next Renewal</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Priority</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((imm) => (
                    <tr key={imm.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="font-semibold">
                            {imm.employee?.first_name} {imm.employee?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">{imm.employee?.employee_id}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-sm">{imm.work_permit_number || 'N/A'}</p>
                          <StatusBadge status={(imm.work_permit_status || 'N/A') as any} />
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-sm">{imm.residence_permit_number || 'N/A'}</p>
                          <StatusBadge status={(imm.residence_permit_status || 'N/A') as any} />
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-sm font-medium">
                            {imm.next_renewal_action || 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {imm.next_renewal_date ? new Date(imm.next_renewal_date).toLocaleDateString() : 'N/A'}
                          </p>
                          {imm.daysUntilExpiry !== null && imm.daysUntilExpiry !== undefined && (
                            <p className={`text-xs mt-1 ${
                              imm.daysUntilExpiry < 0 ? 'text-red-400' :
                              imm.daysUntilExpiry <= 30 ? 'text-orange-400' :
                              'text-green-400'
                            }`}>
                              {imm.daysUntilExpiry < 0 
                                ? `${Math.abs(imm.daysUntilExpiry)} days overdue`
                                : `${imm.daysUntilExpiry} days remaining`
                              }
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge 
                          variant={
                            imm.renewal_priority === 'Urgent' ? 'destructive' :
                            imm.renewal_priority === 'High' ? 'warning' :
                            'outline'
                          }
                        >
                          {imm.renewal_priority || 'Normal'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(imm)}
                          >
                            <Eye size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(imm)}
                          >
                            <Edit size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Immigration Details</DialogTitle>
            <DialogDescription>
              {selectedImmigration && (
                <span>
                  {selectedImmigration.employee?.first_name} {selectedImmigration.employee?.last_name} 
                  {' '}({selectedImmigration.employee?.employee_id})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedImmigration && (
            <div className="space-y-6 mt-4">
              {/* Work Permit */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileCheck size={18} /> Work Permit
                </h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Number</Label>
                    <p className="font-medium">{selectedImmigration.work_permit_number || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <StatusBadge status={(selectedImmigration.work_permit_status || 'N/A') as any} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Expiry Date</Label>
                    <p className="font-medium">
                      {selectedImmigration.work_permit_expiry_date 
                        ? new Date(selectedImmigration.work_permit_expiry_date).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Residence Permit */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileCheck size={18} /> Residence Permit
                </h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Number</Label>
                    <p className="font-medium">{selectedImmigration.residence_permit_number || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <StatusBadge status={(selectedImmigration.residence_permit_status || 'N/A') as any} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Expiry Date</Label>
                    <p className="font-medium">
                      {selectedImmigration.residence_permit_expiry_date 
                        ? new Date(selectedImmigration.residence_permit_expiry_date).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Passport */}
              {selectedImmigration.passport_number && (
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileCheck size={18} /> Passport
                  </h3>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg">
                    <div>
                      <Label className="text-xs text-muted-foreground">Number</Label>
                      <p className="font-medium">{selectedImmigration.passport_number}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Expiry Date</Label>
                      <p className="font-medium">
                        {selectedImmigration.passport_expiry_date 
                          ? new Date(selectedImmigration.passport_expiry_date).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedImmigration.renewal_notes && (
                <div className="space-y-2">
                  <Label>Renewal Notes</Label>
                  <p className="text-sm p-4 bg-white/5 rounded-lg">{selectedImmigration.renewal_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Immigration Status</DialogTitle>
            <DialogDescription>
              Update the status of immigration documents and add renewal notes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Work Permit Status</Label>
                <Select 
                  value={editForm.work_permit_status} 
                  onValueChange={(value) => setEditForm({ ...editForm, work_permit_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending Renewal">Pending Renewal</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Residence Permit Status</Label>
                <Select 
                  value={editForm.residence_permit_status} 
                  onValueChange={(value) => setEditForm({ ...editForm, residence_permit_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending Renewal">Pending Renewal</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Renewal Notes</Label>
              <Textarea
                value={editForm.renewal_notes || ''}
                onChange={(e) => setEditForm({ ...editForm, renewal_notes: e.target.value })}
                placeholder="Add notes about the renewal process..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Immigration Record Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
              <DialogContent 
          className="max-h-[95vh] overflow-y-auto" 
          style={{ maxWidth: '1400px', width: '98vw' }}
        >
          <DialogHeader className="pb-4 border-b border-white/10">
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Globe size={28} className="text-primary" />
              Add Immigration Record
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Add immigration and residence permit information for an expatriate employee according to Kuwait expat law
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-6">
            {/* Employee Selection */}
            <Card className="overflow-hidden border-primary/20 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <User size={20} className="text-primary" />
                  </div>
                  <div>
                    <Label className="text-base font-semibold">Select Employee *</Label>
                    <p className="text-sm text-muted-foreground">Choose the expatriate employee</p>
                  </div>
                </div>
                <Select 
                  value={selectedEmployee?.id || ''} 
                  onValueChange={(value) => {
                    const emp = employees.find(e => e.id === value);
                    setSelectedEmployee(emp || null);
                    if (emp) {
                      setAddForm(prev => ({ ...prev, employee_id: emp.id }));
                    }
                  }}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter(emp => !immigrations.find(imm => imm.employee_id === emp.id))
                      .map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} ({emp.employee_id || emp.employeeId})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Work Permit Section */}
            <Card className="overflow-hidden border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
              <CardHeader className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-b border-blue-500/20 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <FileCheck size={18} className="text-blue-400" />
                  </div>
                  Work Permit (Public Authority for Manpower)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Work Permit Number</Label>
                    <Input
                      value={addForm.work_permit_number || ''}
                      onChange={(e) => setAddForm({ ...addForm, work_permit_number: e.target.value })}
                      placeholder="Enter work permit number"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Status</Label>
                    <Select 
                      value={addForm.work_permit_status} 
                      onValueChange={(value) => setAddForm({ ...addForm, work_permit_status: value })}
                    >
                      <SelectTrigger className="h-11">
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
                    <Label className="text-sm font-semibold">Issue Date</Label>
                    <Input
                      type="date"
                      value={addForm.work_permit_issue_date || ''}
                      onChange={(e) => setAddForm({ ...addForm, work_permit_issue_date: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Expiry Date <span className="text-red-400">*</span></Label>
                    <Input
                      type="date"
                      value={addForm.work_permit_expiry_date || ''}
                      onChange={(e) => setAddForm({ ...addForm, work_permit_expiry_date: e.target.value })}
                      required
                      className="h-11"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Residence Permit Section */}
            <Card className="overflow-hidden border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
              <CardHeader className="bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent border-b border-purple-500/20 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <FileCheck size={18} className="text-purple-400" />
                  </div>
                  Residence Permit (Article 18) - Ministry of Interior
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Residence Permit Number</Label>
                    <Input
                      value={addForm.residence_permit_number || ''}
                      onChange={(e) => setAddForm({ ...addForm, residence_permit_number: e.target.value })}
                      placeholder="Enter residence permit number"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Status</Label>
                    <Select 
                      value={addForm.residence_permit_status} 
                      onValueChange={(value) => setAddForm({ ...addForm, residence_permit_status: value })}
                    >
                      <SelectTrigger className="h-11">
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
                    <Label className="text-sm font-semibold">Issue Date</Label>
                    <Input
                      type="date"
                      value={addForm.residence_permit_issue_date || ''}
                      onChange={(e) => setAddForm({ ...addForm, residence_permit_issue_date: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Expiry Date <span className="text-red-400">*</span></Label>
                    <Input
                      type="date"
                      value={addForm.residence_permit_expiry_date || ''}
                      onChange={(e) => setAddForm({ ...addForm, residence_permit_expiry_date: e.target.value })}
                      required
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Article</Label>
                    <Select 
                      value={addForm.residence_permit_article} 
                      onValueChange={(value) => setAddForm({ ...addForm, residence_permit_article: value })}
                    >
                      <SelectTrigger className="h-11">
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
              </CardContent>
            </Card>

            {/* Passport Section */}
            <Card className="overflow-hidden border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
              <CardHeader className="bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent border-b border-green-500/20 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <FileCheck size={18} className="text-green-400" />
                  </div>
                  Passport Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Passport Number</Label>
                    <Input
                      value={addForm.passport_number || ''}
                      onChange={(e) => setAddForm({ ...addForm, passport_number: e.target.value })}
                      placeholder="Enter passport number"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Issue Country</Label>
                    <Input
                      value={addForm.passport_issue_country || ''}
                      onChange={(e) => setAddForm({ ...addForm, passport_issue_country: e.target.value })}
                      placeholder="Enter country"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Issue Date</Label>
                    <Input
                      type="date"
                      value={addForm.passport_issue_date || ''}
                      onChange={(e) => setAddForm({ ...addForm, passport_issue_date: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Expiry Date <span className="text-red-400">*</span></Label>
                    <Input
                      type="date"
                      value={addForm.passport_expiry_date || ''}
                      onChange={(e) => setAddForm({ ...addForm, passport_expiry_date: e.target.value })}
                      required
                      className="h-11"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Health Insurance Section */}
            <Card className="overflow-hidden border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
              <CardHeader className="bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent border-b border-cyan-500/20 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <FileCheck size={18} className="text-cyan-400" />
                  </div>
                  Health Insurance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Insurance Number</Label>
                    <Input
                      value={addForm.health_insurance_number || ''}
                      onChange={(e) => setAddForm({ ...addForm, health_insurance_number: e.target.value })}
                      placeholder="Enter insurance number"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Provider</Label>
                    <Input
                      value={addForm.health_insurance_provider || ''}
                      onChange={(e) => setAddForm({ ...addForm, health_insurance_provider: e.target.value })}
                      placeholder="Enter insurance provider"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Issue Date</Label>
                    <Input
                      type="date"
                      value={addForm.health_insurance_issue_date || ''}
                      onChange={(e) => setAddForm({ ...addForm, health_insurance_issue_date: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Expiry Date</Label>
                    <Input
                      type="date"
                      value={addForm.health_insurance_expiry_date || ''}
                      onChange={(e) => setAddForm({ ...addForm, health_insurance_expiry_date: e.target.value })}
                      className="h-11"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Civil ID Section */}
            <Card className="overflow-hidden border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
              <CardHeader className="bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border-b border-orange-500/20 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <FileCheck size={18} className="text-orange-400" />
                  </div>
                  Civil ID
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Civil ID Number</Label>
                    <Input
                      value={addForm.civil_id_number || ''}
                      onChange={(e) => setAddForm({ ...addForm, civil_id_number: e.target.value })}
                      placeholder="Enter Civil ID number"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Expiry Date</Label>
                    <Input
                      type="date"
                      value={addForm.civil_id_expiry_date || ''}
                      onChange={(e) => setAddForm({ ...addForm, civil_id_expiry_date: e.target.value })}
                      className="h-11"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* General Information */}
            <Card className="overflow-hidden border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent">
              <CardHeader className="bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border-b border-indigo-500/20 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Globe size={18} className="text-indigo-400" />
                  </div>
                  General Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Visa Type</Label>
                    <Select 
                      value={addForm.visa_type} 
                      onValueChange={(value) => setAddForm({ ...addForm, visa_type: value })}
                    >
                      <SelectTrigger className="h-11">
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
                    <Label className="text-sm font-semibold">Sponsor Name</Label>
                    <Input
                      value={addForm.sponsor_name || ''}
                      onChange={(e) => setAddForm({ ...addForm, sponsor_name: e.target.value })}
                      placeholder="Company or individual name"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Entry Date</Label>
                    <Input
                      type="date"
                      value={addForm.entry_date || ''}
                      onChange={(e) => setAddForm({ ...addForm, entry_date: e.target.value })}
                      className="h-11"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="overflow-hidden border-slate-500/20 bg-gradient-to-br from-slate-500/5 to-transparent">
              <CardContent className="p-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <FileText size={16} className="text-slate-400" />
                    Additional Notes
                  </Label>
                  <Textarea
                    value={addForm.notes || ''}
                    onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                    placeholder="Add any additional notes about immigration status, renewals, or special requirements..."
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button 
                variant="outline" 
                onClick={() => {
                  setAddModalOpen(false);
                  setSelectedEmployee(null);
                  setAddForm({
                    is_expatriate: true,
                    residence_permit_article: 'Article 18',
                    work_permit_status: 'Active',
                    residence_permit_status: 'Active',
                    health_insurance_status: 'Active',
                    passport_status: 'Valid',
                    civil_id_status: 'Valid',
                    renewal_priority: 'Normal'
                  });
                }}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAdd} 
                disabled={!selectedEmployee}
                className="px-6 gap-2"
              >
                <Plus size={18} />
                Add Immigration Record
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

