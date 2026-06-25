import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Users, FileText, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { employeeService } from '@/services/employeeService';
import PayrollReportTab from '@/components/payroll/PayrollReportTab';
import ReportsTab from '@/components/payroll/ReportsTab';

export default function PayrollManagementPage() {
  const { t } = useTranslation();
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
          <h2 className="text-3xl font-bold tracking-tight">{t('payroll.title')}</h2>
          <p className="text-muted-foreground">{t('payroll.subtitle')}</p>
        </div>
        <Button size="lg" onClick={() => setActiveTab('payroll-report')}>
          <DollarSign className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
          {t('payroll.payrollReportBtn')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('payroll.totalEmployees')}</p>
              <p className="text-3xl font-bold">{stats.loading ? '—' : stats.totalEmployees}</p>
              <p className="text-xs text-muted-foreground mt-2">{t('payroll.totalEmployeesHint')}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('payroll.totalBaseSalary')}</p>
              <p className="text-3xl font-bold">
                {stats.loading ? '—' : stats.totalBaseSalary.toLocaleString('en-US', { minimumFractionDigits: 3 })}
              </p>
              <p className="text-xs text-muted-foreground mt-2">{t('payroll.totalBaseSalaryHint')}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('payroll.totalHousing')}</p>
              <p className="text-3xl font-bold">
                {stats.loading ? '—' : stats.totalHousing.toLocaleString('en-US', { minimumFractionDigits: 3 })}
              </p>
              <p className="text-xs text-muted-foreground mt-2">{t('payroll.totalHousingHint')}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">{t('payroll.tabOverview')}</TabsTrigger>
          <TabsTrigger value="payroll-report">{t('payroll.tabPayrollReport')}</TabsTrigger>
          <TabsTrigger value="reports">{t('payroll.tabReports')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="p-6">
            <h4 className="font-semibold mb-4">{t('payroll.quickActions')}</h4>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setActiveTab('payroll-report')}>
                <FileText className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('payroll.buildPayrollReport')}
              </Button>
              <Button variant="outline" onClick={() => setActiveTab('reports')}>
                {t('payroll.exportPayrollExcel')}
              </Button>
            </div>
            <p
              className="text-sm text-muted-foreground mt-4"
              dangerouslySetInnerHTML={{ __html: t('payroll.overviewHelp') }}
            />
          </Card>
        </TabsContent>

        <TabsContent value="payroll-report">
          {activeTab === 'payroll-report' ? <PayrollReportTab /> : null}
        </TabsContent>

        <TabsContent value="reports">
          {activeTab === 'reports' ? <ReportsTab /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
