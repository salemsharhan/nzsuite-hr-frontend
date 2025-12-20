import React from 'react';
import { Clock, Calendar, DollarSign, FileText, Send, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '../components/common/UIComponents';

export default function ESSPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-heading">My Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, Sarah</p>
        </div>
        <Button className="gap-2">
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
              <p className="text-2xl font-bold font-mono">08:02 AM</p>
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
              <p className="text-2xl font-bold font-mono">22 Days</p>
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
              <p className="text-2xl font-bold font-mono">Jan 25</p>
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
              <p className="text-2xl font-bold font-mono">1</p>
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
              {[
                { month: 'December 2025', amount: '1,445.000 KD', status: 'Paid' },
                { month: 'November 2025', amount: '1,445.000 KD', status: 'Paid' },
                { month: 'October 2025', amount: '1,445.000 KD', status: 'Paid' },
              ].map((slip, i) => (
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
              {[
                { type: 'Annual Leave', date: 'Dec 24 - Dec 26', status: 'Pending' },
                { type: 'Salary Certificate', date: 'Dec 10', status: 'Approved' },
                { type: 'Sick Leave', date: 'Nov 15', status: 'Approved' },
              ].map((req, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <p className="font-bold">{req.type}</p>
                    <p className="text-xs text-muted-foreground">{req.date}</p>
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
