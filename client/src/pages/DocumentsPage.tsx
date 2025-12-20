import React from 'react';
import { Folder, FileText, MoreVertical, Search, Upload, Grid, List } from 'lucide-react';
import { Card, CardContent, Button, Input } from '../components/common/UIComponents';

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-heading">Documents</h1>
          <p className="text-muted-foreground">Centralized digital filing cabinet</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search files..." className="pl-9 w-64" />
          </div>
          <Button className="gap-2">
            <Upload size={16} /> Upload
          </Button>
        </div>
      </div>

      {/* Folders */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {['Contracts', 'Policies', 'Visas', 'Payroll', 'Onboarding', 'Templates'].map((folder, i) => (
          <Card key={i} className="hover:bg-white/5 cursor-pointer transition-colors group">
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <Folder size={48} className="text-blue-400 group-hover:text-blue-300 transition-colors" />
              <span className="font-medium text-sm">{folder}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Files */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-white/5 border-b border-white/5">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Owner</th>
                <th className="px-6 py-3">Date Modified</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { name: 'Employee_Handbook_2025.pdf', owner: 'Admin', date: 'Dec 15, 2025', size: '2.4 MB' },
                { name: 'Offer_Letter_Template.docx', owner: 'HR Manager', date: 'Dec 10, 2025', size: '156 KB' },
                { name: 'Visa_Process_Flow.png', owner: 'PRO', date: 'Nov 28, 2025', size: '1.1 MB' },
              ].map((file, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3 font-medium">
                    <FileText size={18} className="text-muted-foreground" />
                    {file.name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{file.owner}</td>
                  <td className="px-6 py-4 text-muted-foreground">{file.date}</td>
                  <td className="px-6 py-4 text-muted-foreground">{file.size}</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
