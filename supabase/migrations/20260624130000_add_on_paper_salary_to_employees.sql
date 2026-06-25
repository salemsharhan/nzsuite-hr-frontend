-- On-paper salary (declared salary for bank/refund); payroll refund = on_paper_salary - net salary
ALTER TABLE employees ADD COLUMN IF NOT EXISTS on_paper_salary NUMERIC(12, 3);

COMMENT ON COLUMN employees.on_paper_salary IS 'Declared on-paper salary (KWD). Payroll refund = on_paper_salary - net salary.';
