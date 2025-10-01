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
 * Extract and parse a number from text, handling various formats
 */
export function parseAmount(text: string): number | null {
  if (!text) return null;

  // Normalize digits first (convert Arabic/Persian to Western)
  let normalized = normalizeDigits(text);

  // Remove Arabic words like "الف" (thousand) which are just prefixes
  // Also remove common Arabic text that might appear
  normalized = normalized.replace(/\b(ألف|الف|مليون|جنيه|دولار|يورو)\b/gi, ' ');

  // Remove currency symbols
  normalized = normalized.replace(/[€$£¥₹]/g, ' ');
  normalized = normalized.replace(/\b(EGP|CVE|USD|EUR|GBP)\b/gi, ' ');

  // Clean up whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Extract all sequences of digits (with optional decimal point)
  // This regex finds numbers like: 50300, 7600, 27500, 380, 550, etc.
  const matches = normalized.match(/\d+\.?\d*/g);
  if (!matches || matches.length === 0) return null;

  // Parse all numbers
  const numbers = matches
    .map(m => parseFloat(m))
    .filter(n => !isNaN(n) && n > 0);
  
  if (numbers.length === 0) return null;

  // Return the largest number (in receipts, the total is usually the largest)
  const maxNumber = Math.max(...numbers);
  
  console.log(`parseAmount("${text.substring(0, 50)}...") -> numbers found: [${numbers.join(', ')}], max: ${maxNumber}`);
  
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
