// Test script to debug Arabic voucher parsing
import { extractAmount } from './src/utils/amountExtraction.js';
import { parseAmount, detectCurrency, normalizeDigits } from './src/utils/numberParser.js';

// Simulated OCR text from the Arabic voucher
const arabicVoucherText = `
فاتورة
الاسيل \ فندق بالاس

رقم التسجيل الضريبي: 104560
رقم البطاقة الضريبية: 752-214-489

زيمزم تكنولوجي
للتوريدات العامة

تاريخ: 2025/8/10

فاتورة
الاسيل \ فندق بالاس

نوع الصنف | الحجم (لتر) | العدد | السعر | الإجمالي
برتقال | 5 لتر | 40 | 550 | 22000
جوافة | 5 لتر | 10 | 380 | 3800
فراولة | 5 لتر | 20 | 380 | 7600
مانجو | 5 لتر | 30 | 380 | 11400

الإجمالي | | | | 44800 ألف
`;

console.log('=== Testing Arabic Voucher Parsing ===');
console.log('Original text:');
console.log(arabicVoucherText);

console.log('\n=== Testing Number Parsing ===');
const testLines = [
  '22000',
  '3800', 
  '7600',
  '11400',
  '44800 ألف',
  'الإجمالي | | | | 44800 ألف'
];

testLines.forEach(line => {
  console.log(`Line: "${line}"`);
  console.log(`  Parsed amount: ${parseAmount(line)}`);
  console.log(`  Currency: ${detectCurrency(line)}`);
  console.log(`  Normalized: "${normalizeDigits(line)}"`);
  console.log('');
});

console.log('\n=== Testing Full Extraction ===');
const result = extractAmount(arabicVoucherText);
console.log('Final result:', result);
