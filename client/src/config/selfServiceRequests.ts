import { FieldConfig } from '../components/common/DynamicForm';
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  FileText, 
  GraduationCap, 
  Laptop, 
  Shield,
  Briefcase
} from 'lucide-react';

export interface RequestCategory {
  id: string;
  title: string;
  description: string;
  icon: any;
  requestTypes: RequestType[];
}

export interface RequestType {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  fields: FieldConfig[];
  workflowRoute: string[];
}

// Define all 14 request types with their field configurations
export const REQUEST_CATEGORIES: RequestCategory[] = [
  {
    id: 'attendance-leaves',
    title: 'Attendance & Leaves',
    description: 'Manage your attendance and leave requests',
    icon: Calendar,
    requestTypes: [
      {
        id: 'leave-request',
        title: 'Leave Request',
        description: 'Request time off',
        categoryId: 'attendance-leaves',
        workflowRoute: ['Manager', 'HR'],
        fields: [
          {
            key: 'leaveType',
            label: 'Leave Type',
            type: 'select',
            required: true,
            options: [
              { label: 'Annual Leave', value: 'annual' },
              { label: 'Sick Leave', value: 'sick' },
              { label: 'Emergency Leave', value: 'emergency' },
              { label: 'Unpaid Leave', value: 'unpaid' }
            ]
          },
          {
            key: 'fromDate',
            label: 'From Date',
            type: 'date',
            required: true
          },
          {
            key: 'toDate',
            label: 'To Date',
            type: 'date',
            required: true
          },
          {
            key: 'reason',
            label: 'Reason',
            type: 'textarea',
            placeholder: 'Please provide a reason for your leave request'
          },
          {
            key: 'attachment',
            label: 'Medical Certificate',
            type: 'file',
            conditionalRequired: (formData) => formData.leaveType === 'sick',
            dependsOn: { field: 'leaveType', value: 'sick' },
            fileConfig: {
              allowedTypes: ['.pdf', '.jpg', '.png'],
              maxSize: 5
            }
          }
        ]
      },
      {
        id: 'permission-early-leave',
        title: 'Permission / Early Leave',
        description: 'Request permission to leave early',
        categoryId: 'attendance-leaves',
        workflowRoute: ['Manager'],
        fields: [
          {
            key: 'date',
            label: 'Date',
            type: 'date',
            required: true
          },
          {
            key: 'fromTime',
            label: 'From Time',
            type: 'time',
            required: true
          },
          {
            key: 'toTime',
            label: 'To Time',
            type: 'time',
            required: true
          },
          {
            key: 'reason',
            label: 'Reason',
            type: 'textarea',
            required: true,
            placeholder: 'Please provide a reason for your permission request'
          }
        ]
      },
      {
        id: 'attendance-correction',
        title: 'Attendance Correction',
        description: 'Request correction for missed attendance',
        categoryId: 'attendance-leaves',
        workflowRoute: ['Manager', 'HR'],
        fields: [
          {
            key: 'date',
            label: 'Date',
            type: 'date',
            required: true
          },
          {
            key: 'correctionType',
            label: 'Correction Type',
            type: 'select',
            required: true,
            options: [
              { label: 'Missed Check-In', value: 'missed-in' },
              { label: 'Missed Check-Out', value: 'missed-out' },
              { label: 'Both', value: 'both' }
            ]
          },
          {
            key: 'correctInTime',
            label: 'Correct Check-In Time',
            type: 'time',
            dependsOn: { field: 'correctionType', value: 'missed-in' }
          },
          {
            key: 'correctOutTime',
            label: 'Correct Check-Out Time',
            type: 'time',
            dependsOn: { field: 'correctionType', value: 'missed-out' }
          },
          {
            key: 'reason',
            label: 'Reason',
            type: 'textarea',
            required: true,
            placeholder: 'Explain why you missed the attendance'
          }
        ]
      }
    ]
  },
  {
    id: 'payroll-finance',
    title: 'Payroll & Finance',
    description: 'Manage payroll and financial requests',
    icon: DollarSign,
    requestTypes: [
      {
        id: 'payslip-inquiry',
        title: 'Payslip Inquiry / Payroll Issue',
        description: 'Report payroll issues',
        categoryId: 'payroll-finance',
        workflowRoute: ['Finance', 'HR'],
        fields: [
          {
            key: 'month',
            label: 'Month',
            type: 'date',
            required: true
          },
          {
            key: 'issueType',
            label: 'Issue Type',
            type: 'select',
            required: true,
            options: [
              { label: 'Missing Payslip', value: 'missing' },
              { label: 'Wrong Deduction', value: 'wrong-deduction' },
              { label: 'Other', value: 'other' }
            ]
          },
          {
            key: 'description',
            label: 'Description',
            type: 'textarea',
            required: true,
            placeholder: 'Describe the issue in detail'
          },
          {
            key: 'attachment',
            label: 'Supporting Document',
            type: 'file',
            fileConfig: {
              allowedTypes: ['.pdf', '.jpg', '.png'],
              maxSize: 5
            }
          }
        ]
      },
      {
        id: 'advance-loan',
        title: 'Advance / Loan',
        description: 'Request salary advance or loan',
        categoryId: 'payroll-finance',
        workflowRoute: ['Finance', 'HR'],
        fields: [
          {
            key: 'amount',
            label: 'Amount',
            type: 'number',
            required: true,
            validation: { min: 100 }
          },
          {
            key: 'reason',
            label: 'Reason',
            type: 'textarea',
            required: true,
            placeholder: 'Explain why you need this advance/loan'
          },
          {
            key: 'installments',
            label: 'Number of Installments',
            type: 'number',
            required: true,
            validation: { min: 1, max: 12 }
          },
          {
            key: 'startDeductionDate',
            label: 'Start Deduction Date',
            type: 'date',
            required: true
          },
          {
            key: 'agreement',
            label: 'I agree to the terms and conditions',
            type: 'checkbox',
            required: true,
            placeholder: 'I agree to the deduction terms and repayment schedule'
          }
        ]
      },
      {
        id: 'expense-reimbursement',
        title: 'Expense Reimbursement',
        description: 'Request reimbursement for expenses',
        categoryId: 'payroll-finance',
        workflowRoute: ['Manager', 'Finance'],
        fields: [
          {
            key: 'expenseType',
            label: 'Expense Type',
            type: 'select',
            required: true,
            options: [
              { label: 'Travel', value: 'travel' },
              { label: 'Meals', value: 'meals' },
              { label: 'Accommodation', value: 'accommodation' },
              { label: 'Other', value: 'other' }
            ]
          },
          {
            key: 'date',
            label: 'Expense Date',
            type: 'date',
            required: true
          },
          {
            key: 'amount',
            label: 'Amount',
            type: 'number',
            required: true,
            validation: { min: 1 }
          },
          {
            key: 'paymentMethod',
            label: 'Payment Method',
            type: 'select',
            required: true,
            options: [
              { label: 'Bank Transfer', value: 'bank' },
              { label: 'Cash', value: 'cash' },
              { label: 'Cheque', value: 'cheque' }
            ]
          },
          {
            key: 'invoice',
            label: 'Invoice/Receipt',
            type: 'file',
            required: true,
            fileConfig: {
              allowedTypes: ['.pdf', '.jpg', '.png'],
              maxSize: 5
            }
          }
        ]
      }
    ]
  },
  {
    id: 'administrative',
    title: 'Administrative',
    description: 'Update personal information',
    icon: FileText,
    requestTypes: [
      {
        id: 'update-personal-data',
        title: 'Update Personal Data',
        description: 'Update your personal information',
        categoryId: 'administrative',
        workflowRoute: ['HR'],
        fields: [
          {
            key: 'fieldType',
            label: 'Field to Update',
            type: 'select',
            required: true,
            options: [
              { label: 'Phone Number', value: 'phone' },
              { label: 'Address', value: 'address' },
              { label: 'Bank Account', value: 'bank' }
            ]
          },
          {
            key: 'newValue',
            label: 'New Value',
            type: 'text',
            required: true,
            placeholder: 'Enter the new value'
          },
          {
            key: 'attachment',
            label: 'Supporting Document',
            type: 'file',
            conditionalRequired: (formData) => formData.fieldType === 'bank',
            dependsOn: { field: 'fieldType', value: 'bank' },
            fileConfig: {
              allowedTypes: ['.pdf', '.jpg', '.png'],
              maxSize: 5
            }
          }
        ]
      }
    ]
  },
  {
    id: 'letters-certificates',
    title: 'Letters & Certificates',
    description: 'Request official documents',
    icon: FileText,
    requestTypes: [
      {
        id: 'salary-certificate',
        title: 'Salary Certificate',
        description: 'Request salary certificate',
        categoryId: 'letters-certificates',
        workflowRoute: ['HR'],
        fields: [
          {
            key: 'language',
            label: 'Language',
            type: 'select',
            required: true,
            options: [
              { label: 'Arabic', value: 'ar' },
              { label: 'English', value: 'en' }
            ]
          },
          {
            key: 'destination',
            label: 'Destination',
            type: 'text',
            required: true,
            placeholder: 'e.g., Embassy, Bank'
          },
          {
            key: 'purpose',
            label: 'Purpose',
            type: 'text',
            required: true,
            placeholder: 'e.g., Visa application, Loan'
          },
          {
            key: 'stampedCopy',
            label: 'Stamped Copy Required',
            type: 'select',
            required: true,
            options: [
              { label: 'Yes', value: 'yes' },
              { label: 'No', value: 'no' }
            ]
          }
        ]
      },
      {
        id: 'experience-letter',
        title: 'Experience Letter',
        description: 'Request experience letter',
        categoryId: 'letters-certificates',
        workflowRoute: ['HR'],
        fields: [
          {
            key: 'language',
            label: 'Language',
            type: 'select',
            required: true,
            options: [
              { label: 'Arabic', value: 'ar' },
              { label: 'English', value: 'en' }
            ]
          }
        ]
      },
      {
        id: 'document-request',
        title: 'Document Request',
        description: 'Request any official document',
        categoryId: 'letters-certificates',
        workflowRoute: ['HR'],
        fields: [
          {
            key: 'documentType',
            label: 'Document Type',
            type: 'select',
            required: true,
            options: [
              { label: 'Salary Certificate', value: 'Salary Certificate' },
              { label: 'Employment Letter', value: 'Employment Letter' },
              { label: 'Experience Certificate', value: 'Experience Certificate' },
              { label: 'No Objection Certificate (NOC)', value: 'No Objection Certificate (NOC)' },
              { label: 'Visa Letter', value: 'Visa Letter' },
              { label: 'Bank Letter', value: 'Bank Letter' },
              { label: 'Other', value: 'Other' }
            ]
          },
          {
            key: 'language',
            label: 'Language',
            type: 'select',
            required: true,
            options: [
              { label: 'Arabic', value: 'ar' },
              { label: 'English', value: 'en' }
            ]
          },
          {
            key: 'purpose',
            label: 'Purpose',
            type: 'textarea',
            required: true,
            placeholder: 'Please specify the purpose for this document (e.g., Visa application, Loan, etc.)'
          },
          {
            key: 'destination',
            label: 'Destination (Optional)',
            type: 'text',
            required: false,
            placeholder: 'e.g., Embassy, Bank, Government Office'
          }
        ]
      }
    ]
  },
  {
    id: 'training-development',
    title: 'Training & Development',
    description: 'Request training opportunities',
    icon: GraduationCap,
    requestTypes: [
      {
        id: 'training-request',
        title: 'Training Request',
        description: 'Request training or course',
        categoryId: 'training-development',
        workflowRoute: ['Manager', 'HR'],
        fields: [
          {
            key: 'courseName',
            label: 'Course Name',
            type: 'text',
            required: true
          },
          {
            key: 'provider',
            label: 'Training Provider',
            type: 'text',
            required: true
          },
          {
            key: 'dateFrom',
            label: 'Start Date',
            type: 'date',
            required: true
          },
          {
            key: 'dateTo',
            label: 'End Date',
            type: 'date',
            required: true
          },
          {
            key: 'insideWorkHours',
            label: 'During Work Hours',
            type: 'select',
            required: true,
            options: [
              { label: 'Yes', value: 'yes' },
              { label: 'No', value: 'no' }
            ]
          },
          {
            key: 'estimatedCost',
            label: 'Estimated Cost',
            type: 'number',
            required: true,
            validation: { min: 0 }
          }
        ]
      }
    ]
  },
  {
    id: 'assets-it',
    title: 'Assets & IT Support',
    description: 'Request assets or IT support',
    icon: Laptop,
    requestTypes: [
      {
        id: 'asset-request',
        title: 'Asset Request',
        description: 'Request company assets',
        categoryId: 'assets-it',
        workflowRoute: ['IT', 'Manager'],
        fields: [
          {
            key: 'assetType',
            label: 'Asset Type',
            type: 'select',
            required: true,
            options: [
              { label: 'Laptop', value: 'laptop' },
              { label: 'Mobile Phone', value: 'mobile' },
              { label: 'Monitor', value: 'monitor' },
              { label: 'Other', value: 'other' }
            ]
          },
          {
            key: 'justification',
            label: 'Justification',
            type: 'textarea',
            required: true,
            placeholder: 'Explain why you need this asset'
          },
          {
            key: 'neededDate',
            label: 'Needed By',
            type: 'date',
            required: true
          }
        ]
      },
      {
        id: 'it-support',
        title: 'IT Support Ticket',
        description: 'Report IT issues',
        categoryId: 'assets-it',
        workflowRoute: ['IT'],
        fields: [
          {
            key: 'issueCategory',
            label: 'Issue Category',
            type: 'select',
            required: true,
            options: [
              { label: 'Hardware', value: 'hardware' },
              { label: 'Software', value: 'software' },
              { label: 'Network', value: 'network' },
              { label: 'Access', value: 'access' }
            ]
          },
          {
            key: 'systemOrDevice',
            label: 'System/Device',
            type: 'text',
            required: true,
            placeholder: 'e.g., Laptop, Email, HR System'
          },
          {
            key: 'priority',
            label: 'Priority',
            type: 'select',
            required: true,
            options: [
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
              { label: 'Urgent', value: 'urgent' }
            ]
          },
          {
            key: 'description',
            label: 'Description',
            type: 'textarea',
            required: true,
            placeholder: 'Describe the issue in detail'
          }
        ]
      }
    ]
  },
  {
    id: 'sensitive',
    title: 'Sensitive Requests',
    description: 'Confidential HR matters',
    icon: Shield,
    requestTypes: [
      {
        id: 'complaint-grievance',
        title: 'Complaint / Grievance',
        description: 'File a complaint (confidential)',
        categoryId: 'sensitive',
        workflowRoute: ['HR'], // Bypasses manager if confidential
        fields: [
          {
            key: 'category',
            label: 'Category',
            type: 'select',
            required: true,
            options: [
              { label: 'Workplace Harassment', value: 'harassment' },
              { label: 'Discrimination', value: 'discrimination' },
              { label: 'Safety Concern', value: 'safety' },
              { label: 'Other', value: 'other' }
            ]
          },
          {
            key: 'description',
            label: 'Description',
            type: 'textarea',
            required: true,
            placeholder: 'Describe the issue in detail'
          },
          {
            key: 'confidentiality',
            label: 'Keep Confidential',
            type: 'select',
            required: true,
            options: [
              { label: 'Yes - Route to HR only', value: 'yes' },
              { label: 'No - Standard workflow', value: 'no' }
            ]
          },
          {
            key: 'attachment',
            label: 'Supporting Evidence',
            type: 'file',
            fileConfig: {
              allowedTypes: ['.pdf', '.jpg', '.png'],
              maxSize: 10,
              multiple: true
            }
          }
        ]
      },
      {
        id: 'resignation',
        title: 'Resignation',
        description: 'Submit resignation',
        categoryId: 'sensitive',
        workflowRoute: ['Manager', 'HR'],
        fields: [
          {
            key: 'lastWorkingDay',
            label: 'Last Working Day',
            type: 'date',
            required: true
          },
          {
            key: 'reason',
            label: 'Reason (Optional)',
            type: 'textarea',
            placeholder: 'You may provide a reason for your resignation'
          },
          {
            key: 'agreement',
            label: 'I understand the notice period and exit procedures',
            type: 'checkbox',
            required: true,
            placeholder: 'I agree to complete the exit process as per company policy'
          }
        ]
      }
    ]
  }
];

// Helper function to get all request types flattened
export const getAllRequestTypes = (): RequestType[] => {
  return REQUEST_CATEGORIES.flatMap(category => category.requestTypes);
};

// Helper function to get request type by ID
export const getRequestTypeById = (id: string): RequestType | undefined => {
  return getAllRequestTypes().find(type => type.id === id);
};

// Helper function to get category by ID
export const getCategoryById = (id: string): RequestCategory | undefined => {
  return REQUEST_CATEGORIES.find(category => category.id === id);
};
