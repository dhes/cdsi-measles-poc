#!/usr/bin/env node

/**
 * Execute CQL locally using the Java CQL Language Server
 * (Same engine that VS Code uses)
 *
 * Usage:
 *   node scripts/execute-cql-local.js <cql-file> <test-case-dir>
 *
 * Examples:
 *   node scripts/execute-cql-local.js input/cql/MMR_Routine_Lite_2.cql input/tests/MMR_Routine_Lite_2/mmr-rule1-negative
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Find CQL Language Server JAR
const CQL_JAR = path.join(
  os.homedir(),
  '.vscode/extensions/cqframework.cql-0.7.8/dist/jars/cql-ls-service-3.8.0.jar'
);

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node execute-cql-local.js <cql-file> <test-case-dir>');
    console.error('\nExamples:');
    console.error('  node scripts/execute-cql-local.js input/cql/MMR_Routine_Lite_2.cql input/tests/MMR_Routine_Lite_2/mmr-rule1-negative');
    process.exit(1);
  }

  return {
    cqlFile: args[0],
    testCaseDir: args[1]
  };
}

/**
 * Check if Java is installed
 */
function checkJava() {
  return new Promise((resolve, reject) => {
    exec('java -version', (error, stdout, stderr) => {
      if (error) {
        reject(new Error('Java not found. Please install Java to execute CQL.'));
      } else {
        // Java outputs version to stderr
        const version = stderr.split('\n')[0];
        console.log(`✓ ${version}`);
        resolve();
      }
    });
  });
}

/**
 * Load test case FHIR resources as a Bundle
 */
function loadTestCaseBundle(testCaseDir) {
  const resources = [];

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

  // Create a FHIR Bundle
  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    entry: resources.map(resource => ({
      resource: resource
    }))
  };

  return bundle;
}

/**
 * Main execution
 */
async function main() {
  try {
    const { cqlFile, testCaseDir } = parseArgs();

    console.log('\n=== CQL Local Execution ===\n');

    // Check Java
    console.log('Checking Java...');
    await checkJava();

    // Check CQL JAR exists
    if (!fs.existsSync(CQL_JAR)) {
      throw new Error(`CQL Language Server JAR not found at: ${CQL_JAR}`);
    }
    console.log(`✓ CQL Language Server found`);

    // Check CQL file exists
    if (!fs.existsSync(cqlFile)) {
      throw new Error(`CQL file not found: ${cqlFile}`);
    }
    console.log(`✓ CQL file: ${cqlFile}`);

    // Load test case
    if (!fs.existsSync(testCaseDir)) {
      throw new Error(`Test case directory not found: ${testCaseDir}`);
    }

    const bundle = loadTestCaseBundle(testCaseDir);
    console.log(`✓ Loaded ${bundle.entry.length} test resources`);

    // Find patient
    const patient = bundle.entry.find(e => e.resource.resourceType === 'Patient');
    if (!patient) {
      throw new Error('No Patient resource found in test case');
    }
    console.log(`✓ Patient: ${patient.resource.id}`);

    console.log('\n⚠️  Note: Direct JAR execution requires specific command-line API');
    console.log('The CQL Language Server is designed for LSP protocol, not CLI execution.\n');

    console.log('💡 Recommended approach:');
    console.log('   Use VS Code "Execute CQL" right-click command for now');
    console.log('   Or use the cql-execution npm package directly');

    console.log('\n📝 Alternative: Install cql-execution package:');
    console.log('   npm install cql-execution cql-exec-fhir fhir');
    console.log('   Then create a script using those libraries');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
