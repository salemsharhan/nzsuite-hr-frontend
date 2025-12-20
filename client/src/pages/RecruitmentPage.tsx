import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, MoreHorizontal, Calendar, MessageSquare, Paperclip, Trash2 } from 'lucide-react';
import { Card, CardContent, Button, Badge, Input } from '../components/common/UIComponents';
import Modal from '../components/common/Modal';
import { recruitmentService, Candidate } from '../services/recruitmentService';

interface Column {
  id: string;
  title: string;
  color: string;
  candidates: Candidate[];
}

const initialColumns: Column[] = [
  { id: 'Applied', title: 'Applied', color: 'bg-blue-500', candidates: [] },
  { id: 'Screening', title: 'Screening', color: 'bg-purple-500', candidates: [] },
  { id: 'Interview', title: 'Interview', color: 'bg-amber-500', candidates: [] },
  { id: 'Offer', title: 'Offer Sent', color: 'bg-emerald-500', candidates: [] },
  { id: 'Hired', title: 'Hired', color: 'bg-primary', candidates: [] }
];

export default function RecruitmentPage() {
  const { t } = useTranslation();
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [newCandidate, setNewCandidate] = useState({
    name: '',
    email: '',
    position: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await recruitmentService.getAll();
      const newCols = initialColumns.map(col => ({
        ...col,
        candidates: data.filter(c => c.status === col.id)
      }));
      setColumns(newCols);
    } catch (error) {
      console.error('Failed to load candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recruitmentService.create(newCandidate);
      await loadData();
      setIsModalOpen(false);
      setNewCandidate({ name: '', email: '', position: '' });
    } catch (error) {
      console.error('Failed to add candidate:', error);
      alert('Failed to add candidate');
    }
  };

  const handleDragStart = (e: React.DragEvent, candidateId: string, sourceColId: string) => {
    e.dataTransfer.setData('candidateId', candidateId);
    e.dataTransfer.setData('sourceColId', sourceColId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData('candidateId');
    const sourceColId = e.dataTransfer.getData('sourceColId');

    if (sourceColId === targetColId) return;

    // Optimistic UI Update
    const sourceCol = columns.find(c => c.id === sourceColId);
    const targetCol = columns.find(c => c.id === targetColId);
    const candidate = sourceCol?.candidates.find(c => c.id === candidateId);

    if (sourceCol && targetCol && candidate) {
      const newColumns = columns.map(col => {
        if (col.id === sourceColId) {
          return { ...col, candidates: col.candidates.filter(c => c.id !== candidateId) };
        }
        if (col.id === targetColId) {
          return { ...col, candidates: [...col.candidates, { ...candidate, status: targetColId as any }] };
        }
        return col;
      });
      setColumns(newColumns);

      // API Call
      try {
        await recruitmentService.updateStatus(candidateId, targetColId as any);
      } catch (error) {
        console.error('Failed to update status:', error);
        alert('Failed to move candidate');
        loadData(); // Revert on error
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this candidate?')) return;
    try {
      await recruitmentService.delete(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete candidate:', error);
      alert('Failed to delete candidate');
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold font-heading text-foreground">Recruitment Pipeline</h1>
          <p className="text-muted-foreground">Manage candidates and hiring workflow</p>
        </div>
        <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Add Candidate
        </Button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Candidate">
        <form onSubmit={handleAddCandidate} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name</label>
            <Input 
              value={newCandidate.name}
              onChange={e => setNewCandidate({...newCandidate, name: e.target.value})}
              required
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input 
              type="email"
              value={newCandidate.email}
              onChange={e => setNewCandidate({...newCandidate, email: e.target.value})}
              required
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Position</label>
            <Input 
              value={newCandidate.position}
              onChange={e => setNewCandidate({...newCandidate, position: e.target.value})}
              required
              placeholder="Software Engineer"
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max h-full">
          {columns.map((col) => (
            <div 
              key={col.id} 
              className="w-80 flex flex-col bg-white/5 rounded-xl border border-white/5"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column Header */}
              <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${col.color}`} />
                  <h3 className="font-bold text-sm">{col.title}</h3>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {col.candidates.length}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal size={14} />
                </Button>
              </div>

              {/* Candidates List */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {loading ? (
                  <div className="text-center text-xs text-muted-foreground py-4">Loading...</div>
                ) : col.candidates.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-4 opacity-50">Drop here</div>
                ) : col.candidates.map((candidate) => (
                  <Card 
                    key={candidate.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, candidate.id, col.id)}
                    className="cursor-move hover:border-primary/50 transition-colors bg-card/50 backdrop-blur-sm group"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary border border-white/10 overflow-hidden">
                            {candidate.avatar_url ? (
                              <img src={candidate.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{candidate.name.split(' ').map(n => n[0]).join('').substring(0, 2)}</span>
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-foreground">{candidate.name}</h4>
                            <p className="text-xs text-muted-foreground">{candidate.position}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(candidate.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>{new Date(candidate.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-2">
                          <MessageSquare size={12} className="hover:text-primary cursor-pointer" />
                          <Paperclip size={12} className="hover:text-primary cursor-pointer" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
