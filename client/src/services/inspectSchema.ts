import { api } from './api';

export const inspectSchema = async () => {
  try {
    // Fetch one record to see the structure
    const response = await api.get('/employees?limit=1');
    console.log('Table Structure (from first record):', response.data[0]);
    
    // Also try to get the OpenAPI definition if possible, but for now just the record
    return response.data[0];
  } catch (error) {
    console.error('Error inspecting schema:', error);
  }
};
