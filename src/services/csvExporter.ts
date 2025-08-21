import type { Employee, PolicyViolation } from '../types/employee';
import { PolicyValidator } from '../utils/policyValidation';

// Export configuration interface
export interface ExportConfig {
  includeOriginalData: boolean;
  includeCalculatedFields: boolean;
  includePolicyViolations: boolean;
  includeMetadata: boolean;
  customColumnOrder?: string[];
  filterCriteria?: {
    minRaiseAmount?: number;
    maxRaiseAmount?: number;
    countries?: string[];
    departmentCodes?: string[];
    onlyWithRaises?: boolean;
  };
}

// Export result interface
export interface ExportResult {
  success: boolean;
  fileName: string;
  rowCount: number;
  totalRaiseAmount: number;
  policyViolations: PolicyViolation[];
  exportTimestamp: number;
  downloadUrl?: string;
  error?: string;
}

// Column order matching original RH Compensation Report format plus new proposed columns
const DEFAULT_COLUMN_ORDER = [
  // Original compensation report columns (matching RH_Compensation_Report_w_Hierarchy_-_Manager.csv)
  'employeeId', // Employee Number
  'name', // Employee Full name
  'jobFunction', // Job Function
  'jobFamily', // Job Family
  'jobProfile', // Job Profile
  'jobCategory', // Job Category
  'jobTitle', // Business Title
  'jobCode', // Job Code
  'gradeBand', // Grade Band
  'gradePayRegion', // Grade Pay Region
  'compensationGradeProfile', // Compensation Grade Profile
  'baseSalary', // Base Pay All Countries
  'variableCompPercent', // Variable Comp %
  'variableCompAmt', // Variable Comp Amt (FTE)
  'salesTIC', // Sales TIC
  'comparatio', // Comparatio
  'salaryRangeSegment', // Salary Range Segment
  'belowRangeMinimum', // Below Range Minimum?
  'totalBasePay', // Total Base Pay
  'salary', // Salary
  'primaryCompensationBasis', // Primary Compensation Basis
  'annualCalculatedBasePay', // Annual Calculated Base Pay All Countries
  'annualCalculatedOTE', // Annual Calculated OTE
  'salaryGradeMin', // Min Pay Grade Value
  'salaryGradeMid', // Mid Pay Grade Value
  'salaryGradeMax', // Max Pay Grade Value
  'payMixGuidelines', // Pay Mix Guidelines
  'basePercentOfOTE', // Base % of OTE
  'ticPercentOfOTE', // TIC % of OTE
  'currency', // Currency
  'currencyRateToUSD', // Currency Rate to USD as of Effective Date (USD=1)
  'lastSalaryChangeDate', // Last Salary Change Date
  'salesTICStartDate', // Sales TIC Start Date
  'reviewName', // Review Name
  'performanceRating', // Overall Performance Rating
  'futuretalent', // Identified as Future Talent?
  'movementReadiness', // Movement Readiness
  'managerId', // Manager Employee Number
  'managerName', // Manager Full name
  'latestHireDate', // Latest Hire Date
  'hireDate', // Original Hire Date
  'organizationName', // Organization Name
  'departmentCode', // Employee Cost Center Code
  'personSystemStatus', // Person System Status
  'timeType', // Time Type
  'workerStatus', // Worker Status
  'scheduledWeeklyHours', // Scheduled Weekly Hours
  'defaultHours', // Default Hours
  'fte', // FTE
  'hourlySalary', // Hourly/Salary
  'periodSalaryPlan', // Period Salary Plan
  'jobEntryStartDate', // Job Entry Start Date
  'exemptionStatus', // Exemption Status
  'department', // Department - CC Based
  'location', // Location
  'countryISO2', // Country ISO2
  'country', // Country
  'region', // Region
  'managerFlag', // Manager Flag
  'teamLeadFlag', // Team Lead Flag
  'cltOrg', // CLT Org
  'level2FullName', // Level2 Full Name
  'level3FullName', // Level3 Full Name
  'level4FullName', // Level4 Full Name
  'level5FullName', // Level5 Full Name
  'level6FullName', // Level6 Full Name
  'level7FullName', // Level7 Full Name
  'level8FullName', // Level8 Full Name
  'level9FullName', // Level9 Full Name
  'level10FullName', // Level10 Full Name
  'level11FullName', // Level11 Full Name
  'level12FullName', // Level12 Full Name
  'managementLevel', // Management Level
  
  // NEW PROPOSED COLUMNS (as requested)
  'proposedRaisePercent', // Proposed Raise (percent)
  'proposedSalary', // Proposed Salary
  'proposedComparatio', // Proposed Comparatio
  
  // Additional calculated fields for context
  'proposedRaiseOriginal', // Proposed Raise (in employee's currency)
  'percentChange', // Raise Percentage Change
  'retentionRisk', // Retention Risk
  'businessImpactScore', // Business Impact Score
  'timeInRole', // Time in Role
  
  // Policy compliance
  'policyViolations',
  'violationSeverity',
  'approvalRequired',
  
  // Export metadata
  'exportTimestamp',
  'lastModified'
];

export class CSVExporter {
  // Main export function
  public static async exportEmployeeData(
    employees: Employee[],
    config: Partial<ExportConfig> = {}
  ): Promise<ExportResult> {

    
    try {
      // Merge with default config
      const exportConfig: ExportConfig = {
        includeOriginalData: true,
        includeCalculatedFields: true,
        includePolicyViolations: true,
        includeMetadata: true,
        customColumnOrder: DEFAULT_COLUMN_ORDER,
        ...config
      };

      // Filter employees based on criteria
      const filteredEmployees = this.filterEmployees(employees, exportConfig.filterCriteria);


      // Validate all employees and collect policy violations
      const allViolations: PolicyViolation[] = [];
      const enrichedEmployees = filteredEmployees.map(employee => {
        const violations = PolicyValidator.validateEmployee(employee);
        allViolations.push(...violations);
        
        return this.enrichEmployeeData(employee, violations, exportConfig);
      });

      // Generate CSV content
      const csvContent = this.generateCSVContent(enrichedEmployees, exportConfig);
      
      // Calculate export metrics
      const totalRaiseAmount = filteredEmployees.reduce((sum, emp) => 
        sum + (emp.proposedRaise || 0), 0
      );

      // Create download blob and URL
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `salary-raises-export-${timestamp}.csv`;

      const result: ExportResult = {
        success: true,
        fileName,
        rowCount: enrichedEmployees.length,
        totalRaiseAmount,
        policyViolations: allViolations,
        exportTimestamp: Date.now(),
        downloadUrl
      };


      return result;

    } catch (error) {
      console.error('❌ CSV export failed:', error);
      return {
        success: false,
        fileName: '',
        rowCount: 0,
        totalRaiseAmount: 0,
        policyViolations: [],
        exportTimestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown export error'
      };
    }
  }

  // Filter employees based on export criteria
  private static filterEmployees(
    employees: Employee[], 
    criteria?: ExportConfig['filterCriteria']
  ): Employee[] {
    if (!criteria) return employees;

    return employees.filter(employee => {
      // Filter by raise amount range
      if (criteria.minRaiseAmount && (employee.proposedRaise || 0) < criteria.minRaiseAmount) {
        return false;
      }
      if (criteria.maxRaiseAmount && (employee.proposedRaise || 0) > criteria.maxRaiseAmount) {
        return false;
      }

      // Filter by countries
      if (criteria.countries && criteria.countries.length > 0) {
        if (!criteria.countries.includes(employee.country || '')) {
          return false;
        }
      }

      // Filter by department codes
      if (criteria.departmentCodes && criteria.departmentCodes.length > 0) {
        if (!criteria.departmentCodes.includes(employee.departmentCode || '')) {
          return false;
        }
      }

      // Filter to only employees with raises
      if (criteria.onlyWithRaises && (!employee.proposedRaise || employee.proposedRaise <= 0)) {
        return false;
      }

      return true;
    });
  }

  // Enrich employee data with calculated fields and policy information
  private static enrichEmployeeData(
    employee: Employee, 
    violations: PolicyViolation[], 
    config: ExportConfig
  ): any {
    const enriched: any = { ...employee };

    // Always calculate the three new required columns using employee's original currency
    const currentSalaryUSD = employee.baseSalaryUSD || 0;
    const currentSalaryOriginal = employee.baseSalary || 0; // Original currency
    const raiseAmountUSD = employee.proposedRaise || 0;
    
    // Convert raise amount from USD back to employee's original currency
    // The app stores raises in USD for comparison, but export should show values in employee's currency
    // Calculate conversion rate from the salary difference (original currency / USD)
    const conversionRate = currentSalaryUSD > 0 ? currentSalaryOriginal / currentSalaryUSD : 1;
    const raiseAmountOriginal = raiseAmountUSD * conversionRate;
    
    // 1. Proposed Raise (percent) - Calculate percentage from raise amount
    enriched.proposedRaisePercent = currentSalaryOriginal > 0 ? 
      ((raiseAmountOriginal / currentSalaryOriginal) * 100).toFixed(2) + '%' : '0.00%';
    
    // 2. Proposed Salary - Current salary + raise amount (in original currency)
    enriched.proposedSalary = currentSalaryOriginal + raiseAmountOriginal;
    
    // 3. Proposed Comparatio - Calculate new comparatio with proposed salary
    // Note: salaryGradeMid should be in the same currency as baseSalary
    const salaryMid = employee.salaryGradeMid || 0;
    enriched.proposedComparatio = salaryMid > 0 ? 
      Math.round((enriched.proposedSalary / salaryMid) * 100) + '%' : '0%';
    
    // Store the raise amount in original currency for the "Proposed Raise" column
    enriched.proposedRaiseOriginal = raiseAmountOriginal;

    if (config.includeCalculatedFields) {
      // Calculate new salary and percentage change (legacy fields) - using original currency
      enriched.newSalary = currentSalaryOriginal + raiseAmountOriginal;
      
      enriched.percentChange = currentSalaryOriginal > 0 ? 
        ((raiseAmountOriginal / currentSalaryOriginal) * 100).toFixed(2) : '0.00';

      // Map original data to match compensation report column names
      enriched.salary = enriched.baseSalary; // Salary column
      enriched.totalBasePay = enriched.baseSalary; // Total Base Pay
      enriched.annualCalculatedBasePay = enriched.baseSalary; // Annual Calculated Base Pay
      enriched.primaryCompensationBasis = '0.00'; // Default value
      enriched.annualCalculatedOTE = '0.00'; // Default value
      enriched.payMixGuidelines = ''; // Default empty
      enriched.basePercentOfOTE = '0.00%'; // Default value
      enriched.ticPercentOfOTE = '0.00%'; // Default value
      enriched.currencyRateToUSD = enriched.currency === 'USD' ? '1' : ''; // Default for USD
      enriched.salesTIC = '0.00'; // Default value
      enriched.variableCompPercent = '0.00%'; // Default value
      enriched.variableCompAmt = '0.00'; // Default value
      enriched.salesTICStartDate = ''; // Default empty
      enriched.reviewName = '2024-Q4 Talent Assessment & Calibration'; // Default review name
      enriched.latestHireDate = enriched.hireDate; // Same as hire date
      enriched.organizationName = ''; // Default empty
      enriched.personSystemStatus = 'Regular'; // Default status
      enriched.timeType = 'Full time'; // Default time type
      enriched.workerStatus = 'Active'; // Default status
      enriched.scheduledWeeklyHours = '40'; // Default hours
      enriched.defaultHours = '40'; // Default hours
      enriched.fte = '1'; // Default FTE
      enriched.hourlySalary = 'Salary'; // Default type
      enriched.periodSalaryPlan = ''; // Default empty
      enriched.jobEntryStartDate = enriched.roleStartDate; // Same as role start
      enriched.exemptionStatus = 'EX'; // Default exempt status
      enriched.department = 'R&D - Research and Development'; // Default department
      enriched.location = enriched.country === 'US' ? 'Remote US' : 'Remote ' + enriched.country; // Default location
      enriched.countryISO2 = enriched.country === 'United States' ? 'US' : 
                            enriched.country === 'India' ? 'IN' : enriched.country; // Map country to ISO2
      enriched.region = enriched.country === 'US' ? 'NA' : 
                       enriched.country === 'IN' ? 'APAC' : 'Other'; // Default regions
      enriched.managerFlag = enriched.managerId ? 'No' : 'No'; // Default not a manager
      enriched.teamLeadFlag = 'No'; // Default not a team lead

      // Calculate tenure information
      if (employee.hireDate) {
        const hireDate = new Date(employee.hireDate);
        const now = new Date();
        const tenureMonths = Math.floor((now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        enriched.totalTenure = tenureMonths;
      }

      if (employee.roleStartDate) {
        const roleStart = new Date(employee.roleStartDate);
        const now = new Date();
        const roleMonths = Math.floor((now.getTime() - roleStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        enriched.timeInRole = roleMonths;
      }
    }

    if (config.includePolicyViolations) {
      // Add policy violation information
      enriched.policyViolations = violations.map(v => v.message).join('; ');
      enriched.violationSeverity = PolicyValidator.getViolationColor(violations);
      enriched.approvalRequired = violations.some(v => v.severity === 'ERROR') ? 'YES' : 'NO';
    }

    if (config.includeMetadata) {
      // Add export metadata
      enriched.exportTimestamp = new Date().toISOString();
      enriched.lastModified = new Date().toISOString();
      enriched.modifiedBy = 'System'; // Could be enhanced to track actual user
    }

    return enriched;
  }

  // Generate CSV content from employee data
  private static generateCSVContent(employees: any[], config: ExportConfig): string {
    if (employees.length === 0) {
      return 'No data to export';
    }

    // Determine column order
    const columnOrder = config.customColumnOrder || DEFAULT_COLUMN_ORDER;
    
    // Get all available columns from the data
    const availableColumns = new Set<string>();
    employees.forEach(emp => {
      Object.keys(emp).forEach(key => availableColumns.add(key));
    });

    // Filter column order to only include available columns
    const finalColumns = columnOrder.filter(col => availableColumns.has(col));
    
    // Add any remaining columns not in the specified order
    availableColumns.forEach(col => {
      if (!finalColumns.includes(col)) {
        finalColumns.push(col);
      }
    });

    // Generate header row
    const headers = finalColumns.map(col => this.formatColumnHeader(col));
    const csvRows = [headers.join(',')];

    // Generate data rows
    employees.forEach(employee => {
      const row = finalColumns.map(column => {
        const value = employee[column];
        return this.formatCSVValue(value);
      });
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  // Format column headers to match original compensation report format
  private static formatColumnHeader(columnName: string): string {
    // Direct mapping to match original RH Compensation Report headers exactly
    const headerMappings: { [key: string]: string } = {
      // Original compensation report columns
      'employeeId': 'Employee Number',
      'name': 'Employee Full name',
      'jobFunction': 'Job Function',
      'jobFamily': 'Job Family',
      'jobProfile': 'Job Profile',
      'jobCategory': 'Job Category',
      'jobTitle': 'Business Title',
      'jobCode': 'Job Code',
      'gradeBand': 'Grade Band',
      'gradePayRegion': 'Grade Pay Region',
      'compensationGradeProfile': 'Compensation Grade Profile',
      'baseSalary': 'Base Pay All Countries',
      'variableCompPercent': 'Variable Comp %',
      'variableCompAmt': 'Variable Comp Amt (FTE)',
      'salesTIC': 'Sales TIC',
      'comparatio': 'Comparatio',
      'salaryRangeSegment': 'Salary Range Segment',
      'belowRangeMinimum': 'Below Range Minimum?',
      'totalBasePay': 'Total Base Pay',
      'salary': 'Salary',
      'primaryCompensationBasis': 'Primary Compensation Basis',
      'annualCalculatedBasePay': 'Annual Calculated Base Pay All Countries',
      'annualCalculatedOTE': 'Annual Calculated OTE',
      'salaryGradeMin': 'Min Pay Grade Value',
      'salaryGradeMid': 'Mid Pay Grade Value',
      'salaryGradeMax': 'Max Pay Grade Value',
      'payMixGuidelines': 'Pay Mix Guidelines',
      'basePercentOfOTE': 'Base % of OTE',
      'ticPercentOfOTE': 'TIC % of OTE',
      'currency': 'Currency',
      'currencyRateToUSD': 'Currency Rate to USD as of Effective Date (USD=1)',
      'lastSalaryChangeDate': 'Last Salary Change Date',
      'salesTICStartDate': 'Sales TIC Start Date',
      'reviewName': 'Review Name',
      'performanceRating': 'Overall Performance Rating',
      'futuretalent': 'Identified as Future Talent?',
      'movementReadiness': 'Movement Readiness',
      'managerId': 'Manager Employee Number',
      'managerName': 'Manager Full name',
      'latestHireDate': 'Latest Hire Date',
      'hireDate': 'Original Hire Date',
      'organizationName': 'Organization Name',
      'departmentCode': 'Employee Cost Center Code',
      'personSystemStatus': 'Person System Status',
      'timeType': 'Time Type',
      'workerStatus': 'Worker Status',
      'scheduledWeeklyHours': 'Scheduled Weekly Hours',
      'defaultHours': 'Default Hours',
      'fte': 'FTE',
      'hourlySalary': 'Hourly/Salary',
      'periodSalaryPlan': 'Period Salary Plan',
      'jobEntryStartDate': 'Job Entry Start Date',
      'exemptionStatus': 'Exemption Status',
      'department': 'Department - CC Based',
      'location': 'Location',
      'countryISO2': 'Country ISO2',
      'country': 'Country',
      'region': 'Region',
      'managerFlag': 'Manager Flag',
      'teamLeadFlag': 'Team Lead Flag',
      'cltOrg': 'CLT Org',
      'level2FullName': 'Level2 Full Name',
      'level3FullName': 'Level3 Full Name',
      'level4FullName': 'Level4 Full Name',
      'level5FullName': 'Level5 Full Name',
      'level6FullName': 'Level6 Full Name',
      'level7FullName': 'Level7 Full Name',
      'level8FullName': 'Level8 Full Name',
      'level9FullName': 'Level9 Full Name',
      'level10FullName': 'Level10 Full Name',
      'level11FullName': 'Level11 Full Name',
      'level12FullName': 'Level12 Full Name',
      'managementLevel': 'Management Level',
      
      // NEW PROPOSED COLUMNS (as requested)
      'proposedRaisePercent': 'Proposed Raise (percent)',
      'proposedSalary': 'Proposed Salary',
      'proposedComparatio': 'Proposed Comparatio',
      
      // Additional calculated fields
      'proposedRaiseOriginal': 'Proposed Raise',
      'percentChange': 'Raise Percentage (%)',
      'retentionRisk': 'Retention Risk (%)',
      'businessImpactScore': 'Business Impact Score',
      'timeInRole': 'Time in Role (Months)',
      'policyViolations': 'Policy Violations',
      'violationSeverity': 'Violation Severity',
      'approvalRequired': 'Approval Required',
      'exportTimestamp': 'Export Timestamp',
      'lastModified': 'Last Modified'
    };

    // Return mapped header or fallback to formatted column name
    const mappedHeader = headerMappings[columnName];
    if (mappedHeader) {
      return mappedHeader;
    }

    // Fallback: Convert camelCase to Title Case for unmapped columns
    const formatted = columnName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    
    return formatted;
  }

  // Format individual CSV values with proper escaping
  private static formatCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Convert to string
    let stringValue = String(value);

    // Handle numbers with proper formatting
    if (typeof value === 'number') {
      // Format currency values
      if (value > 1000 && Number.isInteger(value)) {
        stringValue = value.toLocaleString();
      } else if (value % 1 !== 0) {
        // Format decimals to 2 places for percentages and ratios
        stringValue = value.toFixed(2);
      }
    }

    // Handle dates
    if (value instanceof Date) {
      stringValue = value.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    // Escape quotes and wrap in quotes if necessary
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      stringValue = `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  // Trigger download of the CSV file
  public static downloadCSV(result: ExportResult): void {
    if (!result.success || !result.downloadUrl) {
      console.error('❌ Cannot download CSV: Export failed or no download URL');
      return;
    }

    try {
      // Create temporary download link
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.fileName;
      link.style.display = 'none';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
  
      
      // Clean up the blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(result.downloadUrl!);
      }, 1000);
      
    } catch (error) {
      console.error('❌ CSV download failed:', error);
    }
  }

  // Generate export preview (first 5 rows) for validation
  public static generatePreview(employees: Employee[], config: Partial<ExportConfig> = {}): string {
    const previewEmployees = employees.slice(0, 5);
    const previewConfig = { ...config, includeMetadata: false };
    
    return this.generateCSVContent(
      previewEmployees.map(emp => this.enrichEmployeeData(emp, [], previewConfig as ExportConfig)),
      previewConfig as ExportConfig
    );
  }

  // Validate export data before processing
  public static validateExportData(employees: Employee[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (employees.length === 0) {
      errors.push('No employee data to export');
    }

    // Check for required fields
    const requiredFields = ['employeeId', 'name'];
    employees.forEach((emp, index) => {
      requiredFields.forEach(field => {
        if (!emp[field as keyof Employee]) {
          errors.push(`Employee at row ${index + 1} is missing required field: ${field}`);
        }
      });
    });

    // Check for data quality issues
    const employeesWithRaises = employees.filter(emp => emp.proposedRaise && emp.proposedRaise > 0);
    if (employeesWithRaises.length === 0) {
      warnings.push('No employees have proposed raises');
    }

    const employeesWithoutSalary = employees.filter(emp => !emp.baseSalaryUSD && !emp.baseSalary);
    if (employeesWithoutSalary.length > 0) {
      warnings.push(`${employeesWithoutSalary.length} employees are missing salary information`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
} 