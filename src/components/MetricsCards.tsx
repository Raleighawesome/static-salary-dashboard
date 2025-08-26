import React, { useMemo, useState } from 'react';
import styles from './MetricsCards.module.css';
import { EmployeeCalculations } from '../utils/calculations';

interface BudgetMetrics {
  totalCurrentSalary: number;
  totalProposedRaises: number;
  remainingBudget: number;
  budgetUtilization: number;
  averageRaisePercent: number;
}

interface MetricsCardsProps {
  totalEmployees: number;
  totalBudget: number;
  budgetCurrency: string;
  budgetMetrics: BudgetMetrics;
  employeeData: any[];
  onEmployeeSelect?: (employee: any) => void;
  onQuickFilter?: (filter: 'below75' | 'below85NotBelow75' | 'above85' | 'seg1_24m') => void;
}

interface EmployeeListComponentProps {
  employees: any[];
  styles: any;
  onEmployeeSelect?: (employee: any) => void;
  maxVisible?: number;
}

const EmployeeListComponent: React.FC<EmployeeListComponentProps> = ({ 
  employees, 
  styles, 
  onEmployeeSelect, 
  maxVisible = 4 
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = Math.ceil(employees.length / maxVisible);
  const startIndex = currentPage * maxVisible;
  const visibleEmployees = employees.slice(startIndex, startIndex + maxVisible);

  const handlePrevPage = () => setCurrentPage(prev => Math.max(0, prev - 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));

  const getName = (employee: any) => {
    return employee.name ||
      employee.employeeName ||
      employee.fullName ||
      employee['Employee Name'] ||
      'Unknown';
  };

  const getId = (employee: any) => {
    return employee.employeeId ||
      employee.id ||
      employee.email ||
      getName(employee);
  };

  if (employees.length === 0) {
    return (
      <div className={styles.employeeList}>
        <div className={styles.employeeItem}>
          <span className={styles.employeeLink}>No employees found</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ul className={styles.employeeList}>
        {visibleEmployees.map((employee) => (
          <li key={getId(employee)} className={styles.employeeItem}>
            <button
              type="button"
              className={styles.employeeLink}
              onClick={() => onEmployeeSelect && onEmployeeSelect(employee)}
            >
              {getName(employee)}
            </button>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className={styles.paginationControls}>
          <button 
            onClick={handlePrevPage} 
            disabled={currentPage === 0}
            className={styles.pageButton}
          >
            ←
          </button>
          <span className={styles.pageInfo}>
            {currentPage + 1} of {totalPages}
          </span>
          <button 
            onClick={handleNextPage} 
            disabled={currentPage === totalPages - 1}
            className={styles.pageButton}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
};

interface TimeInSegment1CardProps {
  employeeData: any[];
  onEmployeeSelect?: (employee: any) => void;
  onQuickFilter?: (filter: 'seg1_24m') => void;
  styles: any;
}

const TimeInSegment1Card: React.FC<TimeInSegment1CardProps> = ({
  employeeData,
  onEmployeeSelect,
  onQuickFilter,
  styles
}) => {
  // Helper function to get performance badge classification
  const getPerformanceBadge = (rating: string | number): { text: string; className: string } => {
    if (!rating) return { text: 'N/A', className: 'noData' };
    
    // Handle text-based performance ratings from CSV
    if (typeof rating === 'string') {
      const ratingLower = rating.toLowerCase();
      if (ratingLower.includes('high') || ratingLower.includes('excellent') || ratingLower.includes('impact')) {
        return { text: rating, className: 'excellent' };
      }
      if (ratingLower.includes('successful') || ratingLower.includes('good') || ratingLower.includes('meets')) {
        return { text: rating, className: 'good' };
      }
      if (ratingLower.includes('developing') || ratingLower.includes('fair') || ratingLower.includes('partial')) {
        return { text: rating, className: 'fair' };
      }
      if (ratingLower.includes('evolving')) {
        return { text: rating, className: 'poor' };
      }
      if (ratingLower.includes('poor') || ratingLower.includes('below') || ratingLower.includes('needs')) {
        return { text: rating, className: 'poor' };
      }
      // Default for unknown text ratings
      return { text: rating, className: 'good' };
    }
    
    // Handle numeric ratings (legacy support)
    const numRating = Number(rating);
    if (numRating <= 0) return { text: 'N/A', className: 'noData' };
    if (numRating >= 4.5) return { text: 'Excellent', className: 'excellent' };
    if (numRating >= 4.0) return { text: 'Good', className: 'good' };
    if (numRating >= 3.5) return { text: 'Fair', className: 'fair' };
    if (numRating >= 3.0) return { text: 'Poor', className: 'poor' };
    return { text: 'Critical', className: 'critical' };
  };

  // Filter employees using the same logic as Seg1 24m+ filter
  const segment1Employees = employeeData.filter(emp => {
    try {
      // Enhanced data extraction with comprehensive field name fallbacks
      const extractFieldValue = (fieldNames: string[], defaultValue: any = null) => {
        for (const fieldName of fieldNames) {
          const value = emp[fieldName];
          if (value !== undefined && value !== null && value !== '') {
            return value;
          }
        }
        return defaultValue;
      };

      // Check for Segment 1
      const seg = (emp.salaryRangeSegment || '').toString().toLowerCase();
      const isSegment1 = seg === 'segment 1' || seg === '1' || seg.includes('segment 1');
      
      if (!isSegment1) return false;

      // Calculate tenure information using EmployeeCalculations
      const tenureInfo = EmployeeCalculations.calculateTenure(
        extractFieldValue([
          'Latest Hire Date', 'hireDate', 'hire_date', 'start_date',
          'Hire Date', 'Start Date'
        ]),
        extractFieldValue([
          'Job Entry Start Date', 'roleStartDate', 'role_start_date', 'current_role_start',
          'Role Start Date', 'Current Role Start'
        ]),
        extractFieldValue([
          'Last Increase Date', 'lastRaiseDate', 'last_raise_date', 'lastRaise',
          'Last Raise Date'
        ])
      );

      const timeInRoleMonths = tenureInfo?.timeInRoleMonths || 0;
      
      // Check for performance issues
      const derivedRating = emp.performanceRating ||
        emp['CALIBRATED VALUE: Overall Performance Rating'] ||
        emp['calibrated value: overall performance rating'] ||
        '';
      const perfClass = getPerformanceBadge(derivedRating).className;
      const hasPerformanceIssues = perfClass === 'poor' || perfClass === 'critical';
      
      return timeInRoleMonths > 24 && !hasPerformanceIssues;
    } catch (error) {
      console.error('Error filtering segment 1 employee:', emp?.name || 'unknown', error);
      return false;
    }
  });

  // Filter to only successful/high performers for the employee list
  const highPerformingSegment1 = segment1Employees.filter(emp => {
    const derivedRating = emp.performanceRating ||
      emp['CALIBRATED VALUE: Overall Performance Rating'] ||
      emp['calibrated value: overall performance rating'] ||
      '';
    const perfClass = getPerformanceBadge(derivedRating).className;
    return perfClass === 'excellent' || perfClass === 'good';
  });

  return (
    <div className={`${styles.metricCard} ${styles.segment1Card}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>⏳</div>
        <div className={styles.cardTitle}>Time in Segment 1</div>
      </div>
      <div className={styles.cardContent}>
        <div 
          className={`${styles.primaryMetric} ${styles.clickable}`}
          onClick={() => onQuickFilter?.('seg1_24m')}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.metricValue}>
            {segment1Employees.length}
          </div>
          <div className={styles.metricLabel}>Over 24 Months</div>
        </div>
        {highPerformingSegment1.length > 0 && (
          <EmployeeListComponent
            employees={highPerformingSegment1}
            styles={styles}
            onEmployeeSelect={onEmployeeSelect}
            maxVisible={4}
          />
        )}
      </div>
    </div>
  );
};

interface RiskAssessmentCardProps {
  totalEmployees: number;
  employeeData: any[];
  onEmployeeSelect?: (employee: any) => void;
  onQuickFilter?: (filter: 'below75' | 'below85NotBelow75') => void;
  styles: any;
}

const RiskAssessmentCard: React.FC<RiskAssessmentCardProps> = ({
  totalEmployees,
  employeeData,
  onEmployeeSelect,
  onQuickFilter,
  styles
}) => {

  const below75Employees = employeeData.filter(emp =>
    emp.comparatio && emp.comparatio <= 75
  );

  const below85NotBelow75Employees = employeeData.filter(emp =>
    emp.comparatio && emp.comparatio < 85 && emp.comparatio > 75
  );


  return (
    <div className={`${styles.metricCard} ${styles.riskCard}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>⚠️</div>
        <div className={styles.cardTitle}>Comparatio Assessment</div>
      </div>
      <div className={styles.cardContent}>
        <div 
          className={`${styles.primaryMetric} ${styles.clickable}`}
          onClick={() => onQuickFilter?.('below75')}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.metricValue}>
            {below75Employees.length}
          </div>
          <div className={styles.metricLabel}>Below minimum</div>
        </div>
        <div className={styles.secondaryMetrics}>
          <div
            className={`${styles.secondaryMetric} ${styles.clickable}`}
            onClick={() => onQuickFilter?.('below85NotBelow75')}
          >
            <span className={styles.secondaryLabel}>Below 85% (not below minimum):</span>
            <span className={styles.secondaryValue}>
              {below85NotBelow75Employees.length}{' '}
              ({totalEmployees > 0
                ? ((below85NotBelow75Employees.length / totalEmployees) * 100).toFixed(1)
                : '0.0'}%)
            </span>
          </div>
        </div>
        {below75Employees.length > 0 && (
          <EmployeeListComponent
            employees={below75Employees}
            styles={styles}
            onEmployeeSelect={onEmployeeSelect}
            maxVisible={4}
          />
        )}
      </div>
    </div>
  );
};

interface RaiseReviewNeededCardProps {
  additionalMetrics: any;
  onEmployeeSelect?: (employee: any) => void;
  styles: any;
}

const RaiseReviewNeededCard: React.FC<RaiseReviewNeededCardProps> = ({
  additionalMetrics,
  onEmployeeSelect,
  styles
}) => {
  const overdueEmployees = additionalMetrics.overdueList.map(({ employee }: any) => employee);

  return (
    <div className={`${styles.metricCard} ${styles.raiseCard}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>⏱️</div>
        <div className={styles.cardTitle}>Merit Review Needed</div>
      </div>
      <div className={styles.cardContent}>
        <div className={styles.primaryMetric}>
          <div className={styles.metricValue}>{additionalMetrics.overdueCount24}</div>
          <div className={styles.metricLabel}>Over 24 Months</div>
        </div>
        <div className={styles.secondaryMetrics}>
          <div className={styles.secondaryMetric}>
            <span className={styles.secondaryLabel}>Over 18 Months:</span>
            <span className={styles.secondaryValue}>{additionalMetrics.overdueCount18}</span>
          </div>
        </div>
        {overdueEmployees.length > 0 && (
          <EmployeeListComponent
            employees={overdueEmployees}
            styles={styles}
            onEmployeeSelect={onEmployeeSelect}
            maxVisible={4}
          />
        )}
      </div>
    </div>
  );
};

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  totalEmployees,
  employeeData,
  onEmployeeSelect,
  onQuickFilter,
}) => {
  // Calculate additional metrics
  const additionalMetrics = useMemo(() => {
    // Helper to safely extract field values with fallbacks
    const extractField = (emp: any, fields: string[]): any => {
      for (const field of fields) {
        const value = emp[field];
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
      return undefined;
    };

    // Performance distribution
    const performanceRatings = employeeData
      .map(emp => emp.performanceRating)
      .filter(rating => rating && rating > 0);

    const avgPerformance = performanceRatings.length > 0
      ? performanceRatings.reduce((sum, rating) => sum + rating, 0) / performanceRatings.length
      : 0;

    // Comparatio analysis
    const comparatios = employeeData
      .map(emp => emp.comparatio)
      .filter(comp => comp && comp > 0);

    const avgComparatio = comparatios.length > 0
      ? comparatios.reduce((sum, comp) => sum + comp, 0) / comparatios.length
      : 0;

    // Employees with raises
    const employeesWithRaises = employeeData.filter(emp =>
      emp.proposedRaise && emp.proposedRaise > 0
    ).length;

    // High performers (rating >= 4.0)
    const highPerformers = employeeData.filter(emp =>
      emp.performanceRating && emp.performanceRating >= 4.0
    ).length;

    // At-risk employees (low comparatio or high retention risk)
    const atRiskEmployees = employeeData.filter(emp =>
      (emp.comparatio && emp.comparatio < 80) ||
      (emp.retentionRisk && emp.retentionRisk > 70)
    ).length;

    // Currency distribution
    const currencies = new Set(employeeData.map(emp => emp.currency).filter(Boolean));

    // Tenure and raise timing analysis
    const tenureData = employeeData.map(emp => {
      const hireDate = extractField(emp, [
        'Latest Hire Date', 'hireDate', 'hire_date', 'start_date', 'Hire Date', 'Start Date'
      ]);
      const roleStart = extractField(emp, [
        'Job Entry Start Date', 'roleStartDate', 'role_start_date', 'current_role_start',
        'Role Start Date', 'Current Role Start'
      ]);
      const lastRaise = extractField(emp, [
        'Last Increase Date', 'lastRaiseDate', 'last_raise_date', 'lastRaise', 'Last Raise Date'
      ]);

      const tenure = EmployeeCalculations.calculateTenure(hireDate, roleStart, lastRaise);
      return { employee: emp, tenure };
    });

    const overdueEmployees = tenureData.filter(({ tenure }) => {
      const months = tenure.lastRaiseMonthsAgo ?? tenure.timeInRoleMonths;
      return months !== undefined && months > 18;
    });

    const overdue24 = overdueEmployees.filter(({ tenure }) => {
      const months = tenure.lastRaiseMonthsAgo ?? tenure.timeInRoleMonths;
      return months > 24;
    });

    const overdueList = overdueEmployees
      .sort((a, b) => (
        (b.tenure.lastRaiseMonthsAgo ?? b.tenure.timeInRoleMonths) -
        (a.tenure.lastRaiseMonthsAgo ?? a.tenure.timeInRoleMonths)
      ))
      .slice(0, 5)
      .map(({ employee, tenure }) => ({
        employee,
        months: tenure.lastRaiseMonthsAgo ?? tenure.timeInRoleMonths,
      }));

    // Segment 1 time analysis (replacing salary range breaches)
    const segment1TimeData = employeeData.filter(emp => {
      try {
        // Helper to safely extract field values with fallbacks
        const extractFieldValue = (fieldNames: string[], defaultValue: any = null) => {
          for (const fieldName of fieldNames) {
            const value = emp[fieldName];
            if (value !== undefined && value !== null && value !== '') {
              return value;
            }
          }
          return defaultValue;
        };

        // Check for Segment 1
        const seg = (emp.salaryRangeSegment || '').toString().toLowerCase();
        const isSegment1 = seg === 'segment 1' || seg === '1' || seg.includes('segment 1');
        
        if (!isSegment1) return false;

        // Calculate tenure information
        const tenureInfo = EmployeeCalculations.calculateTenure(
          extractFieldValue([
            'Latest Hire Date', 'hireDate', 'hire_date', 'start_date',
            'Hire Date', 'Start Date'
          ]),
          extractFieldValue([
            'Job Entry Start Date', 'roleStartDate', 'role_start_date', 'current_role_start',
            'Role Start Date', 'Current Role Start'
          ]),
          extractFieldValue([
            'Last Increase Date', 'lastRaiseDate', 'last_raise_date', 'lastRaise',
            'Last Raise Date'
          ])
        );

        const timeInRoleMonths = tenureInfo?.timeInRoleMonths || 0;
        return timeInRoleMonths > 24;
      } catch (error) {
        console.error('Error calculating segment 1 time data for:', emp?.name || 'unknown', error);
        return false;
      }
    });

    return {
      avgPerformance,
      avgComparatio,
      employeesWithRaises,
      highPerformers,
      atRiskEmployees,
      currencyCount: currencies.size,
      overdueCount18: overdueEmployees.length,
      overdueCount24: overdue24.length,
      overdueList,
      segment1TimeData,
    };
  }, [employeeData]);


  return (
    <div className={styles.metricsCards}>
      <div className={styles.cardsHeader}>
        <h3 className={styles.cardsTitle}>📊 Key Metrics</h3>
        <p className={styles.cardsSubtitle}>
          Metrics based on our merit increase guidelines
        </p>
      </div>

      <div className={styles.cardsGrid}>

        {/* Comparatio Assessment Card (formerly Risk Assessment) */}
        <RiskAssessmentCard 
          totalEmployees={totalEmployees}
          employeeData={employeeData}
          onEmployeeSelect={onEmployeeSelect}
          onQuickFilter={onQuickFilter}
          styles={styles}
        />

        {/* Raise Review Needed Card */}
        <RaiseReviewNeededCard 
          additionalMetrics={additionalMetrics}
          onEmployeeSelect={onEmployeeSelect}
          styles={styles}
        />

        {/* Time in Segment 1 Card (formerly Range Breaches) */}
        <TimeInSegment1Card 
          employeeData={employeeData}
          onEmployeeSelect={onEmployeeSelect}
          onQuickFilter={onQuickFilter}
          styles={styles}
        />

      </div>
    </div>
  );
};

export default MetricsCards;
