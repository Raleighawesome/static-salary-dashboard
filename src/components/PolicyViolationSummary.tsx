import React, { useMemo, useState } from 'react';
import type { PolicyViolation } from '../types/employee';
import styles from './PolicyViolationSummary.module.css';

interface PolicyViolationSummaryProps {
  violations: PolicyViolation[];
}

interface GroupedViolations {
  [type: string]: PolicyViolation[];
}

const PolicyViolationSummary: React.FC<PolicyViolationSummaryProps> = ({ violations }) => {
  const grouped = useMemo(() => {
    return violations.reduce<GroupedViolations>((acc, violation) => {
      if (!acc[violation.type]) {
        acc[violation.type] = [];
      }
      acc[violation.type].push(violation);
      return acc;
    }, {});
  }, [violations]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (type: string) => {
    setExpanded(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const types = Object.keys(grouped);
  if (types.length === 0) return null;

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>⚠️ Policy Violations</h3>
      {types.map(type => (
        <div key={type} className={styles.typeSection}>
          <button className={styles.typeHeader} onClick={() => toggle(type)}>
            <span className={styles.typeName}>{type.replace(/_/g, ' ')}</span>
            <span className={styles.typeCount}>{grouped[type].length}</span>
            <span className={styles.expandIcon}>{expanded[type] ? '▼' : '▶'}</span>
          </button>
          {expanded[type] && (
            <ul className={styles.employeeList}>
              {grouped[type].map((v, index) => (
                <li key={index} className={styles.employeeItem}>
                  {v.employeeName || v.employeeId || 'Unknown'}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

export default PolicyViolationSummary;
