-- departments.head_employee_id -> employees was a second foreign key between employees and departments,
-- which made every PostgREST embed like employees?select=*,departments(name) fail with PGRST201
-- ("more than one relationship was found"). Replace the FK with triggers that keep the same rules,
-- so employees.department_id is again the only relationship PostgREST sees.

ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_head_employee_id_fkey;

-- Same check the FK did: the head must be an existing employee.
CREATE OR REPLACE FUNCTION public.departments_check_head_employee()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.head_employee_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.employees WHERE id = NEW.head_employee_id) THEN
    RAISE EXCEPTION 'head_employee_id % is not an existing employee', NEW.head_employee_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS departments_check_head_employee ON public.departments;
CREATE TRIGGER departments_check_head_employee
  BEFORE INSERT OR UPDATE OF head_employee_id ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.departments_check_head_employee();

-- Same as ON DELETE SET NULL: deleting an employee clears them as department head.
CREATE OR REPLACE FUNCTION public.employees_clear_department_head()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.departments SET head_employee_id = NULL WHERE head_employee_id = OLD.id;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS employees_clear_department_head ON public.employees;
CREATE TRIGGER employees_clear_department_head
  AFTER DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_clear_department_head();

CREATE INDEX IF NOT EXISTS idx_departments_head_employee_id ON public.departments(head_employee_id);

NOTIFY pgrst, 'reload schema';
