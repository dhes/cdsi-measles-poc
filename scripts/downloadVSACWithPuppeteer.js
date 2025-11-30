// Refactored version of downloadVSACWithPuppeteer.js to support --measure-dir

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const glob = require("glob");
require("dotenv").config();

let outputDir; // will be assigned later once measureDir is known

// const outputDir = path.join("vocabulary", "valueset", "external");
// fs.mkdirSync(outputDir, { recursive: true });

function parseCQLValueSetsFromFiles(cqlDir) {
  const files = glob.sync(path.join(cqlDir, "*.cql"));
  const valuesetUrls = new Set();
  const pattern = /valueset\s+"[^"]+":\s+'([^']+)'/g;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    let match;
    while ((match = pattern.exec(content)) !== null) {
      valuesetUrls.add(match[1]);
    }
  }
  return [...valuesetUrls];
}

function extractOid(url) {
  return url.substring(url.lastIndexOf("/") + 1);
}

async function downloadValueSets(
  valueSetUrls,
  apiKey,
  overwriteExisting = false
) {
  console.log(`Starting download of ${valueSetUrls.length} ValueSets...`);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent("Mozilla/5.0");
    await page.goto("https://cts.nlm.nih.gov/fhir/", {
      waitUntil: "networkidle2",
    });

    const loginFormExists = await page.evaluate(
      () => !!document.querySelector('form[action="login"]')
    );
    if (loginFormExists) {
      console.log("Logging into VSAC using API key...");
      await page.type('input[name="password"]', apiKey);
      await Promise.all([
        page.click("#btnLogin"),
        page.waitForNavigation({ waitUntil: "networkidle2" }),
      ]);
    }

    for (const url of valueSetUrls) {
      const oid = extractOid(url);
      const outPath = path.join(outputDir, `${oid}.json`);
      if (fs.existsSync(outPath) && !overwriteExisting) {
        console.log(`Skipping existing: ${oid}`);
        continue;
      }

      const jsonUrl = `${url.replace(
        "http://",
        "https://"
      )}/$expand?_format=json`;
      console.log(`Fetching: ${jsonUrl}`);
      try {
        await page.goto(jsonUrl, { waitUntil: "networkidle2" });
        const raw = await page.evaluate(() => {
          const pre = document.querySelector("pre");
          return pre ? pre.textContent : document.body.innerText;
        });
        const json = JSON.parse(raw);
        if (json.resourceType === "ValueSet") {
          fs.writeFileSync(outPath, JSON.stringify(json, null, 2));
          console.log(`✅ Saved: ${oid}`);
        } else {
          throw new Error("Not a ValueSet");
        }
      } catch (e) {
        console.error(`❌ Failed for ${url}: ${e.message}`);
        fs.writeFileSync(
          path.join(outputDir, `${oid}_error.html`),
          await page.content()
        );
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const apiKey = process.env.VSAC_API_KEY;
  if (!apiKey) throw new Error("Missing VSAC_API_KEY in .env");

  const args = process.argv.slice(2);

  let measureDir;

  // first look for `--measure-dir=some/path`
  for (const a of args) {
    if (a.startsWith("--measure-dir=")) {
      measureDir = a.split("=")[1];
      break;
    }
  }

  // if we didn’t find it yet, look for the “two‑part” form
  if (!measureDir) {
    const idx = args.indexOf("--measure-dir");
    if (idx !== -1 && args[idx + 1]) {
      measureDir = args[idx + 1];
    }
  }

  if (!measureDir) {
    console.error("❌ No --measure-dir argument or value provided");
    process.exit(1);
  }

  // now you can safely do:
  outputDir = path.join(measureDir, "vocabulary", "valueset", "external");
  fs.mkdirSync(outputDir, { recursive: true });

  const cqlDir = path.join(measureDir, "cql");
  const overwrite = args.includes("--overwrite");

  const valueSets = parseCQLValueSetsFromFiles(cqlDir);
  if (valueSets.length === 0) {
    console.error("No ValueSets found in CQL files.");
    return;
  }

  await downloadValueSets(valueSets, apiKey, overwrite);
}

main();
