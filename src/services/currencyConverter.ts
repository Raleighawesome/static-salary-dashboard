export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: number;
  source: 'api' | 'fallback' | 'cache';
}

export interface CurrencyConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
  rateSource: 'api' | 'fallback' | 'cache';
  timestamp: number;
}

export interface CurrencyConverterOptions {
  cacheDurationMs?: number; // Default: 1 hour
  fallbackToStaticRates?: boolean; // Default: true
  timeoutMs?: number; // Default: 5000ms
}

// Static fallback rates (current as of August 26, 2025)
const FALLBACK_RATES: Record<string, number> = {
  'USD': 1.0,
  'EUR': 0.858,
  'GBP': 0.742,
  'JPY': 147.64,
  'CAD': 1.38,
  'AUD': 1.54,
  'CHF': 0.805,
  'CNY': 7.16,
  'INR': 87.61,
  'BRL': 5.43,
  'MXN': 18.66,
  'SGD': 1.28,
  'HKD': 7.81,
  'SEK': 9.57,
  'NOK': 10.12,
  'DKK': 6.41,
  'PLN': 3.66,
  'CZK': 21.06,
  'HUF': 340.73,
  'RUB': 80.71,
  'ZAR': 17.6,
  'KRW': 1389.25,
  'THB': 32.44,
  'MYR': 4.21,
  'PHP': 56.73,
  'IDR': 16265.13,
  'VND': 26206.36,
  'ILS': 3.38,
  'AED': 3.67,
  'SAR': 3.75,
  'EGP': 48.5,
  'TRY': 41.02,
  'PKR': 283.64,
  'LKR': 301.9,
  'TWD': 30.44,
  'NZD': 1.71,
};

export class CurrencyConverter {
  private static cache = new Map<string, ExchangeRate>();
  private static options: Required<CurrencyConverterOptions> = {
    cacheDurationMs: 15 * 60 * 1000, // 15 minutes for fresher rates
    fallbackToStaticRates: true,
    timeoutMs: 8000, // Longer timeout for better API success
  };
  private static usingFallbackRates = false;
  private static lastFallbackWarningTime = 0;

  // Initialize the converter with options for real-time priority
  public static initialize(options: CurrencyConverterOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
    
    console.log('💱 Currency Converter initialized with real-time priority');
    console.log(`   Cache duration: ${this.options.cacheDurationMs / 60000} minutes`);
  }

  // Convert amount from one currency to another
  public static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string = 'USD'
  ): Promise<CurrencyConversionResult> {
    // Normalize currency codes
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    // If same currency, no conversion needed
    if (from === to) {
      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: amount,
        targetCurrency: to,
        exchangeRate: 1.0,
        rateSource: 'cache',
        timestamp: Date.now(),
      };
    }

    try {
      // Get exchange rate
      const exchangeRate = await this.getExchangeRate(from, to);
      
      // Calculate converted amount
      const convertedAmount = Math.round((amount * exchangeRate.rate) * 100) / 100;

      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount,
        targetCurrency: to,
        exchangeRate: exchangeRate.rate,
        rateSource: exchangeRate.source,
        timestamp: exchangeRate.timestamp,
      };

    } catch (error) {
      console.error(`❌ Currency conversion failed: ${from} → ${to}`, error);
      
      // Return original amount if conversion fails
      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: amount,
        targetCurrency: from, // Keep original currency
        exchangeRate: 1.0,
        rateSource: 'fallback',
        timestamp: Date.now(),
      };
    }
  }

  // Get exchange rate between two currencies (4-tier priority system)
  public static async getExchangeRate(
    fromCurrency: string,
    toCurrency: string = 'USD'
  ): Promise<ExchangeRate> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    const cacheKey = `${from}-${to}`;

    // TIER 1: Check memory cache first (10 minutes)
    const cachedRate = await this.getCachedRate(cacheKey);
    if (cachedRate) {
      return cachedRate;
    }

    // TIER 2: Check public file and trigger API update if stale (24+ hours)
    try {
      const publicRate = await this.getPublicFileRate(from, to);
      if (publicRate) {
        await this.cacheRate(cacheKey, publicRate);
        return publicRate;
      }
    } catch (error) {
      console.warn(`⚠️ Public file rate fetch failed for ${from} → ${to}:`, error);
    }

    // TIER 3: Try direct API call (fallback if public file failed)
    try {
      const apiRate = await this.fetchFromAPI(from, to);
      if (apiRate) {
        await this.cacheRate(cacheKey, apiRate);
        return apiRate;
      }
    } catch (error) {
      console.warn(`⚠️ Direct API fetch failed for ${from} → ${to}:`, error);
    }

    // TIER 4: Fall back to static hardcoded rates
    if (this.options.fallbackToStaticRates) {
      const fallbackRate = this.getFallbackRate(from, to);
      if (fallbackRate) {
        await this.cacheRate(cacheKey, fallbackRate);
        console.warn(`⚠️ Using hardcoded fallback rate for ${from} → ${to} (API unavailable)`);
        
        // Track that we're using fallback rates for UI warning
        this.usingFallbackRates = true;
        this.lastFallbackWarningTime = Date.now();
        
        return fallbackRate;
      }
    }

    throw new Error(`No exchange rate available for ${from} → ${to}`);
  }

  // Fetch exchange rate from API with enhanced real-time sources
  private static async fetchFromAPI(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null> {
    console.log(`🔄 Fetching live rate for ${fromCurrency} → ${toCurrency}`);

    try {
      const result = await this.fetchFromExchangeRateAPI(fromCurrency, toCurrency);
      if (result) {
        console.log(`✅ Got live rate: ${result.rate} (${result.source})`);
        // Reset fallback warning since API is working
        this.resetFallbackWarning();
        return result;
      }
    } catch (error) {
      console.warn(`⚠️  Live rate fetch failed:`, error);
    }

    console.warn(`❌ Live rate unavailable for ${fromCurrency} → ${toCurrency}`);
    return null;
  }

  // Fetch from exchangerate-api.com (free tier available)
  private static async fetchFromExchangeRateAPI(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null> {
    const url = `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.rates && data.rates[toCurrency]) {
        return {
          fromCurrency,
          toCurrency,
          rate: data.rates[toCurrency],
          timestamp: Date.now(),
          source: 'api',
        };
      }

      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // Get fallback rate from static rates
  private static getFallbackRate(
    fromCurrency: string,
    toCurrency: string
  ): ExchangeRate | null {
    const fromRate = FALLBACK_RATES[fromCurrency];
    const toRate = FALLBACK_RATES[toCurrency];

    if (fromRate && toRate) {
      // Convert via USD: from → USD → to
      const rate = toRate / fromRate;
      

      
      return {
        fromCurrency,
        toCurrency,
        rate,
        timestamp: Date.now(),
        source: 'fallback',
      };
    }

    return null;
  }

  // Check if we have a cached rate (memory first, then IndexedDB)
  private static async getCachedRate(cacheKey: string): Promise<ExchangeRate | null> {
    // Check memory cache first
    const memoryCache = this.cache.get(cacheKey);
    if (memoryCache) {
      const age = Date.now() - memoryCache.timestamp;
      if (age < this.options.cacheDurationMs) {
        console.log(`📋 Using cached rate (${Math.round(age / 60000)}min old): ${memoryCache.rate}`);
        return { ...memoryCache, source: 'cache' };
      } else {
        // Remove expired cache entry
        console.log(`🗑️  Cache expired (${Math.round(age / 60000)}min old), fetching fresh rate`);
        this.cache.delete(cacheKey);
      }
    }

    // Check IndexedDB cache
    try {
      const { DataStorageService } = await import('./dataStorage');
      const [fromCurrency, toCurrency] = cacheKey.split('-');
      const dbCached = await DataStorageService.getCachedCurrencyRate(fromCurrency, toCurrency);
      
      if (dbCached) {
        const age = Date.now() - dbCached.timestamp;
        if (age < this.options.cacheDurationMs) {
          // Also cache in memory for faster access
          this.cache.set(cacheKey, dbCached);
          console.log(`💾 Using IndexedDB cached rate (${Math.round(age / 60000)}min old): ${dbCached.rate}`);
          return dbCached;
        } else {
          console.log(`🗑️  IndexedDB cache expired (${Math.round(age / 60000)}min old), fetching fresh rate`);
        }
      }
    } catch (error) {
      console.warn('Failed to check IndexedDB currency cache:', error);
    }

    return null;
  }

  // Fetch rates from public file
  private static async getPublicFileRates(): Promise<{ rates: Record<string, number>; lastUpdated: number } | null> {
    try {
      const response = await fetch('/currency-rates.json');
      if (!response.ok) {
        console.warn('⚠️ Public currency rates file not found');
        return null;
      }
      
      const data = await response.json();
      if (!data.rates || !data.lastUpdated) {
        console.warn('⚠️ Invalid public currency rates file format');
        return null;
      }
      
      return {
        rates: data.rates,
        lastUpdated: data.lastUpdated
      };
    } catch (error) {
      console.warn('⚠️ Failed to fetch public currency rates:', error);
      return null;
    }
  }

  // Check if public rates are fresh (< 24 hours old)
  private static isPublicRatesFresh(lastUpdated: number): boolean {
    const age = Date.now() - lastUpdated;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return age < maxAge;
  }

  // Update public rates file with fresh API data
  public static async updatePublicRatesFile(): Promise<boolean> {
    try {
      console.log('🔄 Updating public currency rates file...');
      
      // Fetch fresh rates from API
      const apiRate = await this.fetchFromAPI('USD', 'EUR'); // Test call to validate API
      if (!apiRate) {
        console.warn('⚠️ API test call failed, cannot update public rates');
        return false;
      }

      // Fetch full rates from API
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const apiData = await response.json();
      
      if (!apiData.rates) {
        throw new Error('Invalid API response format');
      }

      // Create updated rates object
      const updatedRates = {
        lastUpdated: Date.now(),
        source: 'exchangerate-api.com',
        base: 'USD',
        date: apiData.date || new Date().toISOString().split('T')[0],
        rates: apiData.rates
      };

      // In a real application, this would need a backend API to write the file
      // For now, we'll save to localStorage as a fallback and log the data
      localStorage.setItem('currency-rates-cache', JSON.stringify(updatedRates));
      
      console.log('✅ Currency rates updated successfully');
      console.log('📁 Note: Public file update requires backend API (saved to localStorage for now)');
      
      // Reset fallback warning since API update succeeded
      this.resetFallbackWarning();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to update public rates file:', error);
      return false;
    }
  }

  // Get rate from public file or trigger update if stale
  private static async getPublicFileRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null> {
    try {
      // First check localStorage cache (fallback for file writing limitation)
      const localCache = localStorage.getItem('currency-rates-cache');
      let publicData = null;
      
      if (localCache) {
        try {
          const cachedData = JSON.parse(localCache);
          if (this.isPublicRatesFresh(cachedData.lastUpdated)) {
            publicData = cachedData;
            console.log(`📁 Using localStorage cached rates (${Math.round((Date.now() - cachedData.lastUpdated) / (1000 * 60 * 60))}h old)`);
          }
        } catch (e) {
          console.warn('⚠️ Invalid localStorage currency cache');
        }
      }
      
      // If no fresh local cache, try public file
      if (!publicData) {
        publicData = await this.getPublicFileRates();
        
        if (publicData && !this.isPublicRatesFresh(publicData.lastUpdated)) {
          console.log(`🕒 Public rates are stale (${Math.round((Date.now() - publicData.lastUpdated) / (1000 * 60 * 60))}h old), updating...`);
          
          // Trigger update but don't wait for it - use stale data for now
          this.updatePublicRatesFile().catch(err => 
            console.warn('⚠️ Background rate update failed:', err)
          );
        }
      }
      
      if (!publicData || !publicData.rates) {
        return null;
      }
      
      // Calculate rate from public data
      const fromRate = publicData.rates[fromCurrency] || publicData.rates[fromCurrency.toUpperCase()];
      const toRate = publicData.rates[toCurrency] || publicData.rates[toCurrency.toUpperCase()];
      
      if (fromRate && toRate) {
        const rate = toRate / fromRate;
        return {
          fromCurrency,
          toCurrency,
          rate,
          timestamp: publicData.lastUpdated,
          source: 'cache',
        };
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ Error accessing public file rates:', error);
      return null;
    }
  }

  // Cache an exchange rate (both memory and IndexedDB)
  private static async cacheRate(cacheKey: string, rate: ExchangeRate): Promise<void> {
    // Cache in memory
    this.cache.set(cacheKey, rate);


    // Cache in IndexedDB for persistence
    try {
      const { DataStorageService } = await import('./dataStorage');
      await DataStorageService.cacheCurrencyRate(rate, this.options.cacheDurationMs);
    } catch (error) {
      console.warn('Failed to cache currency rate in IndexedDB:', error);
    }
  }

  // Convert multiple amounts in batch
  public static async convertBatch(
    conversions: Array<{
      amount: number;
      fromCurrency: string;
      toCurrency?: string;
      id?: string;
    }>
  ): Promise<Array<CurrencyConversionResult & { id?: string }>> {
    const results = await Promise.allSettled(
      conversions.map(async (conversion) => {
        const result = await this.convertCurrency(
          conversion.amount,
          conversion.fromCurrency,
          conversion.toCurrency
        );
        return { ...result, id: conversion.id };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`❌ Batch conversion failed for item ${index}:`, result.reason);
        // Return fallback result
        const conversion = conversions[index];
        return {
          originalAmount: conversion.amount,
          originalCurrency: conversion.fromCurrency,
          convertedAmount: conversion.amount,
          targetCurrency: conversion.fromCurrency,
          exchangeRate: 1.0,
          rateSource: 'fallback' as const,
          timestamp: Date.now(),
          id: conversion.id,
        };
      }
    });
  }

  // Get supported currencies
  public static getSupportedCurrencies(): string[] {
    return Object.keys(FALLBACK_RATES).sort();
  }

  // Check if a currency is supported
  public static isCurrencySupported(currency: string): boolean {
    return currency.toUpperCase() in FALLBACK_RATES;
  }

  // Clear cache
  public static clearCache(): void {
    this.cache.clear();

  }

  // Get cache statistics
  public static getCacheStats(): {
    size: number;
    entries: Array<{ key: string; age: number; source: string }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, rate]) => ({
      key,
      age: Date.now() - rate.timestamp,
      source: rate.source,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  // Format currency amount for display
  public static formatCurrency(
    amount: number,
    currency: string,
    locale: string = 'en-US'
  ): string {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch (error) {
      // Fallback formatting if currency is not supported by Intl
      return `${currency.toUpperCase()} ${amount.toLocaleString()}`;
    }
  }

  // Force refresh exchange rate (bypass cache)
  public static async forceRefreshRate(
    fromCurrency: string,
    toCurrency: string = 'USD'
  ): Promise<ExchangeRate> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    const cacheKey = `${from}-${to}`;

    console.log(`🔄 Force refreshing rate for ${from} → ${to}`);

    // Clear existing cache
    this.cache.delete(cacheKey);
    
    // Try to fetch fresh data from API
    try {
      const apiRate = await this.fetchFromAPI(from, to);
      if (apiRate) {
        await this.cacheRate(cacheKey, apiRate);
        console.log(`✅ Force refresh successful: ${apiRate.rate} (${apiRate.source})`);
        return apiRate;
      }
    } catch (error) {
      console.warn(`⚠️  Force refresh API failed for ${from} → ${to}:`, error);
    }

    // Fall back to static rates if API fails
    if (this.options.fallbackToStaticRates) {
      const fallbackRate = this.getFallbackRate(from, to);
      if (fallbackRate) {
        console.log(`📊 Using fallback rate after force refresh: ${fallbackRate.rate}`);
        return fallbackRate;
      }
    }

    throw new Error(`Force refresh failed: No exchange rate available for ${from} → ${to}`);
  }

  // Get the freshest possible rate (tries API first, then cache, then fallback)
  public static async getFreshestRate(
    fromCurrency: string,
    toCurrency: string = 'USD'
  ): Promise<ExchangeRate> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    console.log(`🎯 Getting freshest rate for ${from} → ${to}`);

    // Try API first for the freshest data
    try {
      const apiRate = await this.fetchFromAPI(from, to);
      if (apiRate) {
        const cacheKey = `${from}-${to}`;
        await this.cacheRate(cacheKey, apiRate);
        console.log(`✅ Fresh API rate: ${apiRate.rate} (${apiRate.source})`);
        return apiRate;
      }
    } catch (error) {
      console.warn(`⚠️  Fresh API fetch failed for ${from} → ${to}:`, error);
    }

    // Fall back to regular flow (cache then fallback)
    return this.getExchangeRate(from, to);
  }

  // Initialize with real-time priority settings
  public static initializeForRealTime(): void {
    this.initialize({
      cacheDurationMs: 10 * 60 * 1000, // 10 minutes for very fresh rates
      fallbackToStaticRates: true,
      timeoutMs: 10000, // Longer timeout for better API success
    });
    
    console.log('🚀 Currency Converter initialized for REAL-TIME priority');
    console.log('   - Cache duration: 10 minutes');
  }

  // Get exchange rate trend (if we had historical data)
  public static async getRateTrend(
    _fromCurrency: string,
    _toCurrency: string,
    _days: number = 30
  ): Promise<Array<{ date: string; rate: number }>> {
    // This would require a historical data API
    // For now, return empty array
    console.warn('📈 Rate trend data not available - would require historical API');
    return [];
  }

  // Check if currently using fallback rates (for UI warnings)
  public static isUsingFallbackRates(): boolean {
    return this.usingFallbackRates;
  }

  // Get fallback warning info for UI display
  public static getFallbackWarningInfo(): {
    isUsingFallback: boolean;
    lastWarningTime: number;
    warningAge: number;
  } {
    return {
      isUsingFallback: this.usingFallbackRates,
      lastWarningTime: this.lastFallbackWarningTime,
      warningAge: this.lastFallbackWarningTime > 0 ? Date.now() - this.lastFallbackWarningTime : 0,
    };
  }

  // Reset fallback warning status (call when API becomes available again)
  public static resetFallbackWarning(): void {
    this.usingFallbackRates = false;
    this.lastFallbackWarningTime = 0;
  }
} 