import React, { useState } from 'react';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from '../components/common/UIComponents';
import Modal from '../components/common/Modal';
import { useTranslation } from 'react-i18next';

export default function LeavesPage() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-heading">{t('leaves.title')}</h1>
          <p className="text-muted-foreground">Track and approve employee time off</p>
        </div>
        <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> {t('leaves.newRequest')}
        </Button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('leaves.newRequest')}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('employees.name')}</label>
            <Input placeholder="Select Employee" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Leave Type</label>
            <select className="w-full h-10 bg-white/5 border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-primary">
              <option>{t('leaves.annualLeave')}</option>
              <option>{t('leaves.sickLeave')}</option>
              <option>{t('leaves.unpaidLeave')}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => setIsModalOpen(false)}>{t('common.submit')}</Button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>{t('leaves.calendar')}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-96 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
              <div className="text-center text-muted-foreground">
                <CalendarIcon size={48} className="mx-auto mb-4 opacity-50" />
                <p>Interactive Calendar Component</p>
                <p className="text-xs">(Integration with FullCalendar or similar)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('leaves.pendingApprovals')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: 'Sarah Connor', type: 'Annual Leave', dates: 'Dec 24 - Dec 26', avatar: 'SC' },
                { name: 'John Doe', type: 'Sick Leave', dates: 'Dec 20', avatar: 'JD' },
              ].map((req, i) => (
                <div key={i} className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {req.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{req.name}</p>
                      <p className="text-xs text-muted-foreground">{req.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-muted-foreground">{req.dates}</span>
                    <Badge variant="warning">Pending</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700">Approve</Button>
                    <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs">Reject</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
