import { api, adminApi } from './api';

export interface Folder {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface Document {
  id: string;
  name: string;
  url: string;
  size: string;
  type: string;
  owner?: string;
  uploaded_by?: string;
  folder?: string; // Legacy: folder name for backward compatibility
  category?: string; // Legacy: category column
  folder_id?: string; // New: reference to folders table
  folders?: Folder; // Populated folder object
  created_at: string;
}

export const documentService = {
  // Folder operations
  async getFolders(): Promise<Folder[]> {
    try {
      const response = await api.get('/folders?select=*&order=name.asc');
      return response.data || [];
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return [];
      }
      console.error('Error fetching folders:', error);
      return [];
    }
  },

  async createFolder(folder: Omit<Folder, 'id' | 'created_at' | 'updated_at'>): Promise<Folder> {
    try {
      const response = await adminApi.post('/folders', folder, {
        headers: {
          'Prefer': 'return=representation'
        }
      });
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  },

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder> {
    try {
      const response = await adminApi.patch(`/folders?id=eq.${id}`, updates, {
        headers: {
          'Prefer': 'return=representation'
        }
      });
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error updating folder:', error);
      throw error;
    }
  },

  async deleteFolder(id: string): Promise<boolean> {
    try {
      await adminApi.delete(`/folders`, {
        params: {
          id: `eq.${id}`
        }
      });
      return true;
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  },

  // Document operations
  async getAll() {
    try {
      const response = await api.get('/documents?select=*,folders(*)&order=created_at.desc');
      // Map database columns to interface
      const documents = (response.data || []).map((doc: any) => ({
        ...doc,
        folder: doc.folders?.name || doc.folder || doc.category, // Use folder name from relation
        folder_id: doc.folder_id || doc.folders?.id
      }));
      return documents as Document[];
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return [];
      }
      console.error('Error fetching documents:', error);
      return [];
    }
  },

  async upload(file: File, folderId: string | null, folderName?: string) {
    try {
      // In a real app, this would upload to Supabase Storage first, then create a record
      // For now, we'll just create the record assuming the file is handled
      const payload: any = {
        name: file.name,
        url: '#', // Placeholder until storage is implemented
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        type: file.name.split('.').pop() || 'file',
        category: 'General', // Default category (required by schema)
      };

      // Use folder_id if provided
      if (folderId) {
        payload.folder_id = folderId;
        // Also set category to folder name for backward compatibility
        if (folderName) {
          payload.category = folderName;
        }
      } else if (folderName) {
        // Legacy support: use folder name as category
        payload.category = folderName;
        payload.folder = folderName; // Legacy support
      }
      
      const response = await adminApi.post('/documents', payload, {
        headers: {
          'Prefer': 'return=representation'
        }
      });
      if (response.data && response.data.length > 0) {
        const doc = response.data[0];
        return {
          ...doc,
          folder: folderName || doc.folders?.name || doc.folder || doc.category || 'General'
        };
      }
      return response.data;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },

  async delete(id: string) {
    try {
      await adminApi.delete(`/documents`, {
        params: {
          id: `eq.${id}`
        }
      });
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
};
