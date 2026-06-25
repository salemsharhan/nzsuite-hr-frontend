-- Paid leave taken from annual balance: excused absence, no extra salary (unlike paid_leave)
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
    'permitted_late'
  ));

COMMENT ON TABLE employee_payroll_month_adjustments IS
  'HR monthly leave/late per employee. paid=add salary; paid_leave_from_balance/sick/emergency=no pay change (excused); unpaid=deduct; permitted_late=approved late.';
