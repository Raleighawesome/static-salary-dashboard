import type { Employee, CompensationReviewSheetRow } from '../types/employee';

export class CompensationReviewImporter {
  /**
   * Merges compensation review data into existing employee data.
   * This enriches employee records with merit recommendations, proposed raises, and salary adjustment notes.
   * 
   * @param employees - Existing employee data
   * @param compensationReviewData - Compensation review sheet data
   * @returns Updated employee data with compensation review fields merged
   */
  public static mergeCompensationReviewData(
    employees: Employee[],
    compensationReviewData: CompensationReviewSheetRow[]
  ): Employee[] {
    if (!compensationReviewData || compensationReviewData.length === 0) {
      console.log('📋 No compensation review data to merge');
      return employees;
    }

    console.log(`📊 Merging ${compensationReviewData.length} compensation review records into ${employees.length} employees`);

    // Create a map for quick lookup by employeeId
    const compensationReviewMap = new Map<string, CompensationReviewSheetRow>();
    compensationReviewData.forEach(review => {
      if (review.employeeId) {
        compensationReviewMap.set(review.employeeId.toLowerCase().trim(), review);
      }
    });

    let mergedCount = 0;
    const updatedEmployees = employees.map(employee => {
      const employeeId = employee.employeeId?.toLowerCase().trim();
      if (!employeeId) {
        return employee;
      }

      const compensationReview = compensationReviewMap.get(employeeId);
      if (!compensationReview) {
        return employee;
      }

      mergedCount++;
      
      // Create updated employee with compensation review data
      const updatedEmployee: Employee = {
        ...employee,
        // Add new compensation review fields
        meritRecommendation: compensationReview.meritRecommendation,
        salaryAdjustmentNotes: compensationReview.salaryAdjustmentNotes,
      };

      // Handle proposedRaise update (overwrite existing values)
      if (compensationReview.proposedRaise !== undefined && compensationReview.proposedRaise !== null) {
        const newProposedRaise = compensationReview.proposedRaise;
        updatedEmployee.proposedRaise = newProposedRaise;

        // Recalculate dependent fields based on new proposed raise
        const currentSalaryUSD = employee.baseSalaryUSD || employee.baseSalary || 0;
        
        // Calculate new salary
        updatedEmployee.newSalary = currentSalaryUSD + newProposedRaise;
        
        // Calculate percentage change
        updatedEmployee.percentChange = currentSalaryUSD > 0 ? 
          Math.round((newProposedRaise / currentSalaryUSD) * 100) : 0;

        console.log(`💰 Updated ${employee.name}: proposedRaise=${newProposedRaise}, percentChange=${updatedEmployee.percentChange}%`);
      }

      return updatedEmployee;
    });

    console.log(`✅ Successfully merged compensation review data for ${mergedCount} employees`);
    
    // Report unmatched records
    const unmatchedReviews = compensationReviewData.filter(review => {
      const employeeId = review.employeeId?.toLowerCase().trim();
      return employeeId && !employees.some(emp => 
        emp.employeeId?.toLowerCase().trim() === employeeId
      );
    });

    if (unmatchedReviews.length > 0) {
      console.warn(`⚠️ ${unmatchedReviews.length} compensation review records could not be matched to existing employees:`);
      unmatchedReviews.forEach(review => {
        console.warn(`  - Employee ID: ${review.employeeId}`);
      });
    }

    return updatedEmployees;
  }

  /**
   * Validates that compensation review data can be properly merged
   * 
   * @param compensationReviewData - The compensation review data to validate
   * @returns Validation results with any issues found
   */
  public static validateForMerge(compensationReviewData: CompensationReviewSheetRow[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!compensationReviewData || compensationReviewData.length === 0) {
      errors.push('No compensation review data provided');
      return { isValid: false, errors, warnings };
    }

    // Check for duplicate employee IDs
    const employeeIds = compensationReviewData
      .map(review => review.employeeId?.toLowerCase().trim())
      .filter(id => id);
    
    const duplicateIds = employeeIds.filter((id, index) => 
      employeeIds.indexOf(id) !== index
    );

    if (duplicateIds.length > 0) {
      warnings.push(`Duplicate employee IDs found: ${[...new Set(duplicateIds)].join(', ')}`);
    }

    // Check for records with missing employee IDs
    const recordsWithoutIds = compensationReviewData.filter(review => 
      !review.employeeId || review.employeeId.trim() === ''
    );

    if (recordsWithoutIds.length > 0) {
      warnings.push(`${recordsWithoutIds.length} records missing employee IDs will be skipped`);
    }

    // Validate proposed raise values
    const invalidRaises = compensationReviewData.filter(review => 
      review.proposedRaise !== undefined && 
      review.proposedRaise !== null && 
      (typeof review.proposedRaise !== 'number' || review.proposedRaise < 0)
    );

    if (invalidRaises.length > 0) {
      warnings.push(`${invalidRaises.length} records have invalid proposed raise amounts`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}