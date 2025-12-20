import React from 'react';
import { Globe, Bell, Database, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../components/common/UIComponents';
import { useTranslation } from 'react-i18next';

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.general')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-2">
            {[
              { icon: Globe, label: t('settings.general'), active: true },
              { icon: Bell, label: t('common.notifications'), active: false },
              { icon: Database, label: t('common.import'), active: false },
              { icon: Smartphone, label: 'Mobile App', active: false },
            ].map((item, i) => (
              <button 
                key={i}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors ${
                  item.active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Content */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t('settings.general')}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('settings.companyName')}</label>
                <Input defaultValue="The System Enterprise" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('settings.supportEmail')}</label>
                <Input defaultValue="support@thesystem.com" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('settings.currency')}</label>
                <select className="w-full h-10 bg-white/5 border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-primary">
                  <option>KWD (Kuwaiti Dinar)</option>
                  <option>USD (US Dollar)</option>
                  <option>SAR (Saudi Riyal)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('settings.timezone')}</label>
                <select className="w-full h-10 bg-white/5 border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-primary">
                  <option>Asia/Kuwait (GMT+3)</option>
                  <option>UTC</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <Button>{t('common.save')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
