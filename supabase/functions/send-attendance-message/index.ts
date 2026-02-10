// Supabase Edge Function to send WhatsApp messages when attendance is recorded
// This function is triggered by a database trigger on the attendances table

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AttendanceRecord {
  id: number;
  employee_id: number;
  timestamp: string;
  status1: boolean | null;
  status2: boolean | null;
  sn?: string;
  stamp?: string;
}

interface MessageApiConfig {
  id: string;
  company_id: string;
  api_type: 'single' | 'bulk';
  api_url: string;
  enabled: boolean;
  user_id?: number;
  message_type?: number;
  mode?: number;
  custom_message_template?: string;
  auth_token?: string;
  auth_header?: string;
}

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  alternate_phone?: string;
  company_id: string;
  external_id?: string;
}

interface EmployeeShift {
  id: string;
  employee_id: string;
  day_of_week: number;
  shift_name?: string;
  start_time: string; // Format: "HH:MM:SS" or "HH:MM"
  end_time: string;
  break_duration_minutes: number;
  is_active: boolean;
  effective_from: string;
  effective_to?: string;
}

// Motivational check-in messages (20 messages)
const CHECK_IN_MESSAGES = [
  'صباح الخير {EmployeeName} 👋🏻',
  'أهلًا وسهلًا {EmployeeName} 🌤️',
  'يومك بدأ الآن يا {EmployeeName} ✨',
  'حياك الله {EmployeeName} 🌿',
  'صباح الإنجاز {EmployeeName} 💪',
  'بداية موفقة يا {EmployeeName} 🌞',
  'نتمنى لك يومًا مثمرًا {EmployeeName} 🌱',
  'انطلاقة جديدة اليوم يا {EmployeeName} 🚀',
  'وجودك اليوم محل تقدير {EmployeeName} 🤍',
  'صباح العمل والنشاط {EmployeeName} ☕',
  'يوم جميل نتمناه لك {EmployeeName} 🌼',
  'بالتوفيق في مهامك اليوم {EmployeeName} ✔️',
  'خطوة أولى ليوم ناجح {EmployeeName} ✨',
  'نثق بعطائك اليوم {EmployeeName} 🌟',
  'يومك يستاهل الأفضل {EmployeeName} 🌞',
  'صباح الالتزام والجد {EmployeeName} 📌',
  'انطلق ليومك بثقة {EmployeeName} 💼',
  'سعيدون بوجودك اليوم {EmployeeName} 🌿',
  'يوم جديد وفرصة جديدة {EmployeeName} ✨',
  'صباح التفاؤل والعمل {EmployeeName} 🌤️'
];

// Motivational check-out messages (20 messages)
const CHECK_OUT_MESSAGES = [
  'شكرًا لجهودك اليوم {EmployeeName} 👏',
  'يومك اكتمل يا {EmployeeName} 🌙',
  'تعبك اليوم مقدّر {EmployeeName} 🤍',
  'نهاية موفقة ليومك {EmployeeName} ✨',
  'أحسنت اليوم {EmployeeName} 💪',
  'راحة مستحقة {EmployeeName} 🌿',
  'شكرًا لالتزامك {EmployeeName} ✔️',
  'جهدك محل تقدير {EmployeeName} 🌟',
  'يوم عمل آخر أُنجز {EmployeeName} 📊',
  'مساء هادئ نتمناه لك {EmployeeName} 🌙',
  'إلى لقاء قريب {EmployeeName} 👋🏻',
  'انتهى دوامك اليوم {EmployeeName} ⏰',
  'نعتز بعطائك {EmployeeName} 🤝',
  'ختام جميل ليومك {EmployeeName} ✨',
  'شكرًا لصدق عطائك {EmployeeName} 🌱',
  'تمنياتنا لك بمساء سعيد {EmployeeName} 🌙',
  'أديت ما عليك اليوم {EmployeeName} ✔️',
  'عملك اليوم يُشكر {EmployeeName} 👏',
  'جهد طيب يستحق التقدير {EmployeeName} 🌟',
  'راحة طيبة {EmployeeName} 🤍'
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Log incoming request for debugging
  // Declare requestId outside try block so it's accessible in catch
  let requestId: string;
  try {
    requestId = crypto.randomUUID();
  } catch {
    requestId = `req-${Date.now()}`;
  }
  
  console.log(`[${requestId}] === New request received ===`);
  console.log(`[${requestId}] Method:`, req.method);
  console.log(`[${requestId}] URL:`, req.url);

  try {
    // Get Supabase client with service role
    // Try multiple environment variable names for compatibility
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('sb_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('sb_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseServiceKey
      });
      return new Response(
        JSON.stringify({ 
          error: 'Missing Supabase configuration',
          message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the request body (from database trigger)
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error(`[${requestId}] Error parsing request body:`, parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request body',
          message: parseError instanceof Error ? parseError.message : 'Unknown error'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    const { record, old_record, type } = requestBody;
    console.log(`[${requestId}] Request body parsed:`, { type, hasRecord: !!record });

    if (type !== 'INSERT' || !record) {
      return new Response(
        JSON.stringify({ message: 'Not an insert event or no record' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const attendance: AttendanceRecord = record;
    const attendanceDate = new Date(attendance.timestamp);
    console.log(`[${requestId}] Processing attendance record:`, {
      id: attendance.id,
      employee_id: attendance.employee_id,
      timestamp: attendance.timestamp,
      status1: attendance.status1,
      status2: attendance.status2
    });

    // Convert integer employee_id to string for lookup
    const employeeIdStr = attendance.employee_id.toString();
    console.log('Looking up employee with ID:', employeeIdStr, '(integer:', attendance.employee_id, ')');
    
    // Try multiple lookup strategies:
    // 1. Direct match on employee_id (text field) - exact match
    // 2. Match on external_id (if it exists)
    // 3. Extract number from employee_id text field
    // 4. Try casting employee_id to integer in query
    
    let employees: Employee[] | null = null;
    let empError: any = null;
    
    // Strategy 1: Direct match on employee_id text field (exact string match)
    console.log('Strategy 1: Direct employee_id match');
    let result = await supabase
      .from('employees')
      .select('id, employee_id, first_name, last_name, phone, alternate_phone, company_id, external_id')
      .eq('employee_id', employeeIdStr)
      .limit(1);
    
    employees = result.data as Employee[] | null;
    empError = result.error;
    console.log('Strategy 1 result:', { found: employees?.length || 0, error: empError?.message });
    
    // Strategy 2: If not found, try external_id field
    if ((!employees || employees.length === 0) && !empError) {
      console.log('Strategy 2: Trying external_id lookup for:', employeeIdStr);
      result = await supabase
        .from('employees')
        .select('id, employee_id, first_name, last_name, phone, alternate_phone, company_id, external_id')
        .eq('external_id', employeeIdStr)
        .limit(1);
      
      employees = result.data as Employee[] | null;
      empError = result.error;
      console.log('Strategy 2 result:', { found: employees?.length || 0, error: empError?.message });
    }
    
    // Strategy 3: Try casting to integer in PostgreSQL (if employee_id can be cast to integer)
    if ((!employees || employees.length === 0) && !empError) {
      console.log('Strategy 3: Trying integer cast match');
      // Use RPC or raw query to cast employee_id to integer
      // Since Supabase client doesn't support casting directly, we'll use a different approach
      // Get all employees and filter by casting employee_id to integer
      result = await supabase
        .from('employees')
        .select('id, employee_id, first_name, last_name, phone, alternate_phone, company_id, external_id')
        .limit(1000);
      
      if (result.data && !result.error) {
        const matched = (result.data as Employee[]).find(emp => {
          const empId = emp.employee_id || '';
          // Try direct integer comparison
          if (!isNaN(Number(empId))) {
            return Number(empId) === attendance.employee_id;
          }
          return false;
        });
        
        if (matched) {
          employees = [matched];
          console.log('Strategy 3: Found employee via integer cast');
        }
      }
    }
    
    // Strategy 4: Try to find by extracting number from employee_id text (pattern matching)
    if ((!employees || employees.length === 0) && !empError) {
      console.log('Strategy 4: Trying pattern match on employee_id');
      if (!result.data) {
        result = await supabase
          .from('employees')
          .select('id, employee_id, first_name, last_name, phone, alternate_phone, company_id, external_id')
          .limit(1000); // Reasonable limit
      }
      
      if (result.data) {
        const matched = (result.data as Employee[]).find(emp => {
          const empId = emp.employee_id || '';
          // Extract number from employee_id text (e.g., "EMP-1222" -> 1222)
          const match = empId.match(/\d+/);
          if (match) {
            return parseInt(match[0], 10) === attendance.employee_id;
          }
          return false;
        });
        
        if (matched) {
          employees = [matched];
          console.log('Strategy 4: Found employee via pattern match');
        }
      }
    }

    if (empError) {
      console.error('Error fetching employee:', empError);
      return new Response(
        JSON.stringify({ 
          message: 'Error fetching employee', 
          error: empError?.message || 'Unknown error',
          details: empError
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    if (!employees || employees.length === 0) {
      console.error('Employee not found for employee_id:', attendance.employee_id);
      
      // Debug: Get a sample of employees to see what employee_id values look like
      const sampleEmployees = await supabase
        .from('employees')
        .select('id, employee_id, external_id, first_name, last_name')
        .limit(10);
      
      console.log('Sample employees in database:', sampleEmployees.data?.map(emp => ({
        id: emp.id,
        employee_id: emp.employee_id,
        external_id: (emp as any).external_id,
        name: `${(emp as any).first_name} ${(emp as any).last_name}`
      })));
      
      return new Response(
        JSON.stringify({ 
          message: 'Employee not found', 
          employee_id: attendance.employee_id,
          searched_as: employeeIdStr,
          debug: {
            sample_employees: sampleEmployees.data?.slice(0, 5).map(emp => ({
              employee_id: emp.employee_id,
              external_id: (emp as any).external_id
            }))
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    console.log(`[${requestId}] Found employee:`, {
      id: employees[0].id,
      employee_id: employees[0].employee_id,
      external_id: employees[0].external_id,
      name: `${employees[0].first_name} ${employees[0].last_name}`,
      company_id: employees[0].company_id,
      phone: employees[0].phone,
      alternate_phone: employees[0].alternate_phone
    });

    const employee: Employee = employees[0];

    if (!employee.company_id) {
      console.log(`[${requestId}] Employee has no company_id`);
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Employee has no company_id',
          employee_id: employee.id,
          employee_name: `${employee.first_name} ${employee.last_name}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get employee shifts for the day of the attendance
    const dayOfWeek = attendanceDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    console.log(`[${requestId}] Fetching shifts for day of week:`, dayOfWeek);
    
    const { data: shifts, error: shiftsError } = await supabase
      .from('employee_shifts')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .lte('effective_from', attendanceDate.toISOString().split('T')[0])
      .or(`effective_to.is.null,effective_to.gte.${attendanceDate.toISOString().split('T')[0]}`)
      .order('start_time', { ascending: true });

    if (shiftsError) {
      console.error(`[${requestId}] Error fetching shifts:`, shiftsError);
    }

    console.log(`[${requestId}] Found ${shifts?.length || 0} shifts for day ${dayOfWeek}`);

    // Determine if this is a check-in or check-out based on shift schedule
    let attendanceType: 'check_in' | 'check_out' | null = null;
    
    if (shifts && shifts.length > 0) {
      // Get the attendance time in minutes since midnight
      const attendanceHour = attendanceDate.getHours();
      const attendanceMinute = attendanceDate.getMinutes();
      const attendanceTimeMinutes = attendanceHour * 60 + attendanceMinute;
      
      // Find the closest shift to the attendance time
      let closestShift: EmployeeShift | null = null;
      let minTimeDiff = Infinity;
      
      for (const shift of shifts) {
        // Parse shift start and end times
        const startParts = shift.start_time.split(':').map(Number);
        const endParts = shift.end_time.split(':').map(Number);
        const startTimeMinutes = startParts[0] * 60 + startParts[1];
        const endTimeMinutes = endParts[0] * 60 + endParts[1];
        
        // Calculate time difference from shift start and end
        const diffFromStart = Math.abs(attendanceTimeMinutes - startTimeMinutes);
        const diffFromEnd = Math.abs(attendanceTimeMinutes - endTimeMinutes);
        const minDiff = Math.min(diffFromStart, diffFromEnd);
        
        // If attendance is within 2 hours of shift start or end, consider it
        if (minDiff < minTimeDiff && minDiff <= 120) { // 2 hours tolerance
          minTimeDiff = minDiff;
          closestShift = shift;
          
          // Determine if closer to start (check-in) or end (check-out)
          if (diffFromStart < diffFromEnd) {
            attendanceType = 'check_in';
          } else {
            attendanceType = 'check_out';
          }
        }
      }
      
      console.log(`[${requestId}] Determined attendance type from shifts:`, {
        attendanceType,
        closestShift: closestShift ? {
          shift_name: closestShift.shift_name,
          start_time: closestShift.start_time,
          end_time: closestShift.end_time
        } : null,
        timeDiff: minTimeDiff !== Infinity ? `${minTimeDiff} minutes` : 'N/A'
      });
    }
    
    // Fallback: Use status1/status2 if shift-based detection failed
    if (!attendanceType) {
      console.log(`[${requestId}] No shift match found, using status1/status2 fallback`);
      if (attendance.status1 === true && attendance.status2 !== true) {
        attendanceType = 'check_in';
      } else if (attendance.status2 === true && attendance.status1 !== true) {
        attendanceType = 'check_out';
      } else if (attendance.status1 === true && attendance.status2 === true) {
        // Both true - infer based on time of day
        const hour = attendanceDate.getHours();
        attendanceType = hour < 14 ? 'check_in' : 'check_out';
      }
    }

    if (!attendanceType) {
      console.log(`[${requestId}] Could not determine attendance type`);
      return new Response(
        JSON.stringify({ message: 'Could not determine attendance type' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    console.log(`[${requestId}] Final attendance type:`, attendanceType);

    console.log(`[${requestId}] Checking message API config for company:`, employee.company_id);
    
    // Get message API configuration
    const { data: configs, error: configError } = await supabase
      .from('message_api_configs')
      .select('*')
      .eq('company_id', employee.company_id)
      .eq('enabled', true)
      .limit(1);

    if (configError) {
      console.error(`[${requestId}] Error fetching message API config:`, configError);
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Error fetching message API config',
          error: configError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (!configs || configs.length === 0) {
      console.log(`[${requestId}] Message API not configured for company:`, employee.company_id);
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Message API not configured',
          company_id: employee.company_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const config: MessageApiConfig = configs[0];
    console.log(`[${requestId}] Message API config found:`, {
      api_type: config.api_type,
      api_url: config.api_url,
      enabled: config.enabled,
      has_auth: !!(config.auth_token && config.auth_header)
    });

    // Get phone number
    const phoneNumber = employee.phone || employee.alternate_phone;
    if (!phoneNumber) {
      console.log(`[${requestId}] Employee has no phone number:`, {
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        employee_employee_id: employee.employee_id
      });
      // Return success (200) so webhook doesn't retry - this is not an error condition
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Employee has no phone number',
          employee_id: employee.id,
          employee_name: `${employee.first_name} ${employee.last_name}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[${requestId}] Phone number found:`, phoneNumber);

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Format timestamp - use manual formatting to avoid HTML entities
    const day = attendanceDate.getUTCDate();
    const month = attendanceDate.getUTCMonth() + 1;
    const year = attendanceDate.getUTCFullYear();
    const hours = attendanceDate.getUTCHours();
    const minutes = attendanceDate.getUTCMinutes();
    
    // Format date in Arabic format (DD/MM/YYYY) without HTML entities
    const dateStr = `${day}/${month}/${year}`;
    
    // Format time in 12-hour format with AM/PM in Arabic
    const hour12 = hours % 12 || 12;
    const ampm = hours < 12 ? 'ص' : 'م';
    const timeStr = `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;

    // Build message (using actual newlines, not \n)
    let message = '';
    if (attendanceType === 'check_in') {
      message = `تم تسجيل الحضور بنجاح ✅
📅 التاريخ: ${dateStr}
🕐 الوقت: ${timeStr}

شكراً لالتزامك بالمواعيد.`;
    } else {
      message = `تم تسجيل الانصراف بنجاح ✅
📅 التاريخ: ${dateStr}
🕐 الوقت: ${timeStr}

شكراً لجهودك اليوم.`;
    }

    // Send message based on API type
    console.log(`[${requestId}] Sending message via ${config.api_type} API to:`, config.api_url);
    let success = false;
    let apiResponse: Response | null = null;
    let apiError: any = null;
    let responseBody: string = '';
    
    try {
      if (config.api_type === 'single') {
        // Single message API
        const payload = {
          message: message,
          userId: config.user_id || 0,
          type: config.message_type || 0,
          fileurl: '',
          numbers: cleanPhone
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (config.auth_token && config.auth_header) {
          headers[config.auth_header] = config.auth_token;
        }

        console.log(`[${requestId}] Single API payload:`, { ...payload, message: message.substring(0, 50) + '...' });
        console.log(`[${requestId}] Single API headers:`, Object.keys(headers));

        apiResponse = await fetch(config.api_url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        success = apiResponse.ok;
        responseBody = await apiResponse.text();
        console.log(`[${requestId}] Single API response:`, {
          status: apiResponse.status,
          statusText: apiResponse.statusText,
          ok: apiResponse.ok,
          body: responseBody.substring(0, 500)
        });
      } else {
        // Bulk message API
        const formData = new FormData();
        formData.append('Mode', String(config.mode || 2));
        formData.append('CustomMessage', message);
        formData.append('MessageType', String(config.message_type || 1));
        formData.append('Users[0].Name', `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_id);
        formData.append('Users[0].Number', cleanPhone);

        const headers: Record<string, string> = {};

        if (config.auth_token && config.auth_header) {
          headers[config.auth_header] = config.auth_token;
        }

        console.log(`[${requestId}] Bulk API form data:`, {
          Mode: config.mode || 2,
          MessageType: config.message_type || 1,
          Name: `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_id,
          Number: cleanPhone,
          MessageLength: message.length
        });
        console.log(`[${requestId}] Bulk API headers:`, Object.keys(headers));

        apiResponse = await fetch(config.api_url, {
          method: 'POST',
          headers,
          body: formData
        });

        success = apiResponse.ok;
        responseBody = await apiResponse.text();
        console.log(`[${requestId}] Bulk API response:`, {
          status: apiResponse.status,
          statusText: apiResponse.statusText,
          ok: apiResponse.ok,
          body: responseBody.substring(0, 500)
        });
      }
    } catch (fetchError) {
      apiError = fetchError;
      console.error(`[${requestId}] Error sending message to API:`, fetchError);
      success = false;
    }

    const responseData = {
      success,
      message: success ? 'Message sent successfully' : 'Failed to send message',
      attendanceType,
      employeeId: employee.id,
      employeeName: `${employee.first_name} ${employee.last_name}`,
      phone: cleanPhone,
      apiResponse: apiResponse ? {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        body: responseBody.substring(0, 200)
      } : null,
      apiError: apiError ? (apiError instanceof Error ? apiError.message : String(apiError)) : null
    };

    console.log(`[${requestId}] Final response:`, responseData);

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Always return 200 so webhook doesn't retry
      }
    );
  } catch (error) {
    console.error(`[${requestId}] CRITICAL ERROR in send-attendance-message function:`, error);
    console.error(`[${requestId}] Error details:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    
    // Always return 200 to prevent webhook retries on unexpected errors
    // Log the error but don't crash the function
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Function encountered an error but completed processing'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 so webhook doesn't retry
      }
    );
  }
});

