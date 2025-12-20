import React, { useState } from 'react';
import { Calendar, Save, Upload, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '../components/common/UIComponents';

export default function TimesheetsPage() {
  const [week, setWeek] = useState('2025-W51');
  
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const projects = ['Project Alpha', 'Internal Ops', 'Client Meeting'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-heading">Timesheets</h1>
          <p className="text-muted-foreground">Track project hours and tasks</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Upload size={16} /> Import Excel
          </Button>
          <Button className="gap-2">
            <Save size={16} /> Submit Week
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <Input 
              type="week" 
              value={week} 
              onChange={(e) => setWeek(e.target.value)}
              className="w-48"
            />
            <Badge variant="warning">Draft</Badge>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Hours</p>
            <p className="text-2xl font-bold font-mono text-primary">32.5</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-white/5">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Project / Task</th>
                  {days.map(day => (
                    <th key={day} className="px-2 py-3 text-center w-16">{day}</th>
                  ))}
                  <th className="px-4 py-3 text-right rounded-r-lg">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {projects.map((project, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium">{project}</td>
                    {days.map(day => (
                      <td key={day} className="px-2 py-3">
                        <input 
                          type="number" 
                          className="w-full bg-transparent text-center border border-white/10 rounded focus:border-primary focus:outline-none py-1"
                          defaultValue={Math.floor(Math.random() * 8)}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-bold font-mono">
                      {Math.floor(Math.random() * 40)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={9} className="px-4 py-3">
                    <Button variant="ghost" size="sm" className="text-primary gap-2 pl-0 hover:bg-transparent hover:underline">
                      <Plus size={14} /> Add Row
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
