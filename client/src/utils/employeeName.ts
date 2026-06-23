import { Employee } from '../services/employeeService';
import i18n from './i18n';

/**
 * Gets the employee's display name based on the current language.
 * If language is Arabic, returns Arabic name if available, otherwise English name.
 * If language is English, returns English name.
 * 
 * @param employee - The employee object
 * @param options - Optional configuration
 * @returns The display name string
 */
export function getEmployeeDisplayName(
  employee: Employee | null | undefined,
  options: {
    includeMiddle?: boolean;
    fallback?: string;
  } = {}
): string {
  if (!employee) return options.fallback || '';

  const { includeMiddle = true } = options;
  const currentLang = (i18n.language || 'en').split('-')[0];
  const isArabic = currentLang === 'ar';

  if (isArabic) {
    const arabicFirst = employee.arabic_first_name || employee.arabicFirstName;
    const arabicMiddle = includeMiddle ? (employee.arabic_middle_name || employee.arabicMiddleName) : null;
    const arabicLast = employee.arabic_last_name || employee.arabicLastName;

    if (arabicFirst || arabicMiddle || arabicLast) {
      // Arabic name exists
      const parts = [
        arabicFirst,
        arabicMiddle,
        arabicLast
      ].filter(Boolean);
      return parts.join(' ') || options.fallback || '';
    }
  }

  // English mode or Arabic name not available - use English name
  const englishFirst = employee.first_name || employee.firstName;
  const englishMiddle = includeMiddle ? (employee.middle_name || employee.middleName) : null;
  const englishLast = employee.last_name || employee.lastName;

  const parts = [
    englishFirst,
    englishMiddle,
    englishLast
  ].filter(Boolean);

  return parts.join(' ') || options.fallback || '';
}

/**
 * Gets the employee's first name based on the current language.
 */
export function getEmployeeFirstName(employee: Employee | null | undefined): string {
  if (!employee) return '';
  const currentLang = (i18n.language || 'en').split('-')[0];
  const isArabic = currentLang === 'ar';

  if (isArabic) {
    return employee.arabic_first_name || employee.arabicFirstName || employee.first_name || employee.firstName || '';
  }
  return employee.first_name || employee.firstName || '';
}

/**
 * Gets the employee's last name based on the current language.
 */
export function getEmployeeLastName(employee: Employee | null | undefined): string {
  if (!employee) return '';
  const currentLang = (i18n.language || 'en').split('-')[0];
  const isArabic = currentLang === 'ar';

  if (isArabic) {
    return employee.arabic_last_name || employee.arabicLastName || employee.last_name || employee.lastName || '';
  }
  return employee.last_name || employee.lastName || '';
}

/**
 * Gets initials for avatar display based on the current language.
 */
export function getEmployeeInitials(employee: Employee | null | undefined): string {
  if (!employee) return 'U';
  const currentLang = (i18n.language || 'en').split('-')[0];
  const isArabic = currentLang === 'ar';

  if (isArabic) {
    const arabicFirst = employee.arabic_first_name || employee.arabicFirstName;
    const arabicLast = employee.arabic_last_name || employee.arabicLastName;
    if (arabicFirst || arabicLast) {
      return ((arabicFirst || 'U')[0] + (arabicLast || 'N')[0]).toUpperCase();
    }
  }

  const englishFirst = employee.first_name || employee.firstName;
  const englishLast = employee.last_name || employee.lastName;
  return ((englishFirst || 'U')[0] + (englishLast || 'N')[0]).toUpperCase();
}

