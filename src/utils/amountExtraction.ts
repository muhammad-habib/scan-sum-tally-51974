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
  const normalizedLines = lines.map(line => normalizeDigits(line.toLowerCase()));

  // Pre-pass: scan forward from any "total" header and pick the largest numeric value beneath it
  const totalHeaderIndices = normalizedLines
    .map((l, i) => (containsTotalKeywordNormalized(l) ? i : -1))
    .filter(i => i >= 0);

  if (totalHeaderIndices.length > 0) {
    let headerBest: { amount: number; index: number; currency: string } | null = null;
    totalHeaderIndices.forEach(idx => {
      const end = Math.min(lines.length - 1, idx + 12); // look up to 12 lines below header
      for (let j = idx + 1; j <= end; j++) {
        const amt = parseAmount(lines[j]);
        if (amt !== null && amt > 0 && amt <= 1000000) {
          if (!headerBest || amt > headerBest.amount || (amt === headerBest.amount && j > headerBest.index)) {
            headerBest = { amount: amt, index: j, currency: detectCurrency(lines[j]) };
          }
        }
      }
    });
    if (headerBest) {
      console.log(`Header-based selection -> ${headerBest.amount} (line ${headerBest.index})`);
      return {
        amount: headerBest.amount,
        currency: headerBest.currency,
        confidence: 0.95,
        rawText: lines[headerBest.index],
        detectedRows: lines,
      };
    }
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
    const hasTotalNearbyContext = hasTotalKeyword || hasTotalKeywordNearby(index, normalizedLines, 2);
    
    if (hasIgnoreKeyword && !hasTotalNearbyContext) {
      console.log(`Line ${index}: SKIPPED (ignore keyword: registration/tax/contact)`);
      return; // Skip this line
    }

    // Try to parse amount from this line
    const amount = parseAmount(line);
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

    // Calculate confidence - HEAVILY prioritize total keywords or nearby header
    const isLastInList = index >= lines.length - 5; // Within last 5 lines
    const contextQuality = hasTotalNearbyContext ? 1.0 : 0.2;
    const confidence = calculateConfidence(
      hasTotalNearbyContext,
      isLastInList,
      amount,
      contextQuality
    );

    console.log(`Line ${index}: "${line.substring(0, 50)}..." -> ${amount} ${currency} (hasTotalContext: ${hasTotalNearbyContext}, conf: ${confidence.toFixed(2)})`);

    // Update best candidate
    // Priority order:
    // 1. Lines WITH total keywords win over those without
    // 2. If both have or both lack total keywords, higher confidence wins
    const currentHasTotal = hasTotalNearbyContext;
    const bestHasTotal = bestCandidate ? bestCandidate.hasTotalContext : false;
    
    if (
      !bestCandidate ||
      (currentHasTotal && !bestHasTotal) ||
      (currentHasTotal === bestHasTotal && confidence > bestCandidate.confidence + 1e-6) ||
      (currentHasTotal === bestHasTotal && Math.abs(confidence - bestCandidate.confidence) <= 0.01 &&
        (amount > bestCandidate.amount || (amount === bestCandidate.amount && index > bestCandidate.lineIndex)))
    ) {
      bestCandidate = {
        amount,
        currency,
        confidence,
        lineIndex: index,
        line,
        hasTotalContext: currentHasTotal,
      };
    }
  });

  console.log(`=== BEST CANDIDATE: ${bestCandidate ? `${bestCandidate.amount} (line ${bestCandidate.lineIndex}, totalCtx: ${bestCandidate.hasTotalContext})` : 'NONE'} ===\n`);

  // If we found a candidate, return it
  if (bestCandidate) {
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
