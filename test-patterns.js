// Simple test for the Arabic total line pattern
const testLine = "الإجمالي | | | | 44800 ألف";

console.log('Testing Arabic total line:', testLine);

// Test the enhanced patterns
const patterns = [
  {
    name: "Table row pattern",
    regex: /الإجمالي.*?\|\s*.*?\|\s*.*?\|\s*.*?\|\s*(\d+)\s*ألف?/i,
  },
  {
    name: "Simple pattern",
    regex: /الإجمالي.*?(\d+)\s*ألف/i,
  },
  {
    name: "Alef pattern",
    regex: /(\d+)\s*ألف/i,
  }
];

patterns.forEach((pattern, index) => {
  const match = testLine.match(pattern.regex);
  console.log(`${index + 1}. ${pattern.name}:`);
  console.log(`   Match: ${match ? match[1] : 'NO MATCH'}`);
});

// Test column splitting
console.log('\n4. Column splitting:');
if (testLine.includes('|')) {
  const columns = testLine.split('|').map(col => col.trim());
  console.log(`   Columns: [${columns.map(c => `"${c}"`).join(', ')}]`);

  for (let i = columns.length - 1; i >= 0; i--) {
    const numberMatch = columns[i].match(/(\d+)/);
    if (numberMatch) {
      console.log(`   Found number in column ${i}: ${numberMatch[1]}`);
      break;
    }
  }
}
