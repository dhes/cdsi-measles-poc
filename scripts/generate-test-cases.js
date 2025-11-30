#!/usr/bin/env node

/**
 * Generate MMR Test Cases from Manifests
 *
 * This script reads YAML manifest files and generates FHIR test case resources
 * with dates calculated relative to a reference date.
 *
 * Usage:
 *   node scripts/generate-test-cases.js [--reference-date YYYY-MM-DD]
 *
 * Examples:
 *   node scripts/generate-test-cases.js
 *   node scripts/generate-test-cases.js --reference-date 2025-11-24
 *
 * The script:
 * 1. Reads manifests from manifests/*.yaml
 * 2. Calculates absolute dates from relative specifications
 * 3. Generates FHIR resources in input/tests/MMR_Recommendations/
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { v4: uuidv4 } = require('uuid');

// Configuration
const MANIFESTS_DIR = path.join(__dirname, '..', 'manifests');
const OUTPUT_BASE_DIR = path.join(__dirname, '..', 'input', 'tests', 'MMR_Standard');

// Parse command line arguments
let referenceDate = new Date();
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--reference-date' && args[i + 1]) {
    referenceDate = new Date(args[i + 1]);
    i++;
  }
}

console.log(`\n📅 Reference Date: ${referenceDate.toISOString().split('T')[0]}`);
console.log(`📂 Manifests Directory: ${MANIFESTS_DIR}`);
console.log(`📁 Output Directory: ${OUTPUT_BASE_DIR}\n`);

/**
 * Parse relative date specification and calculate absolute date
 *
 * @param {string|object} dateSpec - Either ISO date string or relative spec
 * @param {Date} refDate - Reference date for relative calculations
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function calculateDate(dateSpec, refDate) {
  if (typeof dateSpec === 'string') {
    // Already an absolute date
    return dateSpec;
  }

  if (dateSpec.relative) {
    // Parse relative specification: "13 months before reference"
    const match = dateSpec.relative.match(/^(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+(before|after)\s+reference$/i);

    if (!match) {
      throw new Error(`Invalid relative date format: ${dateSpec.relative}`);
    }

    const [, amount, unit, direction] = match;
    const value = parseInt(amount, 10);
    const result = new Date(refDate);

    // Calculate offset
    const multiplier = direction.toLowerCase() === 'before' ? -1 : 1;

    switch (unit.toLowerCase().replace(/s$/, '')) {
      case 'day':
        result.setDate(result.getDate() + (value * multiplier));
        break;
      case 'week':
        result.setDate(result.getDate() + (value * 7 * multiplier));
        break;
      case 'month':
        result.setMonth(result.getMonth() + (value * multiplier));
        break;
      case 'year':
        result.setFullYear(result.getFullYear() + (value * multiplier));
        break;
      default:
        throw new Error(`Unsupported time unit: ${unit}`);
    }

    return result.toISOString().split('T')[0];
  }

  throw new Error(`Invalid date specification: ${JSON.stringify(dateSpec)}`);
}

/**
 * Generate Patient resource from manifest
 */
function generatePatient(manifest, refDate) {
  const patient = manifest.patient;
  const birthDate = calculateDate(patient.birthDate, refDate);

  // Build text.div based on available data (supports both old and new manifest formats)
  let textDiv = `<div xmlns="http://www.w3.org/1999/xhtml">Test: ${manifest.description}.`;

  // Add expected results if present
  if (manifest.expectedResults) {
    // Check for new format (MMR_Routine_Lite_2.cql outputs)
    if (manifest.expectedResults['All Doses Due Now'] !== undefined ||
        manifest.expectedResults['Any Dose Due Now'] !== undefined) {
      textDiv += ` Expected: `;
      const expectations = [];
      if (manifest.expectedResults['All Doses Due Now'] !== undefined) {
        expectations.push(`All Doses Due Now=${manifest.expectedResults['All Doses Due Now']}`);
      }
      if (manifest.expectedResults['Any Dose Due Now'] !== undefined) {
        expectations.push(`Any Dose Due Now=${manifest.expectedResults['Any Dose Due Now']}`);
      }
      textDiv += expectations.join(', ') + '.';
    }
    // Old format (MMR[n] rule outputs)
    else if (manifest.expectedResults.recommendation1 !== undefined ||
             manifest.expectedResults.recommendation2 !== undefined) {
      textDiv += ` Expected: Rule ${manifest.clinicalScenario?.ruleFires ? 'FIRES' : 'does NOT fire'}. ` +
                 `Recommendation 1: ${manifest.expectedResults.recommendation1 ? `'${manifest.expectedResults.recommendation1}'` : 'null'}, ` +
                 `Recommendation 2: ${manifest.expectedResults.recommendation2 ? `'${manifest.expectedResults.recommendation2}'` : 'null'}.`;
    }
  }

  textDiv += `</div>`;

  return {
    resourceType: 'Patient',
    id: patient.id,
    text: {
      status: 'generated',
      div: textDiv
    },
    name: [
      {
        given: Array.isArray(patient.name.given) ? patient.name.given : [patient.name.given],
        family: patient.name.family
      }
    ],
    gender: patient.gender,
    birthDate: birthDate
  };
}

/**
 * Generate Immunization resource from manifest entry
 */
function generateImmunization(immunization, patientId, refDate) {
  const occurrenceDate = calculateDate(immunization.occurrenceDateTime, refDate);

  return {
    resourceType: 'Immunization',
    id: immunization.id || uuidv4(),
    status: immunization.status || 'completed',
    primarySource: immunization.primarySource !== undefined ? immunization.primarySource : true,
    vaccineCode: immunization.vaccineCode,
    occurrenceDateTime: `${occurrenceDate}T00:00:00.000Z`,
    patient: {
      reference: `Patient/${patientId}`
    }
  };
}

/**
 * Generate Condition resource from manifest entry
 */
function generateCondition(condition, patientId, refDate) {
  const resource = {
    resourceType: 'Condition',
    id: condition.id || uuidv4(),
    clinicalStatus: condition.clinicalStatus,
    verificationStatus: condition.verificationStatus,
    code: condition.code,
    subject: {
      reference: `Patient/${patientId}`
    }
  };

  if (condition.onsetDateTime) {
    resource.onsetDateTime = `${calculateDate(condition.onsetDateTime, refDate)}T00:00:00.000Z`;
  }

  return resource;
}

/**
 * Generate Observation resource from manifest entry
 */
function generateObservation(observation, patientId, refDate) {
  const resource = {
    resourceType: 'Observation',
    id: observation.id || uuidv4(),
    status: observation.status || 'final',
    code: observation.code,
    subject: {
      reference: `Patient/${patientId}`
    }
  };

  if (observation.category) {
    resource.category = observation.category;
  }

  if (observation.valueQuantity) {
    resource.valueQuantity = observation.valueQuantity;
  }

  if (observation.valueCodeableConcept) {
    resource.valueCodeableConcept = observation.valueCodeableConcept;
  }

  if (observation.effectiveDateTime) {
    resource.effectiveDateTime = `${calculateDate(observation.effectiveDateTime, refDate)}T00:00:00.000Z`;
  }

  if (observation.issued) {
    // issued is just a date, not dateTime
    resource.issued = calculateDate(observation.issued, refDate);
  }

  return resource;
}

/**
 * Write resource to file
 */
function writeResource(testCaseId, resourceType, resource) {
  const testCaseDir = path.join(OUTPUT_BASE_DIR, testCaseId);
  const resourceDir = path.join(testCaseDir, resourceType);

  // Create directories if they don't exist
  fs.mkdirSync(resourceDir, { recursive: true });

  const filename = path.join(resourceDir, `${resource.id}.json`);
  fs.writeFileSync(filename, JSON.stringify(resource, null, 2) + '\n');

  return filename;
}

/**
 * Process a single manifest file
 */
function processManifest(manifestPath, refDate) {
  const manifestFile = path.basename(manifestPath);
  console.log(`📄 Processing: ${manifestFile}`);

  // Read and parse manifest
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = yaml.load(manifestContent);

  const testCaseId = manifest.testCaseId;

  // Generate Patient resource
  const patient = generatePatient(manifest, refDate);
  const patientFile = writeResource(testCaseId, 'Patient', patient);
  console.log(`   ✓ Patient: ${path.relative(OUTPUT_BASE_DIR, patientFile)}`);

  // Generate Immunization resources
  if (manifest.immunizations && manifest.immunizations.length > 0) {
    manifest.immunizations.forEach((imm, index) => {
      const immunization = generateImmunization(imm, testCaseId, refDate);
      const immFile = writeResource(testCaseId, 'Immunization', immunization);
      console.log(`   ✓ Immunization ${index + 1}: ${path.relative(OUTPUT_BASE_DIR, immFile)}`);
    });
  }

  // Generate Condition resources
  if (manifest.conditions && manifest.conditions.length > 0) {
    manifest.conditions.forEach((cond, index) => {
      const condition = generateCondition(cond, testCaseId, refDate);
      const condFile = writeResource(testCaseId, 'Condition', condition);
      console.log(`   ✓ Condition ${index + 1}: ${path.relative(OUTPUT_BASE_DIR, condFile)}`);
    });
  }

  // Generate Observation resources
  if (manifest.observations && manifest.observations.length > 0) {
    manifest.observations.forEach((obs, index) => {
      const observation = generateObservation(obs, testCaseId, refDate);
      const obsFile = writeResource(testCaseId, 'Observation', observation);
      console.log(`   ✓ Observation ${index + 1}: ${path.relative(OUTPUT_BASE_DIR, obsFile)}`);
    });
  }

  console.log(`   ✅ Test case '${testCaseId}' generated successfully\n`);
}

/**
 * Main execution
 */
function main() {
  // Find all manifest files
  const manifestFiles = fs.readdirSync(MANIFESTS_DIR)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => path.join(MANIFESTS_DIR, f));

  if (manifestFiles.length === 0) {
    console.error('❌ No manifest files found in', MANIFESTS_DIR);
    process.exit(1);
  }

  console.log(`Found ${manifestFiles.length} manifest file(s)\n`);

  // Process each manifest
  manifestFiles.forEach(manifestPath => {
    try {
      processManifest(manifestPath, referenceDate);
    } catch (error) {
      console.error(`❌ Error processing ${path.basename(manifestPath)}:`, error.message);
      process.exit(1);
    }
  });

  console.log(`\n✅ All test cases generated successfully!`);
  console.log(`📁 Output location: ${OUTPUT_BASE_DIR}\n`);
}

// Run the script
main();
