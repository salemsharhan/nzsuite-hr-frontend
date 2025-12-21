import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { User, FileText, Clock, DollarSign, Shield, ArrowLeft, Upload, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '../components/common/UIComponents';
import { employeeService, Employee } from '../services/employeeService';

export default function EmployeeDetailPage() {
  const [match, params] = useRoute('/employees/:id');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState('personal');

  useEffect(() => {
    if (params?.id) {
      loadEmployee(params.id);
    }
  }, [params?.id]);

  const loadEmployee = async (id: string) => {
    try {
      // In a real app, we would fetch by ID. For now, we'll simulate it or fetch all and find.
      // Since our mock/service might not support getById perfectly in fallback mode:
      const all = await employeeService.getAll();
      const found = all.find(e => e.id.toString() === id || (e.employee_id || e.employeeId) === id);
      if (found) setEmployee(found);
    } catch (error) {
      console.error('Failed to load employee details', error);
    }
  };

  if (!employee) return <div className="p-8 text-center">Loading profile...</div>;

  return (
    <div className="space-y-6">
      {/* Header Profile Card */}
      <div className="flex items-start gap-6">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary border-2 border-primary/30">
                {(employee.first_name || employee.firstName || 'U')[0]}{(employee.last_name || employee.lastName || 'N')[0]}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-bold font-heading">{employee.first_name || employee.firstName} {employee.last_name || employee.lastName}</h1>
                    <p className="text-lg text-muted-foreground">{employee.designation} • {employee.department}</p>
                  </div>
                  <Badge variant={employee.status === 'Active' ? 'success' : 'warning'} className="text-lg px-4 py-1">
                    {employee.status}
                  </Badge>
                </div>
                <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User size={16} /> {employee.employee_id}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} /> Joined {employee.join_date || employee.hireDate ? new Date(employee.join_date || employee.hireDate!).toLocaleDateString() : 'N/A'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield size={16} /> Manager: Sarah Connor
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-white/5 p-1 rounded-lg">
          <TabsTrigger value="personal" className="data-[state=active]:bg-primary data-[state=active]:text-white">Personal Info</TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-primary data-[state=active]:text-white">Documents</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-white">Job History</TabsTrigger>
          <TabsTrigger value="payroll" className="data-[state=active]:bg-primary data-[state=active]:text-white">Payroll Info</TabsTrigger>
        </TabsList>

        {/* Personal Info Tab */}
        <TabsContent value="personal" className="mt-6 space-y-6">
          <Card>
            <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">Email Address</label>
                <p className="text-lg">{employee.email}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">Phone Number</label>
                <p className="text-lg">{employee.phone || '+965 5555 1234'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">Nationality</label>
                <p className="text-lg">Kuwaiti</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">Civil ID</label>
                <p className="text-lg">290123456789</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Employee Documents</CardTitle>
              <Button size="sm" className="gap-2"><Upload size={16}/> Upload Document</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'Employment Contract.pdf', type: 'Contract', date: '2023-01-15' },
                  { name: 'Civil ID Copy.jpg', type: 'ID', date: '2023-01-15' },
                  { name: 'Passport Copy.pdf', type: 'ID', date: '2023-01-15' },
                  { name: 'University Degree.pdf', type: 'Education', date: '2023-01-10' },
                ].map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="font-bold">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.type} • Uploaded {doc.date}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon"><Download size={18}/></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Career Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="relative border-l-2 border-white/10 ml-4 space-y-8 py-4">
                <div className="relative pl-8">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background"></div>
                  <h3 className="font-bold text-lg">Promoted to Senior Engineer</h3>
                  <p className="text-sm text-muted-foreground">Jan 15, 2024</p>
                  <p className="mt-2 text-sm">Performance review score: 4.8/5. Salary adjustment applied.</p>
                </div>
                <div className="relative pl-8">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white/20 border-4 border-background"></div>
                  <h3 className="font-bold text-lg">Joined as Software Engineer</h3>
                  <p className="text-sm text-muted-foreground">Jan 15, 2023</p>
                  <p className="mt-2 text-sm">Onboarded to Engineering Department.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Salary Structure</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-muted-foreground uppercase text-xs mb-4">Earnings</h3>
                  <div className="flex justify-between p-3 bg-emerald-500/10 rounded border border-emerald-500/20">
                    <span>Basic Salary</span>
                    <span className="font-mono font-bold">1,200.000 KD</span>
                  </div>
                  <div className="flex justify-between p-3 bg-emerald-500/10 rounded border border-emerald-500/20">
                    <span>Housing Allowance</span>
                    <span className="font-mono font-bold">250.000 KD</span>
                  </div>
                  <div className="flex justify-between p-3 bg-emerald-500/10 rounded border border-emerald-500/20">
                    <span>Transport Allowance</span>
                    <span className="font-mono font-bold">100.000 KD</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-muted-foreground uppercase text-xs mb-4">Deductions</h3>
                  <div className="flex justify-between p-3 bg-red-500/10 rounded border border-red-500/20">
                    <span>Social Security (GOSI)</span>
                    <span className="font-mono font-bold">105.000 KD</span>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                <span className="text-xl font-bold">Net Salary</span>
                <span className="text-2xl font-bold font-mono text-primary">1,445.000 KD</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
