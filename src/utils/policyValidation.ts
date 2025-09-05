import type { PolicyViolation } from '../types/employee';
import { getDisplaySalaryUSD, getComparatioSalary } from './salaryHelpers';

export interface PolicySettings {
  comparatioFloor: number; // 76%
  maxRaisePercentUS: number; // 12%
  maxRaisePercentIndia: number; // 35%
  noRaiseThresholdMonths: number; // 18 months
  // Promotion-specific policies
  maxPromotionRaisePercentUS: number; // 25%
  maxPromotionRaisePercentIndia: number; // 50%
  minPromotionIntervalMonths: number; // 12 months
  maxPromotionJumps: number; // 2 salary grade levels
}

export interface ValidationContext {
  totalBudget: number;
  currentBudgetUsage: number;
  employeeCount: number;
}

export class PolicyValidator {
  private static defaultPolicies: PolicySettings = {
    comparatioFloor: 76,
    maxRaisePercentUS: 12,
    maxRaisePercentIndia: 35,
    noRaiseThresholdMonths: 18,
    // Promotion-specific defaults
    maxPromotionRaisePercentUS: 25,
    maxPromotionRaisePercentIndia: 50,
    minPromotionIntervalMonths: 12,
    maxPromotionJumps: 2,
  };

  // Validate a single employee against policies
  public static validateEmployee(
    employee: any,
    policies: PolicySettings = this.defaultPolicies
  ): PolicyViolation[] {
    const violations: PolicyViolation[] = [];

    // Derive a robust employee display name from many possible fields
    const deriveEmployeeName = (emp: any): string => {
      const directName = emp?.name || emp?.Name || emp?.employeeName || emp?.EmployeeName;
      if (directName && typeof directName === 'string' && directName.trim()) return directName.trim();

      const preferred = emp?.['Preferred Name'] || emp?.['preferred name'];
      if (preferred && typeof preferred === 'string' && preferred.trim()) return preferred.trim();

      const worker = emp?.['Worker'] || emp?.['worker'];
      if (worker && typeof worker === 'string' && worker.trim()) return worker.trim();

      const first = emp?.firstName || emp?.['First Name'] || emp?.firstname;
      const last = emp?.lastName || emp?.['Last Name'] || emp?.lastname;
      const combined = [first, last].filter(Boolean).join(' ').trim();
      if (combined) return combined;

      const email = emp?.email || emp?.['Email'] || '';
      if (email) return email;

      return emp?.employeeId || '';
    };

    const employeeName = deriveEmployeeName(employee);

    // Check comparatio floor - use proposed comparatio if there's a proposed raise
    let effectiveComparatio = employee.comparatio;
    
    // Calculate proposed comparatio if there's a proposed raise
    if (employee.proposedRaise && employee.proposedRaise > 0 && employee.salaryGradeMid) {
      const currentComparatioSalary = getComparatioSalary(employee);
      const displaySalaryUSD = getDisplaySalaryUSD(employee);
      
      // Convert raise to local currency if needed
      let proposedRaiseLocalCurrency = employee.proposedRaise;
      if (displaySalaryUSD > 0 && employee.basePayAllCountries) {
        const conversionRate = employee.basePayAllCountries / displaySalaryUSD;
        proposedRaiseLocalCurrency = employee.proposedRaise * conversionRate;
      }
      
      // For part-time employees, convert actual raise to full-time equivalent for comparatio
      let newComparatioSalary = currentComparatioSalary;
      if (employee.timeType === 'Part time' && employee.fte && employee.fte > 0) {
        newComparatioSalary = currentComparatioSalary + (proposedRaiseLocalCurrency / employee.fte);
      } else {
        newComparatioSalary = currentComparatioSalary + proposedRaiseLocalCurrency;
      }
      
      effectiveComparatio = (newComparatioSalary / employee.salaryGradeMid) * 100;
    }
    
    if (effectiveComparatio && effectiveComparatio < policies.comparatioFloor) {
      // Show different message based on whether we're using current or proposed comparatio
      const isUsingProposed = employee.proposedRaise && employee.proposedRaise > 0 && employee.salaryGradeMid;
      const message = isUsingProposed 
        ? `Proposed comparatio ${effectiveComparatio.toFixed(1)}% would still be below minimum of ${policies.comparatioFloor}%`
        : `Comparatio ${effectiveComparatio.toFixed(1)}% is below minimum of ${policies.comparatioFloor}%`;
      
      violations.push({
        type: 'COMPARATIO_TOO_LOW',
        severity: 'WARNING',
        message,
        employeeId: employee.employeeId,
        employeeName,
        currentValue: effectiveComparatio,
        threshold: policies.comparatioFloor,
      });
    }

    // Check raise percentage limits
    if (employee.proposedRaise && employee.baseSalaryUSD) {
      const raisePercent = (employee.proposedRaise / employee.baseSalaryUSD) * 100;
      
      // Different limits for promotions vs regular raises
      let maxRaise: number;
      let raiseType: string;
      
      if (employee.hasPromotion) {
        maxRaise = employee.country === 'India' 
          ? policies.maxPromotionRaisePercentIndia 
          : policies.maxPromotionRaisePercentUS;
        raiseType = 'promotion';
      } else {
        maxRaise = employee.country === 'India' 
          ? policies.maxRaisePercentIndia 
          : policies.maxRaisePercentUS;
        raiseType = 'merit';
      }

      if (raisePercent > maxRaise) {
        violations.push({
          type: employee.hasPromotion ? 'PROMOTION_INCREASE_TOO_HIGH' : 'RAISE_TOO_HIGH',
          severity: 'ERROR',
          message: `Proposed ${raiseType} raise ${raisePercent.toFixed(1)}% exceeds maximum of ${maxRaise}%`,
          employeeId: employee.employeeId,
          employeeName,
          currentValue: raisePercent,
          threshold: maxRaise,
        });
      }
    }

    // Check if employee needs a raise (time in role)
    if (employee.timeInRole && employee.timeInRole >= policies.noRaiseThresholdMonths) {
      if (!employee.proposedRaise || employee.proposedRaise <= 0) {
        violations.push({
          type: 'NO_RAISE_TOO_LONG',
          severity: 'WARNING',
          message: `Employee has been in role for ${employee.timeInRole} months without a raise`,
          employeeId: employee.employeeId,
          employeeName,
          currentValue: employee.timeInRole,
          threshold: policies.noRaiseThresholdMonths,
        });
      }
    }

    // Promotion-specific validations
    if (employee.hasPromotion) {
      // Check if promotion type is valid
      if (employee.promotionType && !['VERTICAL', 'LATERAL', 'INTERNAL', 'DEMOTION'].includes(employee.promotionType)) {
        violations.push({
          type: 'INVALID_PROMOTION_PATH',
          severity: 'WARNING',
          message: `Promotion type '${employee.promotionType}' is not recognized`,
          employeeId: employee.employeeId,
          employeeName,
        });
      }
      
      // Check if promotion timing is appropriate (minimum interval between promotions)
      if (employee.promotionEffectiveDate && employee.lastPromotionDate) {
        const lastPromotionDate = new Date(employee.lastPromotionDate);
        const effectiveDate = new Date(employee.promotionEffectiveDate);
        const monthsBetween = (effectiveDate.getTime() - lastPromotionDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        
        if (monthsBetween < policies.minPromotionIntervalMonths) {
          violations.push({
            type: 'INVALID_PROMOTION_PATH',
            severity: 'WARNING',
            message: `Promotion interval of ${monthsBetween.toFixed(1)} months is less than minimum ${policies.minPromotionIntervalMonths} months`,
            employeeId: employee.employeeId,
            employeeName,
            currentValue: monthsBetween,
            threshold: policies.minPromotionIntervalMonths,
          });
        }
      }
      
      // Check if salary grade jump is too large (if grade levels are numeric)
      if (employee.oldSalaryGrade && employee.newSalaryGrade) {
        const oldGrade = this.extractGradeLevel(employee.oldSalaryGrade);
        const newGrade = this.extractGradeLevel(employee.newSalaryGrade);
        
        if (oldGrade !== null && newGrade !== null) {
          const gradeJump = Math.abs(newGrade - oldGrade);
          if (gradeJump > policies.maxPromotionJumps) {
            violations.push({
              type: 'INVALID_PROMOTION_PATH',
              severity: 'WARNING',
              message: `Grade jump from ${employee.oldSalaryGrade} to ${employee.newSalaryGrade} (${gradeJump} levels) exceeds maximum of ${policies.maxPromotionJumps} levels`,
              employeeId: employee.employeeId,
              employeeName,
              currentValue: gradeJump,
              threshold: policies.maxPromotionJumps,
            });
          }
        }
      }
      
      // Warn if promotion lacks key information
      if (!employee.newJobTitle || !employee.promotionJustification) {
        const missingFields = [];
        if (!employee.newJobTitle) missingFields.push('new job title');
        if (!employee.promotionJustification) missingFields.push('justification');
        
        violations.push({
          type: 'INVALID_PROMOTION_PATH',
          severity: 'WARNING',
          message: `Promotion is missing: ${missingFields.join(', ')}`,
          employeeId: employee.employeeId,
          employeeName,
        });
      }
      
      // Check if promotion is justified for demotions
      if (employee.promotionType === 'DEMOTION' && employee.proposedRaise > 0) {
        violations.push({
          type: 'INVALID_PROMOTION_PATH',
          severity: 'WARNING',
          message: 'Demotion should typically result in salary decrease, not increase',
          employeeId: employee.employeeId,
          employeeName,
        });
      }
    }

    return violations;
  }
  
  // Helper method to extract numeric grade level from grade strings
  private static extractGradeLevel(gradeString: string): number | null {
    if (!gradeString) return null;
    
    // Try to extract numeric values from common grade formats
    // E.g., "Grade 5", "Level 3", "Band 7", "P5", "M4", etc.
    const matches = gradeString.match(/\d+/);
    if (matches) {
      return parseInt(matches[0], 10);
    }
    
    // Try to extract from suffix patterns like "P5", "M4"
    const suffixMatches = gradeString.match(/[PM](\d+)/);
    if (suffixMatches) {
      return parseInt(suffixMatches[1], 10);
    }
    
    return null;
  }

  // Validate budget constraints
  public static validateBudget(
    context: ValidationContext,
    proposedAmount: number
  ): PolicyViolation[] {
    const violations: PolicyViolation[] = [];
    const newTotal = context.currentBudgetUsage + proposedAmount;
    const utilizationPercent = (newTotal / context.totalBudget) * 100;

    if (newTotal > context.totalBudget) {
      violations.push({
        type: 'BUDGET_EXCEEDED',
        severity: 'ERROR',
        message: `This raise would exceed budget by ${(newTotal - context.totalBudget).toLocaleString()}`,
        currentValue: utilizationPercent,
        threshold: 100,
      });
    }

    return violations;
  }

  // Get all policy violations for a list of employees
  public static validateAllEmployees(
    employees: any[],
    context: ValidationContext,
    policies: PolicySettings = this.defaultPolicies
  ): PolicyViolation[] {
    const allViolations: PolicyViolation[] = [];

    // Validate individual employees
    employees.forEach(employee => {
      const employeeViolations = this.validateEmployee(employee, policies);
      allViolations.push(...employeeViolations);
    });

    // Validate overall budget
    const budgetViolations = this.validateBudget(context, 0); // Check current state
    allViolations.push(...budgetViolations);

    return allViolations;
  }

  // Calculate new salary based on proposed raise
  public static calculateNewSalary(currentSalary: number, proposedRaise: number): number {
    return currentSalary + proposedRaise;
  }

  // Calculate raise percentage
  public static calculateRaisePercent(currentSalary: number, proposedRaise: number): number {
    if (currentSalary <= 0) return 0;
    return (proposedRaise / currentSalary) * 100;
  }

  // Get violation severity color
  public static getViolationColor(violations: PolicyViolation[]): 'none' | 'warning' | 'error' {
    if (violations.length === 0) return 'none';
    if (violations.some(v => v.severity === 'ERROR')) return 'error';
    return 'warning';
  }

  // Format violation message for display
  public static formatViolationMessage(violations: PolicyViolation[]): string {
    if (violations.length === 0) return '';
    if (violations.length === 1) return violations[0].message;
    return `${violations.length} policy issues detected`;
  }
} 