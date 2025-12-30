import { useState, useEffect } from 'react';
import { Search, Download, Plus, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Mock employee data with salary components
const mockEmployees = [
  {
    id: 1,
    employeeId: 'EMP001',
    name: 'John Doe',
    department: 'Engineering',
    basicSalary: 4500,
    housingAllowance: 1000,
    transportAllowance: 500,
    grossSalary: 6000,
    taxDeduction: 600,
    socialInsurance: 300,
    totalDeductions: 900,
    netSalary: 5100,
    governmentRegisteredAmount: 7000,
    defaultReturnAmount: 1900, // From employee profile
    returnAmount: 1900,
    bankTransferAmount: 7000,
    finalNetPayroll: 5100,
  },
  {
    id: 2,
    employeeId: 'EMP002',
    name: 'Jane Smith',
    department: 'Sales',
    basicSalary: 3800,
    housingAllowance: 800,
    transportAllowance: 400,
    grossSalary: 5000,
    taxDeduction: 500,
    socialInsurance: 250,
    totalDeductions: 750,
    netSalary: 4250,
    governmentRegisteredAmount: 6000,
    defaultReturnAmount: 1750, // From employee profile
    returnAmount: 1750,
    bankTransferAmount: 6000,
    finalNetPayroll: 4250,
  },
  {
    id: 3,
    employeeId: 'EMP003',
    name: 'Mike Johnson',
    department: 'Marketing',
    basicSalary: 4000,
    housingAllowance: 900,
    transportAllowance: 450,
    grossSalary: 5350,
    taxDeduction: 535,
    socialInsurance: 268,
    totalDeductions: 803,
    netSalary: 4547,
    governmentRegisteredAmount: 6500,
    defaultReturnAmount: 1953, // From employee profile
    returnAmount: 1953,
    bankTransferAmount: 6500,
    finalNetPayroll: 4547,
  },
];

export default function GeneratePayrollTab() {
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [payrollMonth, setPayrollMonth] = useState('12');
  const [payrollYear, setPayrollYear] = useState('2024');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [customReturnAmounts, setCustomReturnAmounts] = useState<Record<number, number>>({});

  // Initialize custom return amounts with employee defaults
  useEffect(() => {
    const defaults: Record<number, number> = {};
    mockEmployees.forEach(emp => {
      defaults[emp.id] = emp.defaultReturnAmount || emp.returnAmount;
    });
    setCustomReturnAmounts(defaults);
  }, []);

  // Filter employees
  const filteredEmployees = mockEmployees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const handleSelectAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filteredEmployees.map((emp) => emp.id));
    }
  };

  const handleSelectEmployee = (empId: number) => {
    if (selectedEmployees.includes(empId)) {
      setSelectedEmployees(selectedEmployees.filter((id) => id !== empId));
    } else {
      setSelectedEmployees([...selectedEmployees, empId]);
    }
  };

  const handlePreview = () => {
    if (selectedEmployees.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }
    setPreviewModalOpen(true);
  };

  const handleGenerate = () => {
    setPreviewModalOpen(false);
    setConfirmModalOpen(true);
  };

  const handleConfirmGenerate = () => {
    toast.success(`Payroll generated for ${selectedEmployees.length} employees`);
    setConfirmModalOpen(false);
    setSelectedEmployees([]);
  };

  const selectedEmployeesData = mockEmployees.filter((emp) => selectedEmployees.includes(emp.id));
  const totalGrossSalary = selectedEmployeesData.reduce((sum, emp) => sum + emp.grossSalary, 0);
  const totalDeductions = selectedEmployeesData.reduce((sum, emp) => sum + emp.totalDeductions, 0);
  const totalNetSalary = selectedEmployeesData.reduce((sum, emp) => sum + emp.netSalary, 0);
  const totalBankTransfer = selectedEmployeesData.reduce((sum, emp) => sum + emp.bankTransferAmount, 0);
  const totalReturnAmount = selectedEmployeesData.reduce((sum, emp) => {
    const customAmount = customReturnAmounts[emp.id];
    return sum + (customAmount !== undefined ? customAmount : emp.returnAmount);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Payroll Configuration</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Payroll Month *</Label>
            <Select value={payrollMonth} onValueChange={setPayrollMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payroll Year *</Label>
            <Select value={payrollYear} onValueChange={setPayrollYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment Date</Label>
            <Input type="date" defaultValue="2024-12-25" />
          </div>
        </div>
      </Card>

      {/* Employee Selection */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">Select Employees</h4>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedEmployees.length} of {filteredEmployees.length} selected
            </span>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedEmployees.length === filteredEmployees.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="Engineering">Engineering</SelectItem>
              <SelectItem value="Sales">Sales</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Employee Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium">
                  <Checkbox
                    checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium">Employee</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Department</th>
                <th className="text-right py-3 px-4 text-sm font-medium">Gross Salary</th>
                <th className="text-right py-3 px-4 text-sm font-medium">Deductions</th>
                <th className="text-right py-3 px-4 text-sm font-medium">Net Salary</th>
                <th className="text-right py-3 px-4 text-sm font-medium">Bank Transfer</th>
                <th className="text-right py-3 px-4 text-sm font-medium">Return Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const displayReturnAmount = customReturnAmounts[emp.id] ?? emp.returnAmount;
                return (
                <tr key={emp.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <Checkbox
                      checked={selectedEmployees.includes(emp.id)}
                      onCheckedChange={() => handleSelectEmployee(emp.id)}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.employeeId}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">{emp.department}</td>
                  <td className="py-3 px-4 text-right font-medium">${emp.grossSalary.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-red-600">-${emp.totalDeductions.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-semibold">${emp.netSalary.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-semibold text-blue-600">${emp.bankTransferAmount.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    {selectedEmployees.includes(emp.id) ? (
                      <div className="flex flex-col gap-1">
                        <Input
                          type="number"
                          value={displayReturnAmount}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setCustomReturnAmounts({ ...customReturnAmounts, [emp.id]: value });
                          }}
                          className="w-28 text-right font-semibold text-amber-600"
                        />
                        {displayReturnAmount !== emp.defaultReturnAmount && (
                          <span className="text-xs text-amber-600">⚠ Modified</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-right font-semibold text-amber-600">${emp.returnAmount.toLocaleString()}</span>
                    )}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary & Actions */}
      {selectedEmployees.length > 0 && (
        <Card className="p-6 border-blue-500/50 bg-blue-500/5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold mb-4">Payroll Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Employees</p>
                  <p className="text-2xl font-bold">{selectedEmployees.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gross Salary</p>
                  <p className="text-2xl font-bold">${(totalGrossSalary / 1000).toFixed(0)}k</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Deductions</p>
                  <p className="text-2xl font-bold text-red-600">-${(totalDeductions / 1000).toFixed(0)}k</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Salary</p>
                  <p className="text-2xl font-bold">${(totalNetSalary / 1000).toFixed(0)}k</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bank Transfer</p>
                  <p className="text-2xl font-bold text-blue-600">${(totalBankTransfer / 1000).toFixed(0)}k</p>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium">Total Return Amount: ${(totalReturnAmount / 1000).toFixed(0)}k</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Employees must return this amount within the month
                </p>
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              <Button variant="outline" onClick={handlePreview}>
                Preview
              </Button>
              <Button onClick={handleGenerate}>
                <DollarSign className="w-4 h-4 mr-2" />
                Generate Payroll
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payroll Preview - {new Date(2024, parseInt(payrollMonth) - 1).toLocaleString('default', { month: 'long' })} {payrollYear}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-4">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Employees</p>
                <p className="text-xl font-bold">{selectedEmployees.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Gross</p>
                <p className="text-xl font-bold">${(totalGrossSalary / 1000).toFixed(0)}k</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Deductions</p>
                <p className="text-xl font-bold text-red-600">-${(totalDeductions / 1000).toFixed(0)}k</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Net</p>
                <p className="text-xl font-bold">${(totalNetSalary / 1000).toFixed(0)}k</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Returns</p>
                <p className="text-xl font-bold text-amber-600">${(totalReturnAmount / 1000).toFixed(0)}k</p>
              </Card>
            </div>
            
            <div className="border rounded-lg p-4 space-y-2">
              {selectedEmployeesData.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div>
                    <p className="font-medium">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.employeeId}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">Net: ${emp.netSalary.toLocaleString()}</p>
                    <p className="text-xs text-amber-600">Return: ${emp.returnAmount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate}>
              Confirm & Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payroll Generation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium">Important: Government Compliance Adjustment</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Bank transfers will be made for the government registered amounts. Employees must return the compliance adjustment within the month.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Total Bank Transfer:</strong> ${totalBankTransfer.toLocaleString()}
              </p>
              <p className="text-sm">
                <strong>Total Return Expected:</strong> ${totalReturnAmount.toLocaleString()}
              </p>
              <p className="text-sm">
                <strong>Final Net Payroll:</strong> ${totalNetSalary.toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmGenerate}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirm & Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
