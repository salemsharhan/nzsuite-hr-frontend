import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, decimal, date } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

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

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

// Leave Types table
export const leaveTypes = mysqlTable("leave_types", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3b82f6"),
  icon: varchar("icon", { length: 50 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeaveType = typeof leaveTypes.$inferSelect;
export type InsertLeaveType = typeof leaveTypes.$inferInsert;

// Leave Policies table
export const leavePolicies = mysqlTable("leave_policies", {
  id: int("id").autoincrement().primaryKey(),
  leaveTypeId: int("leaveTypeId").notNull().references(() => leaveTypes.id),
  annualEntitlement: int("annualEntitlement").notNull(), // days per year
  accrualMethod: mysqlEnum("accrualMethod", ["monthly", "yearly", "joining_date"]).default("yearly").notNull(),
  carryForwardEnabled: boolean("carryForwardEnabled").default(false).notNull(),
  maxCarryForwardDays: int("maxCarryForwardDays").default(0),
  encashmentEnabled: boolean("encashmentEnabled").default(false).notNull(),
  minDaysPerRequest: int("minDaysPerRequest").default(1),
  maxDaysPerRequest: int("maxDaysPerRequest"),
  advanceNoticeRequired: int("advanceNoticeRequired").default(0), // days
  requiresApproval: boolean("requiresApproval").default(true).notNull(),
  requiresAttachment: boolean("requiresAttachment").default(false).notNull(),
  applicableTo: json("applicableTo"), // {departments: [], roles: [], employmentTypes: []}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeavePolicy = typeof leavePolicies.$inferSelect;
export type InsertLeavePolicy = typeof leavePolicies.$inferInsert;

// Leave Balances table
export const leaveBalances = mysqlTable("leave_balances", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull().references(() => employees.id),
  leaveTypeId: int("leaveTypeId").notNull().references(() => leaveTypes.id),
  year: int("year").notNull(),
  totalEntitled: decimal("totalEntitled", { precision: 5, scale: 2 }).notNull(),
  used: decimal("used", { precision: 5, scale: 2 }).default("0").notNull(),
  pending: decimal("pending", { precision: 5, scale: 2 }).default("0").notNull(),
  carriedForward: decimal("carriedForward", { precision: 5, scale: 2 }).default("0").notNull(),
  remaining: decimal("remaining", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeaveBalance = typeof leaveBalances.$inferSelect;
export type InsertLeaveBalance = typeof leaveBalances.$inferInsert;

// Leave Requests table
export const leaveRequests = mysqlTable("leave_requests", {
  id: int("id").autoincrement().primaryKey(),
  requestId: varchar("requestId", { length: 50 }).notNull().unique(),
  employeeId: int("employeeId").notNull().references(() => employees.id),
  leaveTypeId: int("leaveTypeId").notNull().references(() => leaveTypes.id),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  duration: decimal("duration", { precision: 5, scale: 2 }).notNull(), // in days
  reason: text("reason"),
  attachments: json("attachments"), // [{name, url, type, size}]
  status: mysqlEnum("status", ["Pending", "Approved", "Rejected", "Cancelled"]).default("Pending").notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy").references(() => users.id),
  reviewComments: text("reviewComments"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = typeof leaveRequests.$inferInsert;

// Leave Approvals table (approval history/timeline)
export const leaveApprovals = mysqlTable("leave_approvals", {
  id: int("id").autoincrement().primaryKey(),
  leaveRequestId: int("leaveRequestId").notNull().references(() => leaveRequests.id),
  approverRole: varchar("approverRole", { length: 50 }).notNull(), // Manager, HR, Admin
  approverId: int("approverId").references(() => users.id),
  action: mysqlEnum("action", ["Approved", "Rejected", "Pending"]).notNull(),
  comments: text("comments"),
  actionAt: timestamp("actionAt").defaultNow().notNull(),
});

export type LeaveApproval = typeof leaveApprovals.$inferSelect;
export type InsertLeaveApproval = typeof leaveApprovals.$inferInsert;

// Public Holidays table
export const publicHolidays = mysqlTable("public_holidays", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  date: date("date").notNull(),
  isRecurring: boolean("isRecurring").default(false).notNull(),
  applicableTo: json("applicableTo"), // {departments: [], locations: []}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PublicHoliday = typeof publicHolidays.$inferSelect;
export type InsertPublicHoliday = typeof publicHolidays.$inferInsert;

// Leave Adjustments table (manual balance adjustments)
export const leaveAdjustments = mysqlTable("leave_adjustments", {
  id: int("id").autoincrement().primaryKey(),
  leaveBalanceId: int("leaveBalanceId").notNull().references(() => leaveBalances.id),
  adjustmentType: mysqlEnum("adjustmentType", ["Add", "Deduct"]).notNull(),
  amount: decimal("amount", { precision: 5, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  adjustedBy: int("adjustedBy").notNull().references(() => users.id),
  adjustedAt: timestamp("adjustedAt").defaultNow().notNull(),
});

export type LeaveAdjustment = typeof leaveAdjustments.$inferSelect;
export type InsertLeaveAdjustment = typeof leaveAdjustments.$inferInsert;

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

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;

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

export type Leave = typeof leaves.$inferSelect;
export type InsertLeave = typeof leaves.$inferInsert;

// Payroll table
export const payroll = mysqlTable("payroll", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  month: varchar("month", { length: 7 }).notNull(), // Format: YYYY-MM
  basicSalary: decimal("basicSalary", { precision: 10, scale: 2 }).notNull(),
  allowances: decimal("allowances", { precision: 10, scale: 2 }).default("0.00").notNull(),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).default("0.00").notNull(),
  netSalary: decimal("netSalary", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["Draft", "Processed", "Paid"]).default("Draft").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payroll = typeof payroll.$inferSelect;
export type InsertPayroll = typeof payroll.$inferInsert;

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

export type Recruitment = typeof recruitment.$inferSelect;
export type InsertRecruitment = typeof recruitment.$inferInsert;

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

export type Timesheet = typeof timesheets.$inferSelect;
export type InsertTimesheet = typeof timesheets.$inferInsert;

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

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

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
  items: json("items").notNull(), // JSON array of checklist items
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HiringChecklist = typeof hiringChecklists.$inferSelect;
export type InsertHiringChecklist = typeof hiringChecklists.$inferInsert;

// Roles table
export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  isSystemRole: boolean("isSystemRole").default(false).notNull(),
  permissions: json("permissions").notNull(), // JSON array of permission objects
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

// User Roles table
export const userRoles = mysqlTable("userRoles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  roleId: int("roleId").notNull(),
  effectiveDate: timestamp("effectiveDate"),
  assignedBy: varchar("assignedBy", { length: 200 }).notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;

// Audit Logs table
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: varchar("entityId", { length: 100 }).notNull(),
  changes: json("changes"), // JSON object of changes
  performedBy: varchar("performedBy", { length: 200 }).notNull(),
  performedAt: timestamp("performedAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
