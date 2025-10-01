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

  // Normalize digits first
  let normalized = normalizeDigits(text);

  // Remove Arabic number words that might appear before numbers (ألف=thousand, مليون=million)
  normalized = normalized.replace(/\b(ألف|الف|مليون)\b/gi, '');

  // Remove currency symbols and common words
  normalized = normalized.replace(/[€$£¥₹]/g, '');
  normalized = normalized.replace(/\b(EGP|CVE|USD|EUR|GBP)\b/gi, '');

  // Remove thousands separators (spaces, commas in thousands position)
  // But preserve decimal commas/points
  normalized = normalized.replace(/[\s,']/g, (match, offset, string) => {
    // If it's a comma or point near the end (last 3 chars), keep it as decimal
    const remainingLength = string.length - offset;
    if ((match === ',' || match === '.') && remainingLength <= 3) {
      return '.';
    }
    return '';
  });

  // Handle comma as decimal separator (European format)
  normalized = normalized.replace(/,/g, '.');

  // Extract all valid numbers and return the largest one (often the total)
  const matches = normalized.match(/-?\d+\.?\d*/g);
  if (!matches || matches.length === 0) return null;

  // Parse all numbers and find the largest one
  const numbers = matches
    .map(m => parseFloat(m))
    .filter(n => !isNaN(n) && n > 0);
  
  if (numbers.length === 0) return null;

  // Return the largest number found (usually the total amount)
  return Math.max(...numbers);
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
