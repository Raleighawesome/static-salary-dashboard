import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Base path for static deployment - can be overridden with --base flag
  base: './',
  
  // Build configuration for static compilation
  build: {
    // Generate sourcemaps for debugging
    sourcemap: true,
    
    // Optimize for static serving
    assetsDir: 'assets',
    
    // Ensure all assets use relative paths
    rollupOptions: {
      output: {
        // Organize output files
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      }
    },
    
    // Target modern browsers for better optimization
    target: 'es2020',
    
    // Minify for production
    minify: 'terser',
    
    // Optimize chunk size
    chunkSizeWarningLimit: 1000
  },
  
  optimizeDeps: {
    // Exclude problematic dependencies from Vite's dependency optimization
    exclude: [
      'plotly.js', // Large library that can cause optimization issues
      '@e965/xlsx'  // Excel library that may have compatibility issues
    ],
    // Force include common dependencies that should be optimized
    include: [
      'react',
      'react-dom',
      'papaparse',
      'dexie'
    ]
  },
  
  
  // Preview configuration for testing static build
  preview: {
    port: 4173,
    host: true
  }
})
