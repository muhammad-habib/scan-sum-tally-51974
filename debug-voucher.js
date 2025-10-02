// Complete test case for the actual OCR output from your voucher
const { extractAmount } = require('./src/utils/amountExtraction.js');

// This is the actual OCR output causing the issue
const actualOCROutput = `لإ امي ©                85 812:59
فاتوره فندق بالاس- 1‏&
رقم التسجيل الضريبي:106560
رقم البطاقة الضريبة:                                                       752-214-489&
زمزمتكنولوجى
للتوريدات                                               العامة تاريخ :20251810
01063060623 -01094263639
EMAILMA9038732@GMAIL.COM‏
‏فاتورة
‏العميل | ‎Sais‏بالاس
"   ©
‎(Sp)‏
              ‏برتقال              ‎As‏               40 550 |22000
‎ws | ao |‏ | 10 | 380 |3800
     فراولة     ‎As‏     20     3807600
‎às               =‏ |                30             38011400
العنوان: المنوفية شبين الكوم ميدان شرف فوق بريدالطرود
‎(vd‏
‏و
‎do J‏4
   ‎<Q    :‏   3   ©27
‎Edit                 Print Uploadto Spare               More‏
‎Cloud‏`;

console.log('=== TESTING ACTUAL OCR OUTPUT ===');
console.log('Expected result: 44800 EGP');
console.log('');

// Test individual problematic lines
const problemLines = [
  "              ‏برتقال              ‎As‏               40 550 |22000",
  "‎ws | ao |‏ | 10 | 380 |3800",
  "     فراولة     ‎As‏     20     3807600",
  "‎às               =‏ |                30             38011400"
];

console.log('=== ANALYZING PROBLEMATIC LINES ===');
problemLines.forEach((line, index) => {
  console.log(`\nLine ${index + 1}: "${line}"`);

  // Test number extraction manually
  const numbers = line.match(/\d+/g);
  console.log(`  Raw numbers: ${numbers ? numbers.join(', ') : 'none'}`);

  // Test pipe splitting
  if (line.includes('|')) {
    const parts = line.split('|');
    console.log(`  Pipe parts: [${parts.map(p => `"${p.trim()}"`).join(', ')}]`);

    // Get rightmost number
    for (let i = parts.length - 1; i >= 0; i--) {
      const match = parts[i].match(/(\d+)/);
      if (match) {
        console.log(`  Rightmost number: ${match[1]} from part "${parts[i].trim()}"`);
        break;
      }
    }
  }
});

console.log('\n=== MANUAL CALCULATION ===');
// Based on the actual table:
// Orange: 40 × 550 = 22000
// Guava: 10 × 380 = 3800
// Strawberry: 20 × 380 = 7600
// Mango: 30 × 380 = 11400
// Total: 22000 + 3800 + 7600 + 11400 = 44800

const expectedAmounts = [22000, 3800, 7600, 11400];
const expectedTotal = expectedAmounts.reduce((sum, amt) => sum + amt, 0);
console.log(`Expected individual amounts: ${expectedAmounts.join(' + ')} = ${expectedTotal}`);

try {
  const result = extractAmount(actualOCROutput);
  console.log('\n=== ACTUAL RESULT ===');
  console.log(`Amount: ${result.amount}`);
  console.log(`Currency: ${result.currency}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Raw text: "${result.rawText}"`);

  console.log('\n=== ANALYSIS ===');
  if (result.amount === expectedTotal) {
    console.log('✅ SUCCESS: Extracted correct total!');
  } else {
    console.log(`❌ FAILED: Expected ${expectedTotal}, got ${result.amount}`);
    console.log(`Difference: ${Math.abs(expectedTotal - (result.amount || 0))}`);
  }
} catch (error) {
  console.log('\n=== ERROR ===');
  console.log(error.message);
}
