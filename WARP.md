# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a React-based salary raise dashboard designed for managers to efficiently allocate salary raises with budget tracking and policy compliance validation. It's built as a static web application that processes Workday exports and operates entirely client-side with no server dependencies.

## Common Development Commands

### Essential Development Commands
```bash
# Start development server
npm run dev

# Build for production (regular)
npm run build

# Build for static deployment (recommended)
npm run build:static

# Build for GitHub Pages
npm run build:github

# Type checking
npm run typecheck

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Linting
npm run lint

# Format code
npm run format

# Check formatting without changes
npm run format:check

# Preview built application
npm run preview

# Preview static build locally
npm run preview:static
```

### Testing Individual Components
```bash
# Run specific test files
npm test -- --testNamePattern="EmployeeTable"
npm test -- src/components/EmployeeTable.test.tsx

# Run tests for specific service
npm test -- src/services/__tests__/
```

## Architecture Overview

### High-Level Architecture

This is a **client-side only** React application with the following key architectural patterns:

1. **Data Processing Pipeline**: Files are uploaded → parsed → joined → enhanced → stored locally
2. **Local-First Storage**: All data persists in IndexedDB with automatic backups to localStorage
3. **Service Layer Architecture**: Clear separation between UI components and business logic
4. **Real-Time Currency Conversion**: Live exchange rates with fallback to static rates

### Core Data Flow

```
File Upload → DataParser → DataJoiner → DataProcessor → DataStorageService → IndexedDB
                                                    ↓
                                            AutoBackupService → localStorage
```

### Key Service Classes

- **DataProcessor**: Main orchestrator for file processing and employee data management
- **DataStorageService**: IndexedDB operations with comprehensive caching and audit logging
- **DataJoiner**: Intelligent matching of salary and performance data across files
- **CurrencyConverter**: Real-time currency conversion with fallback rates
- **AutoBackupService**: Automatic data backup and recovery
- **TempFieldStorageService**: Manages temporary field changes before persistence

### Component Architecture

```
App.tsx (main state management)
├── FileUpload (drag-drop file processing)
├── Dashboard (main data interaction)
│   ├── BudgetInput & BudgetSummary
│   ├── EmployeeTable (editable table with sorting/filtering)
│   ├── EmployeeDetail (individual employee view)
│   ├── MetricsCards & MetricsHeatMap
│   └── PolicyViolationAlert
├── BackupManager (import/export functionality)
└── ProposalImporter (manager proposal merging)
```

### Data Storage Strategy

**Primary Storage**: IndexedDB via Dexie
- Employee records with full audit trails
- Session data and file metadata
- Currency rate caching (15-minute expiry)
- File processing cache for performance
- User preferences and policy settings

**Backup Storage**: localStorage
- Compressed JSON backups created automatically
- Recovery mechanism for data loss scenarios
- Manual export/import functionality

### Key Technology Integrations

- **File Processing**: Papaparse (CSV) + @e965/xlsx (Excel files)
- **Charts/Visualization**: Plotly.js for heat maps and analytics
- **Currency API**: exchangerate-api.com with graceful fallback
- **State Management**: React hooks with centralized App.tsx state
- **Build Tool**: Vite with TypeScript support

## Development Guidelines

### Working with Employee Data

Employee data flows through several transformation stages:
1. **Raw CSV/XLSX** → `SalarySheetRow` / `PerformanceSheetRow`
2. **Data Joining** → `Employee` objects via DataJoiner
3. **Enhancement** → Currency conversion, name normalization, calculations
4. **Storage** → `EmployeeRecord` format in IndexedDB

### Currency Handling

All monetary calculations use USD as the base currency:
- `baseSalary` stores original currency amount
- `baseSalaryUSD` stores converted amount for calculations
- `proposedRaise` is always in USD
- Display conversions happen at render time

### File Processing

The application expects specific Workday reports:
- "RH Talent Assessment Calibration Audit Report" (performance data)
- "RH Compensation Report w/ Hierarchy - Manager" (salary data)

File detection is automatic based on column headers, with intelligent fallback.

### Policy Validation

Default policies are configurable via `PolicySettings`:
- Comparatio floor: 76%
- Max raise (US): 12%
- Max raise (India): 35%
- No-raise threshold: 18 months

### Testing Strategy

- Unit tests for core services in `src/services/__tests__/`
- Component tests using Testing Library
- Key test files: `EmployeeTable.test.tsx`, `xlsxHeaderDetection.test.ts`
- Tests focus on data processing logic and component interactions

## Static Deployment

This application is optimized for static hosting:

### Build Configuration
- Use `npm run build:static` for most static hosting
- Use `npm run build:github` for GitHub Pages
- All assets use relative paths (`./`)

### Deployment Features
- **Offline capable**: Works without internet after initial load
- **No server dependencies**: All processing happens client-side
- **Progressive enhancement**: Currency rates degrade gracefully
- **Local storage**: Data persists across sessions

### Supported Platforms
- Netlify, Vercel, GitHub Pages
- AWS S3 static hosting, Firebase Hosting
- Any static file hosting service

## Common Development Patterns

### Adding New Data Fields

1. Update `Employee` interface in `types/employee.ts`
2. Add field to `DataJoiner` mapping logic
3. Update storage interface in `dataStorage.ts`
4. Add to UI components as needed
5. Update backup/restore serialization

### Adding New File Types

1. Create new parser in `dataParser.ts`
2. Add file type detection logic
3. Update `DataProcessor.processUploadedFile()`
4. Add appropriate TypeScript interfaces

### Modifying Calculations

Most calculations happen in:
- `DataProcessor.enhanceEmployeeData()` for derived fields
- `utils/calculations.ts` for reusable calculation logic
- Component-level state for UI-specific calculations

### Adding New Policy Rules

1. Update `PolicySettings` interface
2. Add validation logic to `utils/policyValidation.ts`
3. Update UI alerts in `PolicyViolationAlert.tsx`
4. Add corresponding tests

## Integration Notes

### Currency API Integration
- Primary: exchangerate-api.com
- Fallback: Static rates from 2024
- Cache duration: 15 minutes (configurable)
- Timeout: 8 seconds per request

### Browser Compatibility
- Requires modern browsers with ES2020 support
- IndexedDB required for data persistence
- File API required for Excel/CSV uploads
- HTTPS recommended for full feature set

## Performance Considerations

- Large files (500+ employees) use pagination
- Currency conversion is batched for efficiency
- File processing is cached by content hash
- Database maintenance runs automatically
- Background backups are throttled to prevent UI blocking
