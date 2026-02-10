import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, FileText, MoreVertical, Search, Upload, Grid, List, Trash2, Download, Plus, X } from 'lucide-react';
import { Card, CardContent, Button, Input } from '../components/common/UIComponents';
import Modal from '../components/common/Modal';
import { documentService, Document, Folder as FolderType } from '../services/documentService';
import { useAuth } from '../contexts/AuthContext';

export default function DocumentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const companyId = user?.role !== 'super_admin' ? user?.company_id : undefined;
      const [docsData, foldersData] = await Promise.all([
        documentService.getAll(undefined, companyId),
        documentService.getFolders()
      ]);
      setDocuments(docsData);
      setFolders(foldersData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert(t('documents.pleaseEnterFolderName'));
      return;
    }

    try {
      const newFolder = await documentService.createFolder({
        name: newFolderName.trim(),
        description: newFolderDescription.trim() || undefined,
        color: newFolderColor
      });
      setFolders([...folders, newFolder]);
      setShowCreateFolder(false);
      setNewFolderName('');
      setNewFolderDescription('');
      setNewFolderColor('#3b82f6');
    } catch (error: any) {
      console.error('Failed to create folder:', error);
      alert(error.response?.data?.message || t('documents.failedToCreateFolder'));
    }
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!confirm(t('documents.confirmDeleteFolder', { name }))) return;
    try {
      await documentService.deleteFolder(id);
      setFolders(folders.filter(f => f.id !== id));
      if (selectedFolderId === id) {
        setSelectedFolderId(null);
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      alert(t('documents.failedToDeleteFolder'));
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const selectedFolder = folders.find(f => f.id === selectedFolderId);
        const newDoc = await documentService.upload(
          e.target.files[0], 
          selectedFolderId, 
          selectedFolder?.name
        );
        setDocuments([newDoc, ...documents]);
      } catch (error) {
        console.error('Failed to upload:', error);
        alert(t('documents.failedToUpload'));
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('documents.confirmDeleteFile'))) return;
    try {
      await documentService.delete(id);
      setDocuments(documents.filter(d => d.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
      alert(t('documents.failedToDeleteFile'));
    }
  };

  const getFolderDescription = (folder: FolderType): string => {
    const translationKey = `documents.${folder.name.toLowerCase()}Desc`;
    const translated = t(translationKey);
    // If translation exists and is different from the key, use it; otherwise use original description
    return translated !== translationKey ? translated : (folder.description || '');
  };

  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const filteredDocs = documents.filter(doc => 
    (selectedFolderId ? doc.folder_id === selectedFolderId : true) &&
    doc.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-heading">{t('documents.title')}</h1>
          <p className="text-muted-foreground">{t('documents.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder={t('documents.searchFiles')} 
              className="pl-9 w-64" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <input 
              type="file" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={handleUpload}
            />
            <Button className="gap-2">
              <Upload size={16} /> {t('documents.upload')}
            </Button>
          </div>
        </div>
      </div>

      {/* Folders */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {folders.map((folder) => (
          <Card 
            key={folder.id} 
            className={`cursor-pointer transition-colors group relative ${selectedFolderId === folder.id ? 'bg-primary/10 border-primary' : 'hover:bg-white/5'}`}
            onClick={() => setSelectedFolderId(selectedFolderId === folder.id ? null : folder.id)}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="relative">
                <Folder 
                  size={48} 
                  className={`transition-colors ${selectedFolderId === folder.id ? 'text-primary' : ''}`}
                  style={{ color: selectedFolderId === folder.id ? undefined : folder.color || '#3b82f6' }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id, folder.name);
                  }}
                  className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-white rounded-full p-1 hover:bg-destructive/80"
                  title={t('documents.deleteFolder')}
                >
                  <X size={12} />
                </button>
              </div>
              <span className="font-medium text-sm">{folder.name}</span>
              {folder.description && (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {getFolderDescription(folder)}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
        
        {/* Add Folder Button */}
        <Card 
          className="cursor-pointer transition-colors hover:bg-white/5 border-dashed"
          onClick={() => setShowCreateFolder(true)}
        >
          <CardContent className="p-4 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <Plus size={24} className="text-muted-foreground" />
            </div>
            <span className="font-medium text-sm text-muted-foreground">{t('documents.addFolder')}</span>
          </CardContent>
        </Card>
      </div>

      {/* Create Folder Modal */}
      <Modal
        isOpen={showCreateFolder}
        onClose={() => {
          setShowCreateFolder(false);
          setNewFolderName('');
          setNewFolderDescription('');
          setNewFolderColor('#3b82f6');
        }}
        title={t('documents.createNewFolder')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('documents.folderName')} *</label>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('documents.folderNamePlaceholder')}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('documents.folderDescription')}</label>
            <Input
              value={newFolderDescription}
              onChange={(e) => setNewFolderDescription(e.target.value)}
              placeholder={t('documents.folderDescriptionPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('documents.folderColor')}</label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={newFolderColor}
                onChange={(e) => setNewFolderColor(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                value={newFolderColor}
                onChange={(e) => setNewFolderColor(e.target.value)}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateFolder(false);
                setNewFolderName('');
                setNewFolderDescription('');
                setNewFolderColor('#3b82f6');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateFolder}>
              {t('documents.createFolder')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Recent Files */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-white/5 border-b border-white/5">
              <tr>
                <th className="px-6 py-3">{t('documents.name')}</th>
                <th className="px-6 py-3">{t('documents.folder')}</th>
                <th className="px-6 py-3">{t('documents.owner')}</th>
                <th className="px-6 py-3">{t('documents.dateModified')}</th>
                <th className="px-6 py-3">{t('documents.size')}</th>
                <th className="px-6 py-3 text-right">{t('documents.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8">{t('documents.loading')}</td></tr>
              ) : filteredDocs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t('documents.noFilesFound')}</td></tr>
              ) : filteredDocs.map((file) => (
                <tr key={file.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 flex items-center gap-3 font-medium">
                    <FileText size={18} className="text-muted-foreground" />
                    {file.name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <span className="px-2 py-1 rounded bg-white/5 text-xs">{file.folder}</span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{file.owner}</td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(file.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-muted-foreground">{file.size}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary">
                        <Download size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:text-destructive"
                        onClick={() => handleDelete(file.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
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
