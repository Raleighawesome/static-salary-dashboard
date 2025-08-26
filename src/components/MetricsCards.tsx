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
  onQuickFilter?: (filter: 'belowRange' | 'aboveRange' | 'below75' | 'below85NotBelow75' | 'above85' | 'seg1_24m') => void;
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

interface RangeBreachesCardProps {
  additionalMetrics: any;
  totalEmployees: number;
  employeeData: any[];
  onEmployeeSelect?: (employee: any) => void;
  onQuickFilter?: (filter: 'belowRange' | 'aboveRange') => void;
  styles: any;
}

const RangeBreachesCard: React.FC<RangeBreachesCardProps> = ({
  additionalMetrics,
  totalEmployees,
  employeeData,
  onEmployeeSelect,
  onQuickFilter,
  styles
}) => {
  const belowRangeEmployees = employeeData.filter(emp => {
    const base = typeof emp.baseSalary === 'number' ? emp.baseSalary : emp.baseSalaryUSD;
    const min = emp.salaryGradeMin;
    return typeof base === 'number' && typeof min === 'number' && base < min;
  });

  const aboveRangeEmployees = employeeData.filter(emp => {
    const base = typeof emp.baseSalary === 'number' ? emp.baseSalary : emp.baseSalaryUSD;
    const max = emp.salaryGradeMax;
    return typeof base === 'number' && typeof max === 'number' && base > max;
  });

  const allBreachEmployees = [...belowRangeEmployees, ...aboveRangeEmployees];

  return (
    <div className={`${styles.metricCard} ${styles.rangeCard}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>📏</div>
        <div className={styles.cardTitle}>Range Breaches</div>
      </div>
      <div className={styles.cardContent}>
        <div className={styles.primaryMetric}>
          <div className={styles.metricValue}>
            {additionalMetrics.rangeBreaches.belowRange + additionalMetrics.rangeBreaches.aboveRange}
          </div>
          <div className={styles.metricLabel}>Total Breaches</div>
        </div>
        <div className={styles.secondaryMetrics}>
          <div
            className={`${styles.secondaryMetric} ${styles.clickable}`}
            onClick={() => onQuickFilter?.('belowRange')}
          >
            <span className={styles.secondaryLabel}>Below Min:</span>
            <span className={styles.secondaryValue}>
              {additionalMetrics.rangeBreaches.belowRange}{' '}
              ({totalEmployees > 0
                ? ((additionalMetrics.rangeBreaches.belowRange / totalEmployees) * 100).toFixed(1)
                : '0.0'}%)
            </span>
          </div>
          <div
            className={`${styles.secondaryMetric} ${styles.clickable}`}
            onClick={() => onQuickFilter?.('aboveRange')}
          >
            <span className={styles.secondaryLabel}>Above Max:</span>
            <span className={styles.secondaryValue}>
              {additionalMetrics.rangeBreaches.aboveRange}{' '}
              ({totalEmployees > 0
                ? ((additionalMetrics.rangeBreaches.aboveRange / totalEmployees) * 100).toFixed(1)
                : '0.0'}%)
            </span>
          </div>
        </div>
        {allBreachEmployees.length > 0 && (
          <EmployeeListComponent
            employees={allBreachEmployees}
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
          className={styles.primaryMetric}
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
        <div className={styles.cardTitle}>Raise Review Needed</div>
      </div>
      <div className={styles.cardContent}>
        <div className={styles.primaryMetric}>
          <div className={styles.metricValue}>{additionalMetrics.overdueCount18}</div>
          <div className={styles.metricLabel}>Over 18 Months</div>
        </div>
        <div className={styles.secondaryMetrics}>
          <div className={styles.secondaryMetric}>
            <span className={styles.secondaryLabel}>Over 24 Months:</span>
            <span className={styles.secondaryValue}>{additionalMetrics.overdueCount24}</span>
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

    // Salary range breaches
    const { belowRange, aboveRange } = employeeData.reduce(
      (acc, emp) => {
        const base = typeof emp.baseSalary === 'number' ? emp.baseSalary : emp.baseSalaryUSD;
        const min = emp.salaryGradeMin;
        const max = emp.salaryGradeMax;
        if (typeof base === 'number') {
          if (typeof min === 'number' && base < min) acc.belowRange += 1;
          if (typeof max === 'number' && base > max) acc.aboveRange += 1;
        }
        return acc;
      },
      { belowRange: 0, aboveRange: 0 }
    );

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
      rangeBreaches: { belowRange, aboveRange },
    };
  }, [employeeData]);


  return (
    <div className={styles.metricsCards}>
      <div className={styles.cardsHeader}>
        <h3 className={styles.cardsTitle}>📊 Key Metrics</h3>
        <p className={styles.cardsSubtitle}>
          Overview of your salary raise allocation and employee metrics
        </p>
      </div>

      <div className={styles.cardsGrid}>

        {/* Range Breaches Card */}
        <RangeBreachesCard 
          additionalMetrics={additionalMetrics}
          totalEmployees={totalEmployees}
          employeeData={employeeData}
          onEmployeeSelect={onEmployeeSelect}
          onQuickFilter={onQuickFilter}
          styles={styles}
        />

        {/* Risk Assessment Card */}
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

      </div>
    </div>
  );
};

export default MetricsCards;
