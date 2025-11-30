#!/usr/bin/env node

/**
 * Generate MMR Test Cases Summary
 *
 * This script analyzes all MMR test case patient bundles and generates
 * a comprehensive markdown summary document.
 *
 * Usage:
 *   node scripts/generate-test-summary.js [reference-date]
 *
 * Example:
 *   node scripts/generate-test-summary.js 2025-11-22
 */

const fs = require('fs');
const path = require('path');

// Configuration
const TEST_CASES_DIR = path.join(__dirname, '..', 'input', 'tests', 'MMR_Recommendations');
const OUTPUT_FILE = path.join(__dirname, '..', 'docs', 'test-cases-summary.md');

// Reference date for age calculations (defaults to today)
const REFERENCE_DATE = process.argv[2] ? new Date(process.argv[2]) : new Date();

/**
 * Calculate age in years and months
 */
function calculateAge(birthDate, referenceDate) {
  const birth = new Date(birthDate);
  const ref = new Date(referenceDate);

  let years = ref.getFullYear() - birth.getFullYear();
  let months = ref.getMonth() - birth.getMonth();

  if (months < 0) {
    years--;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  return {
    years,
    months,
    totalMonths,
    display: years > 0 ? `${years}y ${months}m` : `${months}m`
  };
}

/**
 * Calculate patient age at a specific date (e.g., vaccination date)
 */
function calculateAgeAtDate(birthDate, eventDate) {
  const age = calculateAge(birthDate, eventDate);
  return age.totalMonths;
}

/**
 * Read JSON file safely
 */
function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Find all files matching a pattern in a directory
 */
function findFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(item)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Analyze a single test case
 */
function analyzeTestCase(testCaseDir) {
  const testCaseId = path.basename(testCaseDir);

  // Find Patient resource
  const patientFiles = findFiles(path.join(testCaseDir, 'Patient'), /\.json$/);
  if (patientFiles.length === 0) {
    console.warn(`No Patient resource found in ${testCaseId}`);
    return null;
  }

  const patient = readJSON(patientFiles[0]);
  if (!patient) return null;

  // Calculate age
  const age = calculateAge(patient.birthDate, REFERENCE_DATE);

  // Find Immunization resources
  const immunizationFiles = findFiles(path.join(testCaseDir, 'Immunization'), /\.json$/);
  const immunizations = immunizationFiles.map(f => readJSON(f)).filter(Boolean);

  // MMR vaccine codes (CVX and SNOMED)
  const mmrCodes = ['03', '94', '871765008'];
  const mmrImmunizations = immunizations.filter(imm => {
    const coding = imm.vaccineCode?.coding || [];
    return coding.some(c => mmrCodes.includes(c.code));
  });

  const doseDates = mmrImmunizations
    .map(imm => imm.occurrenceDateTime || imm.occurrenceString)
    .filter(Boolean)
    .sort();

  // Find Condition resources
  const conditionFiles = findFiles(path.join(testCaseDir, 'Condition'), /\.json$/);
  const conditions = conditionFiles.map(f => readJSON(f)).filter(Boolean);

  const conditionSummaries = conditions.map(cond => {
    const coding = cond.code?.coding?.[0] || {};
    return {
      code: coding.code,
      display: coding.display || cond.code?.text || 'Unknown',
      system: coding.system?.includes('snomed') ? 'SNOMED' :
              coding.system?.includes('icd-9') ? 'ICD-9' :
              coding.system?.includes('icd-10') ? 'ICD-10' : 'Other'
    };
  });

  // Find Observation resources (lab results)
  const observationFiles = findFiles(path.join(testCaseDir, 'Observation'), /\.json$/);
  const observations = observationFiles.map(f => readJSON(f)).filter(Boolean);

  const observationSummaries = observations.map(obs => {
    const coding = obs.code?.coding?.[0] || {};
    const value = obs.valueQuantity ?
      `${obs.valueQuantity.value} ${obs.valueQuantity.unit || obs.valueQuantity.code || ''}` :
      obs.valueString || 'N/A';

    return {
      code: coding.code,
      display: coding.display || 'Unknown',
      value: value.trim()
    };
  });

  // Extract notes from Patient resource
  let notes = '';
  if (patient.text?.div) {
    // Extract text from XHTML div
    notes = patient.text.div.replace(/<[^>]*>/g, '').trim();
  }
  if (patient.note && patient.note.length > 0) {
    notes = patient.note[0].text;
  }

  return {
    testCaseId,
    birthDate: patient.birthDate,
    age,
    numMMRDoses: mmrImmunizations.length,
    doseDates,
    conditions: conditionSummaries,
    observations: observationSummaries,
    notes
  };
}

/**
 * Generate markdown summary
 */
function generateMarkdown(testCases) {
  const lines = [];

  // Header
  lines.push('# MMR Test Cases Summary');
  lines.push('');
  lines.push(`**Reference Date:** ${REFERENCE_DATE.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push('');
  lines.push('This document provides an overview of all MMR test case patients, including their ages, vaccination history, conditions, and expected recommendations.');
  lines.push('');

  // Quick Reference Table
  lines.push('## Quick Reference Table');
  lines.push('');
  lines.push('| Test Case | Age | Prior MMR Doses | Dose Dates | Conditions | Notes |');
  lines.push('|-----------|-----|-----------------|------------|------------|-------|');

  for (const tc of testCases) {
    const conditionSummary = tc.conditions.length > 0
      ? tc.conditions.map(c => c.display.substring(0, 30)).join(', ')
      : 'None';

    const dosesSummary = tc.doseDates.length > 0
      ? tc.doseDates.map(d => {
          const ageAtDose = calculateAgeAtDate(tc.birthDate, d);
          return `${d.split('T')[0]} (${ageAtDose}mo)`;
        }).join('<br>')
      : 'None';

    const notesSummary = tc.notes.substring(0, 50) + (tc.notes.length > 50 ? '...' : '');

    lines.push(`| [${tc.testCaseId}](#${tc.testCaseId}) | ${tc.age.display} | ${tc.numMMRDoses} | ${dosesSummary} | ${conditionSummary} | ${notesSummary} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Detailed sections
  lines.push('## Detailed Test Case Information');
  lines.push('');

  for (const tc of testCases) {
    lines.push(`### ${tc.testCaseId}`);
    lines.push(`**Patient Age:** ${tc.age.years} years ${tc.age.months} months (born ${tc.birthDate})`);
    lines.push(`**MMR Doses:** ${tc.numMMRDoses}`);

    if (tc.doseDates.length > 0) {
      lines.push('**Dose History:**');
      tc.doseDates.forEach((date, idx) => {
        const ageAtDose = calculateAgeAtDate(tc.birthDate, date);
        lines.push(`- Dose ${idx + 1}: ${date.split('T')[0]} (patient age ${ageAtDose} months)`);
      });
      lines.push('');
    }

    if (tc.conditions.length > 0) {
      lines.push('**Conditions:**');
      tc.conditions.forEach(cond => {
        lines.push(`- ${cond.display} - ${cond.system} ${cond.code}`);
      });
      lines.push('');
    } else {
      lines.push('**Conditions:** None');
      lines.push('');
    }

    if (tc.observations.length > 0) {
      lines.push('**Laboratory Results:**');
      tc.observations.forEach(obs => {
        lines.push(`- ${obs.display}: **${obs.value}**`);
      });
      lines.push('');
    }

    if (tc.notes) {
      lines.push(`**Notes:** ${tc.notes}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // Summary statistics
  lines.push('## Summary Statistics');
  lines.push('');

  // Age distribution
  const infants = testCases.filter(tc => tc.age.totalMonths < 12).length;
  const toddlers = testCases.filter(tc => tc.age.totalMonths >= 12 && tc.age.totalMonths < 48).length;
  const children = testCases.filter(tc => tc.age.totalMonths >= 48 && tc.age.totalMonths < 216).length;
  const adults = testCases.filter(tc => tc.age.totalMonths >= 216).length;

  lines.push('### By Age Group');
  lines.push(`- **Infants (<12 months):** ${infants} test cases`);
  lines.push(`- **Toddlers (12-47 months):** ${toddlers} test cases`);
  lines.push(`- **Children (4-18 years):** ${children} test cases`);
  lines.push(`- **Adults (>18 years):** ${adults} test cases`);
  lines.push('');

  // Vaccination status
  const noDoses = testCases.filter(tc => tc.numMMRDoses === 0).length;
  const oneDose = testCases.filter(tc => tc.numMMRDoses === 1).length;
  const twoPlusDoses = testCases.filter(tc => tc.numMMRDoses >= 2).length;

  lines.push('### By Vaccination Status');
  lines.push(`- **No prior MMR doses:** ${noDoses} test cases`);
  lines.push(`- **1 prior MMR dose:** ${oneDose} test cases`);
  lines.push(`- **2+ prior MMR doses:** ${twoPlusDoses} test cases`);
  lines.push('');

  // Conditions
  const withConditions = testCases.filter(tc => tc.conditions.length > 0 || tc.observations.length > 0).length;
  const noConditions = testCases.length - withConditions;

  lines.push('### By Clinical Conditions');
  lines.push(`- **No conditions:** ${noConditions} test cases`);
  lines.push(`- **With conditions/labs:** ${withConditions} test cases`);
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## Notes on Date Calculations');
  lines.push('');
  lines.push(`All ages are calculated as of **${REFERENCE_DATE.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}**.`);
  lines.push('');
  lines.push('When a dose date is shown with patient age, this represents the age at vaccination calculated from birth date to vaccination date.');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*This document was auto-generated by `scripts/generate-test-summary.js`*');

  return lines.join('\n');
}

/**
 * Main execution
 */
function main() {
  console.log('Analyzing MMR test cases...');
  console.log(`Reference date: ${REFERENCE_DATE.toISOString().split('T')[0]}`);

  // Get all test case directories
  const testCaseDirs = fs.readdirSync(TEST_CASES_DIR)
    .map(dir => path.join(TEST_CASES_DIR, dir))
    .filter(dir => fs.statSync(dir).isDirectory())
    .sort();

  console.log(`Found ${testCaseDirs.length} test case directories`);

  // Analyze each test case
  const testCases = testCaseDirs
    .map(analyzeTestCase)
    .filter(Boolean);

  console.log(`Successfully analyzed ${testCases.length} test cases`);

  // Generate markdown
  const markdown = generateMarkdown(testCases);

  // Write output file
  fs.writeFileSync(OUTPUT_FILE, markdown, 'utf8');

  console.log(`\n✅ Summary written to: ${OUTPUT_FILE}`);
  console.log(`\nTest cases analyzed: ${testCases.length}`);
  console.log(`- Infants (<12mo): ${testCases.filter(tc => tc.age.totalMonths < 12).length}`);
  console.log(`- Toddlers (12-47mo): ${testCases.filter(tc => tc.age.totalMonths >= 12 && tc.age.totalMonths < 48).length}`);
  console.log(`- Children (4-18y): ${testCases.filter(tc => tc.age.totalMonths >= 48 && tc.age.totalMonths < 216).length}`);
  console.log(`- Adults (>18y): ${testCases.filter(tc => tc.age.totalMonths >= 216).length}`);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { analyzeTestCase, calculateAge, generateMarkdown };
