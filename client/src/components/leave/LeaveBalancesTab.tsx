import { useState, useEffect } from 'react';
import { Search, Download, Edit, History, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { getLeaveBalances, LeaveBalance } from '../../services/leaveBalanceService';
import { useTranslation } from 'react-i18next';

export default function LeaveBalancesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<LeaveBalance | null>(null);
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [adjustmentData, setAdjustmentData] = useState({
    type: 'add',
    days: 0,
    reason: '',
  });

  useEffect(() => {
    if (user?.company_id) {
      loadBalances();
    }
  }, [user?.company_id]);

  const loadBalances = async () => {
    if (!user?.company_id) return;
    
    setLoading(true);
    try {
      const data = await getLeaveBalances(user.company_id);
      setBalances(data);
    } catch (error) {
      console.error('Error loading leave balances:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique departments for filter
  const departments = Array.from(new Set(balances.map(b => b.department))).filter(Boolean);

  // Filter balances
  const filteredBalances = balances.filter((balance) => {
    const matchesSearch =
      balance.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      balance.employee_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = departmentFilter === 'all' || balance.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const handleAdjust = (employee: LeaveBalance, leaveType: string) => {
    setSelectedEmployee(employee);
    setSelectedLeaveType(leaveType);
    setAdjustmentData({ type: 'add', days: 0, reason: '' });
    setAdjustModalOpen(true);
  };

  const handleSaveAdjustment = () => {
    // TODO: Implement adjustment API call
    console.log('Adjustment:', { selectedEmployee, selectedLeaveType, adjustmentData });
    setAdjustModalOpen(false);
    // Reload balances after adjustment
    loadBalances();
  };

  const handleViewHistory = (employee: LeaveBalance) => {
    setSelectedEmployee(employee);
    setHistoryModalOpen(true);
  };

  const getLeaveTypeInfo = (type: string) => {
    switch (type) {
      case 'Annual Leave':
        return { code: 'AL', color: '#3b82f6', label: t('leaves.annualLeave') || 'Annual Leave' };
      case 'Sick Leave':
        return { code: 'SL', color: '#ef4444', label: t('leaves.sickLeave') || 'Sick Leave' };
      case 'Emergency Leave':
        return { code: 'EL', color: '#f59e0b', label: t('leaves.emergencyLeave') || 'Emergency Leave' };
      default:
        return { code: type.substring(0, 2).toUpperCase(), color: '#6b7280', label: type };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">{t('common.loading') || 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('leaves.searchEmployee') || 'Search by employee name or ID...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full lg:w-[200px]">
              <SelectValue placeholder={t('common.department') || 'Department'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all') || 'All Departments'}</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              {t('common.export') || 'Export'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Balances Table */}
      <div className="space-y-4">
        {filteredBalances.map((balance) => {
          const annualInfo = getLeaveTypeInfo('Annual Leave');
          const sickInfo = getLeaveTypeInfo('Sick Leave');
          const emergencyInfo = getLeaveTypeInfo('Emergency Leave');

          return (
            <Card key={balance.employee_id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold">{balance.employee_name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {balance.employee_code} • {balance.department}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('employees.joinDate') || 'Join Date'}: {new Date(balance.join_date).toLocaleDateString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleViewHistory(balance)}>
                  <History className="w-4 h-4 mr-2" />
                  {t('leaves.history') || 'History'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Annual Leave */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: annualInfo.color }}
                      />
                      <span className="font-medium text-sm">{annualInfo.label}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: annualInfo.color }}
                      >
                        {annualInfo.code}
                      </span>
                      {!balance.annual_leave.eligible && (
                        <Badge variant="outline" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {t('leaves.notEligible') || 'Not Eligible'}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAdjust(balance, 'Annual Leave')}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('leaves.accrued') || 'Accrued'}</p>
                      <p className="font-semibold">{balance.annual_leave.accrued.toFixed(2)} {t('common.days') || 'days'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('leaves.used') || 'Used'}</p>
                      <p className="font-semibold text-red-600">{balance.annual_leave.used} {t('common.days') || 'days'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('leaves.pending') || 'Pending'}</p>
                      <p className="font-semibold text-amber-600">{balance.annual_leave.pending} {t('common.days') || 'days'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('leaves.available') || 'Available'}</p>
                      <p className="font-semibold text-green-600">{balance.annual_leave.available.toFixed(2)} {t('common.days') || 'days'}</p>
                    </div>
                  </div>

                  {!balance.annual_leave.eligible && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-400">
                      {t('leaves.annualLeaveRestriction') || 'Annual leave available after 9 months of service'}
                    </div>
                  )}

                  {/* Kuwait Labor Law: 2-Year Expiry Warning */}
                  {balance.annual_leave.expired && balance.annual_leave.expired > 0 && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-700 dark:text-red-400">
                      ⚠️ {t('leaves.expiredLeave') || 'Expired Leave'}: {balance.annual_leave.expired.toFixed(2)} {t('common.days') || 'days'} - {t('leaves.expiredLeaveDesc') || 'According to Kuwait labor law, unused annual leave expires after 2 years'}
                    </div>
                  )}
                  {balance.annual_leave.expiringSoon && balance.annual_leave.expiringSoon > 0 && (
                    <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-xs text-orange-700 dark:text-orange-400">
                      ⏰ {t('leaves.expiringSoon') || 'Expiring Soon'}: {balance.annual_leave.expiringSoon.toFixed(2)} {t('common.days') || 'days'} - {t('leaves.expiringSoonDesc') || 'This leave will expire within 3 months. Please use it before it expires.'}
                    </div>
                  )}
                  {balance.annual_leave.maxAccumulation && balance.annual_leave.accrued >= balance.annual_leave.maxAccumulation * 0.9 && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-400">
                      📊 {t('leaves.nearMaxAccumulation') || 'Near Maximum'}: {(t('leaves.maxAccumulationDesc') || 'Maximum accumulation is {max} days (2 years worth). Please plan your leave accordingly.').replace('{max}', balance.annual_leave.maxAccumulation.toString())}
                    </div>
                  )}

                  {/* Progress Bar */}
                  {balance.annual_leave.accrued > 0 && (
                    <div className="mt-3">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="bg-red-500"
                            style={{ width: `${(balance.annual_leave.used / balance.annual_leave.accrued) * 100}%` }}
                          />
                          <div
                            className="bg-amber-500"
                            style={{ width: `${(balance.annual_leave.pending / balance.annual_leave.accrued) * 100}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {((balance.annual_leave.used / balance.annual_leave.accrued) * 100).toFixed(0)}% {t('leaves.utilized') || 'utilized'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Sick Leave */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: sickInfo.color }}
                      />
                      <span className="font-medium text-sm">{sickInfo.label}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: sickInfo.color }}
                      >
                        {sickInfo.code}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAdjust(balance, 'Sick Leave')}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('leaves.accrued') || 'Accrued'}</p>
                      <p className="font-semibold">{balance.sick_leave.accrued.toFixed(2)} {t('common.days') || 'days'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('leaves.used') || 'Used'}</p>
                      <p className="font-semibold text-red-600">{balance.sick_leave.used} {t('common.days') || 'days'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('leaves.pending') || 'Pending'}</p>
                      <p className="font-semibold text-amber-600">{balance.sick_leave.pending} {t('common.days') || 'days'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('leaves.available') || 'Available'}</p>
                      <p className="font-semibold text-green-600">{balance.sick_leave.available.toFixed(2)} {t('common.days') || 'days'}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {balance.sick_leave.accrued > 0 && (
                    <div className="mt-3">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="bg-red-500"
                            style={{ width: `${(balance.sick_leave.used / balance.sick_leave.accrued) * 100}%` }}
                          />
                          <div
                            className="bg-amber-500"
                            style={{ width: `${(balance.sick_leave.pending / balance.sick_leave.accrued) * 100}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {((balance.sick_leave.used / balance.sick_leave.accrued) * 100).toFixed(0)}% {t('leaves.utilized') || 'utilized'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Emergency Leave */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: emergencyInfo.color }}
                      />
                      <span className="font-medium text-sm">{emergencyInfo.label}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: emergencyInfo.color }}
                      >
                        {emergencyInfo.code}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAdjust(balance, 'Emergency Leave')}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('leaves.accrued') || 'Accrued'}</p>
                      <p className="font-semibold">{balance.emergency_leave.accrued.toFixed(2)} {t('common.days') || 'days'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('leaves.used') || 'Used'}</p>
                      <p className="font-semibold text-red-600">{balance.emergency_leave.used} {t('common.days') || 'days'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('leaves.pending') || 'Pending'}</p>
                      <p className="font-semibold text-amber-600">{balance.emergency_leave.pending} {t('common.days') || 'days'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('leaves.available') || 'Available'}</p>
                      <p className="font-semibold text-green-600">{balance.emergency_leave.available.toFixed(2)} {t('common.days') || 'days'}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {balance.emergency_leave.accrued > 0 && (
                    <div className="mt-3">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="bg-red-500"
                            style={{ width: `${(balance.emergency_leave.used / balance.emergency_leave.accrued) * 100}%` }}
                          />
                          <div
                            className="bg-amber-500"
                            style={{ width: `${(balance.emergency_leave.pending / balance.emergency_leave.accrued) * 100}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {((balance.emergency_leave.used / balance.emergency_leave.accrued) * 100).toFixed(0)}% {t('leaves.utilized') || 'utilized'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredBalances.length === 0 && !loading && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">{t('leaves.noBalances') || 'No employee balances found'}</p>
        </Card>
      )}

      {/* Adjust Balance Modal */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('leaves.adjustBalance') || 'Adjust Leave Balance'}</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('employees.employee') || 'Employee'}</p>
                <p className="font-medium">{selectedEmployee.employee_name}</p>
                <p className="text-sm text-muted-foreground">{selectedEmployee.employee_code}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('leaves.leaveType') || 'Leave Type'}</p>
                <p className="font-medium">{selectedLeaveType}</p>
              </div>
              <div>
                <Label>{t('leaves.adjustmentType') || 'Adjustment Type'} *</Label>
                <Select
                  value={adjustmentData.type}
                  onValueChange={(value) => setAdjustmentData({ ...adjustmentData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">{t('leaves.addDays') || 'Add Days'}</SelectItem>
                    <SelectItem value="deduct">{t('leaves.deductDays') || 'Deduct Days'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('leaves.numberOfDays') || 'Number of Days'} *</Label>
                <Input
                  type="number"
                  value={adjustmentData.days}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, days: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.5}
                />
              </div>
              <div>
                <Label>{t('leaves.reason') || 'Reason'} *</Label>
                <Textarea
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                  placeholder={t('leaves.enterReason') || 'Enter reason for adjustment...'}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModalOpen(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleSaveAdjustment} disabled={!adjustmentData.reason.trim() || adjustmentData.days === 0}>
              {t('leaves.saveAdjustment') || 'Save Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('leaves.balanceHistory') || 'Leave Balance History'}</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">{selectedEmployee.employee_name}</p>
                <p className="text-sm text-muted-foreground">{selectedEmployee.employee_code}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('leaves.historyComingSoon') || 'Leave balance history will be displayed here once implemented.'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
