# The System - HRMS Code Export

This document contains all the key code implementations for the HR Management System.

## 📋 Table of Contents

1. [Database Schema](#database-schema)
2. [Server-Side Code](#server-side-code)
3. [Client Services](#client-services)
4. [Key Pages](#key-pages)
5. [Configuration Files](#configuration-files)

---

## 1. Database Schema

### File: `drizzle/schema.ts`

```typescript
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, decimal } from "drizzle-orm/mysql-core";

// Users table (authentication)
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// Employees table
export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: varchar("employeeId", { length: 50 }).notNull().unique(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  department: varchar("department", { length: 100 }),
  position: varchar("position", { length: 100 }),
  hireDate: timestamp("hireDate"),
  salary: decimal("salary", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["Active", "Inactive", "On Leave"]).default("Active").notNull(),
  employmentType: mysqlEnum("employmentType", ["Full Time", "Part Time", "Consultant"]).default("Full Time").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Attendance table
export const attendance = mysqlTable("attendance", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  date: timestamp("date").notNull(),
  checkIn: timestamp("checkIn"),
  checkOut: timestamp("checkOut"),
  status: mysqlEnum("status", ["Present", "Absent", "Late", "Half Day", "On Leave"]).default("Present").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Leaves table
export const leaves = mysqlTable("leaves", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  leaveType: varchar("leaveType", { length: 50 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  reason: text("reason"),
  status: mysqlEnum("status", ["Pending", "Approved", "Rejected"]).default("Pending").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Payroll table
export const payroll = mysqlTable("payroll", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  month: varchar("month", { length: 7 }).notNull(),
  basicSalary: decimal("basicSalary", { precision: 10, scale: 2 }).notNull(),
  allowances: decimal("allowances", { precision: 10, scale: 2 }).default("0.00").notNull(),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).default("0.00").notNull(),
  netSalary: decimal("netSalary", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["Draft", "Processed", "Paid"]).default("Draft").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Recruitment table
export const recruitment = mysqlTable("recruitment", {
  id: int("id").autoincrement().primaryKey(),
  candidateName: varchar("candidateName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"]).default("Applied").notNull(),
  appliedDate: timestamp("appliedDate").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Timesheets table
export const timesheets = mysqlTable("timesheets", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  date: timestamp("date").notNull(),
  projectName: varchar("projectName", { length: 200 }),
  hoursWorked: decimal("hoursWorked", { precision: 5, scale: 2 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["Draft", "Submitted", "Approved", "Rejected"]).default("Draft").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Documents table
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId"),
  documentName: varchar("documentName", { length: 200 }).notNull(),
  documentType: varchar("documentType", { length: 100 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  uploadedBy: int("uploadedBy"),
  expiryDate: timestamp("expiryDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Hiring Checklists table
export const hiringChecklists = mysqlTable("hiringChecklists", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull().unique(),
  stage: int("stage").default(1).notNull(),
  progressPercentage: int("progressPercentage").default(0).notNull(),
  status: mysqlEnum("status", ["In Progress", "Pending Approval", "Completed"]).default("In Progress").notNull(),
  hrApproved: boolean("hrApproved").default(false).notNull(),
  hrApprovedBy: varchar("hrApprovedBy", { length: 200 }),
  hrApprovedDate: timestamp("hrApprovedDate"),
  managerApproved: boolean("managerApproved").default(false).notNull(),
  managerApprovedBy: varchar("managerApprovedBy", { length: 200 }),
  managerApprovedDate: timestamp("managerApprovedDate"),
  items: json("items").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Roles table
export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  isSystemRole: boolean("isSystemRole").default(false).notNull(),
  permissions: json("permissions").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// User Roles table
export const userRoles = mysqlTable("userRoles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  roleId: int("roleId").notNull(),
  effectiveDate: timestamp("effectiveDate"),
  assignedBy: varchar("assignedBy", { length: 200 }).notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

// Audit Logs table
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: varchar("entityId", { length: 100 }).notNull(),
  changes: json("changes"),
  performedBy: varchar("performedBy", { length: 200 }).notNull(),
  performedAt: timestamp("performedAt").defaultNow().notNull(),
});
```

---

## 2. Server-Side Code

### File: `server/hrRouter.ts`

This file contains all the tRPC endpoints for HR operations. The router is organized by module:

**Key Endpoints:**
- Employee CRUD operations
- Attendance tracking
- Leave management
- Payroll processing
- Recruitment pipeline
- Timesheet management
- Document handling
- Hiring checklist workflow
- Role & permission management
- Audit logging

**Example Employee Endpoint:**

```typescript
employees: router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(employees).orderBy(desc(employees.createdAt));
  }),

  create: publicProcedure
    .input(z.object({
      employeeId: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().email(),
      // ... other fields
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.insert(employees).values(input as any);
      return { id: Number((result as any).insertId), ...input };
    }),
})
```

### File: `server/routers.ts`

```typescript
import { hrRouter } from "./hrRouter";

export const appRouter = router({
  system: systemRouter,
  hr: hrRouter,  // HR module router
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      // ... logout logic
    }),
  }),
});
```

---

## 3. Client Services

### File: `client/src/services/employeeService.ts`

```typescript
export interface Employee {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  hireDate?: string;
  salary?: string;
  status: 'Active' | 'Inactive' | 'On Leave';
  employmentType: 'Full Time' | 'Part Time' | 'Consultant';
  // Legacy field names for compatibility
  employee_id?: string;
  first_name?: string;
  last_name?: string;
  // ... other legacy fields
}

export const employeeService = {
  async getAll() {
    // Currently returns mock data
    // TODO: Replace with tRPC call
    return mockEmployees;
  },

  async getById(id: string | number) {
    const numId = typeof id === 'string' ? parseInt(id) : id;
    return mockEmployees.find(emp => emp.id === numId) || null;
  },

  async create(employee: any) {
    // TODO: Connect to tRPC endpoint
    // await trpc.hr.employees.create.mutate(employee);
  },

  // ... other methods
};
```

### File: `client/src/services/hiringChecklistService.ts`

```typescript
export interface HiringChecklist {
  id: string;
  employee_id: string;
  employee_name: string;
  stage: number;
  progress_percentage: number;
  status: 'In Progress' | 'Pending Approval' | 'Completed';
  hr_approved: boolean;
  manager_approved: boolean;
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  stage: number;
  title: string;
  description: string;
  completed: boolean;
  completed_by?: string;
  completed_at?: string;
}

export const hiringChecklistService = {
  async getAll(): Promise<HiringChecklist[]> {
    // Mock implementation
    return mockChecklists;
  },

  async create(data: { employee_id: string; items: ChecklistItem[] }) {
    // TODO: Connect to tRPC
    // await trpc.hr.hiringChecklists.create.mutate(data);
  },

  async updateProgress(checklistId: string, items: ChecklistItem[]) {
    // Calculate progress and update
    const completedCount = items.filter(item => item.completed).length;
    const progressPercentage = Math.round((completedCount / items.length) * 100);
    // TODO: Update via tRPC
  },

  async approve(checklistId: string, type: 'hr' | 'manager', approvedBy: string) {
    // TODO: Update approval status via tRPC
  },
};
```

### File: `client/src/services/rolesPermissionsService.ts`

```typescript
export interface Role {
  id: string;
  name: string;
  description: string;
  is_system_role: boolean;
  permissions: ModulePermission[];
  created_at: string;
}

export interface ModulePermission {
  module: string;
  actions: string[];
}

export const rolesPermissionsService = {
  async getAllRoles(): Promise<Role[]> {
    // Returns system roles + custom roles
    return mockRoles;
  },

  async createRole(role: Omit<Role, 'id' | 'created_at'>) {
    // TODO: Connect to tRPC
    // await trpc.hr.roles.create.mutate(role);
  },

  async assignRoleToUser(userId: string, roleId: string, assignedBy: string) {
    // TODO: Connect to tRPC
    // await trpc.hr.userRoles.assign.mutate({ userId, roleId, assignedBy });
  },

  async logAuditEvent(action: string, entityType: string, entityId: string, changes: any, performedBy: string) {
    // TODO: Connect to tRPC
    // await trpc.hr.auditLogs.create.mutate({ action, entityType, entityId, changes, performedBy });
  },
};
```

---

## 4. Key Pages

### File: `client/src/pages/HiringChecklistPage.tsx`

**Features:**
- Display all hiring checklists with progress bars
- Create new checklist for employees without one
- 6-stage checklist workflow
- Progress tracking with percentage
- HR and Manager approval system
- Modal for viewing/editing checklist items

**Key Components:**
```typescript
const HiringChecklistPage = () => {
  const [checklists, setChecklists] = useState<HiringChecklist[]>([]);
  const [selectedChecklist, setSelectedChecklist] = useState<HiringChecklist | null>(null);
  
  const handleUpdateProgress = async (checklistId: string, items: ChecklistItem[]) => {
    await hiringChecklistService.updateProgress(checklistId, items);
    await loadData();
  };

  const handleApprove = async (checklistId: string, type: 'hr' | 'manager') => {
    await hiringChecklistService.approve(checklistId, type, 'Current User');
    await loadData();
  };

  // ... render logic
};
```

### File: `client/src/pages/RolesPermissionsPage.tsx`

**Features:**
- Display all roles (system + custom)
- Create custom roles with permission matrix
- 6 modules × 6 actions permission grid
- Assign roles to users
- View audit logs
- Effective date support for role changes

**Permission Matrix:**
```typescript
const modules = ['HR', 'Attendance', 'Payroll', 'Recruitment', 'Analytics', 'Settings'];
const actions = ['View', 'Create', 'Edit', 'Approve', 'Delete', 'Export'];

// Permission grid allows granular control
<div className="grid grid-cols-7 gap-2">
  <div></div>
  {actions.map(action => <div key={action}>{action}</div>)}
  {modules.map(module => (
    <React.Fragment key={module}>
      <div>{module}</div>
      {actions.map(action => (
        <Checkbox
          checked={hasPermission(module, action)}
          onChange={() => togglePermission(module, action)}
        />
      ))}
    </React.Fragment>
  ))}
</div>
```

### File: `client/src/pages/EmployeeListPage.tsx`

**Features:**
- Grid view of all employees
- Search by name, email, or employee ID
- Filter by department
- Add new employee with employment type selection
- Employee cards with status badges
- Employment type badges (Full Time, Part Time, Consultant)

---

## 5. Configuration Files

### File: `drizzle.config.ts`

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### File: `package.json` (Key Scripts)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "db:push": "drizzle-kit generate && drizzle-kit migrate",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "@trpc/server": "^11.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "drizzle-orm": "^0.36.0",
    "mysql2": "^3.11.5",
    "zod": "^3.24.1"
  }
}
```

---

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up database:**
   ```bash
   pnpm db:push
   ```

3. **Start development server:**
   ```bash
   pnpm dev
   ```

4. **Access the application:**
   - Open browser to `http://localhost:3000`
   - Default login: admin@thesystem.com

---

## 📝 Notes

- All services currently use mock data for demonstration
- To enable live database operations, connect services to tRPC endpoints
- Database schema supports all planned features
- tRPC routers are fully implemented and ready to use

---

**Repository**: https://github.com/salemsharhan/the-system-hr-frontend
**Last Updated**: December 21, 2025
