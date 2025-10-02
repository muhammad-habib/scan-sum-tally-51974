// Arabic to Western digit mapping
const arabicToWestern: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

// Persian/Farsi variants
const persianToWestern: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/**
 * Convert Arabic/Persian digits to Western digits
 */
export function normalizeDigits(text: string): string {
  return text
    .split('')
    .map(char => arabicToWestern[char] || persianToWestern[char] || char)
    .join('');
}

/**
 * Extract and parse a number from text, handling various formats including Arabic
 */
export function parseAmount(text: string): number | null {
  if (!text) return null;

  // Store original for logging
  const original = text.substring(0, 80);

  // Normalize digits first (convert Arabic/Persian to Western)
  let normalized = normalizeDigits(text);

  // Remove common Arabic/English words that appear with numbers but aren't part of the number
  // Keep these separate from the number itself
  const cleanText = normalized
    .replace(/\b(ألف|الف|الاف|ألاف|مليون|الملايين|thousand|million|k|m)\b/gi, ' ')
    .replace(/\b(جنيه|دولار|يورو|ريال|درهم|pound|dollar|euro|egp|usd|eur|cve)\b/gi, ' ')
    .replace(/[€$£¥₹]/g, ' ');

  // Remove ALL other non-numeric characters except digits, spaces, commas, dots
  let cleaned = cleanText.replace(/[^\d\s.,]/g, ' ');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Handle space-separated thousands: "50 300" -> "50300"
  // Match patterns like: digit(s) space digit(3) word-boundary
  cleaned = cleaned.replace(/(\d{1,3})\s+(\d{3})\b/g, '$1$2');
  
  // Handle additional space-separated patterns: "7 600" -> "7600" 
  cleaned = cleaned.replace(/(\d{1,2})\s+(\d{3})\b/g, '$1$2');

  // Remove any remaining spaces between digits
  cleaned = cleaned.replace(/(\d)\s+(\d)/g, '$1$2');

  // Extract all number sequences (with optional decimal)
  const matches = cleaned.match(/\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length === 0) {
    console.log(`parseAmount("${original}") -> NO NUMBERS FOUND`);
    return null;
  }

  // Parse and validate all numbers
  const numbers = matches
    .map(m => {
      // Replace comma with dot for decimal parsing
      const normalized = m.replace(',', '.');
      return parseFloat(normalized);
    })
    .filter(n => !isNaN(n) && n > 0);
  
  if (numbers.length === 0) {
    console.log(`parseAmount("${original}") -> NO VALID NUMBERS`);
    return null;
  }

  // Return the largest number (totals are typically the largest on receipts)
  const maxNumber = Math.max(...numbers);
  
  console.log(`parseAmount("${original}") -> numbers: [${numbers.join(', ')}] -> MAX: ${maxNumber}`);
  
  return maxNumber;
}

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Detect currency from text
 */
export function detectCurrency(text: string): string {
  const currencyPatterns = [
    { pattern: /€|EUR|euro/i, code: 'EUR' },
    { pattern: /\$|USD|dollar/i, code: 'USD' },
    { pattern: /£|GBP|pound/i, code: 'GBP' },
    { pattern: /EGP|جنيه/i, code: 'EGP' },
    { pattern: /CVE|escudo/i, code: 'CVE' },
  ];

  for (const { pattern, code } of currencyPatterns) {
    if (pattern.test(text)) {
      return code;
    }
  }

  return 'EUR'; // Default
}
