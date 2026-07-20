# Payroll & Attendance Deduction Rules (BEC / NZSuite HR)

Reference for HR and payroll operators. Combines **company policy**, **BEC spreadsheet logic**, and **NZSuite HR application behaviour**.

---

## 1. Two time windows (important)

| Window | Period | Used for |
|--------|--------|----------|
| **Attendance / payroll period** | **21st of previous month → 20th of payroll month** | Counting present days, absences, late punches, holidays, approved leave |
| **Salary payment month** | **1st → last day of calendar month** | What the employee is paid *for* on the bank transfer (e.g. “June salary”) |

### Company policy (manual / BEC)

- Attendance is **measured** on the 21st–20th cycle.
- The **amount paid** in a calendar month covers that full calendar month.
- **Late arrivals or absences from the 21st onward** may be **carried forward** and deducted in the **following month’s** salary (not always in the same attendance period).

### System behaviour

The app uses the **21st–20th period** for attendance import and day counts. It does **not** yet auto-split “calendar month pay” vs “carry-forward from day 21”. That part is **HR manual** (move days, adjust paid leave, edit penalties).

**Example — June 2026 payroll**

- Attendance period: **21 May 2026 – 20 June 2026**
- Calendar salary month: **June 2026** (1–30 June)

---

## 2. Core day balance (attendance equation)

For each employee row:

```
Scheduled working days in period
  = Present days
  + Company holiday days (paid)
  + Absent days
  + Paid leave days (salary-days mode)
  + Permitted late days
  + Permitted leave days
  + Unpermitted late days
```

### Application logic (`recalcPayrollRow`)

1. Start with **pool** = `Scheduled − Present − Company holidays`
2. HR can **reclassify** pool days into (in order): permitted leave → permitted late → unpermitted late
3. Whatever remains in the pool = **Absent days**

```
Absent = max(0, Scheduled − Present − Holidays − Paid leave − Permitted late − Permitted leave − Unpermitted late)
```

*(Paid leave in “BEC salary-days mode” is handled separately in the salary formula — see §6.)*

---

## 3. Scheduled working days

| Rule | Detail |
|------|--------|
| **Period** | 21st previous month → 20th payroll month |
| **Source** | Employee **shift schedule** (`day_of_week` + start/end) |
| **Count** | Each calendar date in the period that falls on a scheduled weekday |
| **Cap** | Min(shift count in period, **26**) |
| **Default** | If no shifts: Mon–Sat in period, capped at 26 |
| **Holidays** | **Not** subtracted from scheduled count (holidays are a separate paid column) |

### Daily rate divisor (BEC)

| Schedule | Divisor |
|----------|---------|
| **Mon–Sat** (default) | **26** |
| **Saturday off** (Sun–Fri shift) | **21** |

Detected from employee shift: no `day_of_week = 6` (Saturday) → use **21**.

```
Daily rate = Basic salary ÷ divisor
```

Full basic when `(Present + Holidays + Permitted sick/leave + Paid leave days)` equals the divisor (21 or 26).

---

## 4. Present days (actual working days)

### From attendance API / rebuild

- Distinct dates in the payroll period with status **Present** (not Late, not Absent)
- Company holidays excluded
- Period: 21st–20th

### From biometric punch import (PDF / paste)

- Maps device **AC-No** → employee (`external_id`, employee code, or name match)
- Period: 21st–20th; holiday dates skipped
- **Present day** if employee has valid punch(es) on a **scheduled shift weekday**
- Rules include: split-shift (open + close), grace for single punch (**15 minutes** after shift start by default), C/Out mislabeled as arrival near shift start
- Employees **not** in the punch file: treated as **fully present** on all non-holiday scheduled days (minus approved paid leave from API)

---

## 5. Company holidays

| Rule | Detail |
|------|--------|
| **What** | Company holiday dates that fall on the employee’s **working weekdays** in the period |
| **Pay** | **Paid** — do **not** count as absent; **included in Salary KWD** |
| **Salary effect** | `Salary KWD += (Basic ÷ 26) × Company holiday days` (present column stays punch-only count) |
| **Example** | Present 21 + holidays 5 + absent 0 → salary = `(21+5)/26 × Basic` = **full basic** |
| **Source** | Company settings → holidays overlapping 21st–20th |

---

## 6. Paid leave days

| Rule | Detail |
|------|--------|
| **Meaning** | Days paid at daily rate — Eid holiday, official paid leave, or HR reclassifying absent → paid leave |
| **Auto source** | Approved leave requests overlapping the payroll period |
| **Excel columns (BEC & DYLX June 2026)** | **Salary KWD (col 8)** = `(Basic ÷ 26) × (Present + Company holiday days)`; **Paid Leave KWD (col 9)** = `(Basic ÷ 26) × Paid leave days` |
| **Gross salary portion** | `Salary KWD + Paid Leave KWD` |
| **Full Eid month** | Present = 0, paid leave = 27 → all pay in **Paid Leave KWD** (col 9) |
| **Supplemental paid leave** | Present = 25, paid leave = 1 → col 8 = 25 days pay, col 9 = 1 day pay, **net = full basic** |

**Not the same as:** Permitted late (late but approved, full day pay in present column).

**HR action:** “Move all absent → paid leave” or set paid leave days manually.

### Verified — DYLX June 2026 (`DYLX (6-2025)` sheet)

| Employee | Code | Basic | Present | Paid leave | Salary KWD | Paid Leave KWD | Net | Notes |
|----------|------|-------|---------|------------|------------|----------------|-----|-------|
| **عيد حسين الخلف** | VEN-000101 | 575 | 0 | **27** | 0 | **597.115** | 597.115 | `*` — Eid paid holiday (27 days); name is “Eid”, not the holiday itself |
| ميمونة عبد الوهاب | VEN-000065 | 300 | 25 | 1 | 288.462 | 11.538 | **300** | 1 paid leave day + 25 present |
| منار فيصل | VEN-000201 | 250 | 25 | 1 | 240.385 | 9.615 | **250** | Same pattern |
| السيد نبيل رمضان | VEN-000004 | 370 | 0 | **30** | 0 | **426.923** | 426.923 | Full month via paid leave only |
| **ساي ماناسا نوتا** | VEN-000192 | 150 | **25** | 0 | **144.231** | 0 | 144.231 | 1 absent day in 21 May–20 Jun period (see §19) |

**Formula check:** `575 ÷ 26 × 27 = 597.115` · `150 ÷ 26 × 25 = 144.231`

---

## 7. Permitted late days (“paid late”)

| Rule | Detail |
|------|--------|
| **Meaning** | Employee was late but **management approved** — counts like present for scheduling balance |
| **Salary effect** | **No cut** — treated as present for the day-balance; salary stays full basic (when not in paid-leave-days mode) |
| **How to apply** | Move days from **Absent** → **Permitted late** in the payroll table |

---

## 8. Permitted leave days

| Rule | Detail |
|------|--------|
| **Meaning** | Excused absence (approved leave without pay change in this model) |
| **Salary effect** | **No change** to salary KWD in current BEC logic — day is removed from absent pool only |
| **How to apply** | Move days from **Absent** → **Permitted leave** |

---

## 9. Unpermitted late days

| Rule | Detail |
|------|--------|
| **Meaning** | Late without approval — HR reclassifies from absent |
| **Salary effect** | **¼ day (0.25) of daily rate per day** |

```
Unpermitted late deduction = (Basic ÷ 26) × ¼ × Unpermitted late days
```

**Example:** Basic 442.883 → daily 17.034 → **4.258 KWD per unpermitted late day**

**How to apply:** Move days from **Absent** → **Unpermitted late**

**Note:** This is **separate** from **clock-in minute penalties** (§11).

---

## 10. Absent days

| Rule | Detail |
|------|--------|
| **Meaning** | Unpaid absence — no punch / not excused |
| **Salary effect** | **1 full daily rate per absent day** |

```
Absent deduction = (Basic ÷ 26) × Absent days
```

**Normal salary (no paid-leave-days mode):**

```
Salary KWD = Basic − (Absent × daily) − (Unpermitted late × daily × ¼)
```

If no deductions: **Salary KWD = full basic**.

---

## 11. Late clock-in penalties (جزاءات / Penalties column)

### Tier rules

| Lateness (after shift start) | Deducted time |
|------------------------------|---------------|
| **0–15 min** | No penalty |
| **16–30 min** | **30 minutes** of pay |
| **31+ min** | **60 minutes (1 hour)** of pay |

Deduction starts at **16 minutes** late or more.

**Examples** (shift 7:00 AM):

- Clock in **7:16 AM** → 16 min late → **30 minutes** deducted
- Clock in **7:31 AM** or later → **60 minutes (1 hour)** deducted

### Amount (KWD)

```
Penalty = Basic × (deducted minutes ÷ 60) ÷ (26 × hours per day)
```

Equivalently: late minutes are pro-rated against **total monthly working hours** (26 days × hours per day).

- **26** = BEC month divisor
- **Hours per day** = company default (usually **8**), or from shift length
- Rounded to **3 decimal places**

### Examples (Basic 442.883, 26 days, 8 h/day)

| Event | Tier minutes | Penalty (approx.) |
|-------|----------------|-------------------|
| 7:16 AM (16 min late) | 30 | **1.064 KWD** |
| 7:31 AM (31+ min late) | 60 | **2.127 KWD** |
| Two days: 30 + 60 min | 90 | **~3.194 KWD** |

### Punch rules (when auto-calculated)

- Compare **morning arrival** (C/In before 11:00, or C/Out near shift start) vs **shift start**
- **Skip partial days** (left **> 90 minutes** before scheduled shift end)
- One penalty tier **per calendar day** (earliest morning arrival)
- Multiple device IDs for same employee merged before counting

### Carry-forward

Late penalties for incidents **from the 21st** of the month may be applied in the **next** month’s payroll (HR / BEC manual alignment).

### System status

Penalties may be **manual** in the payroll table or **auto** from punch import when late-calculation is enabled. **Net salary** always subtracts **Penalties** from gross.

---

## 12. Gross pay, net pay, refund

### Gross accrual month

```
Total gross = Salary KWD + Paid leave KWD + Overtime + Housing + Other
```

- **Paid leave KWD** = `(Basic ÷ 26) × Paid leave days` (Excel col 9); **Salary KWD** = `(Basic ÷ 26) × Present days` (col 8)
- Allowances from employee profile (housing, transport, meal, etc.)

### Deductions

```
Total deductions = Penalties + Deductions + Loan + Other deductions
Net salary = max(0, Total gross − Total deductions)
```

### On-paper salary & refund (BEC)

If employee has **on-paper salary** (e.g. 600 KWD) higher than bank net:

```
Salary refund = On-paper salary − Net salary  (if basic > 0)
Amount scheduled to pay = Net salary + Salary refund
```

Marked with **\*** in notes when refund > 0.

---

## 13. Overseas / partial-month cases (example: Asma — June 2026 BEC)

> If you meant **Ismat** — not on the June 2026 DYLX sheet. The matching BEC case is **أسماء** (Asma) below. **إسراء** (Isra, VEN-000168) is on DYLX with full basic 250 and no deductions.

### HR policy (Asma — BEC-000196)

| Period | Treatment |
|--------|-----------|
| **21 May – 1 June 2026** | Outside country — **no salary** for that portion |
| **Returned 2 June 2026** | Work resumed |
| **Deduction** | **One day** (01/06/2026) deducted |

### How to handle in the app

1. On **Employee → Payroll tab**, add monthly entry **Full month salary (pay full basic)**.
   - Use **date range** from **02/06/2026** (return date) — this also limits late deductions to on/after that date.
2. Run June payroll with punch import + AI (or rebuild).
3. Late clock-in deductions are computed automatically from punches → **Deductions KWD** column (BEC col 15).
4. Forgive specific late days: add **Permitted late** with date range for that day (excluded from late calc).
5. Formula: `Basic × (tier minutes ÷ 60) ÷ (26 × shift hours)` where tier = 30 min (16–30 late) or 60 min (31+ late).

### Target BEC row (reference — `BEC (1-2026)` sheet)

| Field | Value |
|-------|-------|
| Code | **BEC-000196** |
| Name | أسماء عبد النبي ابراهيم السيد |
| Basic | 442.883 |
| Present | **26** |
| Paid leave | 0 |
| Salary KWD | **442.883** (full basic) |
| Penalties (col 14) | **0** |
| Deductions (col 15 — late clock-in) | **2.832** |
| Net | **440.051** |

**Late calc example (7 h shift):** qualifying days 03/06 (30 min tier) + 17/06 (30 min tier) ≈ **2.432 KWD**; add **Permitted late** for other days HR forgives, or adjust manually to match BEC **2.832**.

That implies: **no absent/¼-day cut in salary** on the sheet — only **penalties** for lateness.

---

## 19. June 2026 verification notes (DYLX Excel)

Source: `docs/Payroll-DYLX - June 2026.xlsx` → sheet **`DYLX (6-2025)`** (title: *June 2026 Payroll Report*).  
BEC counterpart: `docs/Payroll-BEC -June  2026.xlsx` → **`BEC (1-2026)`**.

### Attendance period

- **21 May 2026 – 20 June 2026** for day counts (present, paid leave, absent).
- Calendar **June 2026** salary is what is paid on the bank transfer.

### 1. Eid paid holiday — عيد حسين الخلف (VEN-000101)

- Employee’s first name is **عيد**; this row demonstrates **company Eid paid leave**, not a special rule by name.
- **Present = 0**, **Paid leave days = 27** (one day above the usual 26 — full Eid period paid).
- Pay: `575 ÷ 26 × 27 = **597.115 KWD**` in **Paid Leave KWD** column.
- On-paper / refund: scheduled 822.115, refund 225, notes **`*`**.

**HR setting:** Add **paid leave** entry for Eid dates (or set **27 paid leave days** for the month).

### 2. Manasa — 21st-period absence — ساي ماناسا نوتا (VEN-000192)

- **Present = 25** (of 26 scheduled), **paid leave = 0**.
- Salary: `150 ÷ 26 × 25 = **144.231 KWD**` — one unpaid day in the attendance window.
- No penalties; absence is taken via **lower present days**, not a separate deduction column.
- This matches the **21st–20th** rule: one day missing in the May 21 – Jun 20 window reduces pay in **June** payroll.

**HR setting:** Either accept **present = 25** from punches, or add **1 unpaid leave** day in monthly payroll settings.

### 3. Asma (BEC) / Ismat clarification

| Name searched | Found? | June 2026 outcome |
|---------------|--------|-------------------|
| **أسماء** (Asma) BEC-000196 | BEC sheet | Full basic, penalties 2.832 only — §13 |
| **إسراء** (Isra) VEN-000168 | DYLX sheet | Full basic 250, no cuts |
| **Ismat** (exact) | Not in workbook | Treat as **Asma (BEC)** if that was intended |

### 4. Supplemental paid leave (1 day + 25 present)

Seen on **ميمونة**, **منار**, **سارة**, and BEC **محمود حسن** (BEC-000182):

```
Salary KWD      = (Basic ÷ 26) × Present
Paid Leave KWD  = (Basic ÷ 26) × Paid leave days
Total           = Basic  (when present + paid leave = 26)
```

### 5. DYLX vs BEC template sheet names

| Company | Template file | Active sheet |
|---------|---------------|--------------|
| DYLX | `Payroll-DYLX-June-2026.xlsx` | `DYLX (6-2025)` |
| BEC | `Payroll-BEC-June-2026.xlsx` | `BEC (1-2026)` |

Both use the same 22-column layout (cols 5–9: basic, present, paid leave days, salary KWD, paid leave KWD).

---

## 14. HR workflow summary

```
1. Select payroll month (e.g. June 2026)
2. Import attendance (API rebuild OR punch PDF)
3. Review: Scheduled | Holidays | Present | Absent
4. Reclassify absent:
      → Paid leave        (paid daily rate × days)
      → Permitted late    (no pay cut)
      → Permitted leave   (excused, no pay cut)
      → Unpermitted late  (¼ day cut each)
5. Enter / verify Penalties (late minutes rule)
6. Check Salary KWD, Net, Refund
7. Save & submit for approval
```

---

## 15. Quick reference formulas

| Item | Formula |
|------|---------|
| Daily rate | `Basic ÷ 26` |
| Absent cut | `Daily × Absent days` |
| Unpermitted late cut | `Daily × ¼ × Unpermitted late days` |
| Paid leave salary mode | `(Basic ÷ 26) × Paid leave days` in **Paid Leave KWD**; `(Basic ÷ 26) × Present` in **Salary KWD** |
| Late penalty | `Basic × (penalty minutes ÷ 60) ÷ (26 × 8)` |
| Net | `Gross − Penalties − other deductions` |
| Refund | `On-paper − Net` (if on-paper set) |

---

## 16. Implemented vs manual

| Feature | Status |
|---------|--------|
| 21st–20th attendance period | Implemented |
| Scheduled days from shifts | Implemented |
| Company holidays (paid) | Implemented |
| Present from API / punch | Implemented |
| Day buckets + absent pool | Implemented |
| BEC salary (present + paid leave cols) | Implemented |
| Move absent → buckets (UI) | Implemented |
| Approved leave → paid leave days | Implemented |
| Late penalty auto from punches | Specified; enable when deployed |
| Calendar month vs 21st carry-forward | Policy only — HR manual |
| Overseas / partial month | HR manual |
| Penalties column | Manual entry; auto when late module active |

---

## 17. Glossary

| Term | Arabic (UI) | Meaning |
|------|-------------|---------|
| Scheduled days | أيام مجدولة | Shift working days in 21st–20th period |
| Present days | أيام الحضور | Days with attendance / punch |
| Company holiday | عطلة الشركة | Paid public/company holiday |
| Absent | غياب | Unpaid absence |
| Paid leave days | إجازة مدفوعة | Paid at daily rate (BEC salary-days) |
| Permitted late | تأخير مسموح | Late, approved, no cut |
| Permitted leave | إجازة مسموحة | Excused, no salary change |
| Unpermitted late | تأخير غير مسموح | ¼-day salary cut each |
| Penalties | جزاءات | Late clock-in minute penalties (KWD) |
| Salary refund | استرداد الراتب | On-paper minus net |

---

## 18. Code references

| Topic | File |
|-------|------|
| Payroll period (21st–20th) | `client/src/utils/payrollPeriod.ts` |
| Daily rate, BEC salary | `client/src/utils/payrollTemplate.ts` |
| Row recalc, day buckets | `client/src/utils/payrollRowRecalc.ts` |
| Scheduled / holiday days | `client/src/utils/payrollWorkingDays.ts` |
| Punch import | `client/src/utils/payrollPunchLogParser.ts` |
| Report build | `client/src/services/payrollReportService.ts` |
| Payroll UI | `client/src/components/payroll/PayrollReportTab.tsx` |
