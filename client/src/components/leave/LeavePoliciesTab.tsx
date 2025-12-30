import { useState } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// Mock leave types data
const mockLeaveTypes = [
  {
    id: 1,
    name: 'Annual Leave',
    code: 'AL',
    color: '#3b82f6',
    icon: '🏖️',
    description: 'Paid time off for vacation and personal time',
    isActive: true,
    policy: {
      annualEntitlement: 21,
      accrualMethod: 'yearly',
      carryForwardEnabled: true,
      maxCarryForwardDays: 5,
      encashmentEnabled: true,
      minDaysPerRequest: 1,
      maxDaysPerRequest: 14,
      advanceNoticeRequired: 7,
      requiresApproval: true,
      requiresAttachment: false,
    },
  },
  {
    id: 2,
    name: 'Sick Leave',
    code: 'SL',
    color: '#ef4444',
    icon: '🤒',
    description: 'Leave for illness or medical appointments',
    isActive: true,
    policy: {
      annualEntitlement: 10,
      accrualMethod: 'yearly',
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
    id: 3,
    name: 'Emergency Leave',
    code: 'EL',
    color: '#f59e0b',
    icon: '🚨',
    description: 'Urgent personal or family emergencies',
    isActive: true,
    policy: {
      annualEntitlement: 3,
      accrualMethod: 'yearly',
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
  {
    id: 4,
    name: 'Maternity Leave',
    code: 'ML',
    color: '#8b5cf6',
    icon: '👶',
    description: 'Maternity leave for expecting mothers',
    isActive: true,
    policy: {
      annualEntitlement: 90,
      accrualMethod: 'joining_date',
      carryForwardEnabled: false,
      maxCarryForwardDays: 0,
      encashmentEnabled: false,
      minDaysPerRequest: 30,
      maxDaysPerRequest: 90,
      advanceNoticeRequired: 30,
      requiresApproval: true,
      requiresAttachment: true,
    },
  },
  {
    id: 5,
    name: 'Unpaid Leave',
    code: 'UL',
    color: '#6b7280',
    icon: '⏸️',
    description: 'Leave without pay',
    isActive: true,
    policy: {
      annualEntitlement: 0,
      accrualMethod: 'yearly',
      carryForwardEnabled: false,
      maxCarryForwardDays: 0,
      encashmentEnabled: false,
      minDaysPerRequest: 1,
      maxDaysPerRequest: 30,
      advanceNoticeRequired: 14,
      requiresApproval: true,
      requiresAttachment: false,
    },
  },
];

export default function LeavePoliciesTab() {
  const [leaveTypes, setLeaveTypes] = useState(mockLeaveTypes);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  const handleEdit = (leaveType: any) => {
    setSelectedLeaveType(leaveType);
    setFormData({ ...leaveType, ...leaveType.policy });
    setEditModalOpen(true);
  };

  const handleSave = () => {
    if (selectedLeaveType) {
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
      setEditModalOpen(false);
    }
  };

  const handleToggleActive = (id: number) => {
    setLeaveTypes(leaveTypes.map((lt) => (lt.id === id ? { ...lt, isActive: !lt.isActive } : lt)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Leave Types & Policies</h3>
          <p className="text-sm text-muted-foreground">Configure leave types and their policy rules</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Leave Type
        </Button>
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
                  <p className="text-muted-foreground">Annual Entitlement</p>
                  <p className="font-medium">{leaveType.policy.annualEntitlement} days</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Accrual Method</p>
                  <p className="font-medium capitalize">{leaveType.policy.accrualMethod.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Carry Forward</p>
                  <p className="font-medium">
                    {leaveType.policy.carryForwardEnabled
                      ? `${leaveType.policy.maxCarryForwardDays} days`
                      : 'No'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Encashment</p>
                  <p className="font-medium">{leaveType.policy.encashmentEnabled ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Min/Max Days</p>
                  <p className="font-medium">
                    {leaveType.policy.minDaysPerRequest} - {leaveType.policy.maxDaysPerRequest || '∞'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Advance Notice</p>
                  <p className="font-medium">
                    {leaveType.policy.advanceNoticeRequired === 0
                      ? 'Not required'
                      : `${leaveType.policy.advanceNoticeRequired} days`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    leaveType.policy.requiresApproval ? 'bg-amber-500/20 text-amber-700' : 'bg-green-500/20 text-green-700'
                  }`}
                >
                  {leaveType.policy.requiresApproval ? 'Requires Approval' : 'Auto-Approved'}
                </span>
                {leaveType.policy.requiresAttachment && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-700">
                    Attachment Required
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
            <DialogTitle>Edit Leave Type & Policy</DialogTitle>
          </DialogHeader>
          {selectedLeaveType && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="font-semibold mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Leave Type Name *</Label>
                    <Input
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Annual Leave"
                    />
                  </div>
                  <div>
                    <Label>Code *</Label>
                    <Input
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="e.g., AL"
                      maxLength={4}
                    />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <Input
                      type="color"
                      value={formData.color || '#3b82f6'}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Icon (Emoji)</Label>
                    <Input
                      value={formData.icon || ''}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      placeholder="🏖️"
                      maxLength={2}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this leave type"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Policy Configuration */}
              <div>
                <h4 className="font-semibold mb-3">Policy Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Annual Entitlement (days) *</Label>
                    <Input
                      type="number"
                      value={formData.annualEntitlement || 0}
                      onChange={(e) => setFormData({ ...formData, annualEntitlement: parseInt(e.target.value) })}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label>Accrual Method *</Label>
                    <Select
                      value={formData.accrualMethod || 'yearly'}
                      onValueChange={(value) => setFormData({ ...formData, accrualMethod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="joining_date">From Joining Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Min Days Per Request</Label>
                    <Input
                      type="number"
                      value={formData.minDaysPerRequest || 1}
                      onChange={(e) => setFormData({ ...formData, minDaysPerRequest: parseInt(e.target.value) })}
                      min={1}
                    />
                  </div>
                  <div>
                    <Label>Max Days Per Request</Label>
                    <Input
                      type="number"
                      value={formData.maxDaysPerRequest || ''}
                      onChange={(e) => setFormData({ ...formData, maxDaysPerRequest: parseInt(e.target.value) || null })}
                      min={1}
                      placeholder="No limit"
                    />
                  </div>
                  <div>
                    <Label>Advance Notice Required (days)</Label>
                    <Input
                      type="number"
                      value={formData.advanceNoticeRequired || 0}
                      onChange={(e) => setFormData({ ...formData, advanceNoticeRequired: parseInt(e.target.value) })}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label>Max Carry Forward Days</Label>
                    <Input
                      type="number"
                      value={formData.maxCarryForwardDays || 0}
                      onChange={(e) => setFormData({ ...formData, maxCarryForwardDays: parseInt(e.target.value) })}
                      min={0}
                      disabled={!formData.carryForwardEnabled}
                    />
                  </div>
                </div>
              </div>

              {/* Policy Switches */}
              <div>
                <h4 className="font-semibold mb-3">Policy Options</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">Carry Forward Enabled</p>
                      <p className="text-sm text-muted-foreground">Allow unused days to carry to next year</p>
                    </div>
                    <Switch
                      checked={formData.carryForwardEnabled || false}
                      onCheckedChange={(checked) => setFormData({ ...formData, carryForwardEnabled: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">Encashment Enabled</p>
                      <p className="text-sm text-muted-foreground">Allow employees to encash unused leave</p>
                    </div>
                    <Switch
                      checked={formData.encashmentEnabled || false}
                      onCheckedChange={(checked) => setFormData({ ...formData, encashmentEnabled: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">Requires Approval</p>
                      <p className="text-sm text-muted-foreground">Leave requests need manager approval</p>
                    </div>
                    <Switch
                      checked={formData.requiresApproval !== false}
                      onCheckedChange={(checked) => setFormData({ ...formData, requiresApproval: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">Requires Attachment</p>
                      <p className="text-sm text-muted-foreground">Supporting documents must be uploaded</p>
                    </div>
                    <Switch
                      checked={formData.requiresAttachment || false}
                      onCheckedChange={(checked) => setFormData({ ...formData, requiresAttachment: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">Active</p>
                      <p className="text-sm text-muted-foreground">Leave type is available for requests</p>
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
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
