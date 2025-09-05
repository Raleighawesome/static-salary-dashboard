import { ProposalImporter } from '../../services/proposalImporter';
import type { Employee } from '../../types/employee';

describe('ProposalImporter', () => {
  const baseEmployees: Employee[] = [
    {
      employeeId: 'EMP001',
      email: '',
      name: 'John Smith',
      firstName: 'John',
      lastName: 'Smith',
      country: 'US',
      currency: 'USD',
      baseSalary: 50000,
      baseSalaryUSD: 50000,
      basePayAllCountries: 50000,
      timeType: undefined,
      salary: undefined,
      fte: undefined,
      comparatio: 100,
      timeInRole: 12,
      performanceRating: undefined,
      retentionRisk: 50,
      proposedRaise: 0,
      newSalary: 50000,
      percentChange: 0,
    },
  ];

  function createFile(content: string): File {
    return new File([content], 'test.csv', { type: 'text/csv' });
  }

  it('imports existing proposal format', async () => {
    const csv = 'employee number,proposed raise (percent),proposed salary\n' +
      'EMP001,5%,52500';
    const result = await ProposalImporter.importProposals(createFile(csv), baseEmployees);
    expect(result.success).toBe(true);
    const emp = result.updatedEmployees[0];
    expect(emp.proposedRaise).toBeCloseTo(2500);
    expect(emp.newSalary).toBeCloseTo(52500);
  });

  it('imports new Workday proposal format', async () => {
    const csv = 'Associate ID,Associate,Current Base Pay All Countries,Currency,Merit Increase Amount,Merit Increase %,New Base Pay All Countries,Merit Increase Priority/Recommendation,Salary Adjustment Notes\n' +
      'EMP001,John Smith,50000,USD,3000,6%,53000,High,Great performance';
    const result = await ProposalImporter.importProposals(createFile(csv), baseEmployees);
    expect(result.success).toBe(true);
    const emp = result.updatedEmployees[0];
    expect(emp.proposedRaise).toBe(3000);
    expect(emp.newSalary).toBe(53000);
    expect(emp.percentChange).toBeCloseTo(6);
    expect((emp as any).salaryRecommendation).toBe('High');
    expect((emp as any).adjustmentNotes).toBe('Great performance');
  });
});
