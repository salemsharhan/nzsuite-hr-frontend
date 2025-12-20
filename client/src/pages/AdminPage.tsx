import React from 'react';
import { Shield, Users, Activity, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '../components/common/UIComponents';
import { useTranslation } from 'react-i18next';

export default function AdminPage() {
  const { t } = useTranslation();

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
            <CardTitle>{t('admin.userManagement')}</CardTitle>
            <Button size="sm" className="gap-2"><Users size={16} /> {t('admin.addUser')}</Button>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-white/5">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">{t('employees.name')}</th>
                  <th className="px-4 py-3">{t('admin.role')}</th>
                  <th className="px-4 py-3">{t('common.status')}</th>
                  <th className="px-4 py-3 text-right rounded-r-lg">{t('admin.lastLogin')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { name: 'Admin User', email: 'admin@thesystem.com', role: 'Super Admin', status: 'Active', login: 'Just now' },
                  { name: 'HR Manager', email: 'hr@thesystem.com', role: 'HR Admin', status: 'Active', login: '2 hours ago' },
                  { name: 'Payroll Officer', email: 'finance@thesystem.com', role: 'Finance', status: 'Active', login: '1 day ago' },
                ].map((user, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline">{user.role}</Badge></td>
                    <td className="px-4 py-3"><Badge variant="success">{user.status}</Badge></td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{user.login}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('admin.securityControls')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Lock size={16} /> {t('common.edit')} Password
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3">
                <Shield size={16} /> 2FA {t('settings.title')}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3">
                <Activity size={16} /> {t('common.view')} {t('admin.auditLogs')}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-destructive/10 border-destructive/20">
            <CardHeader><CardTitle className="text-destructive">Danger Zone</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">Irreversible actions. Proceed with caution.</p>
              <Button variant="destructive" className="w-full">System Maintenance Mode</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
