import type { Employee } from '@/services/employeeService';

function normalizeNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function employeeDisplayName(emp: Employee): string {
  const first = emp.firstName || (emp as { first_name?: string }).first_name || '';
  const last = emp.lastName || (emp as { last_name?: string }).last_name || '';
  const full = `${first} ${last}`.trim();
  return full || emp.employeeId || (emp as { employee_id?: string }).employee_id || '';
}

/** True when PDF/device name tokens appear in the HR employee name (or vice versa). */
export function namesMatchAttendanceImport(employeeName: string, importName: string): boolean {
  const a = normalizeNameForMatch(employeeName);
  const b = normalizeNameForMatch(importName);
  if (!a || !b) return false;
  if (a === b) return true;

  const aParts = a.split(' ').filter((p) => p.length > 1);
  const bParts = b.split(' ').filter((p) => p.length > 1);
  if (bParts.length > 0 && bParts.every((p) => a.includes(p))) return true;
  if (aParts.length > 0 && aParts.every((p) => b.includes(p))) return true;
  return false;
}

function extractNumericEmployeeId(emp: Employee): number | null {
  const externalId = (emp as { external_id?: string }).external_id;
  if (externalId && !isNaN(Number(externalId))) {
    return Number(externalId);
  }
  const employeeIdText = emp.employee_id || (emp as { employee_id?: string }).employee_id || '';
  if (!isNaN(Number(employeeIdText))) {
    return Number(employeeIdText);
  }
  const match = employeeIdText.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  return null;
}

/**
 * Maps biometric machine integer IDs to HR employee UUIDs.
 * Strategy: external_id, numeric employee_id, then name only when device AC-No matches emp code.
 */
export function mapMachineIdsToEmployeeUuids(
  integerIds: number[],
  employees: Employee[],
  nameByMachineId?: Map<number, string>
): Map<number, string | null> {
  const mapping = new Map<number, string | null>();

  const externalIdMap = new Map<number, string>();
  const employeeIdTextMap = new Map<number, string>();

  employees.forEach((emp) => {
    const externalId = (emp as { external_id?: string }).external_id;
    if (externalId && !isNaN(Number(externalId))) {
      externalIdMap.set(Number(externalId), emp.id);
    }

    const numericId = extractNumericEmployeeId(emp);
    if (numericId !== null && !employeeIdTextMap.has(numericId)) {
      employeeIdTextMap.set(numericId, emp.id);
    }
  });

  for (const integerId of integerIds) {
    if (externalIdMap.has(integerId)) {
      mapping.set(integerId, externalIdMap.get(integerId)!);
      continue;
    }
    if (employeeIdTextMap.has(integerId)) {
      mapping.set(integerId, employeeIdTextMap.get(integerId)!);
      continue;
    }

    const importName = nameByMachineId?.get(integerId);
    if (importName) {
      const byName = employees.find((emp) => {
        if (!namesMatchAttendanceImport(employeeDisplayName(emp), importName)) return false;
        const empCode = extractNumericEmployeeId(emp);
        // Avoid mapping device AC-No 831 → HR employee 1031 via name alone
        return empCode === null || empCode === integerId;
      });
      mapping.set(integerId, byName?.id ?? null);
    } else {
      mapping.set(integerId, null);
    }
  }

  return mapping;
}
