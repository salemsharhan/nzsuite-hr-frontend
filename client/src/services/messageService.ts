// Message service for sending WhatsApp messages via external APIs
import { adminApi } from './api';
import { employeeService, Employee } from './employeeService';

export interface MessageApiConfig {
  id?: string;
  company_id: string;
  api_type: 'single' | 'bulk'; // 'single' for SendMessage, 'bulk' for SendBulkMessages
  api_url: string;
  enabled: boolean;
  // For single message API
  user_id?: number;
  message_type?: number;
  // For bulk message API
  mode?: number;
  custom_message_template?: string;
  // Common fields
  auth_token?: string;
  auth_header?: string; // Header name for auth (e.g., 'Authorization', 'X-API-Key')
  created_at?: string;
  updated_at?: string;
}

export interface SendMessagePayload {
  employee: Employee;
  message: string;
  type?: 'check_in' | 'check_out';
  timestamp?: string;
}

export interface SingleMessagePayload {
  message: string;
  type: number;
  fileurl: string;
  numbers: string; // Phone number
}

export interface BulkMessagePayload {
  Mode: number;
  CustomMessage: string;
  Users: Array<{
    Name: string;
    Number: string;
  }>;
  MessageType: number;
}

export const messageService = {
  /**
   * Get message API configuration for a company
   */
  async getConfig(companyId: string): Promise<MessageApiConfig | null> {
    try {
      const response = await adminApi.get(`/message_api_configs?company_id=eq.${companyId}&enabled=eq.true&limit=1`);
      if (response.data && response.data.length > 0) {
        return response.data[0] as MessageApiConfig;
      }
      return null;
    } catch (error) {
      console.error('Error fetching message API config:', error);
      return null;
    }
  },

  /**
   * Save or update message API configuration
   */
  async saveConfig(config: MessageApiConfig): Promise<MessageApiConfig> {
    try {
      if (config.id) {
        // Update existing config
        const response = await adminApi.patch(`/message_api_configs?id=eq.${config.id}`, {
          ...config,
          updated_at: new Date().toISOString()
        }, {
          headers: {
            'Prefer': 'return=representation'
          }
        });
        return response.data && response.data.length > 0 ? response.data[0] : response.data;
      } else {
        // Create new config
        const response = await adminApi.post('/message_api_configs', {
          ...config,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          headers: {
            'Prefer': 'return=representation'
          }
        });
        return response.data && response.data.length > 0 ? response.data[0] : response.data;
      }
    } catch (error) {
      console.error('Error saving message API config:', error);
      throw error;
    }
  },

  /**
   * Send a single message using the single message API
   */
  async sendSingleMessage(config: MessageApiConfig, payload: SendMessagePayload): Promise<boolean> {
    try {
      const phoneNumber = payload.employee.phone || payload.employee.alternate_phone;
      if (!phoneNumber) {
        console.warn('Employee has no phone number:', payload.employee.id);
        return false;
      }

      // Clean phone number (remove spaces, dashes, etc.)
      const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');

      const apiPayload: SingleMessagePayload = {
        message: payload.message,
        type: config.message_type || 0,
        fileurl: '',
        numbers: cleanPhone
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add auth header if configured
      if (config.auth_token && config.auth_header) {
        headers[config.auth_header] = config.auth_token;
      }

      const response = await fetch(config.api_url, {
        method: 'POST',
        headers,
        body: JSON.stringify(apiPayload)
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Error sending single message:', error);
      return false;
    }
  },

  /**
   * Send bulk messages using the bulk message API
   */
  async sendBulkMessages(config: MessageApiConfig, payloads: SendMessagePayload[]): Promise<boolean> {
    try {
      // Filter employees with phone numbers
      const validPayloads = payloads.filter(p => p.employee.phone || p.employee.alternate_phone);
      
      if (validPayloads.length === 0) {
        console.warn('No employees with phone numbers to send messages to');
        return false;
      }

      // Build form data
      const formData = new FormData();
      formData.append('Mode', String(config.mode || 2));
      formData.append('CustomMessage', config.custom_message_template || '');
      formData.append('MessageType', String(config.message_type || 1));

      // Add users
      validPayloads.forEach((payload, index) => {
        const phoneNumber = payload.employee.phone || payload.employee.alternate_phone;
        if (phoneNumber) {
          const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
          const employeeName = `${payload.employee.firstName || ''} ${payload.employee.lastName || ''}`.trim() || payload.employee.employeeId;
          
          formData.append(`Users[${index}].Name`, employeeName);
          formData.append(`Users[${index}].Number`, cleanPhone);
        }
      });

      const headers: Record<string, string> = {};

      // Add auth header if configured
      if (config.auth_token && config.auth_header) {
        headers[config.auth_header] = config.auth_token;
      }

      const response = await fetch(config.api_url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Error sending bulk messages:', error);
      return false;
    }
  },

  /**
   * Send attendance notification message to employee
   */
  async sendAttendanceMessage(
    companyId: string,
    employeeId: string,
    type: 'check_in' | 'check_out',
    timestamp: string
  ): Promise<boolean> {
    try {
      // Get message API config
      const config = await this.getConfig(companyId);
      if (!config || !config.enabled) {
        console.log('Message API not configured or disabled for company:', companyId);
        return false;
      }

      // Get employee details
      const employees = await employeeService.getAll(companyId);
      const employee = employees.find(emp => emp.id === employeeId);
      
      if (!employee) {
        console.warn('Employee not found:', employeeId);
        return false;
      }

      // Format timestamp - use manual formatting to avoid HTML entities
      // Add 3 hours for Kuwait timezone (UTC+3)
      const date = new Date(timestamp);
      // Add 3 hours (3 * 60 * 60 * 1000 milliseconds)
      const kuwaitDate = new Date(date.getTime() + (3 * 60 * 60 * 1000));
      
      const day = kuwaitDate.getUTCDate();
      const month = kuwaitDate.getUTCMonth() + 1;
      const year = kuwaitDate.getUTCFullYear();
      const hours = kuwaitDate.getUTCHours();
      const minutes = kuwaitDate.getUTCMinutes();
      
      // Format date in Arabic format (DD/MM/YYYY) without HTML entities
      const dateStr = `${day}/${month}/${year}`;
      
      // Format time in 12-hour format with AM/PM in Arabic
      const hour12 = hours % 12 || 12;
      const ampm = hours < 12 ? 'ص' : 'م';
      const timeStr = `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;

      // Build message based on type (using actual newlines, not \n)
      let message = '';
      if (type === 'check_in') {
        message = `تم2332 تسجيل الحضور بنجاح ✅
📅 التاريخ: ${dateStr}
🕐 الوقت: ${timeStr}

شكراً لالتزامك بالمواعيد.`;
      } else {
        message = `تم تسجيل 3232الانصراف بنجاح ✅
📅 التاريخ: ${dateStr}
🕐 الوقت: ${timeStr}

شكراً لجهودك اليوم.`;
      }

      const payload: SendMessagePayload = {
        employee,
        message,
        type,
        timestamp
      };

      // Send message based on API type
      if (config.api_type === 'single') {
        return await this.sendSingleMessage(config, payload);
      } else {
        // For bulk API, send as single message in array
        return await this.sendBulkMessages(config, [payload]);
      }
    } catch (error) {
      console.error('Error sending attendance message:', error);
      return false;
    }
  },

  /**
   * Send attendance notification messages to multiple employees (for bulk attendance recording)
   */
  async sendBulkAttendanceMessages(
    companyId: string,
    employeeIds: string[],
    type: 'check_in' | 'check_out',
    timestamp: string
  ): Promise<boolean> {
    try {
      // Get message API config
      const config = await this.getConfig(companyId);
      if (!config || !config.enabled) {
        console.log('Message API not configured or disabled for company:', companyId);
        return false;
      }

      // Get employee details
      const employees = await employeeService.getAll(companyId);
      const relevantEmployees = employees.filter(emp => employeeIds.includes(emp.id));
      
      if (relevantEmployees.length === 0) {
        console.warn('No employees found for bulk message');
        return false;
      }

      // Format timestamp - use manual formatting to avoid HTML entities
      // Add 3 hours for Kuwait timezone (UTC+3)
      const date = new Date(timestamp);
      // Add 3 hours (3 * 60 * 60 * 1000 milliseconds)
      const kuwaitDate = new Date(date.getTime() + (3 * 60 * 60 * 1000));
      
      const day = kuwaitDate.getUTCDate();
      const month = kuwaitDate.getUTCMonth() + 1;
      const year = kuwaitDate.getUTCFullYear();
      const hours = kuwaitDate.getUTCHours();
      const minutes = kuwaitDate.getUTCMinutes();
      
      // Format date in Arabic format (DD/MM/YYYY) without HTML entities
      const dateStr = `${day}/${month}/${year}`;
      
      // Format time in 12-hour format with AM/PM in Arabic
      const hour12 = hours % 12 || 12;
      const ampm = hours < 12 ? 'ص' : 'م';
      const timeStr = `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;

      // Build message based on type (using actual newlines, not \n)
      let messageTemplate = '';
      if (type === 'check_in') {
        messageTemplate = `تم2332 تسجيل الحضور بنجاح ✅
📅 التاريخ: ${dateStr}
🕐 الوقت: ${timeStr}

شكراً لالتزامك بالمواعيد.`;
      } else {
        messageTemplate = `تم تسجيل33223 الانصراف بنجاح ✅
📅 التاريخ: ${dateStr}
🕐 الوقت: ${timeStr}

شكراً لجهودك اليوم.`;
      }

      // Create payloads for each employee
      const payloads: SendMessagePayload[] = relevantEmployees.map(employee => ({
        employee,
        message: messageTemplate,
        type,
        timestamp
      }));

      // Send messages based on API type
      if (config.api_type === 'single') {
        // Send individually for single API
        const results = await Promise.all(
          payloads.map(payload => this.sendSingleMessage(config, payload))
        );
        return results.every(r => r === true);
      } else {
        // Send as bulk for bulk API
        return await this.sendBulkMessages(config, payloads);
      }
    } catch (error) {
      console.error('Error sending bulk attendance messages:', error);
      return false;
    }
  }
};

