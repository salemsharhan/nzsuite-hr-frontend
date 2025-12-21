import { z } from "zod";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  employees,
  attendance,
  leaves,
  payroll,
  recruitment,
  timesheets,
  documents,
  hiringChecklists,
  roles,
  userRoles,
  auditLogs,
  type InsertEmployee,
  type InsertAttendance,
  type InsertLeave,
  type InsertPayroll,
  type InsertRecruitment,
  type InsertTimesheet,
  type InsertDocument,
  type InsertHiringChecklist,
  type InsertRole,
  type InsertUserRole,
  type InsertAuditLog,
} from "../drizzle/schema";

export const hrRouter = router({
  // ========== EMPLOYEES ==========
  employees: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(employees).orderBy(desc(employees.createdAt));
    }),

    getById: publicProcedure.input(z.number()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const result = await db.select().from(employees).where(eq(employees.id, input)).limit(1);
      return result[0] || null;
    }),

    create: publicProcedure
      .input(
        z.object({
          employeeId: z.string(),
          firstName: z.string(),
          lastName: z.string(),
          email: z.string().email(),
          phone: z.string().optional(),
          department: z.string().optional(),
          position: z.string().optional(),
          hireDate: z.string().optional(),
          salary: z.string().optional(),
          status: z.enum(["Active", "Inactive", "On Leave"]).default("Active"),
          employmentType: z.enum(["Full Time", "Part Time", "Consultant"]).default("Full Time"),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(employees).values(input as any);
        return { id: Number((result as any).insertId), ...input };
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          employeeId: z.string().optional(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          department: z.string().optional(),
          position: z.string().optional(),
          hireDate: z.string().optional(),
          salary: z.string().optional(),
          status: z.enum(["Active", "Inactive", "On Leave"]).optional(),
          employmentType: z.enum(["Full Time", "Part Time", "Consultant"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, ...updates } = input;
        await db.update(employees).set(updates as any).where(eq(employees.id, id));
        return { success: true };
      }),

    delete: publicProcedure.input(z.number()).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(employees).where(eq(employees.id, input));
      return { success: true };
    }),
  }),

  // ========== ATTENDANCE ==========
  attendance: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(attendance).orderBy(desc(attendance.date));
    }),

    create: publicProcedure
      .input(
        z.object({
          employeeId: z.number(),
          date: z.string(),
          checkIn: z.string().optional(),
          checkOut: z.string().optional(),
          status: z.enum(["Present", "Absent", "Late", "Half Day", "On Leave"]).default("Present"),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(attendance).values(input as any);
        return { id: Number((result as any).insertId), ...input };
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          checkIn: z.string().optional(),
          checkOut: z.string().optional(),
          status: z.enum(["Present", "Absent", "Late", "Half Day", "On Leave"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, ...updates } = input;
        await db.update(attendance).set(updates as any).where(eq(attendance.id, id));
        return { success: true };
      }),
  }),

  // ========== LEAVES ==========
  leaves: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(leaves).orderBy(desc(leaves.createdAt));
    }),

    create: publicProcedure
      .input(
        z.object({
          employeeId: z.number(),
          leaveType: z.string(),
          startDate: z.string(),
          endDate: z.string(),
          reason: z.string().optional(),
          status: z.enum(["Pending", "Approved", "Rejected"]).default("Pending"),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(leaves).values(input as any);
        return { id: Number((result as any).insertId), ...input };
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
          approvedBy: z.number().optional(),
          approvedAt: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, ...updates } = input;
        await db.update(leaves).set(updates as any).where(eq(leaves.id, id));
        return { success: true };
      }),
  }),

  // ========== PAYROLL ==========
  payroll: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(payroll).orderBy(desc(payroll.createdAt));
    }),

    create: publicProcedure
      .input(
        z.object({
          employeeId: z.number(),
          month: z.string(),
          basicSalary: z.string(),
          allowances: z.string().default("0.00"),
          deductions: z.string().default("0.00"),
          netSalary: z.string(),
          status: z.enum(["Draft", "Processed", "Paid"]).default("Draft"),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(payroll).values(input as any);
        return { id: Number((result as any).insertId), ...input };
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["Draft", "Processed", "Paid"]).optional(),
          paidAt: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, ...updates } = input;
        await db.update(payroll).set(updates as any).where(eq(payroll.id, id));
        return { success: true };
      }),
  }),

  // ========== RECRUITMENT ==========
  recruitment: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(recruitment).orderBy(desc(recruitment.createdAt));
    }),

    create: publicProcedure
      .input(
        z.object({
          candidateName: z.string(),
          email: z.string().email(),
          phone: z.string().optional(),
          position: z.string(),
          status: z.enum(["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"]).default("Applied"),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(recruitment).values(input as any);
        return { id: Number((result as any).insertId), ...input };
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, ...updates } = input;
        await db.update(recruitment).set(updates as any).where(eq(recruitment.id, id));
        return { success: true };
      }),
  }),

  // ========== TIMESHEETS ==========
  timesheets: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(timesheets).orderBy(desc(timesheets.createdAt));
    }),

    create: publicProcedure
      .input(
        z.object({
          employeeId: z.number(),
          date: z.string(),
          projectName: z.string().optional(),
          hoursWorked: z.string(),
          description: z.string().optional(),
          status: z.enum(["Draft", "Submitted", "Approved", "Rejected"]).default("Draft"),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(timesheets).values(input as any);
        return { id: Number((result as any).insertId), ...input };
      }),
  }),

  // ========== DOCUMENTS ==========
  documents: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(documents).orderBy(desc(documents.createdAt));
    }),

    create: publicProcedure
      .input(
        z.object({
          employeeId: z.number().optional(),
          documentName: z.string(),
          documentType: z.string(),
          fileUrl: z.string(),
          uploadedBy: z.number().optional(),
          expiryDate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(documents).values(input as any);
        return { id: Number((result as any).insertId), ...input };
      }),
  }),

  // ========== HIRING CHECKLISTS ==========
  hiringChecklists: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(hiringChecklists).orderBy(desc(hiringChecklists.createdAt));
    }),

    getByEmployeeId: publicProcedure.input(z.number()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const result = await db.select().from(hiringChecklists).where(eq(hiringChecklists.employeeId, input)).limit(1);
      return result[0] || null;
    }),

    create: publicProcedure
      .input(
        z.object({
          employeeId: z.number(),
          items: z.any(), // JSON array
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(hiringChecklists).values({
          employeeId: input.employeeId,
          stage: 1,
          progressPercentage: 0,
          status: "In Progress",
          hrApproved: false,
          managerApproved: false,
          items: input.items,
        } as any);
        return { id: Number((result as any).insertId), ...input };
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          stage: z.number().optional(),
          progressPercentage: z.number().optional(),
          status: z.enum(["In Progress", "Pending Approval", "Completed"]).optional(),
          items: z.any().optional(),
          hrApproved: z.boolean().optional(),
          hrApprovedBy: z.string().optional(),
          hrApprovedDate: z.string().optional(),
          managerApproved: z.boolean().optional(),
          managerApprovedBy: z.string().optional(),
          managerApprovedDate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, ...updates } = input;
        await db.update(hiringChecklists).set(updates as any).where(eq(hiringChecklists.id, id));
        return { success: true };
      }),
  }),

  // ========== ROLES ==========
  roles: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(roles).orderBy(desc(roles.createdAt));
    }),

    create: publicProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          isSystemRole: z.boolean().default(false),
          permissions: z.any(), // JSON array
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(roles).values(input as any);
        return { id: Number((result as any).insertId), ...input };
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          permissions: z.any().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, ...updates } = input;
        await db.update(roles).set(updates as any).where(eq(roles.id, id));
        return { success: true };
      }),

    delete: publicProcedure.input(z.number()).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(roles).where(eq(roles.id, input));
      return { success: true };
    }),
  }),

  // ========== USER ROLES ==========
  userRoles: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(userRoles).orderBy(desc(userRoles.assignedAt));
    }),

    assign: publicProcedure
      .input(
        z.object({
          userId: z.number(),
          roleId: z.number(),
          assignedBy: z.string(),
          effectiveDate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(userRoles).values(input as any);
        return { id: Number((result as any).insertId), ...input };
      }),

    remove: publicProcedure.input(z.number()).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(userRoles).where(eq(userRoles.id, input));
      return { success: true };
    }),
  }),

  // ========== AUDIT LOGS ==========
  auditLogs: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(auditLogs).orderBy(desc(auditLogs.performedAt)).limit(100);
    }),

    create: publicProcedure
      .input(
        z.object({
          action: z.string(),
          entityType: z.string(),
          entityId: z.string(),
          changes: z.any().optional(),
          performedBy: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(auditLogs).values(input as any);
        return { id: Number((result as any).insertId), ...input };
      }),
  }),
});
