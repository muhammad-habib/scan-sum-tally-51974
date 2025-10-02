import { parseAmount, detectCurrency, normalizeDigits } from './numberParser';

interface ExtractedAmount {
  amount: number | null;
  currency: string;
  confidence: number;
  rawText?: string;
  detectedRows?: string[];
}

// Keywords that indicate a total amount (multilingual with variations)
const TOTAL_KEYWORDS = [
  // Arabic - comprehensive variations
  'الإجمالي', 'الاجمالي', 'اجمالي', 'إجمالي', 'الإجمالى', 'الاجمالى',
  'المجموع', 'مجموع', 'الكلي', 'كلي', 'الكلى',
  'المبلغ الإجمالي', 'المبلغ الكلي', 'المبلغ',
  'الجملة', 'جملة', 'الإجمالى', 'اﻹجمالي', 'اﻻجمالي',
  // English
  'total', 'total due', 'grand total', 'amount due', 'balance due',
  'sum', 'subtotal', 'net total', 'final total',
  // German
  'gesamt', 'summe', 'endsumme', 'gesamtsumme', 'gesamtbetrag',
  // Portuguese
  'total', 'soma', 'montante', 'valor total', 'saldo',
  // French
  'total', 'montant', 'somme', 'total général',
];

// Keywords that are likely table headers, not actual totals
const HEADER_KEYWORDS = [
  'السعرالإجمالي', 'السعر الإجمالي', // "Total Price" header
  'نوع الصنف', 'الحجم', 'العدد', 'السعر', // Table column headers
  'الإجمالي |', '| الإجمالي', // Table header with pipes
];

// Keywords to ignore (VAT, tax, registration numbers, etc.)
const IGNORE_KEYWORDS = [
  'vat', 'tax', 'مضافة', 'ضريبة', 'steuer', 'imposto',
  'service', 'خدمة', 'bedienung',
  // Registration/ID numbers
  'registration', 'رقم التسجيل', 'التسجيل', 'تسجيل', 'ضريبي',
  'id:', 'رقم:', 'number:', 'no:', 'invoice no', 'رقم الفاتورة',
  // Contact info
  'phone', 'tel', 'email', 'هاتف', 'تليفون', 'بريد',
  'تاريخ', 'date', 'datum',
];

/**
 * Remove Arabic diacritics and formatting characters
 */
function removeArabicDiacritics(text: string): string {
  // Remove bidirectional control characters and Arabic diacritics
  return text.replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E]/g, '') // Bidirectional marks
             .replace(/[\u0610-\u061A]/g, '') // Arabic signs
             .replace(/[\u064B-\u065F]/g, '') // Arabic diacritics
             .replace(/[\u0670]/g, '') // Arabic letter superscript alef
             .replace(/[\u06D6-\u06ED]/g, '') // Arabic small high marks
             .replace(/[\u0640]/g, ''); // Arabic tatweel
}

/**
 * Helpers for keyword context
 */
function containsTotalKeywordNormalized(normalized: string): boolean {
  return TOTAL_KEYWORDS.some(kw => normalized.includes(kw));
}

function hasTotalKeywordNearby(index: number, normalizedLines: string[], window: number = 2): boolean {
  const start = Math.max(0, index - window);
  const end = Math.min(normalizedLines.length - 1, index + window);
  for (let i = start; i <= end; i++) {
    if (i === index) continue;
    if (containsTotalKeywordNormalized(normalizedLines[i])) return true;
  }
  return false;
}

/**
 * Calculate confidence score based on various factors
 */
function calculateConfidence(
  hasKeyword: boolean,
  isLastInList: boolean,
  amountSize: number,
  contextQuality: number
): number {
  let confidence = 0.3; // Lower base confidence

  // Total keywords are CRITICAL - give massive boost
  if (hasKeyword) confidence += 0.5;
  
  // Position matters but less than keywords
  if (isLastInList) confidence += 0.1;
  
  // Larger amounts are more likely to be totals
  if (amountSize > 1000) confidence += 0.1;
  else if (amountSize > 100) confidence += 0.05;
  
  // Context quality (from keyword presence)
  confidence += contextQuality * 0.1;

  return Math.min(confidence, 1.0);
}
/**
 * Extract amount from OCR text using keyword heuristics
 */
export function extractAmount(ocrText: string): ExtractedAmount {
  if (!ocrText || ocrText.trim().length === 0) {
    return {
      amount: null,
      currency: 'EUR',
      confidence: 0,
      rawText: ocrText,
    };
  }

  const lines = ocrText.split('\n').filter(line => line.trim().length > 0);
  const normalizedLines = lines.map(line =>
    removeArabicDiacritics(normalizeDigits(line.toLowerCase()))
  );

  console.log('=== PROCESSING LINES ===');
  lines.forEach((line, index) => {
    console.log(`Line ${index}: "${line}"`);
    console.log(`  Normalized: "${normalizedLines[index]}"`);
    console.log(`  Has total keyword: ${containsTotalKeywordNormalized(normalizedLines[index])}`);
  });

  // Pre-pass: use ONLY the LAST occurrence of a "total" header (avoids column header at top)
  const totalHeaderIndices = normalizedLines
    .map((l, i) => (containsTotalKeywordNormalized(l) ? i : -1))
    .filter(i => i >= 0);

  console.log(`Found total keyword indices: ${totalHeaderIndices}`);

  if (totalHeaderIndices.length > 0) {
    const lastIdx = totalHeaderIndices[totalHeaderIndices.length - 1];
    const totalLine = lines[lastIdx];

    console.log(`Processing total line ${lastIdx}: "${totalLine}"`);

    // Enhanced Arabic total parsing for table structures
    // Pattern 1: Table row with الإجمالي in first column and amount in last column
    const tableRowPattern = /الإجمالي.*?\|\s*.*?\|\s*.*?\|\s*.*?\|\s*(\d+)\s*ألف?/i;
    const tableMatch = totalLine.match(tableRowPattern);

    if (tableMatch) {
      const amount = parseFloat(tableMatch[1]);
      console.log(`Table row pattern match: ${amount} from "${tableMatch[1]}"`);

      if (!isNaN(amount) && amount > 0) {
        return {
          amount: amount,
          currency: detectCurrency(totalLine),
          confidence: 0.99,
          rawText: totalLine,
          detectedRows: lines,
        };
      }
    }

    // Pattern 2: Simple الإجمالي followed by amount and ألف
    const simplePattern = /الإجمالي.*?(\d+)\s*ألف/i;
    const simpleMatch = totalLine.match(simplePattern);

    if (simpleMatch) {
      const amount = parseFloat(simpleMatch[1]);
      console.log(`Simple pattern match: ${amount} from "${simpleMatch[1]}"`);

      if (!isNaN(amount) && amount > 0) {
        return {
          amount: amount,
          currency: detectCurrency(totalLine),
          confidence: 0.98,
          rawText: totalLine,
          detectedRows: lines,
        };
      }
    }

    // Pattern 3: Any number followed by ألف in a total line
    const alefPattern = /(\d+)\s*ألف/i;
    const alefMatch = totalLine.match(alefPattern);

    if (alefMatch) {
      const amount = parseFloat(alefMatch[1]);
      console.log(`Alef pattern match: ${amount} from "${alefMatch[1]}"`);

      if (!isNaN(amount) && amount > 0) {
        return {
          amount: amount,
          currency: detectCurrency(totalLine),
          confidence: 0.97,
          rawText: totalLine,
          detectedRows: lines,
        };
      }
    }

    // Pattern 4: Split by pipes and take the rightmost number
    if (totalLine.includes('|')) {
      const columns = totalLine.split('|').map(col => col.trim());
      console.log(`Table columns: ${columns.join(' | ')}`);

      // Look for the rightmost column with a number
      for (let i = columns.length - 1; i >= 0; i--) {
        const numberMatch = columns[i].match(/(\d+)/);
        if (numberMatch) {
          const amount = parseFloat(numberMatch[1]);
          console.log(`Rightmost column number: ${amount} from column "${columns[i]}"`);

          if (!isNaN(amount) && amount > 1000) { // Totals are usually > 1000
            return {
              amount: amount,
              currency: detectCurrency(totalLine),
              confidence: 0.96,
              rawText: totalLine,
              detectedRows: lines,
            };
          }
        }
      }
    }

    // ...existing fallback logic...
  }
  
  let bestCandidate: {
    amount: number;
    currency: string;
    confidence: number;
    lineIndex: number;
    line: string;
    hasTotalContext: boolean;
  } | null = null;

  console.log(`\n=== EXTRACTING AMOUNT FROM ${lines.length} LINES ===`);

  // Process each line
  lines.forEach((line, index) => {
    const normalizedLine = normalizedLines[index];
    
    // Check if line contains ignore keywords without total keywords
    const hasIgnoreKeyword = IGNORE_KEYWORDS.some(kw => normalizedLine.includes(kw));
    const hasTotalKeyword = containsTotalKeywordNormalized(normalizedLine);

    // Special check: Does this line contain "ألف" indicator? This is very strong signal for Arabic totals
    const hasAlefIndicator = /ألف|الف/.test(line);

    // Check if this is likely a table header rather than actual total
    const isTableHeader = HEADER_KEYWORDS.some(kw => normalizedLine.includes(kw));

    const hasTotalNearbyContext = (hasTotalKeyword && !isTableHeader) || hasTotalKeywordNearby(index, normalizedLines, 2);

    if (hasIgnoreKeyword && !hasTotalNearbyContext && !hasAlefIndicator) {
      console.log(`Line ${index}: SKIPPED (ignore keyword: registration/tax/contact)`);
      return; // Skip this line
    }

    // Row-aware amount extraction: prefer the RIGHTMOST large number in the line
    let amount: number | null = null;
    const numberMatches = normalizeDigits(line).match(/\d+(?:[.,]\d+)?/g);
    if (numberMatches && numberMatches.length >= 2) {
      for (let k = numberMatches.length - 1; k >= 0; k--) {
        const cand = parseFloat(numberMatches[k].replace(',', '.'));
        if (!isNaN(cand) && cand >= 1000 && cand <= 1000000) { // likely a line total
          amount = cand;
          break;
        }
      }
    }
    if (amount === null) {
      amount = parseAmount(line);
    }
    if (amount === null || amount === 0) {
      if (line.trim().length > 0) {
        console.log(`Line ${index}: "${line.substring(0, 40)}..." -> NO AMOUNT`);
      }
      return;
    }

    // Filter out unrealistic amounts (likely registration numbers, phone numbers, dates)
    // Registration numbers are often 5-6 digits, totals are usually different ranges
    if (amount > 1000000) {
      console.log(`Line ${index}: SKIPPED (amount too large - likely phone/ID: ${amount})`);
      return;
    }

    // Detect currency
    const currency = detectCurrency(line);

    // Calculate confidence - HEAVILY prioritize "ألف" indicator and actual totals over table headers
    const isLastInList = index >= lines.length - 5; // Within last 5 lines
    let contextQuality = 0.2;

    if (hasAlefIndicator) {
      contextQuality = 1.5; // "ألف" is strongest indicator
    } else if (hasTotalNearbyContext && !isTableHeader) {
      contextQuality = 1.0; // Real total keyword, not header
    } else if (isTableHeader) {
      contextQuality = 0.1; // Table header is weak signal
    }

    const confidence = calculateConfidence(
      hasAlefIndicator || (hasTotalNearbyContext && !isTableHeader),
      isLastInList,
      amount,
      contextQuality
    );

    console.log(`Line ${index}: "${line.substring(0, 50)}..." -> ${amount} ${currency} (hasAlef: ${hasAlefIndicator}, totalCtx: ${hasTotalNearbyContext}, header: ${isTableHeader}, conf: ${confidence.toFixed(2)})`);

    // Update best candidate - prioritize "ألف" lines over everything else
    const currentHasAlefOrTotal = hasAlefIndicator || (hasTotalNearbyContext && !isTableHeader);
    const bestHasAlefOrTotal = bestCandidate ?
      (/ألف|الف/.test(bestCandidate.line) || (bestCandidate.hasTotalContext && !HEADER_KEYWORDS.some(kw => bestCandidate.line.toLowerCase().includes(kw)))) : false;

    if (
      !bestCandidate ||
      (currentHasAlefOrTotal && !bestHasAlefOrTotal) ||
      (currentHasAlefOrTotal === bestHasAlefOrTotal && confidence > bestCandidate.confidence + 1e-6) ||
      (currentHasAlefOrTotal === bestHasAlefOrTotal && Math.abs(confidence - bestCandidate.confidence) <= 0.01 &&
        (amount > bestCandidate.amount || (amount === bestCandidate.amount && index > bestCandidate.lineIndex)))
    ) {
      bestCandidate = {
        amount,
        currency,
        confidence,
        lineIndex: index,
        line,
        hasTotalContext: currentHasAlefOrTotal,
      };
    }
  });

  console.log(`=== BEST CANDIDATE: ${bestCandidate ? `${bestCandidate.amount} (line ${bestCandidate.lineIndex}, totalCtx: ${bestCandidate.hasTotalContext})` : 'NONE'} ===\n`);

  // If we found a candidate, return it
  if (bestCandidate) {
    // Special handling for Arabic receipts when no total keyword was found
    // In this case, look for the sum of all reasonable amounts vs the largest single amount
    if (!bestCandidate.hasTotalContext && detectCurrency(ocrText).includes('EG')) {
      console.log('=== ARABIC RECEIPT FALLBACK: Analyzing all amounts ===');

      const allAmounts: number[] = [];
      lines.forEach((line, index) => {
        const amount = parseAmount(line);
        if (amount && amount >= 1000 && amount <= 100000) { // Reasonable receipt amounts
          allAmounts.push(amount);
          console.log(`Found amount: ${amount} from line ${index}: "${line.substring(0, 50)}..."`);
        }
      });

      if (allAmounts.length >= 2) {
        // If we have multiple amounts, the total should be the sum or the largest
        const sumOfAmounts = allAmounts.reduce((sum, amt) => sum + amt, 0);
        const maxAmount = Math.max(...allAmounts);

        console.log(`All amounts: [${allAmounts.join(', ')}]`);
        console.log(`Sum: ${sumOfAmounts}, Max: ${maxAmount}`);

        // If the largest amount is close to the sum of others, it's likely the total
        const sumOfOthers = sumOfAmounts - maxAmount;
        const isLikelyTotal = maxAmount > sumOfOthers * 0.8; // Max is significant portion

        if (isLikelyTotal && maxAmount !== bestCandidate.amount) {
          console.log(`Selecting ${maxAmount} as likely total (was ${bestCandidate.amount})`);
          return {
            amount: maxAmount,
            currency: detectCurrency(ocrText),
            confidence: 0.75, // Lower confidence due to poor OCR
            rawText: lines.find(line => parseAmount(line) === maxAmount) || bestCandidate.line,
            detectedRows: lines,
          };
        }

        // If the sum makes sense as a total, prefer it
        if (sumOfAmounts > maxAmount * 1.5 && sumOfAmounts <= 100000) {
          console.log(`Calculated total from sum: ${sumOfAmounts}`);
          return {
            amount: sumOfAmounts,
            currency: detectCurrency(ocrText),
            confidence: 0.70, // Lower confidence for calculated total
            rawText: `Calculated from: ${allAmounts.join(' + ')}`,
            detectedRows: lines,
          };
        }
      }
    }

    return {
      amount: bestCandidate.amount,
      currency: bestCandidate.currency,
      confidence: bestCandidate.confidence,
      rawText: bestCandidate.line,
      detectedRows: lines,
    };
  }

  // Fallback: try to find any number in the last few lines
  const lastLines = lines.slice(-5);
  for (let i = lastLines.length - 1; i >= 0; i--) {
    const amount = parseAmount(lastLines[i]);
    if (amount !== null && amount > 0) {
      return {
        amount,
        currency: detectCurrency(lastLines[i]),
        confidence: 0.4, // Low confidence fallback
        rawText: lastLines[i],
        detectedRows: lines,
      };
    }
  }

  // No amount found
  return {
    amount: null,
    currency: detectCurrency(ocrText),
    confidence: 0,
    rawText: ocrText,
    detectedRows: lines,
  };
}

/**
 * Extract multiple amounts from table-like structures
 */
export function extractTableAmounts(ocrText: string): number[] {
  const lines = ocrText.split('\n');
  const amounts: number[] = [];

  for (const line of lines) {
    const amount = parseAmount(line);
    if (amount !== null && amount > 0) {
      amounts.push(amount);
    }
  }

  return amounts;
}
