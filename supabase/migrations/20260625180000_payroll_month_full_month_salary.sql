-- Full calendar-month basic pay (e.g. overseas return — pay full basic, late deductions only)
ALTER TABLE employee_payroll_month_adjustments
  DROP CONSTRAINT IF EXISTS employee_payroll_month_adjustments_entry_type_check;

ALTER TABLE employee_payroll_month_adjustments
  ADD CONSTRAINT employee_payroll_month_adjustments_entry_type_check
  CHECK (entry_type IN (
    'paid_leave',
    'paid_leave_from_balance',
    'unpaid_leave',
    'sick_leave',
    'emergency_leave',
    'permitted_late',
    'full_month_salary'
  ));
