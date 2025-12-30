import { useState } from 'react';
import { Download, FileText, TrendingUp, Users, Calendar, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

// Mock report data
const mockReportData = {
  summary: {
    totalLeavesTaken: 456,
    totalDays: 2340,
    averagePerEmployee: 18.8,
    mostCommonType: 'Annual Leave',
    peakMonth: 'December',
  },
  byLeaveType: [
    { type: 'Annual Leave', count: 234, days: 1456, percentage: 62.2, color: '#3b82f6' },
    { type: 'Sick Leave', count: 123, days: 456, percentage: 19.5, color: '#ef4444' },
    { type: 'Emergency Leave', count: 67, days: 234, percentage: 10.0, color: '#f59e0b' },
    { type: 'Maternity Leave', count: 12, days: 1080, percentage: 46.2, color: '#8b5cf6' },
    { type: 'Unpaid Leave', count: 20, days: 114, percentage: 4.9, color: '#6b7280' },
  ],
  byDepartment: [
    { department: 'Engineering', employees: 45, leavesTaken: 156, avgDays: 19.2 },
    { department: 'Sales', employees: 32, leavesTaken: 112, avgDays: 17.5 },
    { department: 'Marketing', employees: 18, leavesTaken: 78, avgDays: 21.7 },
    { department: 'HR', employees: 8, leavesTaken: 45, avgDays: 18.1 },
    { department: 'Finance', employees: 12, leavesTaken: 65, avgDays: 16.8 },
  ],
  byMonth: [
    { month: 'Jan', leaves: 34, days: 187 },
    { month: 'Feb', leaves: 28, days: 145 },
    { month: 'Mar', leaves: 42, days: 223 },
    { month: 'Apr', leaves: 38, days: 198 },
    { month: 'May', leaves: 45, days: 234 },
    { month: 'Jun', leaves: 52, days: 267 },
    { month: 'Jul', leaves: 48, days: 245 },
    { month: 'Aug', leaves: 41, days: 212 },
    { month: 'Sep', leaves: 36, days: 189 },
    { month: 'Oct', leaves: 39, days: 201 },
    { month: 'Nov', leaves: 44, days: 228 },
    { month: 'Dec', leaves: 67, days: 345 },
  ],
  topLeaveUsers: [
    { employee: 'John Doe', department: 'Engineering', leavesTaken: 24, days: 32 },
    { employee: 'Jane Smith', department: 'Sales', leavesTaken: 22, days: 28 },
    { employee: 'Mike Johnson', department: 'Marketing', leavesTaken: 21, days: 27 },
    { employee: 'Sarah Williams', department: 'HR', leavesTaken: 20, days: 26 },
    { employee: 'Tom Brown', department: 'Finance', leavesTaken: 19, days: 25 },
  ],
};

export default function LeaveReportsTab() {
  const [reportPeriod, setReportPeriod] = useState('2024');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const handleExport = (format: 'pdf' | 'excel') => {
    alert(`Exporting report as ${format.toUpperCase()}...`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Leave Analytics & Reports</h3>
            <p className="text-sm text-muted-foreground">Comprehensive leave statistics and insights</p>
          </div>

          <div className="flex gap-2">
            <Select value={reportPeriod} onValueChange={setReportPeriod}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">Year 2024</SelectItem>
                <SelectItem value="2023">Year 2023</SelectItem>
                <SelectItem value="q4-2024">Q4 2024</SelectItem>
                <SelectItem value="q3-2024">Q3 2024</SelectItem>
              </SelectContent>
            </Select>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="Engineering">Engineering</SelectItem>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => handleExport('excel')}>
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={() => handleExport('pdf')}>
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Leaves Taken</p>
              <p className="text-3xl font-bold">{mockReportData.summary.totalLeavesTaken}</p>
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +8% from last year
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Days</p>
              <p className="text-3xl font-bold">{mockReportData.summary.totalDays}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Across all leave types
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Avg Per Employee</p>
              <p className="text-3xl font-bold">{mockReportData.summary.averagePerEmployee}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Days per year
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Peak Month</p>
              <p className="text-3xl font-bold">{mockReportData.summary.peakMonth}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Most leaves taken
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Type Distribution */}
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Leave Type Distribution</h4>
          <div className="space-y-4">
            {mockReportData.byLeaveType.map((item, index) => {
              const maxDays = Math.max(...mockReportData.byLeaveType.map((i) => i.days));
              const widthPercentage = (item.days / maxDays) * 100;
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.type}
                    </span>
                    <span className="font-semibold">
                      {item.days} days ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${widthPercentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.count} requests
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Department Analysis */}
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Leave by Department</h4>
          <div className="space-y-3">
            {mockReportData.byDepartment.map((dept, index) => (
              <div key={index} className="p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{dept.department}</span>
                  <span className="text-sm text-muted-foreground">{dept.employees} employees</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Leaves</p>
                    <p className="font-semibold">{dept.leavesTaken}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Days</p>
                    <p className="font-semibold">{dept.avgDays}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Monthly Leave Trend</h4>
        <div className="h-64 flex items-end justify-between gap-2">
          {mockReportData.byMonth.map((month, index) => {
            const maxLeaves = Math.max(...mockReportData.byMonth.map((m) => m.leaves));
            const heightPercentage = (month.leaves / maxLeaves) * 100;
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center">
                  <span className="text-xs text-muted-foreground mb-1">{month.leaves}</span>
                  <div
                    className="w-full bg-primary rounded-t transition-all hover:opacity-80 cursor-pointer"
                    style={{ height: `${heightPercentage * 2}px` }}
                    title={`${month.month}: ${month.leaves} leaves, ${month.days} days`}
                  />
                </div>
                <span className="text-xs font-medium">{month.month}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Top Leave Users */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Top Leave Users</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Rank</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Employee</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Department</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Leaves Taken</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total Days</th>
              </tr>
            </thead>
            <tbody>
              {mockReportData.topLeaveUsers.map((user, index) => (
                <tr key={index} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-lg">#{index + 1}</span>
                  </td>
                  <td className="py-3 px-4 font-medium">{user.employee}</td>
                  <td className="py-3 px-4 text-muted-foreground">{user.department}</td>
                  <td className="py-3 px-4">{user.leavesTaken}</td>
                  <td className="py-3 px-4 font-semibold">{user.days} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quick Reports */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Quick Reports</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Button variant="outline" className="h-auto py-4 flex-col items-start">
            <FileText className="w-5 h-5 mb-2" />
            <span className="font-medium">Leave Balance Report</span>
            <span className="text-xs text-muted-foreground">All employees' current balances</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col items-start">
            <FileText className="w-5 h-5 mb-2" />
            <span className="font-medium">Utilization Report</span>
            <span className="text-xs text-muted-foreground">Leave usage by department</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col items-start">
            <FileText className="w-5 h-5 mb-2" />
            <span className="font-medium">Pending Approvals</span>
            <span className="text-xs text-muted-foreground">All pending leave requests</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col items-start">
            <FileText className="w-5 h-5 mb-2" />
            <span className="font-medium">Audit Trail</span>
            <span className="text-xs text-muted-foreground">Complete leave history</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col items-start">
            <FileText className="w-5 h-5 mb-2" />
            <span className="font-medium">Compliance Report</span>
            <span className="text-xs text-muted-foreground">Policy adherence analysis</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col items-start">
            <FileText className="w-5 h-5 mb-2" />
            <span className="font-medium">Custom Report</span>
            <span className="text-xs text-muted-foreground">Build your own report</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
