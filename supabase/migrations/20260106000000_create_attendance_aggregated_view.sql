-- Create a view that aggregates attendance records by employee and date
-- Combines check-ins and check-outs into single daily records
-- For multiple shifts (4 entries = 2 shifts), creates separate records per shift

CREATE OR REPLACE VIEW attendance_aggregated AS
WITH check_ins AS (
  -- Get all check-ins (status1 = true)
  SELECT 
    employee_id,
    DATE(timestamp) as attendance_date,
    timestamp as check_in_time,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, DATE(timestamp) 
      ORDER BY timestamp
    ) as shift_num
  FROM attendances
  WHERE status1 = true
),
check_outs AS (
  -- Get all check-outs (status2 = true)
  SELECT 
    employee_id,
    DATE(timestamp) as attendance_date,
    timestamp as check_out_time,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, DATE(timestamp) 
      ORDER BY timestamp
    ) as shift_num
  FROM attendances
  WHERE status2 = true
),
paired_shifts AS (
  -- Pair check-ins with their corresponding check-outs
  -- For each check-in, find the next check-out that hasn't been paired yet
  SELECT 
    ci.employee_id,
    ci.attendance_date,
    ci.shift_num,
    ci.check_in_time::text as check_in,
    COALESCE(
      (SELECT co.check_out_time::text
       FROM check_outs co
       WHERE co.employee_id = ci.employee_id
         AND co.attendance_date = ci.attendance_date
         AND co.check_out_time > ci.check_in_time
         AND co.shift_num = ci.shift_num),
      (SELECT MIN(co.check_out_time)::text
       FROM check_outs co
       WHERE co.employee_id = ci.employee_id
         AND co.attendance_date = ci.attendance_date
         AND co.check_out_time > ci.check_in_time)
    ) as check_out
  FROM check_ins ci
),
orphan_check_outs AS (
  -- Handle check-outs without matching check-ins
  SELECT 
    co.employee_id,
    co.attendance_date,
    '' as check_in,
    co.check_out_time::text as check_out,
    co.shift_num
  FROM check_outs co
  WHERE NOT EXISTS (
    SELECT 1 FROM check_ins ci
    WHERE ci.employee_id = co.employee_id
      AND ci.attendance_date = co.attendance_date
      AND ci.check_in_time <= co.check_out_time
  )
)
SELECT 
  COALESCE(ps.employee_id, oco.employee_id) as employee_id,
  COALESCE(ps.attendance_date, oco.attendance_date) as date,
  COALESCE(ps.check_in, oco.check_in, '') as check_in,
  COALESCE(ps.check_out, oco.check_out, '') as check_out,
  CASE 
    WHEN COALESCE(ps.check_in, oco.check_in) != '' THEN 'Present'
    ELSE 'Absent'
  END as status,
  COALESCE(ps.shift_num, oco.shift_num, 1) as shift_number
FROM paired_shifts ps
FULL OUTER JOIN orphan_check_outs oco
  ON ps.employee_id = oco.employee_id
  AND ps.attendance_date = oco.attendance_date
  AND ps.shift_num = oco.shift_num;

-- Create a view that combines all shifts into one record per day
-- Uses earliest check-in and latest check-out (for single shift display)
CREATE OR REPLACE VIEW attendance_daily AS
SELECT 
  employee_id,
  date,
  MIN(check_in) FILTER (WHERE check_in != '') as check_in,
  MAX(check_out) FILTER (WHERE check_out != '') as check_out,
  CASE 
    WHEN MIN(check_in) FILTER (WHERE check_in != '') IS NOT NULL THEN 'Present'
    ELSE 'Absent'
  END as status,
  COUNT(*) as shift_count
FROM attendance_aggregated
GROUP BY employee_id, date;

-- Grant access to the views
GRANT SELECT ON attendance_aggregated TO authenticated;
GRANT SELECT ON attendance_daily TO authenticated;

