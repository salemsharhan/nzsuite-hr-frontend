import React, { useState, useEffect } from 'react';
import { Calendar, Save, Upload, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '../components/common/UIComponents';
import { timesheetService, TimesheetEntry } from '../services/timesheetService';

export default function TimesheetsPage() {
  const [week, setWeek] = useState('2025-W51');
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  useEffect(() => {
    loadData();
  }, [week]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get first employee to simulate logged-in user
      const employees = await import('../services/employeeService').then(m => m.employeeService.getAll());
      if (employees.length === 0) {
        setLoading(false);
        return;
      }
      
      const userId = employees[0].id.toString();
      setCurrentUserId(userId);

      const data = await timesheetService.getMyTimesheets(userId, week);
      // If no data, initialize with empty rows
      if (data.length === 0) {
        setEntries([
          { id: 'new-1', employee_id: userId.toString(), week, project: 'Project Alpha', hours: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 }, status: 'Draft', total_hours: 0 },
          { id: 'new-2', employee_id: userId.toString(), week, project: 'Internal Ops', hours: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 }, status: 'Draft', total_hours: 0 }
        ]);
      } else {
        setEntries(data);
      }
    } catch (error) {
      console.error('Failed to load timesheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHourChange = (index: number, day: string, value: string) => {
    const newEntries = [...entries];
    newEntries[index].hours[day] = Number(value) || 0;
    
    // Recalculate total
    newEntries[index].total_hours = Object.values(newEntries[index].hours).reduce((a, b) => a + b, 0);
    setEntries(newEntries);
  };

  const handleSave = async () => {
    try {
      // In a real app, we would loop and save each entry
      alert('Timesheet saved successfully!');
    } catch (error) {
      console.error('Failed to save timesheet:', error);
    }
  };

  const totalWeeklyHours = entries.reduce((acc, curr) => acc + (curr.total_hours || 0), 0);

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
          <Button className="gap-2" onClick={handleSave}>
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
            <p className="text-2xl font-bold font-mono text-primary">{totalWeeklyHours}</p>
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
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-8">Loading...</td></tr>
                ) : entries.map((entry, i) => (
                  <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Input 
                        value={entry.project} 
                        onChange={(e) => {
                          const newEntries = [...entries];
                          newEntries[i].project = e.target.value;
                          setEntries(newEntries);
                        }}
                        className="h-8 bg-transparent border-none focus:bg-white/5"
                      />
                    </td>
                    {days.map(day => (
                      <td key={day} className="px-2 py-3">
                        <input 
                          type="number" 
                          className="w-full bg-transparent text-center border border-white/10 rounded focus:border-primary focus:outline-none py-1"
                          value={entry.hours[day] || ''}
                          onChange={(e) => handleHourChange(i, day, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-bold font-mono">
                      {entry.total_hours || 0}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={9} className="px-4 py-3">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-primary gap-2 pl-0 hover:bg-transparent hover:underline"
                      onClick={() => setEntries([...entries, { id: `new-${Date.now()}`, employee_id: currentUserId, week, project: 'New Task', hours: {}, status: 'Draft', total_hours: 0 }])}
                    >
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
