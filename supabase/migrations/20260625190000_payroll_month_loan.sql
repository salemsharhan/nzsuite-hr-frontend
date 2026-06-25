-- Monthly payroll loan deduction (سلف) per employee
ALTER TABLE employee_payroll_month_adjustments
  ADD COLUMN IF NOT EXISTS amount_kwd NUMERIC(10, 3);

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
    'full_month_salary',
    'loan'
  ));

ALTER TABLE employee_payroll_month_adjustments
  DROP CONSTRAINT IF EXISTS employee_payroll_month_adjustments_input_mode_check;

ALTER TABLE employee_payroll_month_adjustments
  ADD CONSTRAINT employee_payroll_month_adjustments_input_mode_check
  CHECK (input_mode IN ('days_count', 'date_range', 'amount_kwd'));

ALTER TABLE employee_payroll_month_adjustments
  DROP CONSTRAINT IF EXISTS employee_payroll_month_adj_days_or_range;

ALTER TABLE employee_payroll_month_adjustments
  ADD CONSTRAINT employee_payroll_month_adj_days_or_range CHECK (
    (entry_type = 'loan' AND amount_kwd IS NOT NULL AND amount_kwd > 0)
    OR (
      entry_type <> 'loan'
      AND (
        (input_mode = 'days_count' AND days_count IS NOT NULL AND days_count > 0)
        OR (
          input_mode = 'date_range'
          AND date_from IS NOT NULL
          AND date_to IS NOT NULL
          AND date_from <= date_to
        )
      )
    )
  );

COMMENT ON COLUMN employee_payroll_month_adjustments.amount_kwd IS
  'Loan deduction KWD for entry_type=loan (payroll Loan / سلف column).';
