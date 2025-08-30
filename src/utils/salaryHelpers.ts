/**
 * Centralized salary calculation helpers that use basePayAllCountries as the primary field
 * with special handling for part-time employees in comparatio calculations
 */

/**
 * Get the display salary - always uses basePayAllCountries
 */
export function getDisplaySalary(employee: any): number {
  return employee.basePayAllCountries || 0;
}

/**
 * Get the display salary in USD - always uses basePayAllCountries converted to USD
 */
export function getDisplaySalaryUSD(employee: any): number {
  return employee.baseSalaryUSD || employee.basePayAllCountries || 0;
}

/**
 * Get the salary to use for comparatio calculations
 * If Salary > Total Base Pay: use Salary (FTE rate for part-time/contract employees)
 * If Salary == Total Base Pay: use Base Pay All Countries (full-time employees)
 */
export function getComparatioSalary(employee: any): number {
  const salary = employee.salary || 0;
  const totalBasePay = employee.baseSalary || 0;
  
  // If Salary > Total Base Pay, use Salary (represents FTE rate)
  if (salary > totalBasePay && salary > 0) {
    return salary;
  }
  
  // Otherwise use Base Pay All Countries (actual pay amount)
  return employee.basePayAllCountries || 0;
}

/**
 * Calculate comparatio using the appropriate salary value
 */
export function calculateComparatio(employee: any): number {
  if (!employee.salaryGradeMid || employee.salaryGradeMid <= 0) {
    return 0;
  }
  
  const salaryForComparatio = getComparatioSalary(employee);
  return Math.round((salaryForComparatio / employee.salaryGradeMid) * 100);
}

/**
 * Format salary for display with currency symbol
 */
export function formatSalary(amount: number, currency: string = 'USD'): string {
  const currencySymbols: Record<string, string> = {
    USD: '$',
    INR: '₹',
    GBP: '£',
    EUR: '€',
  };

  const symbol = currencySymbols[currency] || currency;
  return `${symbol}${amount.toLocaleString()}`;
}

/**
 * Calculate new salary after a raise (uses basePayAllCountries)
 */
export function calculateNewSalary(employee: any, raiseAmount: number): number {
  const currentSalary = getDisplaySalary(employee);
  return currentSalary + raiseAmount;
}

/**
 * Calculate raise percentage based on basePayAllCountries
 */
export function calculateRaisePercentage(employee: any, raiseAmount: number): number {
  const currentSalary = getDisplaySalary(employee);
  if (currentSalary <= 0) return 0;
  return (raiseAmount / currentSalary) * 100;
}

/**
 * Get salary range position (where employee sits in their salary grade)
 */
export function getSalaryRangePosition(employee: any): {
  position: number; // 0-100 percentage
  label: string;
} {
  if (!employee.salaryGradeMin || !employee.salaryGradeMax) {
    return { position: 0, label: 'Unknown' };
  }

  const salary = getComparatioSalary(employee);
  const min = employee.salaryGradeMin;
  const max = employee.salaryGradeMax;
  
  const position = ((salary - min) / (max - min)) * 100;
  
  let label = 'Unknown';
  if (position < 25) label = 'Below Range';
  else if (position < 50) label = 'Lower Range';
  else if (position < 75) label = 'Mid Range';
  else if (position <= 100) label = 'Upper Range';
  else label = 'Above Range';

  return { position: Math.max(0, Math.min(100, position)), label };
}

/**
 * Check if employee is eligible for a raise based on time in role
 */
export function isEligibleForRaise(employee: any, thresholdMonths: number = 12): boolean {
  return (employee.timeInRole || 0) >= thresholdMonths;
}

/**
 * Get recommended raise amount based on performance and comparatio
 */
export function getRecommendedRaise(employee: any): {
  amount: number;
  reason: string;
} {
  const currentSalary = getDisplaySalary(employee);
  const comparatio = calculateComparatio(employee);
  
  if (comparatio < 80) {
    // Significantly below market
    const targetSalary = employee.salaryGradeMid * 0.9; // Target 90% comparatio
    const amount = Math.max(0, targetSalary - currentSalary);
    return {
      amount: Math.round(amount),
      reason: 'Below market rate - significant adjustment needed'
    };
  } else if (comparatio < 90) {
    // Somewhat below market
    const targetSalary = employee.salaryGradeMid * 0.95; // Target 95% comparatio
    const amount = Math.max(0, targetSalary - currentSalary);
    return {
      amount: Math.round(amount),
      reason: 'Below market rate - moderate adjustment recommended'
    };
  } else if (comparatio > 110) {
    // Above market
    return {
      amount: 0,
      reason: 'Above market rate - no raise recommended'
    };
  } else {
    // In good range - performance-based raise
    const performanceMultiplier = employee.performanceRating >= 4 ? 0.05 : 0.03;
    const amount = currentSalary * performanceMultiplier;
    return {
      amount: Math.round(amount),
      reason: 'Performance-based adjustment'
    };
  }
}