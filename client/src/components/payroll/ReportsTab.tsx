import { useState, useEffect } from 'react';
import { Download, FileText, TrendingUp, DollarSign, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { buildKdaPayrollReport, getApprovedLeaveDaysForMonth, getWorkingDaysInMonthByEmployee, getActualWorkingDaysFromAttendance } from '@/services/payrollReportService';
import { downloadPayrollExcel } from '@/utils/payrollReportExcelExport';
import { detectPayrollTemplate } from '@/utils/payrollTemplate';
import { employeeService } from '@/services/employeeService';
import { toast } from 'sonner';

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
  { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' }
];

export default function ReportsTab() {
  const { user } = useAuth();
  const [kdaMonth, setKdaMonth] = useState('12');
  const [kdaYear, setKdaYear] = useState('2025');
  const [kdaDepartment, setKdaDepartment] = useState<string>('all');
  const [departmentOptions, setDepartmentOptions] = useState<{ value: string; label: string }[]>([]);
  const [kdaLoading, setKdaLoading] = useState(false);

  const companyId = user?.company_id;

  useEffect(() => {
    if (!companyId) return;
    employeeService.getAll(companyId).then((employees) => {
      const depts = new Set<string>();
      employees.forEach((e) => {
        const d = e.department || (e as any).departments?.name;
        if (d) depts.add(d);
      });
      setDepartmentOptions([
        { value: 'all', label: 'All Departments' },
        ...Array.from(depts).sort().map((d) => ({ value: d, label: d }))
      ]);
    });
  }, [companyId]);

  const handleGenerateKdaReport = async () => {
    if (!companyId) {
      toast.error('Company not set. Please log in with a company account.');
      return;
    }
    setKdaLoading(true);
    try {
      const y = parseInt(kdaYear, 10);
      const m = parseInt(kdaMonth, 10);
      const [leaveDays, workingDaysMap, actualDaysMap] = await Promise.all([
        getApprovedLeaveDaysForMonth(companyId, y, m),
        getWorkingDaysInMonthByEmployee(companyId, y, m),
        getActualWorkingDaysFromAttendance(companyId, y, m)
      ]);
      const report = await buildKdaPayrollReport({
        companyId,
        month: m,
        year: y,
        department: kdaDepartment === 'all' ? undefined : kdaDepartment,
        workingDaysByEmployeeId: workingDaysMap,
        paidLeaveDaysByEmployeeId: leaveDays,
        actualDaysByEmployeeId: actualDaysMap
      });
      const monthName = MONTHS.find((m) => m.value === kdaMonth)?.label || kdaMonth;
      const filename = `Payroll_${monthName}_${kdaYear}.xlsx`;
      await downloadPayrollExcel(
        {
          companyName: report.companyName,
          companyNameArabic: report.companyNameArabic,
          periodLabel: report.periodLabel,
          departmentLabel: report.departmentLabel,
          rows: report.rows,
          templateKind: detectPayrollTemplate(report.companyName, report.companyNameArabic)
        },
        filename
      );
      toast.success(`Report generated: ${report.rows.length} employees. Excel download started.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate payroll report. Please try again.');
    } finally {
      setKdaLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KDA Bilingual Payroll Report (Excel-like) */}
      <Card className="p-6 border-primary/20 bg-primary/5">
        <h4 className="font-semibold mb-1">Bilingual Payroll Report</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Generate a payroll report matching the June 2026 template from docs: bilingual headers, gross accrual, deductions, net salary, scheduled payment, and refund. Exports the same styled Excel (BEC or DYLX template).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Month</label>
            <Select value={kdaMonth} onValueChange={setKdaMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Year</label>
            <Select value={kdaYear} onValueChange={setKdaYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Department</label>
            <Select value={kdaDepartment} onValueChange={setKdaDepartment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleGenerateKdaReport} disabled={kdaLoading}>
              {kdaLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Generate & Download Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* Report Generation */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Generate Reports</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Report Type</label>
            <Select defaultValue="monthly">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly Payroll Summary</SelectItem>
                <SelectItem value="returns">Return Tracking Report</SelectItem>
                <SelectItem value="compliance">Compliance Adjustment Report</SelectItem>
                <SelectItem value="department">Department-wise Payroll</SelectItem>
                <SelectItem value="annual">Annual Payroll Report</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Period</label>
            <Select defaultValue="december">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="december">December 2024</SelectItem>
                <SelectItem value="november">November 2024</SelectItem>
                <SelectItem value="october">October 2024</SelectItem>
                <SelectItem value="q4">Q4 2024</SelectItem>
                <SelectItem value="2024">Full Year 2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Format</label>
            <Select defaultValue="pdf">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button>
          <Download className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Payroll Trends</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">December 2024</span>
              <span className="font-semibold">$1,420k</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">November 2024</span>
              <span className="font-semibold">$1,380k</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">October 2024</span>
              <span className="font-semibold">$1,350k</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600">+5.2% growth</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-semibold mb-4">Return Compliance</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Returns</span>
              <span className="font-semibold">248</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Completed</span>
              <span className="font-semibold text-green-600">233 (94%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Pending</span>
              <span className="font-semibold text-amber-600">15 (6%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Overdue</span>
              <span className="font-semibold text-red-600">3 (1%)</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-semibold mb-4">Financial Summary</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Gross Payroll</span>
              <span className="font-semibold">$1,420k</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Deductions</span>
              <span className="font-semibold text-red-600">-$428k</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Net Payroll</span>
              <span className="font-semibold">$992k</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm">Bank Transfers</span>
              <span className="font-semibold text-blue-600">$1,240k</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Available Reports */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Available Reports</h4>
        <div className="space-y-3">
          {[
            { name: 'Monthly Payroll Summary - December 2024', date: '2024-12-25', size: '2.4 MB' },
            { name: 'Return Tracking Report - December 2024', date: '2024-12-26', size: '1.8 MB' },
            { name: 'Compliance Adjustment Report - December 2024', date: '2024-12-26', size: '1.2 MB' },
            { name: 'Department-wise Payroll - December 2024', date: '2024-12-25', size: '1.5 MB' },
            { name: 'Annual Payroll Report - 2024', date: '2024-12-31', size: '5.6 MB' },
          ].map((report, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{report.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Generated on {report.date} • {report.size}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline">
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
