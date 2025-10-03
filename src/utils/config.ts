// Environment configuration for API keys
export const config = {
  // Get API key from build-time environment variable (GitHub Secrets only)
  gemini: {
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    isConfigured: Boolean(import.meta.env.VITE_GEMINI_API_KEY),
  }
};

// Check if API key is available from environment
export const hasPreConfiguredApiKey = () => config.gemini.isConfigured;

// Get the API key (environment only - no localStorage fallback)
export const getApiKey = (): string | null => {
  return config.gemini.apiKey || null;
};

// Check if API key is available
export const hasApiKey = (): boolean => {
  return Boolean(config.gemini.apiKey);
};
