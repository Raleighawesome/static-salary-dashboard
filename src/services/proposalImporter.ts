// proposalImporter.ts - Service for importing and merging manager salary proposals
import Papa from 'papaparse';
import type { Employee } from '../types/employee';

// Interface for proposal data from manager exports
export interface ProposalData {
  employeeId: string;
  proposedRaisePercent?: string; // e.g., "5.00%"
  proposedSalary?: number;
  proposedComparatio?: string; // e.g., "95%"
  proposedRaise?: number; // USD amount
  // Additional fields that might be in manager exports
  name?: string;
  currentSalary?: number;
  currency?: string;
  salaryRecommendation?: string;
  adjustmentNotes?: string;
}

// Result of proposal import operation
export interface ProposalImportResult {
  success: boolean;
  matchedEmployees: number;
  unmatchedProposals: ProposalData[];
  updatedEmployees: Employee[];
  errors: string[];
  warnings: string[];
  summary: {
    totalProposals: number;
    successfulMatches: number;
    failedMatches: number;
    totalRaiseAmount: number;
  };
}

// Column mappings for manager proposal CSV files
const PROPOSAL_COLUMN_MAPPINGS: Record<string, keyof ProposalData> = {
  // Employee identification
  'employee number': 'employeeId',
  'employee_number': 'employeeId',
  'employeeid': 'employeeId',
  'employee id': 'employeeId',
  'emp_id': 'employeeId',
  'id': 'employeeId',
  'associate id': 'employeeId',
  'associate_id': 'employeeId',
  
  // Name for validation
  'employee full name': 'name',
  'name': 'name',
  'full_name': 'name',
  'employee_name': 'name',
  'associate': 'name',
  
  // Proposed salary fields
  'proposed raise (percent)': 'proposedRaisePercent',
  'proposed_raise_percent': 'proposedRaisePercent',
  'raise_percent': 'proposedRaisePercent',
  'raise percentage': 'proposedRaisePercent',
  'merit increase %': 'proposedRaisePercent',
  
  'proposed salary': 'proposedSalary',
  'proposed_salary': 'proposedSalary',
  'new_salary': 'proposedSalary',
  'new salary': 'proposedSalary',
  'new base pay all countries': 'proposedSalary',
  
  'proposed comparatio': 'proposedComparatio',
  'proposed_comparatio': 'proposedComparatio',
  'new_comparatio': 'proposedComparatio',
  'new comparatio': 'proposedComparatio',
  
  'proposed raise': 'proposedRaise',
  'proposed_raise': 'proposedRaise',
  'raise_amount': 'proposedRaise',
  'raise amount': 'proposedRaise',
  'merit increase amount': 'proposedRaise',
  
  // Current salary for validation
  'base pay all countries': 'currentSalary',
  'base_salary': 'currentSalary',
  'current_salary': 'currentSalary',
  'salary': 'currentSalary',
  'current base pay all countries': 'currentSalary',
  
  // Currency
  'currency': 'currency',

  // Additional proposal details
  'merit increase priority/recommendation': 'salaryRecommendation',
  'salary adjustment notes': 'adjustmentNotes',
};

export class ProposalImporter {
  /**
   * Import manager proposal CSV and merge with existing employee data
   */
  static async importProposals(
    file: File,
    existingEmployees: Employee[]
  ): Promise<ProposalImportResult> {
    const result: ProposalImportResult = {
      success: false,
      matchedEmployees: 0,
      unmatchedProposals: [],
      updatedEmployees: [...existingEmployees], // Start with copy of existing data
      errors: [],
      warnings: [],
      summary: {
        totalProposals: 0,
        successfulMatches: 0,
        failedMatches: 0,
        totalRaiseAmount: 0,
      },
    };

    try {
      // Parse CSV file
      const csvData = await this.parseCSVFile(file);
      if (!csvData || csvData.length === 0) {
        result.errors.push('CSV file is empty or could not be parsed');
        return result;
      }

      // Map CSV columns to proposal data
      const proposals = this.mapProposalData(csvData);
      result.summary.totalProposals = proposals.length;

      if (proposals.length === 0) {
        result.errors.push('No valid proposal data found in CSV');
        return result;
      }

      // Create employee lookup map for efficient matching
      const employeeMap = new Map<string, number>();
      existingEmployees.forEach((emp, index) => {
        employeeMap.set(emp.employeeId.toString(), index);
      });

      // Process each proposal
      for (const proposal of proposals) {
        if (!proposal.employeeId) {
          result.warnings.push(`Skipping proposal with missing Employee ID`);
          result.unmatchedProposals.push(proposal);
          result.summary.failedMatches++;
          continue;
        }

        const employeeIndex = employeeMap.get(proposal.employeeId.toString());
        if (employeeIndex === undefined) {
          result.warnings.push(`Employee ID ${proposal.employeeId} not found in existing data`);
          result.unmatchedProposals.push(proposal);
          result.summary.failedMatches++;
          continue;
        }

        // Update employee with proposal data
        const updatedEmployee = this.mergeProposalIntoEmployee(
          result.updatedEmployees[employeeIndex],
          proposal
        );

        if (updatedEmployee) {
          result.updatedEmployees[employeeIndex] = updatedEmployee;
          result.summary.successfulMatches++;
          result.summary.totalRaiseAmount += updatedEmployee.proposedRaise || 0;
        } else {
          result.warnings.push(`Failed to merge proposal for Employee ID ${proposal.employeeId}`);
          result.unmatchedProposals.push(proposal);
          result.summary.failedMatches++;
        }
      }

      result.matchedEmployees = result.summary.successfulMatches;
      result.success = result.summary.successfulMatches > 0;

      // Add summary message
      if (result.success) {
        console.log(`✅ Successfully imported ${result.summary.successfulMatches} proposals`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown import error';
      result.errors.push(`Import failed: ${errorMessage}`);
      console.error('❌ Proposal import failed:', error);
    }

    return result;
  }

  /**
   * Parse CSV file using PapaParse
   */
  private static async parseCSVFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.toLowerCase().trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('CSV parsing warnings:', results.errors);
          }
          resolve(results.data as any[]);
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        },
      });
    });
  }

  /**
   * Map CSV data to proposal objects
   */
  private static mapProposalData(csvData: any[]): ProposalData[] {
    return csvData.map((row) => {
      const proposal: ProposalData = {
        employeeId: '',
      };

      // Map each column to proposal fields
      Object.entries(row).forEach(([csvColumn, value]) => {
        const mappedField = PROPOSAL_COLUMN_MAPPINGS[csvColumn.toLowerCase().trim()];
        if (mappedField && value !== null && value !== undefined && value !== '') {
          if (mappedField === 'proposedSalary' || mappedField === 'proposedRaise' || mappedField === 'currentSalary') {
            // Parse numeric values
            const numericValue = this.parseNumericValue(value);
            if (numericValue !== null) {
              (proposal as any)[mappedField] = numericValue;
            }
          } else {
            // String values
            (proposal as any)[mappedField] = String(value).trim();
          }
        }
      });

      return proposal;
    }).filter(proposal => proposal.employeeId); // Only return proposals with Employee ID
  }

  /**
   * Parse numeric values from CSV (handles commas, currency symbols, etc.)
   */
  private static parseNumericValue(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return null;

    // Remove common formatting characters
    const cleanValue = value.replace(/[$,\s]/g, '').replace(/[()]/g, '');
    const parsed = parseFloat(cleanValue);
    
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse percentage values (e.g., "5.00%" -> 5.00)
   */
  private static parsePercentageValue(value: string): number | null {
    if (!value) return null;
    const cleanValue = value.replace('%', '').trim();
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Merge proposal data into existing employee record
   */
  private static mergeProposalIntoEmployee(
    employee: Employee,
    proposal: ProposalData
  ): Employee | null {
    try {
      const updatedEmployee = { ...employee };

      // Calculate raise amount from percentage if provided
      if (proposal.proposedRaisePercent && !proposal.proposedRaise) {
        const raisePercent = this.parsePercentageValue(proposal.proposedRaisePercent);
        if (raisePercent !== null) {
          const currentSalaryUSD = employee.baseSalaryUSD || employee.baseSalary || 0;
          proposal.proposedRaise = (currentSalaryUSD * raisePercent) / 100;
        }
      }

      // Calculate raise amount from proposed salary if provided
      if (proposal.proposedSalary && !proposal.proposedRaise) {
        const currentSalaryOriginal = employee.baseSalary || 0;
        const proposedSalaryOriginal = proposal.proposedSalary;
        
        // Convert to USD for internal storage
        const conversionRate = employee.baseSalaryUSD && employee.baseSalary ? 
          employee.baseSalaryUSD / employee.baseSalary : 1;
        
        const raiseAmountOriginal = proposedSalaryOriginal - currentSalaryOriginal;
        proposal.proposedRaise = raiseAmountOriginal * conversionRate;
      }

      // Update employee with proposal data
      if (proposal.proposedRaise !== undefined) {
        updatedEmployee.proposedRaise = proposal.proposedRaise;
        
        // Recalculate dependent fields
        const currentSalaryUSD = employee.baseSalaryUSD || employee.baseSalary || 0;
        updatedEmployee.newSalary = currentSalaryUSD + proposal.proposedRaise;
        updatedEmployee.percentChange = currentSalaryUSD > 0 ? 
          (proposal.proposedRaise / currentSalaryUSD) * 100 : 0;
        
        // Calculate new comparatio if we have salary grade info
        if (employee.salaryGradeMid) {
          const newSalaryOriginal = (employee.baseSalary || 0) + 
            (proposal.proposedRaise * (employee.baseSalary || 0) / (employee.baseSalaryUSD || 1));
          updatedEmployee.comparatio = Math.round((newSalaryOriginal / employee.salaryGradeMid) * 100);
        }
      }

      if (proposal.salaryRecommendation !== undefined) {
        (updatedEmployee as any).salaryRecommendation = proposal.salaryRecommendation;
      }

      if (proposal.adjustmentNotes !== undefined) {
        (updatedEmployee as any).adjustmentNotes = proposal.adjustmentNotes;
      }

      return updatedEmployee;

    } catch (error) {
      console.error(`Failed to merge proposal for employee ${employee.employeeId}:`, error);
      return null;
    }
  }

  /**
   * Validate proposal import before processing
   */
  static validateProposalFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      errors.push('File must be a CSV file');
    }

    // Check file size (max 10MB for proposal files)
    if (file.size > 10 * 1024 * 1024) {
      errors.push('File size must be less than 10MB');
    }

    // Check if file is empty
    if (file.size === 0) {
      errors.push('File is empty');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate import summary for user feedback
   */
  static generateImportSummary(result: ProposalImportResult): string {
    const { summary, errors, warnings } = result;
    
    let summaryText = `📊 Proposal Import Summary:\n`;
    summaryText += `• Total proposals processed: ${summary.totalProposals}\n`;
    summaryText += `• Successful matches: ${summary.successfulMatches}\n`;
    summaryText += `• Failed matches: ${summary.failedMatches}\n`;
    summaryText += `• Total raise amount: $${summary.totalRaiseAmount.toLocaleString()}\n`;

    if (warnings.length > 0) {
      summaryText += `\n⚠️ Warnings:\n${warnings.map(w => `• ${w}`).join('\n')}`;
    }

    if (errors.length > 0) {
      summaryText += `\n❌ Errors:\n${errors.map(e => `• ${e}`).join('\n')}`;
    }

    return summaryText;
  }
}

export default ProposalImporter;
