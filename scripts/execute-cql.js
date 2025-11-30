#!/usr/bin/env node

/**
 * Execute CQL against test cases via FHIR server
 *
 * Usage:
 *   node scripts/execute-cql.js <library-name> <test-case-id> [--reference-date YYYY-MM-DD]
 *
 * Examples:
 *   node scripts/execute-cql.js MMR_Routine_Lite_2 mmr-rule1-negative
 *   node scripts/execute-cql.js MMR_Routine_Lite_2 4-year-old-no-mmr --reference-date 2025-11-27
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Configuration
const FHIR_SERVER_URL = process.env.FHIR_SERVER_URL || 'https://enhanced.hopena.info/fhir/';
const CQL_DIR = path.join(__dirname, '..', 'input', 'cql');
const TEST_CASES_DIR = path.join(__dirname, '..', 'input', 'tests');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node execute-cql.js <library-name> <test-case-id> [--reference-date YYYY-MM-DD]');
    console.error('\nExamples:');
    console.error('  node execute-cql.js MMR_Routine_Lite_2 mmr-rule1-negative');
    console.error('  node execute-cql.js MMR_Routine_Lite_2 4-year-old-no-mmr --reference-date 2025-11-27');
    process.exit(1);
  }

  const libraryName = args[0];
  const testCaseId = args[1];
  let referenceDate = null;

  // Check for --reference-date flag
  const dateIndex = args.indexOf('--reference-date');
  if (dateIndex !== -1 && args[dateIndex + 1]) {
    referenceDate = args[dateIndex + 1];
  }

  return { libraryName, testCaseId, referenceDate };
}

/**
 * Load test case resources
 */
function loadTestCase(libraryDir, testCaseId) {
  const testCaseDir = path.join(TEST_CASES_DIR, libraryDir, testCaseId);

  if (!fs.existsSync(testCaseDir)) {
    throw new Error(`Test case directory not found: ${testCaseDir}`);
  }

  const resources = [];

  // Load all resource types
  const resourceTypes = ['Patient', 'Immunization', 'Condition', 'Observation'];

  for (const resourceType of resourceTypes) {
    const resourceDir = path.join(testCaseDir, resourceType);

    if (fs.existsSync(resourceDir)) {
      const files = fs.readdirSync(resourceDir)
        .filter(f => f.endsWith('.json'));

      for (const file of files) {
        const resourcePath = path.join(resourceDir, file);
        const resource = JSON.parse(fs.readFileSync(resourcePath, 'utf8'));
        resources.push(resource);
      }
    }
  }

  return resources;
}

/**
 * Execute CQL via FHIR server $cql operation
 */
async function executeCQL(libraryName, patientId, resources) {
  try {
    console.log(`\n🔄 Executing CQL library: ${libraryName}`);
    console.log(`👤 Patient ID: ${patientId}`);
    console.log(`🔗 FHIR Server: ${FHIR_SERVER_URL}`);

    // Build the $cql request
    // Note: This endpoint structure may vary depending on your FHIR server implementation
    // Common patterns:
    // - POST {base}/Library/{id}/$cql
    // - POST {base}/$cql
    // - POST {base}/Library/{id}/$evaluate

    const endpoint = `${FHIR_SERVER_URL}Library/${libraryName}/$cql`;

    const requestBody = {
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'subject',
          valueString: patientId
        },
        {
          name: 'context',
          valueString: 'Patient'
        },
        // Include test resources as contained resources or data parameters
        ...resources.map(resource => ({
          name: 'data',
          resource: resource
        }))
      ]
    };

    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      }
    });

    console.log(`\n✅ CQL Execution Successful\n`);
    console.log('Results:');
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;

  } catch (error) {
    console.error('\n❌ CQL Execution Failed');

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }

    throw error;
  }
}

/**
 * Alternative: Load CQL file and display it
 * (Useful if direct FHIR execution isn't working)
 */
function displayCQLInfo(libraryName) {
  const cqlPath = path.join(CQL_DIR, `${libraryName}.cql`);

  if (fs.existsSync(cqlPath)) {
    console.log(`\n📄 CQL File: ${cqlPath}`);
    console.log(`\nLibrary: ${libraryName}`);
  } else {
    console.log(`\n⚠️  CQL file not found: ${cqlPath}`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const { libraryName, testCaseId, referenceDate } = parseArgs();

    if (referenceDate) {
      console.log(`\n📅 Reference Date: ${referenceDate}`);
      console.log('⚠️  Note: Ensure test cases have been regenerated with this reference date');
    }

    // Display CQL info
    displayCQLInfo(libraryName);

    // Determine which test case directory to use
    // Check common library directory names
    const possibleDirs = [
      'MMR_Routine_Lite_2',
      'MMR_Recommendations',
      libraryName
    ];

    let testCaseDir = null;
    for (const dir of possibleDirs) {
      const testPath = path.join(TEST_CASES_DIR, dir, testCaseId);
      if (fs.existsSync(testPath)) {
        testCaseDir = dir;
        break;
      }
    }

    if (!testCaseDir) {
      console.error(`\n❌ Test case not found in any expected directory`);
      console.error(`   Looked for: ${testCaseId}`);
      console.error(`   In: ${possibleDirs.join(', ')}`);
      process.exit(1);
    }

    // Load test case resources
    console.log(`\n📦 Loading test case: ${testCaseId}`);
    const resources = loadTestCase(testCaseDir, testCaseId);
    console.log(`   Loaded ${resources.length} resources`);

    // Find patient resource
    const patient = resources.find(r => r.resourceType === 'Patient');
    if (!patient) {
      throw new Error('No Patient resource found in test case');
    }

    // Execute CQL
    console.log('\n' + '='.repeat(60));
    await executeCQL(libraryName, patient.id, resources);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    console.log('\n💡 Alternative: Use VS Code CQL Extension');
    console.log('   1. Open the .cql file in VS Code');
    console.log('   2. Right-click in the editor');
    console.log('   3. Select "Execute CQL"');
    console.log('   4. Configure test data in VS Code settings if needed');

    process.exit(1);
  }
}

// Run the script
main();
