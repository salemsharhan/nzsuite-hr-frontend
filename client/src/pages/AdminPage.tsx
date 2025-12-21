import React, { useState, useEffect } from 'react';
import { Shield, Users, Activity, Lock, Plus, Trash2, Edit, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from '../components/common/UIComponents';
import { useTranslation } from 'react-i18next';
import { userManagementService, AdminUser, CreateAdminUserData } from '../services/userManagementService';
import { companyService } from '../services/companyService';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/common/Modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function AdminPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [newAdmin, setNewAdmin] = useState<CreateAdminUserData>({
    email: '',
    password: '',
    role: 'super_admin',
    company_id: undefined,
    first_name: '',
    last_name: ''
  });

  useEffect(() => {
    loadAdmins();
    if (user?.role === 'super_admin') {
      loadCompanies();
    }
  }, [user]);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const data = await userManagementService.getAllAdmins();
      // Filter by company_id if user is admin (not super_admin)
      if (user?.role === 'admin' && user?.company_id) {
        const filteredData = data.filter(admin => admin.company_id === user.company_id);
        setAdmins(filteredData);
      } else {
        // Super admin sees all admins
        setAdmins(data);
      }
    } catch (error) {
      console.error('Failed to load admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await companyService.getAll();
      setCompanies(data);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // If user is admin (not super_admin), automatically set company_id to their company
      const adminData = {
        ...newAdmin,
        role: user?.role === 'admin' ? 'admin' : newAdmin.role, // Admins can only create admins
        company_id: user?.role === 'admin' ? user.company_id : newAdmin.company_id
      };
      
      await userManagementService.createAdmin(adminData);
      await loadAdmins();
      setIsModalOpen(false);
      setNewAdmin({
        email: '',
        password: '',
        role: user?.role === 'admin' ? 'admin' : 'super_admin',
        company_id: user?.role === 'admin' ? user.company_id : undefined,
        first_name: '',
        last_name: ''
      });
      alert(t('admin.addAdmin') + ' ' + t('common.success'));
    } catch (error: any) {
      console.error('Failed to create admin:', error);
      alert(`${t('settings.failedToSave')}: ${error?.message || t('settings.unknownError')}`);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await userManagementService.updateAdminStatus(userId, !currentStatus);
      await loadAdmins();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      alert(`${t('settings.failedToSave')}: ${error?.message || t('settings.unknownError')}`);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(t('admin.confirmDelete'))) {
      return;
    }
    try {
      await userManagementService.deleteAdmin(userId);
      await loadAdmins();
      alert(t('common.delete') + ' ' + t('common.success'));
    } catch (error: any) {
      console.error('Failed to delete admin:', error);
      alert(`${t('settings.failedToDelete')}: ${error?.message || t('settings.unknownError')}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading">{t('admin.title')}</h1>
        <p className="text-muted-foreground">{t('admin.securityControls')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Management */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('admin.adminUsers')}</CardTitle>
            <Button size="sm" className="gap-2" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> {t('admin.addAdmin')}
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
            ) : admins.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.noData')}</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-white/5">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">{t('common.email')}</th>
                    <th className="px-4 py-3">{t('common.role')}</th>
                    <th className="px-4 py-3">{t('common.company')}</th>
                    <th className="px-4 py-3">{t('common.status')}</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{admin.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {t('admin.created')}: {new Date(admin.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={admin.role === 'super_admin' ? 'default' : 'outline'}>
                          {admin.role === 'super_admin' ? t('admin.superAdmin') : t('admin.admin')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {admin.company_name ? (
                          <span className="text-sm">{admin.company_name}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={admin.is_active ? 'success' : 'destructive'}>
                          {admin.is_active ? t('common.active') : t('common.inactive')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleStatus(admin.user_id, admin.is_active)}
                          >
                            {admin.is_active ? t('admin.deactivate') : t('admin.activate')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(admin.user_id, admin.email)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('admin.securityControls')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Lock size={16} /> {t('admin.editPassword')}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3">
                <Shield size={16} /> {t('admin.twoFactorAuth')}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3">
                <Activity size={16} /> {t('admin.viewAuditLogs')}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-destructive/10 border-destructive/20">
            <CardHeader><CardTitle className="text-destructive">{t('admin.dangerZone')}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">{t('admin.irreversibleActions')}</p>
              <Button variant="destructive" className="w-full">{t('admin.systemMaintenanceMode')}</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Admin Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('admin.addAdmin')}
      >
        <form onSubmit={handleAddAdmin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('common.email')} *</label>
            <Input
              type="email"
              required
              value={newAdmin.email}
              onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
              placeholder="admin@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('common.password')} *</label>
            <Input
              type="password"
              required
              value={newAdmin.password}
              onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
              placeholder={t('common.password')}
              minLength={6}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('common.firstName')}</label>
              <Input
                value={newAdmin.first_name}
                onChange={(e) => setNewAdmin({ ...newAdmin, first_name: e.target.value })}
                placeholder={t('common.firstName')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('common.lastName')}</label>
              <Input
                value={newAdmin.last_name}
                onChange={(e) => setNewAdmin({ ...newAdmin, last_name: e.target.value })}
                placeholder={t('common.lastName')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('common.role')} *</label>
            <Select
              value={newAdmin.role}
              onValueChange={(value: 'super_admin' | 'admin') => setNewAdmin({ ...newAdmin, role: value, company_id: value === 'super_admin' ? undefined : (user?.role === 'admin' ? user.company_id : newAdmin.company_id) })}
              disabled={user?.role === 'admin'} // Admins can only create admins
            >
              <SelectTrigger>
                <SelectValue placeholder={t('common.select') + ' ' + t('common.role').toLowerCase()} />
              </SelectTrigger>
              <SelectContent>
                {user?.role === 'super_admin' && <SelectItem value="super_admin">{t('admin.superAdmin')}</SelectItem>}
                <SelectItem value="admin">{t('admin.admin')}</SelectItem>
              </SelectContent>
            </Select>
            {user?.role === 'admin' && (
              <p className="text-xs text-muted-foreground">{t('settings.youCanOnlyCreateAdmins')}</p>
            )}
          </div>

          {newAdmin.role === 'admin' && user?.role === 'super_admin' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('common.company')} ({t('common.select')})</label>
              <Select
                value={newAdmin.company_id || 'none'}
                onValueChange={(value) => setNewAdmin({ ...newAdmin, company_id: value === 'none' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.select') + ' ' + t('common.company').toLowerCase()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.none')}</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {newAdmin.role === 'admin' && user?.role === 'admin' && user?.company_id && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('common.company')}</label>
              <Input
                value={companies.find(c => c.id === user.company_id)?.name || t('common.company')}
                disabled
                className="bg-white/5"
              />
              <p className="text-xs text-muted-foreground">{t('settings.adminWillBeCreated')}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {t('admin.addAdmin')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
