// Test case for Arabic voucher parsing - simulating OCR output
const fs = require('fs');
const path = require('path');

// Simulated OCR text from the Arabic voucher image
const arabicVoucherOCR = `فاتورة فندق بالاس-1

رقم التسجيل الضريبي: 104560
رقم البطاقة الضريبية: 752-214-489

زيمزم تكنولوجي
للتوريدات العامة

تاريخ: 2025/8/10

فاتورة
الاسيل \\ فندق بالاس

نوع الصنف | الحجم (لتر) | العدد | السعر | الإجمالي
برتقال | 5 لتر | 40 | 550 | 22000
جوافة | 5 لتر | 10 | 380 | 3800
فراولة | 5 لتر | 20 | 380 | 7600
مانجو | 5 لتر | 30 | 380 | 11400

الإجمالي | | | | 44800 ألف

العنوان: المصرية لتبين الكروم ميدان شرف فوق بريد الطورد`;

// Test function that mimics the amount extraction logic
function testArabicExtraction(ocrText) {
    console.log('=== TESTING ARABIC VOUCHER EXTRACTION ===');
    console.log('OCR Text:');
    console.log(ocrText);
    console.log('\n=== LINE BY LINE ANALYSIS ===');

    const lines = ocrText.split('\n').filter(line => line.trim().length > 0);

    lines.forEach((line, index) => {
        console.log(`Line ${index}: "${line}"`);

        // Check for Arabic total keywords
        const hasTotal = /الإجمالي|اجمالي|إجمالي/i.test(line);
        console.log(`  Has total keyword: ${hasTotal}`);

        // Check for numbers
        const numbers = line.match(/\d+/g);
        console.log(`  Numbers found: ${numbers ? numbers.join(', ') : 'none'}`);

        // Check for "ألف" indicator
        const hasAlef = /ألف|الف/.test(line);
        console.log(`  Has ألف indicator: ${hasAlef}`);

        // Test specific regex patterns
        if (hasTotal) {
            console.log(`  >>> TOTAL LINE DETECTED <<<`);

            // Test primary regex
            const primaryMatch = line.match(/الإجمالي.*?(\d+(?:\s*\d+)*)\s*ألف?/i);
            if (primaryMatch) {
                console.log(`  Primary regex match: ${primaryMatch[1]}`);
            }

            // Test fallback regex
            const fallbackMatch = line.match(/الإجمالي.*?(\d+(?:[.,]\d+)?)/i);
            if (fallbackMatch) {
                console.log(`  Fallback regex match: ${fallbackMatch[1]}`);
            }

            // Test simple number extraction
            const simpleNumbers = line.match(/\d+/g);
            if (simpleNumbers) {
                console.log(`  Simple numbers: ${simpleNumbers.join(', ')}`);
                console.log(`  Largest number: ${Math.max(...simpleNumbers.map(n => parseInt(n)))}`);
            }
        }

        console.log('');
    });

    // Test the specific problematic line
    const totalLine = "الإجمالي | | | | 44800 ألف";
    console.log('=== TESTING SPECIFIC TOTAL LINE ===');
    console.log(`Line: "${totalLine}"`);

    // Test various regex patterns
    const patterns = [
        /الإجمالي.*?(\d+(?:\s*\d+)*)\s*ألف?/i,
        /الإجمالي.*?(\d+(?:[.,]\d+)?)/i,
        /الإجمالي.*?(\d+)/i,
        /(\d+)\s*ألف/i,
        /\|\s*(\d+)\s*ألف/i,
        /\|\s*(\d+)\s*$/i
    ];

    patterns.forEach((pattern, index) => {
        const match = totalLine.match(pattern);
        console.log(`Pattern ${index + 1}: ${pattern.source}`);
        console.log(`  Match: ${match ? match[1] : 'NO MATCH'}`);
    });
}

// Run the test
testArabicExtraction(arabicVoucherOCR);
