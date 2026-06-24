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

/**
 * Maps biometric machine integer IDs to HR employee UUIDs.
 * Strategy: external_id, numeric employee_id, then name from attendance import.
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

    const employeeIdText = emp.employee_id || (emp as { employeeId?: string }).employeeId || '';
    const match = employeeIdText.match(/\d+/);
    if (match) {
      const extractedNumber = parseInt(match[0], 10);
      if (!employeeIdTextMap.has(extractedNumber)) {
        employeeIdTextMap.set(extractedNumber, emp.id);
      }
    } else if (!isNaN(Number(employeeIdText))) {
      const numId = Number(employeeIdText);
      if (!employeeIdTextMap.has(numId)) {
        employeeIdTextMap.set(numId, emp.id);
      }
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
      const byName = employees.find((emp) =>
        namesMatchAttendanceImport(employeeDisplayName(emp), importName)
      );
      mapping.set(integerId, byName?.id ?? null);
    } else {
      mapping.set(integerId, null);
    }
  }

  return mapping;
}
