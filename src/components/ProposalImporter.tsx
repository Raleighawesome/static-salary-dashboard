import React, { useState, useCallback, useRef } from 'react';
import { ProposalImporter, type ProposalImportResult } from '../services/proposalImporter';
import type { Employee } from '../types/employee';
import styles from './ProposalImporter.module.css';

interface ProposalImporterProps {
  employees: Employee[];
  onProposalsImported: (updatedEmployees: Employee[], result: ProposalImportResult) => void;
  className?: string;
}

export const ProposalImporterComponent: React.FC<ProposalImporterProps> = ({
  employees,
  onProposalsImported,
  className,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ProposalImportResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection and import
  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = ProposalImporter.validateProposalFile(file);
    if (!validation.isValid) {
      alert(`❌ Invalid file:\n${validation.errors.join('\n')}`);
      return;
    }

    setIsImporting(true);
    setImportResult(null);
    setShowResult(false);

    try {
      console.log(`📥 Importing proposals from: ${file.name}`);
      const result = await ProposalImporter.importProposals(file, employees);
      
      setImportResult(result);
      setShowResult(true);

      if (result.success) {
        // Call parent callback with updated employees
        onProposalsImported(result.updatedEmployees, result);
        
        // Show success message
        const summary = ProposalImporter.generateImportSummary(result);
        alert(`✅ Proposals imported successfully!\n\n${summary}`);
      } else {
        // Show error message
        const errorMsg = result.errors.length > 0 ? result.errors.join('\n') : 'No proposals could be imported';
        alert(`❌ Import failed:\n${errorMsg}`);
      }

    } catch (error) {
      console.error('❌ Proposal import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown import error';
      alert(`❌ Import failed: ${errorMessage}`);
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [employees, onProposalsImported]);

  // Trigger file input
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Close result display
  const handleCloseResult = useCallback(() => {
    setShowResult(false);
    setImportResult(null);
  }, []);

  return (
    <div className={`${styles.proposalImporter} ${className || ''}`}>
      <div className={styles.importerHeader}>
        <h3 className={styles.importerTitle}>📈 Import Manager Proposals</h3>
        <p className={styles.importerDescription}>
          Import CSV files from your managers containing proposed salary adjustments
        </p>
      </div>

      <div className={styles.importerContent}>
        {/* Import Instructions */}
        <div className={styles.instructions}>
          <h4>📋 How to Import Manager Proposals:</h4>
          <ol>
            <li>Ask your managers to export their salary proposals as CSV files from this app</li>
            <li>Collect all manager CSV files</li>
            <li>Import each CSV file below - the app will automatically merge proposals by Employee ID</li>
            <li>Review the updated proposals in the employee data table</li>
          </ol>
        </div>

        {/* Import Button */}
        <div className={styles.importActions}>
          <button
            className={styles.importButton}
            onClick={handleImportClick}
            disabled={isImporting || employees.length === 0}
            title={employees.length === 0 ? 'Import employee data first' : 'Import manager proposal CSV'}
          >
            {isImporting ? (
              <>
                <span className={styles.spinner}>⏳</span>
                Importing Proposals...
              </>
            ) : (
              <>
                <span className={styles.importIcon}>📁</span>
                Import Manager CSV
              </>
            )}
          </button>

          {employees.length === 0 && (
            <p className={styles.noDataWarning}>
              ⚠️ Import your compensation and talent reports first
            </p>
          )}
        </div>

        {/* Import Result Display */}
        {showResult && importResult && (
          <div className={styles.resultDisplay}>
            <div className={styles.resultHeader}>
              <h4>📊 Import Results</h4>
              <button className={styles.closeButton} onClick={handleCloseResult}>×</button>
            </div>

            <div className={styles.resultSummary}>
              <div className={styles.summaryStats}>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{importResult.summary.totalProposals}</span>
                  <span className={styles.statLabel}>Total Proposals</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{importResult.summary.successfulMatches}</span>
                  <span className={styles.statLabel}>Successful Matches</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{importResult.summary.failedMatches}</span>
                  <span className={styles.statLabel}>Failed Matches</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>
                    ${importResult.summary.totalRaiseAmount.toLocaleString()}
                  </span>
                  <span className={styles.statLabel}>Total Raise Amount</span>
                </div>
              </div>

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <div className={styles.warnings}>
                  <h5>⚠️ Warnings:</h5>
                  <ul>
                    {importResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className={styles.errors}>
                  <h5>❌ Errors:</h5>
                  <ul>
                    {importResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unmatched Proposals */}
              {importResult.unmatchedProposals.length > 0 && (
                <div className={styles.unmatchedProposals}>
                  <h5>🔍 Unmatched Proposals:</h5>
                  <div className={styles.unmatchedList}>
                    {importResult.unmatchedProposals.slice(0, 5).map((proposal, index) => (
                      <div key={index} className={styles.unmatchedItem}>
                        Employee ID: {proposal.employeeId}
                        {proposal.name && ` (${proposal.name})`}
                      </div>
                    ))}
                    {importResult.unmatchedProposals.length > 5 && (
                      <div className={styles.moreUnmatched}>
                        ... and {importResult.unmatchedProposals.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileImport}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ProposalImporterComponent;
