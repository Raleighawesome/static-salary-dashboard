# Real-Time Currency Conversion Guide

## Live Exchange Rates

The dashboard retrieves exchange rates from a single external service: **exchangerate-api.com**. All other application data remains local to the browser.

## Caching Strategy

- **Cache Duration**: 15 minutes by default
- **Timeout**: 8 seconds for each request
- **Real-Time Mode**: Optionally initialize with a 10‑minute cache for fresher rates

## Helpful Methods

```typescript
// Bypass caches and fetch the latest rate
const fresh = await CurrencyConverter.forceRefreshRate('EUR', 'USD');

// Try API first, then fall back to cache or static data
const rate = await CurrencyConverter.getFreshestRate('GBP', 'USD');

// Initialize converter with real-time settings
CurrencyConverter.initializeForRealTime();
```

## Priority Order

1. **🌐 Live API Call** – exchange-rate request
2. **📋 Recent Cache** – in-memory cache if within 15 minutes
3. **💾 IndexedDB Cache** – persisted data for offline use
4. **📊 Fallback Rates** – static 2024 exchange rates

## Console Logging Example

```
🚀 Currency Converter initialized for REAL-TIME priority
   - Cache duration: 10 minutes

🔄 Fetching live rate for EUR → USD
✅ Got live rate: 1.0851 (api)
```

This configuration maintains a minimal external footprint while still providing up-to-date currency information.
