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
  const normalized = normalizeDigits(text);

  // Handle Arabic thousands indicator "ألف" - multiply by 1000 if present
  const hasArabicThousands = /ألف|الف/.test(text);

  // Remove common Arabic/English words that appear with numbers but aren't part of the number
  const cleanText = normalized
    .replace(/\b(ألف|الف|الاف|ألاف|مليون|الملايين|thousand|million|k|m)\b/gi, ' ')
    .replace(/\b(جنيه|دولار|يورو|ريال|درهم|pound|dollar|euro|egp|usd|eur|cve)\b/gi, ' ')
    .replace(/[€$£¥₹]/g, ' ');

  // Remove ALL other non-numeric characters except digits, spaces, commas, dots, pipes, dashes
  // Keep pipes and dashes as they often separate table columns
  const cleaned = cleanText.replace(/[^\d\s.,|-]/g, ' ');

  // Split by common table separators (pipes, multiple spaces, dashes between numbers)
  // This prevents merging numbers from different table columns
  const parts = cleaned.split(/\s*[|]\s*|\s{3,}|\s-\s/);

  const allNumbers: number[] = [];

  parts.forEach(part => {
    // Clean up this part
    let partCleaned = part.replace(/\s+/g, ' ').trim();
    
    // FIXED: Don't merge spaced numbers automatically - extract each number separately
    // This prevents "40 550" from becoming "40550"
    const individualNumbers = partCleaned.match(/\d+(?:[.,]\d+)?/g);
    if (individualNumbers) {
      individualNumbers.forEach(numStr => {
        let num = parseFloat(numStr.replace(',', '.'));
        if (!isNaN(num) && num > 0) {
          // Apply Arabic thousands multiplier if "ألف" was present
          if (hasArabicThousands && num < 1000) {
            num *= 1000;
          }

          // OCR Error Correction: If we find a suspiciously large number,
          // try to split it intelligently (common OCR error in Arabic receipts)
          if (num > 100000) {
            const numStr = num.toString();
            // Try to split patterns like "3807600" into "380" + "7600"
            if (numStr.length >= 6) {
              const possibleSplit1 = parseInt(numStr.substring(0, 3));
              const possibleSplit2 = parseInt(numStr.substring(3));

              // If the split makes sense (first part is typical unit price 100-999)
              if (possibleSplit1 >= 100 && possibleSplit1 <= 999 && possibleSplit2 >= 1000) {
                console.log(`OCR correction: split ${num} into ${possibleSplit1} + ${possibleSplit2}`);
                allNumbers.push(possibleSplit1);
                allNumbers.push(possibleSplit2);
                return; // Skip adding the original large number
              }
            }
          }

          allNumbers.push(num);
        }
      });
    }
  });
  
  if (allNumbers.length === 0) {
    console.log(`parseAmount("${original}") -> NO NUMBERS FOUND`);
    return null;
  }

  // For table rows, prefer the rightmost/largest number that makes sense as a total
  // In "40 550 |22000", we want 22000, not 40550
  let bestNumber = allNumbers[0];

  // If we have multiple numbers, prefer:
  // 1. Numbers that are sums of others (likely totals)
  // 2. The largest number if it's significantly larger
  // 3. Numbers after pipe separators (table totals)
  if (allNumbers.length > 1) {
    // Check if any number is a sum of others
    for (const candidate of allNumbers) {
      const others = allNumbers.filter(n => n !== candidate);
      const sumOfOthers = others.reduce((sum, n) => sum + n, 0);

      // If this number equals the sum of others, it's likely the total
      if (Math.abs(candidate - sumOfOthers) < 1) {
        bestNumber = candidate;
        break;
      }

      // If this number is much larger than others, it's likely the total
      if (candidate > sumOfOthers && candidate >= 1000) {
        bestNumber = candidate;
      }
    }

    // Fallback: take the largest number
    bestNumber = Math.max(...allNumbers);
  }

  console.log(`parseAmount("${original}") -> numbers: [${allNumbers.join(', ')}] -> BEST: ${bestNumber}`);

  return bestNumber;
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
    // Egyptian Pound - should be checked first for Arabic text
    { pattern: /EGP|جنيه|جنية|ج\.م|LE/i, code: 'EGP' },
    // European currencies
    { pattern: /€|EUR|euro/i, code: 'EUR' },
    // US Dollar
    { pattern: /\$|USD|dollar|دولار/i, code: 'USD' },
    // British Pound
    { pattern: /£|GBP|pound/i, code: 'GBP' },
    // Cape Verde Escudo
    { pattern: /CVE|escudo/i, code: 'CVE' },
    // Saudi Riyal - include both SAR and SR (common abbreviation)
    { pattern: /SAR|SR|ريال|ر\.س/i, code: 'SAR' },
    // UAE Dirham
    { pattern: /AED|درهم|د\.إ/i, code: 'AED' },
  ];

  for (const { pattern, code } of currencyPatterns) {
    if (pattern.test(text)) {
      return code;
    }
  }

  // For Arabic text, default to EGP instead of EUR
  const hasArabicText = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  if (hasArabicText) {
    return 'EGP';
  }

  return 'EUR'; // Default for non-Arabic text
}
