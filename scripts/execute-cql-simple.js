#!/usr/bin/env node

/**
 * Execute CQL locally using cql-execution library
 * No FHIR server needed - executes CQL against local test data
 *
 * First install dependencies:
 *   npm install cql-execution cql-exec-fhir cql-exec-vsac
 *
 * Usage:
 *   node scripts/execute-cql-simple.js <elm-json-file> <test-case-dir>
 *
 * Examples:
 *   node scripts/execute-cql-simple.js input/cql/MMR_Routine_Lite_2.json input/tests/MMR_Routine_Lite_2/mmr-rule1-negative
 *
 * Note: Requires ELM JSON file. Generate from CQL using VS Code CQL extension or cql-to-elm tool.
 */

const fs = require('fs');
const path = require('path');

// These will be loaded if available
let cql, cqlFhir;

try {
  cql = require('cql-execution');
  cqlFhir = require('cql-exec-fhir');
} catch (e) {
  console.error('\n❌ Required packages not installed');
  console.error('\nPlease run:');
  console.error('  npm install cql-execution cql-exec-fhir cql-exec-vsac');
  process.exit(1);
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node execute-cql-simple.js <elm-json-file> <test-case-dir>');
    console.error('\nExamples:');
    console.error('  node scripts/execute-cql-simple.js input/cql/MMR_Routine_Lite_2.json input/tests/MMR_Routine_Lite_2/mmr-rule1-negative');
    console.error('\nNote: Requires ELM JSON file (compiled from CQL)');
    process.exit(1);
  }

  return {
    elmFile: args[0],
    testCaseDir: args[1]
  };
}

/**
 * Load test case FHIR resources
 */
function loadTestCaseResources(testCaseDir) {
  const resources = [];
  const resourceTypes = ['Patient', 'Immunization', 'Condition', 'Observation'];

  for (const resourceType of resourceTypes) {
    const resourceDir = path.join(testCaseDir, resourceType);

    if (fs.existsSync(resourceDir)) {
      const files = fs.readdirSync(resourceDir).filter(f => f.endsWith('.json'));

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
 * Execute CQL using cql-execution
 */
function executeCQL(elmJson, patientBundle) {
  // Create ELM library
  const library = new cql.Library(elmJson);

  // Create code service (for value sets)
  const codeService = new cql.CodeService({});

  // Create patient source from FHIR bundle
  const patientSource = cqlFhir.PatientSource.FHIRv400();
  patientSource.loadBundles([patientBundle]);

  // Create executor
  const executor = new cql.Executor(library, codeService);

  // Execute and get results
  const results = executor.exec(patientSource);

  return results;
}

/**
 * Format results for display
 */
function formatResults(results) {
  const patientResults = results.patientResults;

  for (const [patientId, result] of Object.entries(patientResults)) {
    console.log(`\n📊 Results for Patient: ${patientId}`);
    console.log('='.repeat(60));

    // Sort by expression name for consistent output
    const sortedKeys = Object.keys(result).sort();

    for (const key of sortedKeys) {
      const value = result[key];
      console.log(`${key}=${formatValue(value)}`);
    }

    console.log('='.repeat(60));
  }
}

/**
 * Format a value for display
 */
function formatValue(value) {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value.toString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }

  if (value.constructor && value.constructor.name) {
    // CQL types like Interval, Quantity, etc.
    return value.toString();
  }

  return JSON.stringify(value, null, 2);
}

/**
 * Main execution
 */
async function main() {
  try {
    const { elmFile, testCaseDir } = parseArgs();

    console.log('\n=== CQL Execution ===\n');

    // Load ELM JSON
    if (!fs.existsSync(elmFile)) {
      throw new Error(`ELM file not found: ${elmFile}\n\nGenerate ELM JSON using VS Code CQL extension or cql-to-elm tool`);
    }

    const elmJson = JSON.parse(fs.readFileSync(elmFile, 'utf8'));
    const libraryName = elmJson.library?.identifier?.id || 'Unknown';
    console.log(`✓ Loaded ELM library: ${libraryName}`);

    // Load test case
    if (!fs.existsSync(testCaseDir)) {
      throw new Error(`Test case directory not found: ${testCaseDir}`);
    }

    const resources = loadTestCaseResources(testCaseDir);
    console.log(`✓ Loaded ${resources.length} test resources`);

    // Find patient
    const patient = resources.find(r => r.resourceType === 'Patient');
    if (!patient) {
      throw new Error('No Patient resource found in test case');
    }

    // Create FHIR bundle
    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      id: patient.id,
      entry: resources.map(r => ({ resource: r }))
    };

    console.log(`✓ Patient: ${patient.id}\n`);

    // Execute CQL
    console.log('🔄 Executing CQL...\n');
    const results = executeCQL(elmJson, bundle);

    // Display results
    formatResults(results);

    console.log('\n✅ Execution complete\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
