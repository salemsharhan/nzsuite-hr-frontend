import React, { useState, useEffect } from 'react';
import { Clock, Calendar, DollarSign, FileText, Send, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '../components/common/UIComponents';
import { essService } from '../services/essService';
import { leaveService } from '../services/leaveService';

export default function ESSPage() {
  const [stats, setStats] = useState({
    checkInTime: '--:--',
    leaveBalance: 0,
    nextPayday: '-',
    pendingRequests: 0
  });
  const [requests, setRequests] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get first employee to simulate logged-in user
      const employees = await import('../services/employeeService').then(m => m.employeeService.getAll());
      if (employees.length === 0) {
        setLoading(false);
        return;
      }
      
      const currentUserId = employees[0].id;

      const [statsData, requestsData, payslipsData] = await Promise.all([
        essService.getDashboardStats(currentUserId),
        essService.getMyRequests(currentUserId),
        essService.getPayslips(currentUserId)
      ]);
      
      setStats(statsData);
      setRequests(requestsData);
      setPayslips(payslipsData);
    } catch (error) {
      console.error('Failed to load ESS data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-heading">My Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, Sarah</p>
        </div>
        <Button className="gap-2" onClick={() => window.location.href = '/leaves'}>
          <Send size={16} /> Request Leave
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Check-in Time</p>
              <p className="text-2xl font-bold font-mono">{stats.checkInTime}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Leave Balance</p>
              <p className="text-2xl font-bold font-mono">{stats.leaveBalance} Days</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Payday</p>
              <p className="text-2xl font-bold font-mono">{stats.nextPayday}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Requests</p>
              <p className="text-2xl font-bold font-mono">{stats.pendingRequests}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payslips */}
        <Card>
          <CardHeader><CardTitle>Recent Payslips</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payslips.map((slip, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center text-primary">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <p className="font-bold">{slip.month}</p>
                      <p className="text-xs text-muted-foreground">{slip.amount}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon"><Download size={18}/></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* My Requests */}
        <Card>
          <CardHeader><CardTitle>My Requests</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : requests.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No recent requests.</div>
              ) : requests.slice(0, 5).map((req, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <p className="font-bold">{req.leave_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={req.status === 'Approved' ? 'success' : req.status === 'Pending' ? 'warning' : 'destructive'}>
                    {req.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
