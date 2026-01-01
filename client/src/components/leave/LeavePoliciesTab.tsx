import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '../../contexts/AuthContext';
import { companySettingsService, CompanySettings } from '../../services/companySettingsService';
import { useTranslation } from 'react-i18next';

interface LeavePolicy {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string;
  description: string;
  isActive: boolean;
  policy: {
    annualEntitlement: number;
    accrualMethod: 'yearly' | 'monthly' | 'joining_date';
    carryForwardEnabled: boolean;
    maxCarryForwardDays: number;
    encashmentEnabled: boolean;
    minDaysPerRequest: number;
    maxDaysPerRequest: number | null;
    advanceNoticeRequired: number;
    requiresApproval: boolean;
    requiresAttachment: boolean;
  };
}

export default function LeavePoliciesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeavePolicy[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeavePolicy | null>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (user?.company_id) {
      loadCompanySettings();
    }
  }, [user?.company_id]);

  const loadCompanySettings = async () => {
    if (!user?.company_id) return;
    
    setLoading(true);
    try {
      const settings = await companySettingsService.getCompanySettings(user.company_id);
      setCompanySettings(settings);
      
      if (settings) {
        // Map company settings to leave policies
        const policies: LeavePolicy[] = [
          {
            id: 'annual',
            name: t('leaves.annualLeave') || 'Annual Leave',
            code: 'AL',
            color: '#3b82f6',
            icon: '🏖️',
            description: t('leaves.annualLeaveDesc') || 'Paid time off for vacation and personal time',
            isActive: true,
            policy: {
              annualEntitlement: settings.annual_leave_days_per_year,
              accrualMethod: 'monthly', // Based on your requirement
              carryForwardEnabled: settings.carry_forward_annual_leave,
              maxCarryForwardDays: settings.max_carry_forward_days,
              encashmentEnabled: false,
              minDaysPerRequest: 1,
              maxDaysPerRequest: 14,
              advanceNoticeRequired: 7,
              requiresApproval: true,
              requiresAttachment: false,
            },
          },
          {
            id: 'sick',
            name: t('leaves.sickLeave') || 'Sick Leave',
            code: 'SL',
            color: '#ef4444',
            icon: '🤒',
            description: t('leaves.sickLeaveDesc') || 'Leave for illness or medical appointments',
            isActive: true,
            policy: {
              annualEntitlement: settings.sick_leave_days_per_year,
              accrualMethod: 'monthly',
              carryForwardEnabled: false,
              maxCarryForwardDays: 0,
              encashmentEnabled: false,
              minDaysPerRequest: 1,
              maxDaysPerRequest: 5,
              advanceNoticeRequired: 0,
              requiresApproval: true,
              requiresAttachment: true,
            },
          },
          {
            id: 'emergency',
            name: t('leaves.emergencyLeave') || 'Emergency Leave',
            code: 'EL',
            color: '#f59e0b',
            icon: '🚨',
            description: t('leaves.emergencyLeaveDesc') || 'Urgent personal or family emergencies',
            isActive: true,
            policy: {
              annualEntitlement: 3, // Default emergency leave
              accrualMethod: 'monthly',
              carryForwardEnabled: false,
              maxCarryForwardDays: 0,
              encashmentEnabled: false,
              minDaysPerRequest: 1,
              maxDaysPerRequest: 2,
              advanceNoticeRequired: 0,
              requiresApproval: true,
              requiresAttachment: false,
            },
          },
        ];
        setLeaveTypes(policies);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (leaveType: LeavePolicy) => {
    setSelectedLeaveType(leaveType);
    setFormData({ ...leaveType, ...leaveType.policy });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedLeaveType || !user?.company_id || !companySettings) return;

    try {
      // Update company settings based on the leave type being edited
      const updates: Partial<CompanySettings> = {};
      
      if (selectedLeaveType.id === 'annual') {
        updates.annual_leave_days_per_year = formData.annualEntitlement;
        updates.carry_forward_annual_leave = formData.carryForwardEnabled;
        updates.max_carry_forward_days = formData.maxCarryForwardDays;
      } else if (selectedLeaveType.id === 'sick') {
        updates.sick_leave_days_per_year = formData.annualEntitlement;
      }
      // Emergency leave is not stored in company settings, so we'll just update local state

      if (Object.keys(updates).length > 0) {
        await companySettingsService.updateCompanySettings(user.company_id, updates);
        await loadCompanySettings(); // Reload to get updated settings
      } else {
        // For emergency leave or other types not in company settings, just update local state
        setLeaveTypes(
          leaveTypes.map((lt) =>
            lt.id === selectedLeaveType.id
              ? {
                  ...lt,
                  name: formData.name,
                  code: formData.code,
                  color: formData.color,
                  icon: formData.icon,
                  description: formData.description,
                  isActive: formData.isActive,
                  policy: {
                    annualEntitlement: formData.annualEntitlement,
                    accrualMethod: formData.accrualMethod,
                    carryForwardEnabled: formData.carryForwardEnabled,
                    maxCarryForwardDays: formData.maxCarryForwardDays,
                    encashmentEnabled: formData.encashmentEnabled,
                    minDaysPerRequest: formData.minDaysPerRequest,
                    maxDaysPerRequest: formData.maxDaysPerRequest,
                    advanceNoticeRequired: formData.advanceNoticeRequired,
                    requiresApproval: formData.requiresApproval,
                    requiresAttachment: formData.requiresAttachment,
                  },
                }
              : lt
          )
        );
      }
      
      setEditModalOpen(false);
    } catch (error) {
      console.error('Error saving leave policy:', error);
      alert(t('settings.failedToSave') || 'Failed to save changes');
    }
  };

  const handleToggleActive = (id: string) => {
    setLeaveTypes(leaveTypes.map((lt) => (lt.id === id ? { ...lt, isActive: !lt.isActive } : lt)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <p className="text-muted-foreground">{t('common.loading') || 'Loading...'}</p>
      </div>
    );
  }

  if (!companySettings) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">{t('settings.noCompanySettings') || 'Company settings not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('leaves.leaveTypesPolicies') || 'Leave Types & Policies'}</h3>
          <p className="text-sm text-muted-foreground">
            {t('leaves.configureLeaveTypes') || 'Configure leave types and their policy rules from company settings'}
          </p>
        </div>
      </div>

      {/* Leave Types Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {leaveTypes.map((leaveType) => (
          <Card key={leaveType.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${leaveType.color}20` }}
                >
                  {leaveType.icon}
                </div>
                <div>
                  <h4 className="font-semibold flex items-center gap-2">
                    {leaveType.name}
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: leaveType.color, color: 'white' }}
                    >
                      {leaveType.code}
                    </span>
                  </h4>
                  <p className="text-sm text-muted-foreground">{leaveType.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={leaveType.isActive}
                  onCheckedChange={() => handleToggleActive(leaveType.id)}
                />
                <Button size="sm" variant="ghost" onClick={() => handleEdit(leaveType)}>
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">{t('leaves.annualEntitlement') || 'Annual Entitlement'}</p>
                  <p className="font-medium">{leaveType.policy.annualEntitlement} {t('common.days') || 'days'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('leaves.accrualMethod') || 'Accrual Method'}</p>
                  <p className="font-medium capitalize">{leaveType.policy.accrualMethod.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('leaves.carryForward') || 'Carry Forward'}</p>
                  <p className="font-medium">
                    {leaveType.policy.carryForwardEnabled
                      ? `${leaveType.policy.maxCarryForwardDays} ${t('common.days') || 'days'}`
                      : t('common.no') || 'No'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('leaves.encashment') || 'Encashment'}</p>
                  <p className="font-medium">{leaveType.policy.encashmentEnabled ? (t('common.yes') || 'Yes') : (t('common.no') || 'No')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('leaves.minMaxDays') || 'Min/Max Days'}</p>
                  <p className="font-medium">
                    {leaveType.policy.minDaysPerRequest} - {leaveType.policy.maxDaysPerRequest || '∞'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('leaves.advanceNotice') || 'Advance Notice'}</p>
                  <p className="font-medium">
                    {leaveType.policy.advanceNoticeRequired === 0
                      ? t('leaves.notRequired') || 'Not required'
                      : `${leaveType.policy.advanceNoticeRequired} ${t('common.days') || 'days'}`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    leaveType.policy.requiresApproval ? 'bg-amber-500/20 text-amber-700' : 'bg-green-500/20 text-green-700'
                  }`}
                >
                  {leaveType.policy.requiresApproval ? (t('leaves.requiresApproval') || 'Requires Approval') : (t('leaves.autoApproved') || 'Auto-Approved')}
                </span>
                {leaveType.policy.requiresAttachment && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-700">
                    {t('leaves.attachmentRequired') || 'Attachment Required'}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('leaves.editLeaveType') || 'Edit Leave Type & Policy'}</DialogTitle>
          </DialogHeader>
          {selectedLeaveType && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="font-semibold mb-3">{t('leaves.basicInformation') || 'Basic Information'}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('leaves.leaveTypeName') || 'Leave Type Name'} *</Label>
                    <Input
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t('leaves.leaveTypeNamePlaceholder') || 'e.g., Annual Leave'}
                      disabled={selectedLeaveType.id === 'annual' || selectedLeaveType.id === 'sick' || selectedLeaveType.id === 'emergency'}
                    />
                  </div>
                  <div>
                    <Label>{t('common.code') || 'Code'} *</Label>
                    <Input
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder={t('leaves.codePlaceholder') || 'e.g., AL'}
                      maxLength={4}
                      disabled={selectedLeaveType.id === 'annual' || selectedLeaveType.id === 'sick' || selectedLeaveType.id === 'emergency'}
                    />
                  </div>
                  <div>
                    <Label>{t('leaves.color') || 'Color'}</Label>
                    <Input
                      type="color"
                      value={formData.color || '#3b82f6'}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t('leaves.icon') || 'Icon (Emoji)'}</Label>
                    <Input
                      value={formData.icon || ''}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      placeholder="🏖️"
                      maxLength={2}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>{t('common.description') || 'Description'}</Label>
                    <Textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={t('leaves.descriptionPlaceholder') || 'Brief description of this leave type'}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Policy Configuration */}
              <div>
                <h4 className="font-semibold mb-3">{t('leaves.policyConfiguration') || 'Policy Configuration'}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('leaves.annualEntitlement') || 'Annual Entitlement (days)'} *</Label>
                    <Input
                      type="number"
                      value={formData.annualEntitlement || 0}
                      onChange={(e) => setFormData({ ...formData, annualEntitlement: parseInt(e.target.value) || 0 })}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label>{t('leaves.accrualMethod') || 'Accrual Method'} *</Label>
                    <Select
                      value={formData.accrualMethod || 'monthly'}
                      onValueChange={(value) => setFormData({ ...formData, accrualMethod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yearly">{t('leaves.yearly') || 'Yearly'}</SelectItem>
                        <SelectItem value="monthly">{t('leaves.monthly') || 'Monthly'}</SelectItem>
                        <SelectItem value="joining_date">{t('leaves.fromJoiningDate') || 'From Joining Date'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('leaves.minDaysPerRequest') || 'Min Days Per Request'}</Label>
                    <Input
                      type="number"
                      value={formData.minDaysPerRequest || 1}
                      onChange={(e) => setFormData({ ...formData, minDaysPerRequest: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </div>
                  <div>
                    <Label>{t('leaves.maxDaysPerRequest') || 'Max Days Per Request'}</Label>
                    <Input
                      type="number"
                      value={formData.maxDaysPerRequest || ''}
                      onChange={(e) => setFormData({ ...formData, maxDaysPerRequest: parseInt(e.target.value) || null })}
                      min={1}
                      placeholder={t('leaves.noLimit') || 'No limit'}
                    />
                  </div>
                  <div>
                    <Label>{t('leaves.advanceNoticeRequired') || 'Advance Notice Required (days)'}</Label>
                    <Input
                      type="number"
                      value={formData.advanceNoticeRequired || 0}
                      onChange={(e) => setFormData({ ...formData, advanceNoticeRequired: parseInt(e.target.value) || 0 })}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label>{t('leaves.maxCarryForwardDays') || 'Max Carry Forward Days'}</Label>
                    <Input
                      type="number"
                      value={formData.maxCarryForwardDays || 0}
                      onChange={(e) => setFormData({ ...formData, maxCarryForwardDays: parseInt(e.target.value) || 0 })}
                      min={0}
                      disabled={!formData.carryForwardEnabled}
                    />
                  </div>
                </div>
              </div>

              {/* Policy Switches */}
              <div>
                <h4 className="font-semibold mb-3">{t('leaves.policyOptions') || 'Policy Options'}</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{t('leaves.carryForwardEnabled') || 'Carry Forward Enabled'}</p>
                      <p className="text-sm text-muted-foreground">{t('leaves.carryForwardDesc') || 'Allow unused days to carry to next year'}</p>
                    </div>
                    <Switch
                      checked={formData.carryForwardEnabled || false}
                      onCheckedChange={(checked) => setFormData({ ...formData, carryForwardEnabled: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{t('leaves.encashmentEnabled') || 'Encashment Enabled'}</p>
                      <p className="text-sm text-muted-foreground">{t('leaves.encashmentDesc') || 'Allow employees to encash unused leave'}</p>
                    </div>
                    <Switch
                      checked={formData.encashmentEnabled || false}
                      onCheckedChange={(checked) => setFormData({ ...formData, encashmentEnabled: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{t('leaves.requiresApproval') || 'Requires Approval'}</p>
                      <p className="text-sm text-muted-foreground">{t('leaves.requiresApprovalDesc') || 'Leave requests need manager approval'}</p>
                    </div>
                    <Switch
                      checked={formData.requiresApproval !== false}
                      onCheckedChange={(checked) => setFormData({ ...formData, requiresApproval: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{t('leaves.requiresAttachment') || 'Requires Attachment'}</p>
                      <p className="text-sm text-muted-foreground">{t('leaves.requiresAttachmentDesc') || 'Supporting documents must be uploaded'}</p>
                    </div>
                    <Switch
                      checked={formData.requiresAttachment || false}
                      onCheckedChange={(checked) => setFormData({ ...formData, requiresAttachment: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{t('common.active') || 'Active'}</p>
                      <p className="text-sm text-muted-foreground">{t('leaves.activeDesc') || 'Leave type is available for requests'}</p>
                    </div>
                    <Switch
                      checked={formData.isActive !== false}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              {t('common.save') || 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
