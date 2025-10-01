import { parseAmount, detectCurrency, normalizeDigits } from './numberParser';

interface ExtractedAmount {
  amount: number | null;
  currency: string;
  confidence: number;
  rawText?: string;
  detectedRows?: string[];
}

// Keywords that indicate a total amount (Arabic and other languages)
const TOTAL_KEYWORDS = [
  // Arabic - various forms
  'الإجمالي', 'الاجمالي', 'المجموع', 'الكلي', 'المبلغ الإجمالي', 'المبلغ الكلي',
  'اجمالي', 'إجمالي', 'مجموع', 'كلي', 'الإجمالى', 'الاجمالى',
  // English
  'total', 'total due', 'grand total', 'amount due', 'balance due',
  'sum', 'subtotal',
  // German
  'gesamt', 'summe', 'endsumme', 'gesamtsumme',
  // Portuguese
  'total', 'soma', 'montante', 'valor total', 'saldo',
  // French
  'total', 'montant', 'somme',
];

// Keywords to ignore (VAT, tax, etc. unless combined with total)
const IGNORE_KEYWORDS = [
  'vat', 'tax', 'مضافة', 'ضريبة', 'steuer', 'imposto',
  'service', 'خدمة', 'bedienung',
];

/**
 * Calculate confidence score based on various factors
 */
function calculateConfidence(
  hasKeyword: boolean,
  isLastInList: boolean,
  amountSize: number,
  contextQuality: number
): number {
  let confidence = 0.5; // Base confidence

  if (hasKeyword) confidence += 0.3;
  if (isLastInList) confidence += 0.15;
  if (amountSize > 50) confidence += 0.05; // Larger amounts often totals
  confidence += contextQuality * 0.2; // 0-1 score for surrounding text quality

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
  const normalizedText = normalizeDigits(ocrText.toLowerCase());
  
  let bestCandidate: {
    amount: number;
    currency: string;
    confidence: number;
    lineIndex: number;
    line: string;
  } | null = null;

  // Process each line
  lines.forEach((line, index) => {
    const normalizedLine = normalizeDigits(line.toLowerCase());
    
    // Check if line contains ignore keywords without total keywords
    const hasIgnoreKeyword = IGNORE_KEYWORDS.some(kw => normalizedLine.includes(kw));
    const hasTotalKeyword = TOTAL_KEYWORDS.some(kw => normalizedLine.includes(kw));
    
    if (hasIgnoreKeyword && !hasTotalKeyword) {
      return; // Skip this line
    }

    // Try to parse amount from this line
    const amount = parseAmount(line);
    if (amount === null || amount === 0) return;

    // Detect currency
    const currency = detectCurrency(line);

    // Calculate confidence - prioritize total keywords heavily
    const isLastInList = index >= lines.length - 5; // Within last 5 lines
    const contextQuality = hasTotalKeyword ? 1.0 : 0.3;
    const confidence = calculateConfidence(
      hasTotalKeyword,
      isLastInList,
      amount,
      contextQuality
    );

    // Log for debugging
    console.log(`Line ${index}: "${line.substring(0, 50)}..." -> amount: ${amount}, hasTotal: ${hasTotalKeyword}, confidence: ${confidence.toFixed(2)}`);

    // Update best candidate - strongly prefer lines with total keywords
    if (!bestCandidate || 
        (hasTotalKeyword && !bestCandidate.line.toLowerCase().match(new RegExp(TOTAL_KEYWORDS.join('|'), 'i'))) ||
        (hasTotalKeyword === (bestCandidate.line.toLowerCase().match(new RegExp(TOTAL_KEYWORDS.join('|'), 'i')) !== null) && confidence > bestCandidate.confidence)) {
      bestCandidate = {
        amount,
        currency,
        confidence,
        lineIndex: index,
        line,
      };
    }
  });

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
