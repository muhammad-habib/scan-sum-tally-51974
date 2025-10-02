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
  const cleanText = normalized
    .replace(/\b(ألف|الف|الاف|ألاف|مليون|الملايين|thousand|million|k|m)\b/gi, ' ')
    .replace(/\b(جنيه|دولار|يورو|ريال|درهم|pound|dollar|euro|egp|usd|eur|cve)\b/gi, ' ')
    .replace(/[€$£¥₹]/g, ' ');

  // Remove ALL other non-numeric characters except digits, spaces, commas, dots, pipes, dashes
  // Keep pipes and dashes as they often separate table columns
  let cleaned = cleanText.replace(/[^\d\s.,|\-]/g, ' ');

  // Split by common table separators (pipes, multiple spaces, dashes between numbers)
  // This prevents merging numbers from different table columns
  const parts = cleaned.split(/\s*[\|]\s*|\s{3,}|\s-\s/);

  let allNumbers: number[] = [];

  parts.forEach(part => {
    // Clean up this part
    let partCleaned = part.replace(/\s+/g, ' ').trim();
    
    // Only merge spaces for thousands format: "50 300" but NOT "20 380 7600"
    // Look for pattern: 1-3 digits, space, exactly 3 digits, word boundary
    // Do this ONLY if there's exactly one space followed by 3 digits
    const hasThousandsSeparator = /^\d{1,3}\s\d{3}$/.test(partCleaned);
    
    if (hasThousandsSeparator) {
      // This looks like "50 300" - merge it
      partCleaned = partCleaned.replace(/\s/g, '');
    } else {
      // This might be "20 380 7600" - extract each number separately
      const individualNumbers = partCleaned.match(/\d+(?:[.,]\d+)?/g);
      if (individualNumbers) {
        individualNumbers.forEach(numStr => {
          const num = parseFloat(numStr.replace(',', '.'));
          if (!isNaN(num) && num > 0) {
            allNumbers.push(num);
          }
        });
        return; // Skip the rest for this part
      }
    }
    
    // Extract numbers from this part
    const matches = partCleaned.match(/\d+(?:[.,]\d+)?/g);
    if (matches) {
      matches.forEach(m => {
        const num = parseFloat(m.replace(',', '.'));
        if (!isNaN(num) && num > 0) {
          allNumbers.push(num);
        }
      });
    }
  });
  
  if (allNumbers.length === 0) {
    console.log(`parseAmount("${original}") -> NO NUMBERS FOUND`);
    return null;
  }

  // Return the largest number (totals are typically the largest on receipts)
  const maxNumber = Math.max(...allNumbers);
  
  console.log(`parseAmount("${original}") -> numbers: [${allNumbers.join(', ')}] -> MAX: ${maxNumber}`);
  
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
