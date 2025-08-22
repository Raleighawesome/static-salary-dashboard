// spanOfControl.ts - Utility functions for calculating manager span of control
import type { Employee } from '../types/employee';

export interface SpanOfControlData {
  isManager: boolean;
  isTeamLead: boolean;
  directReports: number;
  managersUnder: number;
  totalTeamSize: number;
  managementLevel: string;
  directReportsList: Employee[];
  managersUnderList: Employee[];
}

export class SpanOfControlCalculator {
  /**
   * Calculate span of control for a given employee
   */
  static calculateSpanOfControl(
    employee: Employee, 
    allEmployees: Employee[]
  ): SpanOfControlData {
    // Extract manager-related fields with fallbacks for different field names
    const isManager = this.isEmployeeManager(employee);
    const isTeamLead = this.isEmployeeTeamLead(employee);
    const managementLevel = this.getManagementLevel(employee);
    
    // If not a manager or team lead, return empty span of control
    if (!isManager && !isTeamLead) {
      return {
        isManager: false,
        isTeamLead: false,
        directReports: 0,
        managersUnder: 0,
        totalTeamSize: 0,
        managementLevel,
        directReportsList: [],
        managersUnderList: [],
      };
    }

    // Find all direct reports (employees who report to this person)
    const directReportsList = allEmployees.filter(emp => 
      this.isDirectReport(emp, employee)
    );

    // Find managers among direct reports
    const managersUnderList = directReportsList.filter(emp => 
      this.isEmployeeManager(emp) || this.isEmployeeTeamLead(emp)
    );

    // Calculate total team size (including indirect reports)
    const totalTeamSize = this.calculateTotalTeamSize(employee, allEmployees);

    return {
      isManager,
      isTeamLead,
      directReports: directReportsList.length,
      managersUnder: managersUnderList.length,
      totalTeamSize,
      managementLevel,
      directReportsList,
      managersUnderList,
    };
  }

  /**
   * Check if an employee is a manager
   */
  private static isEmployeeManager(employee: Employee): boolean {
    // Check various field names that might indicate manager status
    const managerFlag = this.getFieldValue(employee, [
      'managerFlag', 'Manager Flag', 'manager_flag', 'is_manager'
    ]);
    
    const managementLevel = this.getManagementLevel(employee);
    
    // Check if explicitly marked as manager
    if (managerFlag && (
      managerFlag.toString().toLowerCase() === 'yes' || 
      managerFlag.toString().toLowerCase() === 'true' ||
      managerFlag.toString() === '1'
    )) {
      return true;
    }

    // Check if management level indicates manager role
    if (managementLevel && (
      managementLevel.toLowerCase().includes('manager') ||
      managementLevel.toLowerCase().includes('director') ||
      managementLevel.toLowerCase().includes('vp') ||
      managementLevel.toLowerCase().includes('vice president')
    )) {
      return true;
    }

    // Check job title for manager indicators
    const jobTitle = this.getFieldValue(employee, [
      'jobTitle', 'Business Title', 'Job Profile', 'title'
    ]);
    
    if (jobTitle && (
      jobTitle.toLowerCase().includes('manager') ||
      jobTitle.toLowerCase().includes('director') ||
      jobTitle.toLowerCase().includes('lead') ||
      jobTitle.toLowerCase().includes('supervisor')
    )) {
      return true;
    }

    return false;
  }

  /**
   * Check if an employee is a team lead
   */
  private static isEmployeeTeamLead(employee: Employee): boolean {
    const teamLeadFlag = this.getFieldValue(employee, [
      'teamLeadFlag', 'Team Lead Flag', 'team_lead_flag', 'is_team_lead'
    ]);
    
    return teamLeadFlag && (
      teamLeadFlag.toString().toLowerCase() === 'yes' || 
      teamLeadFlag.toString().toLowerCase() === 'true' ||
      teamLeadFlag.toString() === '1'
    );
  }

  /**
   * Get management level for an employee
   */
  private static getManagementLevel(employee: Employee): string {
    return this.getFieldValue(employee, [
      'managementLevel', 'Management Level', 'management_level', 
      'level', 'position_level', 'job_level'
    ]) || 'Individual Contributor';
  }

  /**
   * Check if an employee is a direct report of a manager
   */
  private static isDirectReport(employee: Employee, manager: Employee): boolean {
    const employeeManagerId = this.getFieldValue(employee, [
      'managerId', 'Manager Employee Number', 'manager_id', 'manager_employee_number'
    ]);
    
    const managerEmployeeId = this.getFieldValue(manager, [
      'employeeId', 'Employee Number', 'employee_id', 'id'
    ]);

    return employeeManagerId && managerEmployeeId && 
           employeeManagerId.toString() === managerEmployeeId.toString();
  }

  /**
   * Calculate total team size including indirect reports
   */
  private static calculateTotalTeamSize(manager: Employee, allEmployees: Employee[]): number {
    const visited = new Set<string>();
    
    const countTeamMembers = (managerId: string): number => {
      if (visited.has(managerId)) return 0; // Prevent infinite loops
      visited.add(managerId);
      
      const directReports = allEmployees.filter(emp => {
        const empManagerId = this.getFieldValue(emp, [
          'managerId', 'Manager Employee Number', 'manager_id'
        ]);
        return empManagerId && empManagerId.toString() === managerId;
      });

      let totalCount = directReports.length;
      
      // Recursively count team members under each direct report who is also a manager
      for (const report of directReports) {
        if (this.isEmployeeManager(report) || this.isEmployeeTeamLead(report)) {
          const reportId = this.getFieldValue(report, [
            'employeeId', 'Employee Number', 'employee_id', 'id'
          ]);
          if (reportId) {
            totalCount += countTeamMembers(reportId.toString());
          }
        }
      }
      
      return totalCount;
    };

    const managerEmployeeId = this.getFieldValue(manager, [
      'employeeId', 'Employee Number', 'employee_id', 'id'
    ]);

    return managerEmployeeId ? countTeamMembers(managerEmployeeId.toString()) : 0;
  }

  /**
   * Helper function to get field value with multiple possible field names
   */
  private static getFieldValue(employee: Employee, fieldNames: string[]): any {
    for (const fieldName of fieldNames) {
      const value = (employee as any)[fieldName];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return null;
  }

  /**
   * Format span of control for display
   */
  static formatSpanOfControl(spanData: SpanOfControlData): {
    summary: string;
    details: string[];
  } {
    if (!spanData.isManager && !spanData.isTeamLead) {
      return {
        summary: 'Individual Contributor',
        details: []
      };
    }

    const details: string[] = [];
    
    if (spanData.directReports > 0) {
      details.push(`${spanData.directReports} direct report${spanData.directReports === 1 ? '' : 's'}`);
    }
    
    if (spanData.managersUnder > 0) {
      details.push(`${spanData.managersUnder} manager${spanData.managersUnder === 1 ? '' : 's'} reporting`);
    }
    
    if (spanData.totalTeamSize > spanData.directReports) {
      const indirectReports = spanData.totalTeamSize - spanData.directReports;
      details.push(`${indirectReports} indirect report${indirectReports === 1 ? '' : 's'}`);
    }

    const roleType = spanData.isManager ? 'Manager' : 'Team Lead';
    const summary = spanData.totalTeamSize > 0 
      ? `${roleType} (${spanData.totalTeamSize} total team members)`
      : roleType;

    return {
      summary,
      details
    };
  }
}

export default SpanOfControlCalculator;
