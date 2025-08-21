# Static Deployment Guide

This guide explains how to compile and deploy the RH Salary Dashboard as a static application.

## Overview

The app has been configured for static deployment with the following optimizations:

- **Client-side only**: All data processing happens in the browser
- **Offline-capable**: Currency conversion works with fallback rates
- **Local storage**: Data persists using IndexedDB and localStorage
- **Relative paths**: All assets use relative paths for flexible deployment

## Build Scripts

The following npm scripts are available for static builds:

```bash
# Standard static build (recommended)
npm run build:static

# Safe static build (bypasses TypeScript compilation if needed)
npm run build:static:safe

# GitHub Pages build (with specific base path)
npm run build:github

# Type checking only
npm run typecheck
```

## Build Configuration

### Vite Configuration

The `vite.config.ts` has been optimized for static deployment:

- **Base path**: Set to `./` for relative paths
- **Asset organization**: All assets go to `assets/` directory
- **Modern target**: ES2020 for better optimization
- **Minification**: Terser for production builds
- **Source maps**: Enabled for debugging

### Key Features for Static Deployment

1. **Currency Conversion**: 
   - Works offline with fallback exchange rates
   - Caches rates in IndexedDB
   - Gracefully handles API failures

2. **Data Storage**:
   - Uses IndexedDB for persistent storage
   - Automatic backups to localStorage
   - No server-side dependencies

3. **File Processing**:
   - Client-side Excel/CSV parsing
   - No server uploads required
   - All processing in browser

## Deployment Options

### 1. Simple Static Hosting

After building, deploy the `dist/` folder to any static hosting service:

- **Netlify**: Drag and drop the `dist` folder
- **Vercel**: Connect repository and set build command to `npm run build:static`
- **GitHub Pages**: Use `npm run build:github` and deploy to gh-pages branch
- **AWS S3**: Upload `dist` contents to S3 bucket with static hosting
- **Firebase Hosting**: Deploy `dist` folder

### 2. GitHub Pages Deployment

```bash
# Build for GitHub Pages
npm run build:github

# The build will be optimized for the repository path
# Deploy the dist/ folder to the gh-pages branch
```

### 3. Custom Domain Deployment

```bash
# Build with custom base path if needed
npx vite build --base=/your-custom-path/

# Or modify vite.config.ts base setting
```

## Environment Considerations

### Browser Compatibility

- **Modern browsers**: ES2020+ support required
- **IndexedDB**: Required for data persistence
- **File API**: Required for Excel/CSV uploads
- **Local Storage**: Required for session recovery

### Security

- **HTTPS recommended**: For File System Access API features
- **CORS**: Not applicable (no external API dependencies)
- **CSP**: Compatible with strict Content Security Policies

### Performance

- **Bundle size**: Optimized with code splitting
- **Caching**: Assets are hashed for cache busting
- **Lazy loading**: Large libraries loaded on demand

## Troubleshooting

### Build Issues

If you encounter Node.js module loading errors:

1. **Clear npm cache**: `npm cache clean --force`
2. **Reinstall dependencies**: `rm -rf node_modules && npm install`
3. **Use safe build**: `npm run build:static:safe`
4. **Check Node.js version**: Ensure Node.js 18+ is installed

### Runtime Issues

1. **Data not persisting**: Check if IndexedDB is enabled in browser
2. **Files not uploading**: Ensure HTTPS for File API features
3. **Currency conversion failing**: App will use fallback rates automatically

## Features That Work Offline

- ✅ Data processing and calculations
- ✅ Currency conversion (with fallback rates)
- ✅ Data visualization and charts
- ✅ Export functionality
- ✅ Session persistence
- ✅ Backup and restore

## Features That Require Internet

- 🌐 Real-time currency exchange rates (optional)
- 🌐 Software updates

## Testing Static Build

To test the static build locally:

```bash
# Build the static version
npm run build:static

# Preview the built version
npm run preview:static

# The app will be available at http://localhost:4173
```

## File Structure After Build

```
dist/
├── index.html          # Main HTML file
├── assets/            # All JS, CSS, and other assets
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── [other assets]
└── vite.svg           # Favicon
```

## Deployment Checklist

- [ ] Run `npm run build:static` successfully
- [ ] Test with `npm run preview:static`
- [ ] Verify file uploads work
- [ ] Test currency conversion
- [ ] Check data persistence
- [ ] Verify export functionality
- [ ] Test on target hosting platform

## Support

The application is designed to be completely self-contained and work in any modern browser environment without server-side dependencies.
