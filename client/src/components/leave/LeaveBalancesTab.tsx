import { useState } from 'react';
import { Search, Download, Plus, Edit, History } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// Mock employee balances data
const mockBalances = [
  {
    id: 1,
    employee: { id: 1, name: 'John Doe', department: 'Engineering', employeeId: 'EMP001' },
    balances: [
      { leaveType: 'Annual Leave', code: 'AL', color: '#3b82f6', entitled: 21, used: 5, pending: 2, available: 14 },
      { leaveType: 'Sick Leave', code: 'SL', color: '#ef4444', entitled: 10, used: 2, pending: 0, available: 8 },
      { leaveType: 'Emergency Leave', code: 'EL', color: '#f59e0b', entitled: 3, used: 1, pending: 0, available: 2 },
    ],
  },
  {
    id: 2,
    employee: { id: 2, name: 'Jane Smith', department: 'Sales', employeeId: 'EMP002' },
    balances: [
      { leaveType: 'Annual Leave', code: 'AL', color: '#3b82f6', entitled: 21, used: 12, pending: 3, available: 6 },
      { leaveType: 'Sick Leave', code: 'SL', color: '#ef4444', entitled: 10, used: 4, pending: 1, available: 5 },
      { leaveType: 'Emergency Leave', code: 'EL', color: '#f59e0b', entitled: 3, used: 0, pending: 0, available: 3 },
    ],
  },
  {
    id: 3,
    employee: { id: 3, name: 'Mike Johnson', department: 'Marketing', employeeId: 'EMP003' },
    balances: [
      { leaveType: 'Annual Leave', code: 'AL', color: '#3b82f6', entitled: 21, used: 8, pending: 1, available: 12 },
      { leaveType: 'Sick Leave', code: 'SL', color: '#ef4444', entitled: 10, used: 1, pending: 0, available: 9 },
      { leaveType: 'Emergency Leave', code: 'EL', color: '#f59e0b', entitled: 3, used: 2, pending: 0, available: 1 },
    ],
  },
];

export default function LeaveBalancesTab() {
  const [balances, setBalances] = useState(mockBalances);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [adjustmentData, setAdjustmentData] = useState({
    type: 'add',
    days: 0,
    reason: '',
  });

  // Filter balances
  const filteredBalances = balances.filter((balance) => {
    const matchesSearch =
      balance.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      balance.employee.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = departmentFilter === 'all' || balance.employee.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const handleAdjust = (employee: any, leaveType: string) => {
    setSelectedEmployee(employee);
    setSelectedLeaveType(leaveType);
    setAdjustmentData({ type: 'add', days: 0, reason: '' });
    setAdjustModalOpen(true);
  };

  const handleSaveAdjustment = () => {
    // Update balance
    setBalances(
      balances.map((b) => {
        if (b.employee.id === selectedEmployee.id) {
          return {
            ...b,
            balances: b.balances.map((bal) => {
              if (bal.leaveType === selectedLeaveType) {
                const adjustment = adjustmentData.type === 'add' ? adjustmentData.days : -adjustmentData.days;
                return {
                  ...bal,
                  entitled: bal.entitled + adjustment,
                  available: bal.available + adjustment,
                };
              }
              return bal;
            }),
          };
        }
        return b;
      })
    );
    setAdjustModalOpen(false);
  };

  const handleViewHistory = (employee: any) => {
    setSelectedEmployee(employee);
    setHistoryModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full lg:w-[200px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="Engineering">Engineering</SelectItem>
              <SelectItem value="Sales">Sales</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="HR">HR</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Bulk Adjust
            </Button>
          </div>
        </div>
      </Card>

      {/* Balances Table */}
      <div className="space-y-4">
        {filteredBalances.map((balance) => (
          <Card key={balance.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold">{balance.employee.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {balance.employee.employeeId} • {balance.employee.department}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleViewHistory(balance.employee)}>
                <History className="w-4 h-4 mr-2" />
                History
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {balance.balances.map((bal, index) => (
                <div key={index} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: bal.color }}
                      />
                      <span className="font-medium text-sm">{bal.leaveType}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: bal.color, color: 'white' }}
                      >
                        {bal.code}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAdjust(balance.employee, bal.leaveType)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Entitled</p>
                      <p className="font-semibold">{bal.entitled} days</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Used</p>
                      <p className="font-semibold text-red-600">{bal.used} days</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Pending</p>
                      <p className="font-semibold text-amber-600">{bal.pending} days</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Available</p>
                      <p className="font-semibold text-green-600">{bal.available} days</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full flex">
                        <div
                          className="bg-red-500"
                          style={{ width: `${(bal.used / bal.entitled) * 100}%` }}
                        />
                        <div
                          className="bg-amber-500"
                          style={{ width: `${(bal.pending / bal.entitled) * 100}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {((bal.used / bal.entitled) * 100).toFixed(0)}% utilized
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {filteredBalances.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No employee balances found</p>
        </Card>
      )}

      {/* Adjust Balance Modal */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Leave Balance</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Employee</p>
                <p className="font-medium">{selectedEmployee.name}</p>
                <p className="text-sm text-muted-foreground">{selectedEmployee.employeeId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leave Type</p>
                <p className="font-medium">{selectedLeaveType}</p>
              </div>
              <div>
                <Label>Adjustment Type *</Label>
                <Select
                  value={adjustmentData.type}
                  onValueChange={(value) => setAdjustmentData({ ...adjustmentData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add Days</SelectItem>
                    <SelectItem value="deduct">Deduct Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Number of Days *</Label>
                <Input
                  type="number"
                  value={adjustmentData.days}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, days: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.5}
                />
              </div>
              <div>
                <Label>Reason *</Label>
                <Textarea
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                  placeholder="Enter reason for adjustment..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAdjustment} disabled={!adjustmentData.reason.trim() || adjustmentData.days === 0}>
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Leave Balance History</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">{selectedEmployee.name}</p>
                <p className="text-sm text-muted-foreground">{selectedEmployee.employeeId}</p>
              </div>
              <div className="space-y-2">
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">Annual Leave Adjustment</span>
                    <span className="text-xs text-muted-foreground">2024-12-01</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Added 5 days - Year-end bonus</p>
                  <p className="text-sm font-medium text-green-600">+5 days</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">Sick Leave Deduction</span>
                    <span className="text-xs text-muted-foreground">2024-11-15</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Deducted 2 days - Exceeded limit</p>
                  <p className="text-sm font-medium text-red-600">-2 days</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">Annual Leave Carry Forward</span>
                    <span className="text-xs text-muted-foreground">2024-01-01</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Carried forward from 2023</p>
                  <p className="text-sm font-medium text-green-600">+3 days</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
