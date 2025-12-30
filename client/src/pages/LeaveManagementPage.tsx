import { useState } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, TrendingUp, Users, FileText, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/common/StatusBadge';
import LeaveRequestsTab from '@/components/leave/LeaveRequestsTab';

// Mock data for demonstration
const mockStats = {
  totalRequests: 156,
  pendingApprovals: 23,
  approvedThisMonth: 89,
  rejectedThisMonth: 12,
};

const mockLeaveTypeBreakdown = [
  { type: 'Annual Leave', count: 67, color: '#3b82f6' },
  { type: 'Sick Leave', count: 34, color: '#ef4444' },
  { type: 'Emergency Leave', count: 18, color: '#f59e0b' },
  { type: 'Maternity Leave', count: 12, color: '#8b5cf6' },
  { type: 'Unpaid Leave', count: 25, color: '#6b7280' },
];

const mockRecentRequests = [
  {
    id: 'LR-2025-001',
    employee: 'John Doe',
    department: 'Engineering',
    leaveType: 'Annual Leave',
    startDate: '2025-01-05',
    endDate: '2025-01-10',
    duration: 5,
    status: 'Pending',
    submittedAt: '2024-12-28',
  },
  {
    id: 'LR-2025-002',
    employee: 'Jane Smith',
    department: 'Sales',
    leaveType: 'Sick Leave',
    startDate: '2025-01-03',
    endDate: '2025-01-04',
    duration: 2,
    status: 'Approved',
    submittedAt: '2024-12-27',
  },
  {
    id: 'LR-2025-003',
    employee: 'Mike Johnson',
    department: 'Marketing',
    leaveType: 'Emergency Leave',
    startDate: '2025-01-02',
    endDate: '2025-01-02',
    duration: 1,
    status: 'Pending',
    submittedAt: '2024-12-29',
  },
];

const mockUpcomingLeaves = [
  { employee: 'Sarah Williams', department: 'HR', leaveType: 'Annual Leave', date: '2025-01-05 - 2025-01-12', duration: 7 },
  { employee: 'Tom Brown', department: 'Finance', leaveType: 'Annual Leave', date: '2025-01-08 - 2025-01-15', duration: 7 },
  { employee: 'Emily Davis', department: 'IT', leaveType: 'Maternity Leave', date: '2025-01-10 - 2025-04-10', duration: 90 },
];

export default function LeaveManagementPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading">Leave Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage leave requests, policies, and employee balances
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
          <Button>
            <Settings className="w-4 h-4 mr-2" />
            Configure Policies
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Requests</p>
              <p className="text-3xl font-bold">{mockStats.totalRequests}</p>
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +12% from last month
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pending Approvals</p>
              <p className="text-3xl font-bold">{mockStats.pendingApprovals}</p>
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Requires attention
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Approved This Month</p>
              <p className="text-3xl font-bold">{mockStats.approvedThisMonth}</p>
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Processing smoothly
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Rejected This Month</p>
              <p className="text-3xl font-bold">{mockStats.rejectedThisMonth}</p>
              <p className="text-xs text-muted-foreground mt-2">
                7.7% rejection rate
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">Leave Requests</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leave Type Breakdown */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Leave Type Breakdown</h3>
              <div className="space-y-4">
                {mockLeaveTypeBreakdown.map((item, index) => {
                  const total = mockLeaveTypeBreakdown.reduce((sum, i) => sum + i.count, 0);
                  const percentage = ((item.count / total) * 100).toFixed(1);
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
                          {item.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Upcoming Leaves */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Upcoming Leaves</h3>
              <div className="space-y-3">
                {mockUpcomingLeaves.map((leave, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{leave.employee}</p>
                      <p className="text-sm text-muted-foreground">{leave.department}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {leave.leaveType} • {leave.duration} days
                      </p>
                      <p className="text-xs text-muted-foreground">{leave.date}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                View Full Calendar
              </Button>
            </Card>
          </div>

          {/* Recent Requests */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Leave Requests</h3>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Request ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Employee
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Leave Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Duration
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockRecentRequests.map((request) => (
                    <tr key={request.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 text-sm font-medium">{request.id}</td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium">{request.employee}</p>
                          <p className="text-xs text-muted-foreground">{request.department}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{request.leaveType}</td>
                      <td className="py-3 px-4 text-sm">
                        {request.duration} {request.duration === 1 ? 'day' : 'days'}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {request.startDate} to {request.endDate}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={request.status as any} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {request.status === 'Pending' && (
                            <>
                              <Button size="sm" variant="default">
                                Approve
                              </Button>
                              <Button size="sm" variant="outline">
                                Reject
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost">
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <LeaveRequestsTab />
        </TabsContent>

        <TabsContent value="policies">
          <Card className="p-6">
            <p className="text-muted-foreground">Leave Policies configuration will be implemented here.</p>
          </Card>
        </TabsContent>

        <TabsContent value="balances">
          <Card className="p-6">
            <p className="text-muted-foreground">Leave Balances management will be implemented here.</p>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card className="p-6">
            <p className="text-muted-foreground">Leave Calendar view will be implemented here.</p>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="p-6">
            <p className="text-muted-foreground">Leave Reports and analytics will be implemented here.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
