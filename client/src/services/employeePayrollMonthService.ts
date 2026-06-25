import { adminApi } from './api';
import type { PayrollMonthAdjustmentEntry, PayrollMonthEntryType } from '@/utils/payrollMonthAdjustments';
import {
  summarizeMonthAdjustments,
  type MonthAdjustmentSummary,
} from '@/utils/payrollMonthAdjustments';
import { getPayrollPeriodBounds } from '@/utils/payrollPeriod';

export type EmployeePayrollMonthAdjustment = PayrollMonthAdjustmentEntry & {
  id: string;
  created_at?: string;
  updated_at?: string;
};

export const employeePayrollMonthService = {
  async getByEmployeeMonth(
    employeeId: string,
    year: number,
    month: number,
  ): Promise<EmployeePayrollMonthAdjustment[]> {
    const response = await adminApi.get('/employee_payroll_month_adjustments', {
      params: {
        employee_id: `eq.${employeeId}`,
        payroll_year: `eq.${year}`,
        payroll_month: `eq.${month}`,
        order: 'created_at.asc',
      },
    });
    return response.data ?? [];
  },

  async getByCompanyMonth(
    companyId: string,
    year: number,
    month: number,
  ): Promise<EmployeePayrollMonthAdjustment[]> {
    const response = await adminApi.get('/employee_payroll_month_adjustments', {
      params: {
        company_id: `eq.${companyId}`,
        payroll_year: `eq.${year}`,
        payroll_month: `eq.${month}`,
        order: 'employee_id.asc,created_at.asc',
      },
    });
    return response.data ?? [];
  },

  async create(
    entry: Omit<EmployeePayrollMonthAdjustment, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<EmployeePayrollMonthAdjustment> {
    const response = await adminApi.post('/employee_payroll_month_adjustments', entry);
    const row = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!row) throw new Error('Failed to create payroll month adjustment');
    return row;
  },

  async update(
    id: string,
    patch: Partial<Omit<EmployeePayrollMonthAdjustment, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<EmployeePayrollMonthAdjustment> {
    const response = await adminApi.patch(`/employee_payroll_month_adjustments?id=eq.${id}`, patch);
    const row = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!row) throw new Error('Failed to update payroll month adjustment');
    return row;
  },

  async delete(id: string): Promise<void> {
    await adminApi.delete(`/employee_payroll_month_adjustments?id=eq.${id}`);
  },

  async getSummariesByCompanyMonth(
    companyId: string,
    year: number,
    month: number,
  ): Promise<Record<string, MonthAdjustmentSummary>> {
    const period = getPayrollPeriodBounds(year, month);
    const rows = await this.getByCompanyMonth(companyId, year, month);
    const byEmployee: Record<string, EmployeePayrollMonthAdjustment[]> = {};

    for (const row of rows) {
      if (!byEmployee[row.employee_id]) byEmployee[row.employee_id] = [];
      byEmployee[row.employee_id].push(row);
    }

    const result: Record<string, MonthAdjustmentSummary> = {};
    for (const [empId, entries] of Object.entries(byEmployee)) {
      result[empId] = summarizeMonthAdjustments(entries, period);
    }
    return result;
  },

  entryTypeLabel(type: PayrollMonthEntryType, t: (key: string) => string): string {
    return t(`employees.payrollMonthEntry.${type}`);
  },
};
