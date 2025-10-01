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

  // Remove ALL non-numeric content except digits, spaces, and decimal separators
  // Remove Arabic text, currency symbols, and any letters
  normalized = normalized.replace(/[^\d\s.,]/g, ' ');

  // Clean up whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Try to find space-separated digit sequences that form a single number
  // e.g., "50 300" or "7 600" should be treated as "50300" and "7600"
  const spacePattern = /(\d+)\s+(\d{3})\b/g;
  normalized = normalized.replace(spacePattern, '$1$2');

  // Remove remaining spaces between digits
  normalized = normalized.replace(/(\d)\s+(\d)/g, '$1$2');

  // Extract all sequences of digits (with optional decimal point)
  const matches = normalized.match(/\d+\.?\d*/g);
  if (!matches || matches.length === 0) return null;

  // Parse all numbers
  const numbers = matches
    .map(m => parseFloat(m))
    .filter(n => !isNaN(n) && n > 0);
  
  if (numbers.length === 0) return null;

  // Return the largest number (in receipts, the total is usually the largest)
  const maxNumber = Math.max(...numbers);
  
  console.log(`parseAmount("${text.substring(0, 60)}...") -> found: [${numbers.join(', ')}] -> max: ${maxNumber}`);
  
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
