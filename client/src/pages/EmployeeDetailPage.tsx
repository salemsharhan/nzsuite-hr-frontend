import React, { useState, useEffect, useRef } from 'react';
import { useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import { User, FileText, Clock, DollarSign, Shield, ArrowLeft, Upload, Download, MapPin, Phone, Mail, Calendar, Briefcase, Building2, X, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '../components/common/UIComponents';
import { employeeService, Employee } from '../services/employeeService';
import { documentService, Document } from '../services/documentService';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/common/Modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function EmployeeDetailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [match, params] = useRoute('/employees/:id');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('General');

  useEffect(() => {
    if (params?.id) {
      loadEmployee(params.id);
    }
  }, [params?.id]);

  useEffect(() => {
    if (employee?.id && activeTab === 'documents') {
      loadDocuments();
    }
  }, [employee?.id, activeTab]);

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

  const loadDocuments = async () => {
    if (!employee?.id) return;
    try {
      setDocumentsLoading(true);
      const docs = await documentService.getAll(employee.id);
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents', error);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !employee?.id) return;
    
    try {
      setUploading(true);
      
      // Upload document (handles storage errors gracefully)
      await documentService.upload(
        selectedFile,
        null, // folderId
        selectedCategory, // folderName/category
        employee.id // employeeId
        // Note: uploadedBy is not passed to avoid foreign key constraint issues
        // since user?.id is from auth.users, not employees
      );
      
      // Reload documents
      await loadDocuments();
      
      // Reset form
      setSelectedFile(null);
      setSelectedCategory('General');
      setIsUploadModalOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Show success message
      // Note: Document is saved even if storage bucket doesn't exist
    } catch (error: any) {
      // Only show error if it's not a storage bucket error
      const isStorageError = 
        error?.message?.includes('Bucket not found') ||
        error?.statusCode === 404 ||
        error?.error === 'Bucket not found';
      
      if (!isStorageError) {
        console.error('Failed to upload document', error);
        alert(t('documents.uploadError') || 'Failed to upload document. Please try again.');
      } else {
        // Storage bucket error - document was still saved, just show info
        console.info('Document saved (storage bucket not configured yet)');
        // Still reload and close modal since document was saved
        await loadDocuments();
        setSelectedFile(null);
        setSelectedCategory('General');
        setIsUploadModalOpen(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm(t('documents.confirmDelete') || 'Are you sure you want to delete this document?')) {
      return;
    }
    
    try {
      await documentService.delete(docId);
      await loadDocuments();
    } catch (error) {
      console.error('Failed to delete document', error);
      alert(t('documents.deleteError') || 'Failed to delete document. Please try again.');
    }
  };

  const handleDownload = (url: string, name: string) => {
    // Open in new tab for download
    window.open(url, '_blank');
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
        <TabsList className="grid w-full grid-cols-6 bg-white/5 p-1 rounded-lg">
          <TabsTrigger value="personal" className="data-[state=active]:bg-primary data-[state=active]:text-white">{t('employees.personalInfo')}</TabsTrigger>
          <TabsTrigger value="contact" className="data-[state=active]:bg-primary data-[state=active]:text-white">{t('employees.contactInfo')}</TabsTrigger>
          <TabsTrigger value="employment" className="data-[state=active]:bg-primary data-[state=active]:text-white">{t('employees.employmentDetails')}</TabsTrigger>
          <TabsTrigger value="working-hours" className="data-[state=active]:bg-primary data-[state=active]:text-white">{t('employees.workingHours')}</TabsTrigger>
          <TabsTrigger value="payroll" className="data-[state=active]:bg-primary data-[state=active]:text-white">{t('employees.payrollInfo') || 'Payroll Info'}</TabsTrigger>
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

        {/* Payroll Info Tab */}
        <TabsContent value="payroll" className="mt-6 space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('employees.salaryStructure') || 'Salary Structure'}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* EARNINGS Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-green-400">{t('employees.earnings') || 'EARNINGS'}</h3>
                  <div className="space-y-3">
                    {(emp as any).base_salary && (
                      <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">{t('employees.baseSalary')}</span>
                          <span className="text-white font-bold">{parseFloat((emp as any).base_salary || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(emp as any).housing_allowance && parseFloat((emp as any).housing_allowance || '0') > 0 && (
                      <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">{t('employees.housingAllowance')}</span>
                          <span className="text-white font-bold">{parseFloat((emp as any).housing_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(emp as any).transport_allowance && parseFloat((emp as any).transport_allowance || '0') > 0 && (
                      <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">{t('employees.transportAllowance')}</span>
                          <span className="text-white font-bold">{parseFloat((emp as any).transport_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(emp as any).meal_allowance && parseFloat((emp as any).meal_allowance || '0') > 0 && (
                      <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">{t('employees.mealAllowance')}</span>
                          <span className="text-white font-bold">{parseFloat((emp as any).meal_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(emp as any).medical_allowance && parseFloat((emp as any).medical_allowance || '0') > 0 && (
                      <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">{t('employees.medicalAllowance')}</span>
                          <span className="text-white font-bold">{parseFloat((emp as any).medical_allowance || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(emp as any).other_allowances && parseFloat((emp as any).other_allowances || '0') > 0 && (
                      <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">{t('employees.otherAllowances')}</span>
                          <span className="text-white font-bold">{parseFloat((emp as any).other_allowances || '0').toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                        </div>
                      </div>
                    )}
                    {(!(emp as any).base_salary && !(emp as any).housing_allowance && !(emp as any).transport_allowance && !(emp as any).meal_allowance && !(emp as any).medical_allowance && !(emp as any).other_allowances) && (
                      <div className="text-muted-foreground text-center py-4">{t('common.noData')}</div>
                    )}
                  </div>
                </div>

                {/* DEDUCTIONS Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-red-400">{t('employees.deductions') || 'DEDUCTIONS'}</h3>
                  <div className="space-y-3">
                    {/* Social Security / GOSI */}
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const gosiRate = 0.105; // 10.5% GOSI rate (can be made configurable)
                      const gosiAmount = baseSalary * gosiRate;
                      return gosiAmount > 0 ? (
                        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-medium">{t('employees.socialSecurity') || 'Social Security (GOSI)'}</span>
                            <span className="text-white font-bold">{gosiAmount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {/* Tax Deduction */}
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const taxRate = 0; // Can be fetched from role_salary_config
                      const taxAmount = baseSalary * taxRate;
                      return taxAmount > 0 ? (
                        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-medium">{t('employees.tax') || 'Tax'}</span>
                            <span className="text-white font-bold">{taxAmount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {/* Insurance Deduction */}
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const insuranceRate = 0; // Can be fetched from role_salary_config
                      const insuranceAmount = baseSalary * insuranceRate;
                      return insuranceAmount > 0 ? (
                        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-medium">{t('employees.insurance') || 'Insurance'}</span>
                            <span className="text-white font-bold">{insuranceAmount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KD</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const gosiRate = 0.105;
                      const gosiAmount = baseSalary * gosiRate;
                      return gosiAmount === 0 ? (
                        <div className="text-muted-foreground text-center py-4">{t('common.noData')}</div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              {/* Net Salary */}
              <div className="pt-6 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-white">{t('employees.netSalary') || 'Net Salary'}</span>
                  <span className="text-2xl font-bold text-primary">
                    {(() => {
                      const baseSalary = parseFloat((emp as any).base_salary || '0');
                      const housing = parseFloat((emp as any).housing_allowance || '0');
                      const transport = parseFloat((emp as any).transport_allowance || '0');
                      const meal = parseFloat((emp as any).meal_allowance || '0');
                      const medical = parseFloat((emp as any).medical_allowance || '0');
                      const other = parseFloat((emp as any).other_allowances || '0');
                      const totalEarnings = baseSalary + housing + transport + meal + medical + other;
                      
                      const gosiRate = 0.105;
                      const gosiAmount = baseSalary * gosiRate;
                      const totalDeductions = gosiAmount;
                      
                      const netSalary = totalEarnings - totalDeductions;
                      return netSalary.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                    })()} KD
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('employees.documents')}</CardTitle>
              <Button 
                size="sm" 
                className="gap-2"
                onClick={() => setIsUploadModalOpen(true)}
              >
                <Upload size={16}/> {t('documents.uploadDocument') || 'Upload Document'}
              </Button>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText size={48} className="mx-auto mb-4 opacity-50" />
                  <p>{t('documents.noDocuments') || 'No documents uploaded yet'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="font-bold">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.folder || doc.category || 'General'} • {t('common.uploaded') || 'Uploaded'} {
                              doc.upload_date 
                                ? new Date(doc.upload_date).toLocaleDateString() 
                                : doc.created_at 
                                  ? new Date(doc.created_at).toLocaleDateString() 
                                  : 'N/A'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDownload(doc.url, doc.name)}
                          title={t('common.download') || 'Download'}
                        >
                          <Download size={18}/>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteDocument(doc.id)}
                          title={t('common.delete') || 'Delete'}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={18}/>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Document Modal */}
      <Modal 
        isOpen={isUploadModalOpen} 
        onClose={() => {
          setIsUploadModalOpen(false);
          setSelectedFile(null);
          setSelectedCategory('General');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }} 
        title={t('documents.uploadDocument') || 'Upload Document'}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('documents.selectFile') || 'Select File'} *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="w-full p-2 border border-white/10 rounded-lg bg-white/5 text-foreground"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                {t('documents.selectedFile') || 'Selected'}: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('documents.category') || 'Category'} *
            </label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full h-11">
                <SelectValue placeholder={t('documents.selectCategory') || 'Select category'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Contract">{t('documents.contract') || 'Contract'}</SelectItem>
                <SelectItem value="ID">{t('documents.id') || 'ID'}</SelectItem>
                <SelectItem value="Education">{t('documents.education') || 'Education'}</SelectItem>
                <SelectItem value="General">{t('documents.general') || 'General'}</SelectItem>
                <SelectItem value="Payroll">{t('documents.payroll') || 'Payroll'}</SelectItem>
                <SelectItem value="Visa">{t('documents.visa') || 'Visa'}</SelectItem>
                <SelectItem value="Other">{t('documents.other') || 'Other'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadModalOpen(false);
                setSelectedFile(null);
                setSelectedCategory('General');
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? t('common.uploading') || 'Uploading...' : t('common.upload') || 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
