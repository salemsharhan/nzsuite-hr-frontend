import { useState, useEffect } from 'react';
import { DollarSign, Users, FileText, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { employeeService } from '@/services/employeeService';
import PayrollReportTab from '@/components/payroll/PayrollReportTab';
import ReportsTab from '@/components/payroll/ReportsTab';

export default function PayrollManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<{
    totalEmployees: number;
    totalBaseSalary: number;
    totalHousing: number;
    loading: boolean;
  }>({ totalEmployees: 0, totalBaseSalary: 0, totalHousing: 0, loading: true });

  const companyId = user?.company_id;

  useEffect(() => {
    if (!companyId) {
      setStats((s) => ({ ...s, loading: false }));
      return;
    }
    setStats((s) => ({ ...s, loading: true }));
    employeeService
      .getAll(companyId)
      .then((employees) => {
        const active = employees.filter(
          (e) => e.status === 'Active' && e.employment_type !== 'Consultant' && e.employmentType !== 'Consultant'
        );
        const totalBase = active.reduce((s, e) => s + (Number(e.base_salary ?? e.salary) || 0), 0);
        const totalHousing = active.reduce((s, e) => s + (Number(e.housing_allowance) || 0), 0);
        setStats({
          totalEmployees: active.length,
          totalBaseSalary: totalBase,
          totalHousing,
          loading: false
        });
      })
      .catch(() => setStats((s) => ({ ...s, loading: false })));
  }, [companyId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Payroll Management</h2>
          <p className="text-muted-foreground">
            Manage payroll, track returns, and monitor compliance adjustments
          </p>
        </div>
        <Button size="lg" onClick={() => setActiveTab('payroll-report')}>
          <DollarSign className="w-5 h-5 mr-2" />
          Payroll Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Employees</p>
              <p className="text-3xl font-bold">
                {stats.loading ? '—' : stats.totalEmployees}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Active (excl. consultants)</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Base Salary (KWD)</p>
              <p className="text-3xl font-bold">
                {stats.loading ? '—' : stats.totalBaseSalary.toLocaleString('en-US', { minimumFractionDigits: 3 })}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Sum of base salaries</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Housing Allowance (KWD)</p>
              <p className="text-3xl font-bold">
                {stats.loading ? '—' : stats.totalHousing.toLocaleString('en-US', { minimumFractionDigits: 3 })}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Sum of housing allowances</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payroll-report">Payroll Report</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="p-6">
            <h4 className="font-semibold mb-4">Quick actions</h4>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setActiveTab('payroll-report')}>
                <FileText className="w-4 h-4 mr-2" />
                Build payroll report
              </Button>
              <Button variant="outline" onClick={() => setActiveTab('reports')}>
                Export KDA report (CSV)
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Use <strong>Payroll Report</strong> to load a month with working days from shifts and leave from approved requests, edit refund amounts, and export. Use <strong>Reports</strong> for the bilingual KDA CSV export.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="payroll-report">
          <PayrollReportTab />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
