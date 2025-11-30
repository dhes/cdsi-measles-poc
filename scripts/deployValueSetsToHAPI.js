#!/usr/bin/env node

/**
 * deployValueSetsToHAPI.js
 *
 * Scans ./vocabulary/valueset/external for expanded VSAC ValueSet JSON
 * files and PUTs each one to your HAPI FHIR server (skipping ones that
 * already exist by URL).
 */

const fs     = require('fs');
const path   = require('path');
const axios  = require('axios');
require('dotenv').config();

const FHIR_SERVER_URL = process.env.FHIR_SERVER_URL;
if (!FHIR_SERVER_URL) {
  console.error("❌  Missing FHIR_SERVER_URL in .env");
  process.exit(1);
}

const args = process.argv.slice(2);
let measureDir;
const idx = args.indexOf("--measure-dir");
if (idx !== -1 && args[idx + 1]) {
  measureDir = args[idx + 1];
}

if (!measureDir) {
  console.error("❌  Missing --measure-dir argument");
  process.exit(1);
}

// point at the shared, central VSAC‐expansions folder
const valuesetDir = path.join(measureDir, 'vocabulary', 'valueset', 'external');
const logFile     = path.join(__dirname, '..', 'output', 'upload-vsac-log.txt');

// ensure output folder exists
fs.mkdirSync(path.dirname(logFile), { recursive: true });
fs.appendFileSync(logFile, `\n🚀 UPLOAD RUN @ ${new Date().toISOString()}\n`);

async function checkIfExists(url) {
  try {
    const res = await axios.get(
      `${FHIR_SERVER_URL}ValueSet?url=${encodeURIComponent(url)}`
    );
    return Array.isArray(res.data.entry) && res.data.entry.length > 0;
  } catch (err) {
    console.error(`❌ Error checking ValueSet ${url}: ${err.message}`);
    fs.appendFileSync(logFile, `❌ CHECK ERROR ${url}: ${err.message}\n`);
    return false;
  }
}

async function uploadValueSet(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let vs;
  try {
    vs = JSON.parse(raw);
  } catch (e) {
    console.warn(`⚠️  Skipping invalid JSON: ${filePath}`);
    fs.appendFileSync(logFile, `⚠️ INVALID JSON: ${filePath}\n`);
    return;
  }

  const url = vs.url;
  if (!url) {
    console.warn(`⚠️  Skipping ${path.basename(filePath)}: missing .url`);
    fs.appendFileSync(logFile, `⚠️ NO URL: ${filePath}\n`);
    return;
  }

  if (await checkIfExists(url)) {
    console.log(`🔁 Already exists: ${url}`);
    fs.appendFileSync(logFile, `🔁 SKIPPED: ${url}\n`);
    return;
  }

  try {
    await axios.post(
      `${FHIR_SERVER_URL}ValueSet`,
      vs,
      { headers: { 'Content-Type': 'application/fhir+json' } }
    );
    console.log(`✅ Uploaded: ${url}`);
    fs.appendFileSync(logFile, `✅ UPLOADED: ${url}\n`);
  } catch (err) {
    const msg = err.response?.data || err.message;
    console.error(`❌ Upload failed for ${url}:\n`, msg);
    fs.appendFileSync(logFile, `❌ UPLOAD ERROR ${url}:\n${JSON.stringify(msg)}\n`);
  }
}

async function run() {
  const files = fs.existsSync(valuesetDir)
    ? fs.readdirSync(valuesetDir).filter(f => f.endsWith('.json'))
    : [];

  console.log(`📁 Found ${files.length} ValueSet files in ${valuesetDir}`);
  for (const file of files) {
    await uploadValueSet(path.join(valuesetDir, file));
  }
  console.log(`🧾  Log written to ${logFile}`);
}

run();