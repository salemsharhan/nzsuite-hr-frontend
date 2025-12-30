import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import { User, FileText, Clock, DollarSign, Shield, ArrowLeft, Upload, Download, MapPin, Phone, Mail, Calendar, Briefcase, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '../components/common/UIComponents';
import { employeeService, Employee } from '../services/employeeService';

export default function EmployeeDetailPage() {
  const { t } = useTranslation();
  const [match, params] = useRoute('/employees/:id');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params?.id) {
      loadEmployee(params.id);
    }
  }, [params?.id]);

  const loadEmployee = async (id: string) => {
    try {
      setLoading(true);
      const all = await employeeService.getAll();
      const found = all.find(e => e.id.toString() === id || (e.employee_id || e.employeeId) === id);
      if (found) setEmployee(found);
    } catch (error) {
      console.error('Failed to load employee details', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!employee) return <div className="p-8 text-center">{t('common.noData')}</div>;

  const emp = employee; // Shorthand

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
                {(emp.first_name || emp.firstName || 'U')[0]}{(emp.last_name || emp.lastName || 'N')[0]}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-bold font-heading">{emp.first_name || emp.firstName} {emp.last_name || emp.lastName}</h1>
                    <p className="text-lg text-muted-foreground">{emp.designation || emp.position} • {emp.department}</p>
                  </div>
                  <Badge variant={emp.status === 'Active' ? 'success' : 'warning'} className="text-lg px-4 py-1">
                    {emp.status}
                  </Badge>
                </div>
                <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User size={16} /> {emp.employee_id || emp.employeeId}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} /> {t('employees.joinDate')}: {emp.join_date || emp.hireDate ? new Date(emp.join_date || emp.hireDate!).toLocaleDateString() : 'N/A'}
                  </div>
                  {emp.reporting_manager_id && (
                    <div className="flex items-center gap-2">
                      <Shield size={16} /> {t('employees.manager')}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-white/5 p-1 rounded-lg">
          <TabsTrigger value="personal" className="data-[state=active]:bg-primary data-[state=active]:text-white">{t('employees.personalInfo')}</TabsTrigger>
          <TabsTrigger value="contact" className="data-[state=active]:bg-primary data-[state=active]:text-white">{t('employees.contactInfo')}</TabsTrigger>
          <TabsTrigger value="employment" className="data-[state=active]:bg-primary data-[state=active]:text-white">{t('employees.employmentDetails')}</TabsTrigger>
          <TabsTrigger value="working-hours" className="data-[state=active]:bg-primary data-[state=active]:text-white">{t('employees.workingHours')}</TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-primary data-[state=active]:text-white">{t('employees.documents')}</TabsTrigger>
        </TabsList>

        {/* Personal Info Tab */}
        <TabsContent value="personal" className="mt-6 space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('employees.personalInfo')}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('common.firstName')}</label>
                <p className="text-lg">{emp.first_name || emp.firstName}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('common.lastName')}</label>
                <p className="text-lg">{emp.last_name || emp.lastName}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.dateOfBirth')}</label>
                <p className="text-lg">{emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.gender')}</label>
                <p className="text-lg">{emp.gender || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.maritalStatus')}</label>
                <p className="text-lg">{emp.marital_status || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.nationality')}</label>
                <p className="text-lg">{emp.nationality || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Information Tab */}
        <TabsContent value="contact" className="mt-6 space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('employees.contactInfo')}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-2">
                  <Mail size={14} /> {t('common.email')}
                </label>
                <p className="text-lg mt-1">{emp.email}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-2">
                  <Phone size={14} /> {t('employees.phone')}
                </label>
                <p className="text-lg mt-1">{emp.phone || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.alternatePhone')}</label>
                <p className="text-lg">{emp.alternate_phone || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-2">
                  <MapPin size={14} /> {t('employees.address')}
                </label>
                <p className="text-lg mt-1">{emp.address || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.city')}</label>
                <p className="text-lg">{emp.city || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.state')}</label>
                <p className="text-lg">{emp.state || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.country')}</label>
                <p className="text-lg">{emp.country || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.postalCode')}</label>
                <p className="text-lg">{emp.postal_code || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardHeader><CardTitle>{t('employees.emergencyContact')}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('common.name')}</label>
                <p className="text-lg">{emp.emergency_contact_name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.phone')}</label>
                <p className="text-lg">{emp.emergency_contact_phone || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.relationship')}</label>
                <p className="text-lg">{emp.emergency_contact_relationship || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employment Details Tab */}
        <TabsContent value="employment" className="mt-6 space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('employees.employmentDetails')}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-2">
                  <Building2 size={14} /> {t('employees.department')}
                </label>
                <p className="text-lg mt-1">{emp.department || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-2">
                  <Briefcase size={14} /> {t('common.role')}
                </label>
                <p className="text-lg mt-1">{emp.role_id ? 'Role ID: ' + emp.role_id : 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('common.job')}</label>
                <p className="text-lg">{emp.position || emp.designation || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.employmentType')}</label>
                <p className="text-lg">{emp.employment_type || emp.employmentType || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-2">
                  <Calendar size={14} /> {t('employees.joinDate')}
                </label>
                <p className="text-lg mt-1">{emp.join_date || emp.hireDate ? new Date(emp.join_date || emp.hireDate!).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-2">
                  <DollarSign size={14} /> {t('employees.salary')}
                </label>
                <p className="text-lg mt-1">{emp.salary ? `${emp.salary}` : 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.workLocation')}</label>
                <p className="text-lg">{emp.work_location || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.reportingManager')}</label>
                <p className="text-lg">{emp.reporting_manager_id ? 'Manager ID: ' + emp.reporting_manager_id : 'N/A'}</p>
              </div>
              {emp.notes && (
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.notes')}</label>
                  <p className="text-lg mt-1">{emp.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Working Hours Tab */}
        <TabsContent value="working-hours" className="mt-6">
          <Card>
            <CardHeader><CardTitle>{t('employees.workingHours')}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.monday')}</label>
                  <p className="text-lg">{emp.working_hours_monday ?? 0} {t('employees.hours')}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.tuesday')}</label>
                  <p className="text-lg">{emp.working_hours_tuesday ?? 0} {t('employees.hours')}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.wednesday')}</label>
                  <p className="text-lg">{emp.working_hours_wednesday ?? 0} {t('employees.hours')}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.thursday')}</label>
                  <p className="text-lg">{emp.working_hours_thursday ?? 0} {t('employees.hours')}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.friday')}</label>
                  <p className="text-lg">{emp.working_hours_friday ?? 0} {t('employees.hours')}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.saturday')}</label>
                  <p className="text-lg">{emp.working_hours_saturday ?? 0} {t('employees.hours')}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.sunday')}</label>
                  <p className="text-lg">{emp.working_hours_sunday ?? 0} {t('employees.hours')}</p>
                </div>
              </div>
              {emp.flexible_hours && (
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t('employees.flexibleHours')}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.startTime')}</label>
                      <p className="text-lg">{emp.start_time || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.endTime')}</label>
                      <p className="text-lg">{emp.end_time || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase font-bold">{t('employees.breakDuration')}</label>
                      <p className="text-lg">{emp.break_duration_minutes || 0} {t('common.minutes') || 'minutes'}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('employees.documents')}</CardTitle>
              <Button size="sm" className="gap-2"><Upload size={16}/> {t('common.upload') || 'Upload'} {t('employees.documents')}</Button>
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
                        <p className="text-xs text-muted-foreground">{doc.type} • {t('common.uploaded') || 'Uploaded'} {doc.date}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon"><Download size={18}/></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
