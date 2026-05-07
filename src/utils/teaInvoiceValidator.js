/**
 * Tea Invoice Extraction - Test & Validation Harness
 *
 * This utility helps validate the extraction system against sample invoices
 * and provides detailed diagnostics for improving accuracy.
 */

import { TeaInvoiceExtractor } from './teaInvoiceExtraction';

// Test cases based on known invoice patterns
export const TEA_INVOICE_TEST_CASES = [
  {
    id: 'sanjay-bop-17x40',
    description: 'Sanjay Tea BOP - 17 bags of 40kg',
    input: 'Sanjay Tea BOP 17 x 40 kg 250.00 17000.00',
    expectedOutput: {
      teaName: 'Sanjay Tea',
      grade: 'BOP',
      bagCount: 17,
      bagWeightKg: 40,
      receivedKg: 680,
      ratePerKg: 250,
      taxableValue: 17000,
    },
  },
  {
    id: 'tea-triangle-bop-10x50',
    description: 'Tea Triangle BOP - 10 bags of 50kg',
    input: 'Tea Triangle BOP 10 x 50 kg 280.00 14000.00',
    expectedOutput: {
      teaName: 'Tea Triangle',
      grade: 'BOP',
      bagCount: 10,
      bagWeightKg: 50,
      receivedKg: 500,
      ratePerKg: 280,
      taxableValue: 14000,
    },
  },
  {
    id: 'vaishali-dust-20x30',
    description: 'Vaishali Tea Dust - 20 bags of 30kg',
    input: 'Vaishali Tea Dust 20 x 30 kg 150.00 9000.00',
    expectedOutput: {
      teaName: 'Vaishali Tea',
      grade: 'Dust',
      bagCount: 20,
      bagWeightKg: 30,
      receivedKg: 600,
      ratePerKg: 150,
      taxableValue: 9000,
    },
  },
  {
    id: 'surya-ctc-15x40',
    description: 'Surya Tea CTC - 15 bags of 40kg',
    input: 'Surya Tea CTC 15 x 40 kg 220.00 13200.00',
    expectedOutput: {
      teaName: 'Surya Tea',
      grade: 'CTC',
      bagCount: 15,
      bagWeightKg: 40,
      receivedKg: 600,
      ratePerKg: 220,
      taxableValue: 13200,
    },
  },
];

// Extract GSTIN patterns and amounts from full invoice text
export function validateGstExtraction(invoiceText) {
  const diagnostics = {
    hasGstin: false,
    gstinValue: '',
    hasInvoiceNumber: false,
    invoiceNumber: '',
    hasInvoiceDate: false,
    invoiceDate: '',
    taxTypes: [],
    extractedAmounts: [],
    confidence: 0,
  };

  // Check for GSTIN
  const gstinMatch = invoiceText.match(TeaInvoiceExtractor.patterns.gstin);
  if (gstinMatch) {
    diagnostics.hasGstin = true;
    diagnostics.gstinValue = gstinMatch[0];
  }

  // Check for invoice number
  const invMatch = invoiceText.match(TeaInvoiceExtractor.patterns.invoiceNumber);
  if (invMatch) {
    diagnostics.hasInvoiceNumber = true;
    diagnostics.invoiceNumber = invMatch[1];
  }

  // Check for date
  const dateMatch = invoiceText.match(TeaInvoiceExtractor.patterns.invoiceDate);
  if (dateMatch) {
    diagnostics.hasInvoiceDate = true;
    diagnostics.invoiceDate = dateMatch[1];
  }

  // Extract tax types
  const taxMatches = invoiceText.match(/\b(CGST|SGST|IGST)\b/gi) || [];
  diagnostics.taxTypes = [...new Set(taxMatches.map((t) => t.toUpperCase()))];

  // Extract amounts
  const amounts = invoiceText.match(/₹?\s*\d+(?:,\d{3})*(?:\.\d{2})?/g) || [];
  diagnostics.extractedAmounts = amounts.slice(0, 10); // First 10 amounts

  // Calculate confidence
  let confScore = 0;
  if (diagnostics.hasGstin) confScore += 0.25;
  if (diagnostics.hasInvoiceNumber) confScore += 0.2;
  if (diagnostics.hasInvoiceDate) confScore += 0.2;
  if (diagnostics.taxTypes.length > 0) confScore += 0.2;
  if (diagnostics.extractedAmounts.length > 0) confScore += 0.15;
  diagnostics.confidence = Math.round(confScore * 100);

  return diagnostics;
}

/**
 * Test line item parsing
 * Validates if the parser correctly identifies:
 * - Product name and grade
 * - Bag count and weight
 * - Calculated totals
 */
export function testLineItemParsing(invoiceLineText) {
  const result = {
    input: invoiceLineText,
    parsed: TeaInvoiceExtractor.buildTeaLineItem(invoiceLineText),
    validations: {},
    score: 0,
  };

  // Validate grade extraction
  const gradeMatch = invoiceLineText.match(TeaInvoiceExtractor.patterns.teaGrades);
  result.validations.gradeFound = !!gradeMatch;
  if (gradeMatch) {
    result.validations.gradeCorrect = result.parsed.grade === gradeMatch[0].toUpperCase();
  }

  // Validate bag specification
  const bagSpecMatch = invoiceLineText.match(TeaInvoiceExtractor.patterns.bagSpec);
  result.validations.bagSpecFound = !!bagSpecMatch;
  if (bagSpecMatch) {
    const expectedBagCount = parseInt(bagSpecMatch[1], 10);
    const expectedBagWeight = parseInt(bagSpecMatch[2], 10);
    result.validations.bagCountCorrect = parseInt(result.parsed.bagCount, 10) === expectedBagCount;
    result.validations.bagWeightCorrect =
      parseInt(result.parsed.bagWeightKg, 10) === expectedBagWeight;
  }

  // Validate math
  if (result.parsed.bagCount && result.parsed.bagWeightKg) {
    const expectedReceivedKg =
      parseInt(result.parsed.bagCount) * parseInt(result.parsed.bagWeightKg);
    result.validations.receivedKgCorrect =
      parseInt(result.parsed.receivedKg) === expectedReceivedKg;
  }

  // Calculate score
  const checks = Object.values(result.validations).filter((v) => v === true).length;
  const totalChecks = Object.values(result.validations).length;
  result.score = Math.round((checks / totalChecks) * 100);

  return result;
}

/**
 * Run all test cases and return summary
 */
export function runAllTests() {
  const results = {
    totalTests: TEA_INVOICE_TEST_CASES.length,
    passedTests: 0,
    failedTests: 0,
    results: [],
    averageScore: 0,
  };

  const scores = [];

  TEA_INVOICE_TEST_CASES.forEach((testCase) => {
    const testResult = testLineItemParsing(testCase.input);
    results.results.push({
      testId: testCase.id,
      description: testCase.description,
      score: testResult.score,
      passed: testResult.score >= 80,
      validations: testResult.validations,
    });

    scores.push(testResult.score);
    if (testResult.score >= 80) {
      results.passedTests += 1;
    } else {
      results.failedTests += 1;
    }
  });

  results.averageScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return results;
}

/**
 * Diagnostic: Show what the parser is extracting from a line
 */
export function diagnosticExtraction(invoiceLineText) {
  const numbers = TeaInvoiceExtractor.getNumberTokens(invoiceLineText);
  const grades = invoiceLineText.match(TeaInvoiceExtractor.patterns.teaGrades) || [];
  const bagSpecs = invoiceLineText.match(TeaInvoiceExtractor.patterns.bagSpec) || [];

  return {
    originalText: invoiceLineText,
    extractedNumbers: numbers.map((n) => ({ raw: n.raw, value: n.value, index: n.index })),
    extractedGrades: grades,
    extractedBagSpecs: bagSpecs,
    parsedItem: TeaInvoiceExtractor.buildTeaLineItem(invoiceLineText),
    issues: identifyIssues(invoiceLineText, numbers, grades, bagSpecs),
  };
}

/**
 * Identify common parsing issues
 */
export function identifyIssues(text, numbers, grades, bagSpecs) {
  const issues = [];

  if (grades.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'No tea grade found in text',
      suggestion: 'Ensure grade (BOP, CTC, BBSP, etc.) is present in description',
    });
  }

  if (bagSpecs.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'No bag specification found (expected format: "X x Y")',
      suggestion: 'Include bag count and weight, e.g., "17 x 40" for 17 bags of 40kg each',
    });
  }

  if (numbers.length < 2) {
    issues.push({
      severity: 'error',
      message: 'Insufficient numbers for quantity and rate',
      suggestion: 'Line must include at least 2 numbers (quantity/bags and rate)',
    });
  }

  if (!/\b(₹|Rs|INR)\b/i.test(text)) {
    issues.push({
      severity: 'info',
      message: 'No currency symbol found',
      suggestion: 'Consider prefixing amounts with ₹ or Rs for clarity',
    });
  }

  return issues;
}

/**
 * Format test results for display
 */
export function formatTestResults(results) {
  let output = '='.repeat(60) + '\n';
  output += 'TEA INVOICE EXTRACTION TEST RESULTS\n';
  output += '='.repeat(60) + '\n\n';

  output += `Total Tests: ${results.totalTests}\n`;
  output += `Passed: ${results.passedTests} (${Math.round((results.passedTests / results.totalTests) * 100)}%)\n`;
  output += `Failed: ${results.failedTests}\n`;
  output += `Average Score: ${results.averageScore}%\n\n`;

  output += 'INDIVIDUAL TEST RESULTS:\n';
  output += '-'.repeat(60) + '\n';

  results.results.forEach((result) => {
    output += `\n✓ ${result.testId}\n`;
    output += `  Description: ${result.description}\n`;
    output += `  Score: ${result.score}%\n`;
    output += `  Status: ${result.passed ? 'PASSED' : 'FAILED'}\n`;
    output += `  Validations:\n`;

    Object.entries(result.validations).forEach(([key, value]) => {
      output += `    - ${key}: ${value ? '✓' : '✗'}\n`;
    });
  });

  output += '\n' + '='.repeat(60) + '\n';

  return output;
}

export default {
  TEA_INVOICE_TEST_CASES,
  validateGstExtraction,
  testLineItemParsing,
  runAllTests,
  diagnosticExtraction,
  identifyIssues,
  formatTestResults,
};
