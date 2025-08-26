import { useState, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { ProposalImporterComponent } from './components/ProposalImporter';
import { DataProcessor } from './services/dataProcessor';
import { DataStorageService } from './services/dataStorage';
import { TempFieldStorageService } from './services/tempFieldStorage';
import { CurrencyConverter } from './services/currencyConverter';
import type { FileUploadResult, Employee } from './types/employee';
import type { ProposalImportResult } from './services/proposalImporter';
import './App.css';

function App() {
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResult[]>([]);
  const [currentView, setCurrentView] = useState<'upload' | 'dashboard'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [processedEmployees, setProcessedEmployees] = useState<Employee[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState<Record<number, boolean>>({});
  
  // Budget management state - moved from Dashboard to persist across views
  const [totalBudget, setTotalBudget] = useState<number>(0);
  const [budgetCurrency, setBudgetCurrency] = useState<string>('USD');


  // Initialize services and session recovery on app load
  useEffect(() => {
    const recoverSession = async () => {
      try {
        // Initialize currency converter for real-time rates
        CurrencyConverter.initializeForRealTime();
        
        // Restore DataProcessor session data first
        await DataProcessor.restoreSessionData();
        
        // Get processed employees from DataProcessor
        const restoredEmployees = DataProcessor.getProcessedEmployees();
        
        if (restoredEmployees.length > 0) {

          
          setProcessedEmployees(restoredEmployees);
          
          // Restore any temporary field changes
          TempFieldStorageService.restoreTempChanges();
          
          // Get session metadata if available
          const currentSession = await DataStorageService.getCurrentSession();
          if (currentSession) {

            
            // Reconstruct uploaded files list from session metadata
            const reconstructedFiles: FileUploadResult[] = [];
            
            if (currentSession.fileMetadata.salaryFile) {
              reconstructedFiles.push({
                fileName: currentSession.fileMetadata.salaryFile.name,
                fileType: 'salary',
                rowCount: currentSession.fileMetadata.salaryFile.rowCount,
                validRows: currentSession.fileMetadata.salaryFile.rowCount, // Assume all valid since processed
                errors: [],
                data: [] // Data is already processed and stored
              });
            }
            
            if (currentSession.fileMetadata.performanceFile) {
              reconstructedFiles.push({
                fileName: currentSession.fileMetadata.performanceFile.name,
                fileType: 'performance',
                rowCount: currentSession.fileMetadata.performanceFile.rowCount,
                validRows: currentSession.fileMetadata.performanceFile.rowCount,
                errors: [],
                data: []
              });
            }
            
            setUploadedFiles(reconstructedFiles);
          }
          
          // Switch to dashboard view if we have data
          setCurrentView('dashboard');
          
        }
        
      } catch (error) {
        console.error('❌ Session recovery failed:', error);
        // Don't show error to user, just start fresh
      } finally {
        setIsLoadingSession(false);
      }
    };

    recoverSession();
  }, []);


  // Handle successful file upload
  const handleFileUpload = useCallback(async (result: FileUploadResult) => {

    
    try {
      // Process the uploaded file through DataProcessor
      await DataProcessor.processUploadedFile(result);
      
      // Update uploaded files list
      setUploadedFiles(prev => [...prev, result]);
      
      // Get the processed employee data
      const processResult = await DataProcessor.processEmployeeData();
      setProcessedEmployees(processResult.employees);
      
      // Update session metadata with file information
      const currentSession = await DataStorageService.getCurrentSession();
      const sessionId = currentSession?.sessionId || `session-${Date.now()}`;
      
      const sessionData = {
        sessionId,
        budget: currentSession?.budget || 0,
        remainingBudget: currentSession?.remainingBudget || 0,
        uploadTimestamp: currentSession?.uploadTimestamp || Date.now(),
        lastModified: Date.now(),
        hasPerformanceData: processResult.hasPerformanceData,
        fileMetadata: {
          ...currentSession?.fileMetadata,
          ...(result.fileType === 'salary' && {
            salaryFile: {
              name: result.fileName,
              size: new Blob([JSON.stringify(result.data)]).size, // Estimate file size
              rowCount: result.rowCount,
              uploadTime: Date.now(),
            }
          }),
          ...(result.fileType === 'performance' && {
            performanceFile: {
              name: result.fileName,
              size: new Blob([JSON.stringify(result.data)]).size, // Estimate file size
              rowCount: result.rowCount,
              uploadTime: Date.now(),
            }
          }),
        },
        processingOptions: {
          convertCurrencies: true,
          joinStrategy: 'email-first',
        },
      };

      if (currentSession) {
        await DataStorageService.updateSession(sessionData);
      } else {
        await DataStorageService.saveSession(sessionData);
      }
      
      // Auto-switch to dashboard view when we have data
      if (processResult.employees.length > 0) {
        setCurrentView('dashboard');
        
      }
      
      // Clear any previous errors
      setError(null);
    } catch (error) {
      console.error('❌ Data processing failed:', error);
      setError(`Data processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Handle upload errors
  const handleUploadError = useCallback((errorMessage: string) => {
    console.error('❌ Upload error:', errorMessage);
    setError(errorMessage);
  }, []);

  // Clear error messages
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Switch between views
  const switchView = useCallback((view: 'upload' | 'dashboard') => {
    setCurrentView(view);
    clearError();
  }, [clearError]);

  // Handle employee updates (for inline editing)
  const handleEmployeeUpdate = useCallback((employeeId: string, updates: Partial<Employee>) => {
    setProcessedEmployees(prev => {
      const updatedEmployees = prev.map(emp => 
        emp.employeeId === employeeId 
          ? { ...emp, ...updates }
          : emp
      );
      
      return updatedEmployees;
    });

  }, []);

  // Handle budget changes
  const handleBudgetChange = useCallback((budget: number, currency: string) => {
    setTotalBudget(budget);
    setBudgetCurrency(currency);

  }, []);

  // Handle manager proposal imports
  const handleProposalsImported = useCallback((updatedEmployees: Employee[], result: ProposalImportResult) => {
    console.log(`📈 Imported ${result.summary.successfulMatches} proposals from managers`);
    
    // Update the processed employees with the merged proposals
    setProcessedEmployees(updatedEmployees);
    
    // Update storage
    DataStorageService.saveEmployees(updatedEmployees.map(emp => ({
      employeeId: emp.employeeId,
      email: emp.email,
      name: emp.name,
      country: emp.country,
      currency: emp.currency,
      baseSalary: emp.baseSalary,
      baseSalaryUSD: emp.baseSalaryUSD,
      comparatio: emp.comparatio,
      timeInRole: emp.timeInRole,
      performanceRating: emp.performanceRating,
      retentionRisk: emp.retentionRisk,
      proposedRaise: emp.proposedRaise,
      newSalary: emp.newSalary,
      percentChange: emp.percentChange,
      businessImpactScore: emp.businessImpactScore,
      salaryGradeMin: emp.salaryGradeMin,
      salaryGradeMid: emp.salaryGradeMid,
      salaryGradeMax: emp.salaryGradeMax,
      hireDate: emp.hireDate,
      roleStartDate: emp.roleStartDate,
      lastRaiseDate: emp.lastRaiseDate,
      departmentCode: emp.departmentCode,
      jobTitle: emp.jobTitle,
      managerId: emp.managerId,
      managerName: emp.managerName,
      futuretalent: emp.futuretalent,
      movementReadiness: emp.movementReadiness,
      proposedTalentActions: emp.proposedTalentActions,
      salaryRangeSegment: emp.salaryRangeSegment,
      belowRangeMinimum: emp.belowRangeMinimum,
      managerFlag: emp.managerFlag,
      teamLeadFlag: emp.teamLeadFlag,
      managementLevel: emp.managementLevel,
    }))).catch(error => {
      console.error('❌ Failed to save updated employees:', error);
    });

  }, []);

  // Handle data reset
  const handleResetData = useCallback(async () => {
    try {

      
      // Reset all services
      await DataStorageService.resetAllData();
      TempFieldStorageService.clearAllTempChanges();
      
      // Reset component state
      setProcessedEmployees([]);
      setUploadedFiles([]);
      setTotalBudget(0);
      setBudgetCurrency('USD');
      setCurrentView('upload');
      setError(null);
      setShowResetConfirm(false);
      

    } catch (error) {
      console.error('❌ Reset failed:', error);
      setError(`Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Handle reset confirmation
  const handleResetConfirm = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const handleResetCancel = useCallback(() => {
    setShowResetConfirm(false);
  }, []);

  // Helper function to truncate file names
  const truncateFileName = useCallback((fileName: string, maxLength: number = 30): string => {
    if (fileName.length <= maxLength) return fileName;
    
    const extension = fileName.split('.').pop();
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - extension!.length - 4);
    
    return `${truncatedName}...${extension}`;
  }, []);

  // Helper function to toggle issue details
  const toggleIssueDetails = useCallback((fileIndex: number) => {
    setExpandedIssues(prev => ({
      ...prev,
      [fileIndex]: !prev[fileIndex]
    }));
  }, []);

  // Use processed employee data instead of raw file data
  const totalEmployees = processedEmployees.length;

  // Show loading screen during session recovery
  if (isLoadingSession) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-spinner">🔄</div>
            <h2>Loading Salary Raise Dashboard</h2>
            <p>Checking for previous session data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          {/* Navigation */}
          <nav className="app-nav">
            <button
              className={`nav-button ${currentView === 'upload' ? 'active' : ''}`}
              onClick={() => switchView('upload')}
            >
              📁 Upload Files
            </button>
            <button
              className={`nav-button ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => switchView('dashboard')}
              disabled={totalEmployees === 0}
            >
              📊 Dashboard {totalEmployees > 0 && `(${totalEmployees} employees)`}
            </button>
            {totalEmployees > 0 && (
              <button
                className="nav-button reset-button"
                onClick={handleResetConfirm}
                title="Reset all data to start fresh"
              >
                🔄 Reset Data
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="modal-overlay">
          <div className="modal-content reset-modal">
            <div className="modal-header">
              <h3>⚠️ Reset All Data</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to reset all data? This will:
              </p>
              <ul>
                <li>Delete all uploaded employee data</li>
                <li>Clear budget information</li>
                <li>Remove all session data</li>
                <li>Return you to the upload screen</li>
              </ul>
              <p className="warning-text">
                <strong>This action cannot be undone.</strong>
              </p>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-button cancel-button"
                onClick={handleResetCancel}
              >
                Cancel
              </button>
              <button 
                className="modal-button confirm-button"
                onClick={handleResetData}
              >
                Reset All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
            <button className="error-close" onClick={clearError}>×</button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`app-main ${currentView === 'dashboard' ? 'dashboard-main' : ''}`}>
        {currentView === 'upload' ? (
          <div className="upload-view">
            <div className="view-header">
              <h2>📁 Upload Employee Data</h2>
              <p>Upload your salary and performance files to get started</p>
            </div>

            {/* Workday Instructions */}
            <div className="workday-instructions">
              <h3>📋 Required Workday Reports</h3>
              <p>Before uploading, please download these two spreadsheets from Workday:</p>
              
              <div className="instructions-list">
                <div className="instruction-item">
                  <div className="instruction-number">1</div>
                  <div className="instruction-content">
                    <h4>RH Talent Assessment Calibration Audit Report</h4>
                    <p>Select <strong>"post calibration"</strong> (or <strong>"during calibration"</strong> if in a current calibration cycle)</p>
                  </div>
                </div>
                
                <div className="instruction-item">
                  <div className="instruction-number">2</div>
                  <div className="instruction-content">
                    <h4>RH Compensation Report w/ Hierarchy - Manager</h4>
                    <p>Make sure to <strong>uncheck "Direct Reports Only"</strong> if you want your entire organization</p>
                  </div>
                </div>
              </div>
              
              <div className="export-instruction">
                <span className="export-icon">📤</span>
                <p><strong>After each report generates:</strong> Click the red <strong>"export to excel"</strong> image in the top right corner</p>
              </div>
            </div>
            
            <FileUpload
              onFileUpload={handleFileUpload}
              onError={handleUploadError}
              maxFileSize={50} // 50MB
            />

            {/* Manager Proposal Importer - Only show if we have employee data */}
            {processedEmployees.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <ProposalImporterComponent
                  employees={processedEmployees}
                  onProposalsImported={handleProposalsImported}
                />
              </div>
            )}


            {/* Upload Summary */}
            {uploadedFiles.length > 0 && (
              <div className="upload-summary">
                <h3>📋 Uploaded Files Summary</h3>
                <div className="summary-cards">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="summary-card">
                      <div className="card-header">
                        <span 
                          className="file-name" 
                          title={file.fileName}
                        >
                          {truncateFileName(file.fileName)}
                        </span>
                        <span className={`file-type ${file.fileType}`}>{file.fileType}</span>
                      </div>
                      <div className="card-stats">
                        <div className="stat">
                          <span className="stat-label">Total Rows:</span>
                          <span className="stat-value">{file.rowCount}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Valid Rows:</span>
                          <span className="stat-value">{file.validRows}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Success Rate:</span>
                          <span className="stat-value">
                            {file.rowCount > 0 ? ((file.validRows / file.rowCount) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </div>
                      {file.errors.length > 0 && (
                        <div className="card-errors">
                          <div 
                            className="error-summary"
                            onClick={() => toggleIssueDetails(index)}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="error-count">
                              {file.errors.length} issue{file.errors.length !== 1 ? 's' : ''} found
                            </span>
                            <span className="dropdown-arrow">
                              {expandedIssues[index] ? '▲' : '▼'}
                            </span>
                          </div>
                          {expandedIssues[index] && (
                            <div className="error-details">
                              <div className="error-details-header">Issue Details:</div>
                              <ul className="error-list">
                                {file.errors.map((error, errorIndex) => (
                                  <li key={errorIndex} className="error-item">
                                    {error}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {totalEmployees > 0 && (
                  <div className="proceed-section">
                    <button
                      className="proceed-button"
                      onClick={() => switchView('dashboard')}
                    >
                      📊 Proceed to Dashboard ({totalEmployees} employees)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="dashboard-view">
            <Dashboard
              employeeData={processedEmployees}
              uploadedFiles={uploadedFiles}
              onBackToUpload={() => switchView('upload')}
              onEmployeeUpdate={handleEmployeeUpdate}
              totalBudget={totalBudget}
              budgetCurrency={budgetCurrency}
              onBudgetChange={handleBudgetChange}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          Built for managers to efficiently allocate salary raises with budget tracking and policy compliance
        </p>
      </footer>
    </div>
  );
}

export default App;
