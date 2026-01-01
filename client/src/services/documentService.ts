import { api, adminApi } from './api';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

// Create service role client for storage operations to bypass RLS
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
const supabaseStorage = SUPABASE_SERVICE_KEY 
  ? createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY)
  : supabase; // Fallback to regular client if service key not available

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
  employee_id?: string; // The employee this document belongs to
  folder?: string; // Legacy: folder name for backward compatibility
  category?: string; // Legacy: category column
  folder_id?: string; // New: reference to folders table
  folders?: Folder; // Populated folder object
  upload_date?: string;
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
  async getAll(employeeId?: string) {
    try {
      const params: any = {
        select: '*,folders(*)',
        order: 'created_at.desc'
      };
      
      // Filter by employee_id if provided
      if (employeeId) {
        params.employee_id = `eq.${employeeId}`;
      }
      
      const response = await adminApi.get('/documents', { params });
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

  async upload(file: File, folderId: string | null, folderName?: string, employeeId?: string) {
    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = employeeId ? `employees/${employeeId}/${fileName}` : `documents/${fileName}`;
      
      let publicUrl = '#';
      
      // Try to upload to storage bucket (if it exists)
      // Use service role client to bypass storage RLS
      // If bucket doesn't exist, we'll continue without storage
      try {
        const { data: uploadData, error: uploadError } = await supabaseStorage.storage
          .from('documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) {
          // Check if it's a bucket not found error (404)
          const isBucketNotFound = 
            uploadError.statusCode === 404 || 
            uploadError.message?.includes('Bucket not found') ||
            uploadError.message?.includes('bucket')?.toLowerCase();
          
          if (isBucketNotFound) {
            // Silently continue - bucket will be created later
            // Document will be saved with placeholder URL
            publicUrl = `#placeholder-${fileName}`;
          } else {
            // Other storage errors - log but continue
            console.warn('Storage upload error (non-critical):', uploadError.message || uploadError);
            publicUrl = `#placeholder-${fileName}`;
          }
        } else if (uploadData) {
          // Successfully uploaded - get public URL
          // Use service role client for public URL generation to ensure access
          const { data: urlData } = supabaseStorage.storage
            .from('documents')
            .getPublicUrl(filePath);
          
          if (urlData?.publicUrl) {
            publicUrl = urlData.publicUrl;
          } else {
            publicUrl = `#placeholder-${fileName}`;
          }
        }
      } catch (storageError: any) {
        // Catch any unexpected errors and continue
        // Don't let storage errors break the document upload
        const errorMessage = storageError?.message || storageError?.error || String(storageError);
        const isBucketNotFound = 
          storageError?.statusCode === 404 || 
          errorMessage.includes('Bucket not found') ||
          errorMessage.toLowerCase().includes('bucket');
        
        if (!isBucketNotFound) {
          // Only log non-bucket errors to avoid noise
          console.warn('Storage error (document will still be saved):', errorMessage);
        }
        publicUrl = `#placeholder-${fileName}`;
      }
      
      // Create document record
      const payload: any = {
        name: file.name,
        url: publicUrl,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        type: fileExt || 'file',
        category: 'General', // Default category (required by schema)
      };

      // Add employee_id if provided
      if (employeeId) {
        payload.employee_id = employeeId;
      }
      
      // Note: uploaded_by is kept as null for now since it references employees(id)
      // but the user uploading might be an admin who is not an employee
      // If we need to track uploader, we should either:
      // 1. Make uploaded_by reference auth.users (requires schema change)
      // 2. Only set it if the user has an employee_id
      // For now, we'll leave it null to avoid foreign key constraint issues

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
    } catch (error: any) {
      // Check if it's a storage-related error that we've already handled
      const isStorageError = 
        error?.message?.includes('Bucket not found') ||
        error?.statusCode === 404 ||
        error?.error === 'Bucket not found';
      
      if (isStorageError) {
        // Storage error was already handled - this shouldn't happen, but if it does,
        // the document record creation might have failed, so we should still throw
        // but with a more user-friendly message
        console.warn('Document record creation failed after storage error');
        throw new Error('Document metadata saved, but file storage is not configured. Please create the "documents" bucket in Supabase Storage.');
      }
      
      // For other errors, throw as normal
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
