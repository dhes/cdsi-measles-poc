# Measles Immunization Forecast - Test Scenarios

## Overview

These test scenarios validate the CQL implementation against expected outcomes from the CDC CDSI specification. Each scenario is based on official CDSI test cases where applicable, and includes patient data and expected evaluation/forecast results.

---

## Test Group 1: Basic Functionality

### Scenario 1: Newborn - No Doses Yet
**CDSI Reference**: Test 2013-0543

**Patient:**
- DOB: 9 months before assessment
- Assessment Date: Today
- Immunization History: None

**Expected CQL Results:**
```json
{
  "seriesStatus": "Not Complete",
  "forecastStatus": "Recommended",
  "nextDose": 1,
  "recommendedVaccine": "MMR",
  "earliestDate": "[DOB + 348 days]",  // 12 months - 4 days
  "recommendedDate": "[DOB + 365 days]",  // 12 months
  "dose1": { "satisfied": false },
  "dose2": { "satisfied": false }
}
```

**Rationale:** Patient is under minimum age for Dose 1. Forecast for Dose 1 at 12 months.

---

### Scenario 2: Toddler - Dose 1 Complete
**CDSI Reference**: Test 2013-0523

**Patient:**
- DOB: 22 months before assessment
- Assessment Date: Today
- Immunization History:
  - 10 months ago: MMR (CVX 03) - patient was 12 months old

**Expected CQL Results:**
```json
{
  "seriesStatus": "In-Process",
  "forecastStatus": "Recommended",
  "nextDose": 2,
  "recommendedVaccine": "MMR",
  "earliestDate": "[Dose 1 + 24 days]",  // 4 weeks - 4 days
  "recommendedDate": "[DOB + 4 years]",  // 4 years old
  "dose1": {
    "satisfied": true,
    "date": "[10 months ago]",
    "vaccineCode": {"code": "03", "system": "CVX"}
  },
  "dose2": { "satisfied": false }
}
```

**Rationale:** Dose 1 valid (given at 12 months). Dose 2 due at 4 years but can be given as early as Dose 1 + 4 weeks.

---

### Scenario 3: Preschooler - Series Complete
**CDSI Reference**: Test 2013-0524

**Patient:**
- DOB: 5 years before assessment
- Assessment Date: Today
- Immunization History:
  - 4 years ago: MMR (CVX 03) - at 12 months
  - 1 year ago: MMR (CVX 03) - at 4 years

**Expected CQL Results:**
```json
{
  "seriesStatus": "Complete",
  "forecastStatus": "Complete",
  "nextDose": null,
  "recommendedVaccine": null,
  "dose1": {
    "satisfied": true,
    "date": "[4 years ago]"
  },
  "dose2": {
    "satisfied": true,
    "date": "[1 year ago]"
  }
}
```

**Rationale:** Both doses complete. No further doses needed.

---

### Scenario 4: Adult - Born Before 1957
**CDSI Reference**: Test 2015-0024

**Patient:**
- DOB: 1955-06-20
- Assessment Date: Today
- Immunization History: None
- Observations: No healthcare personnel indicator

**Expected CQL Results:**
```json
{
  "seriesStatus": "Immune",
  "forecastStatus": "Immune",
  "forecastReason": "Born before 1957",
  "nextDose": null,
  "hasEvidenceOfImmunity": true,
  "bornBefore1957": true,
  "isHealthcarePersonnel": false
}
```

**Rationale:** Per CDSI immunity rules, persons born before 1/1/1957 are considered immune (unless healthcare personnel).

---

### Scenario 5: Adult - Conditional Skip
**CDSI Reference**: Test 2019-0018

**Patient:**
- DOB: 24 years before assessment
- Assessment Date: Today
- Immunization History:
  - 23 years ago: MMR (CVX 03) - at 12 months

**Expected CQL Results:**
```json
{
  "seriesStatus": "Complete",
  "forecastStatus": "Complete",
  "nextDose": null,
  "dose1": { "satisfied": true },
  "dose2": {
    "canBeSkipped": true,
    "satisfied": false
  }
}
```

**Rationale:** Per CDSI conditional skip, Dose 2 not required for persons >= 19 years with one valid dose.

---

## Test Group 2: Grace Period Validation

### Scenario 6: Dose 1 Below Grace Period (FAIL)
**CDSI Reference**: Test 2013-0540

**Patient:**
- DOB: 12 months ago
- Assessment Date: Today
- Immunization History:
  - 5 days ago: MMR (CVX 03) - at 11 months, 25 days (360 days old)

**Expected CQL Results:**
```json
{
  "seriesStatus": "Not Complete",
  "forecastStatus": "Recommended",
  "dose1": {
    "satisfied": false  // 360 days < 348 days absMinAge
  },
  "nextDose": 1
}
```

**Rationale:** Dose given at 360 days is before the grace period cutoff (348 days = 12 months - 4 days). Not valid.

---

### Scenario 7: Dose 1 With Grace Period (PASS)
**CDSI Reference**: Test 2013-0541

**Patient:**
- DOB: 12 months ago
- Assessment Date: Today
- Immunization History:
  - 4 days ago: MMR (CVX 03) - at 11 months, 26 days (361 days old)

**Expected CQL Results:**
```json
{
  "seriesStatus": "In-Process",
  "forecastStatus": "Recommended",
  "dose1": {
    "satisfied": true  // 361 days >= 348 days absMinAge
  },
  "nextDose": 2
}
```

**Rationale:** Dose given at 361 days (4 days before 12 months) is within grace period. Valid.

---

### Scenario 8: Dose 2 Below Grace Period (FAIL)
**CDSI Reference**: Test 2013-0570

**Patient:**
- DOB: 14 months ago
- Assessment Date: Today
- Immunization History:
  - 2 months ago: MMR (CVX 03) - at 12 months
  - 5 days ago: MMR (CVX 03) - at 13 months, 25 days (391 days old)

**Expected CQL Results:**
```json
{
  "dose1": { "satisfied": true },
  "dose2": {
    "satisfied": false  // 391 days < 395 days absMinAge for Dose 2
  },
  "nextDose": 2
}
```

**Rationale:** Dose 2 given at 391 days is before the grace period cutoff (391 days = 13 months - 4 days is the minimum).

---

### Scenario 9: Dose 2 With Grace Period (PASS)
**CDSI Reference**: Test 2013-0571

**Patient:**
- DOB: 14 months ago
- Assessment Date: Today
- Immunization History:
  - 2 months ago: MMR (CVX 03) - at 12 months
  - Today: MMR (CVX 03) - at 13 months, 26 days (391 days old)

**Expected CQL Results:**
```json
{
  "seriesStatus": "Complete",
  "dose1": { "satisfied": true },
  "dose2": {
    "satisfied": true  // 391 days >= 391 days absMinAge
  }
}
```

**Rationale:** Dose 2 given at 391 days (13 months - 4 days) is within grace period. Valid and series complete.

---

### Scenario 10: Dose 2 Minimum Interval (PASS)
**CDSI Reference**: Test 2013-0544

**Patient:**
- DOB: 25 months ago
- Assessment Date: Today
- Immunization History:
  - 13 months ago: MMR (CVX 03) - at 12 months
  - 1 month ago: MMR (CVX 03) - 28 days after Dose 1

**Expected CQL Results:**
```json
{
  "seriesStatus": "Complete",
  "dose1": { "satisfied": true },
  "dose2": {
    "satisfied": true  // 28 days >= 28 days minInterval
  }
}
```

**Rationale:** Dose 2 given exactly 28 days after Dose 1 meets minimum interval. Valid and series complete.

---

## Test Group 3: Live Virus Conflicts

### Scenario 11: MMR + Varicella Same Day (PASS)
**CDSI Reference**: Test 2013-0545

**Patient:**
- DOB: 13 months ago
- Assessment Date: Today
- Immunization History:
  - 1 month ago: MMR (CVX 03) - at 12 months
  - 1 month ago: Varicella (CVX 21) - same day as MMR

**Expected CQL Results:**
```json
{
  "seriesStatus": "In-Process",
  "forecastStatus": "Recommended",
  "hasLiveVirusConflict": false,  // Same day is allowed
  "dose1": { "satisfied": true }
}
```

**Rationale:** Live virus vaccines can be given on the same day without conflict.

---

### Scenario 12: Varicella → MMR 27 Days (FAIL)
**CDSI Reference**: Test 2013-0547

**Patient:**
- DOB: 13 months ago
- Assessment Date: Today
- Immunization History:
  - 28 days ago: Varicella (CVX 21) - at 12 months
  - 1 day ago: MMR (CVX 03) - 27 days after Varicella

**Expected CQL Results:**
```json
{
  "seriesStatus": "Not Complete",
  "forecastStatus": "Conditional",
  "forecastReason": "Recent live virus vaccine - wait 28 days",
  "hasLiveVirusConflict": true,
  "dose1": {
    "satisfied": false  // Live virus conflict
  }
}
```

**Rationale:** MMR given 27 days after Varicella violates the 28-day spacing rule for live virus vaccines. Not valid.

---

### Scenario 13: Varicella → MMR 28 Days (PASS)
**CDSI Reference**: Test 2013-0548

**Patient:**
- DOB: 13 months ago
- Assessment Date: Today
- Immunization History:
  - 29 days ago: Varicella (CVX 21) - at 12 months
  - 1 day ago: MMR (CVX 03) - 28 days after Varicella

**Expected CQL Results:**
```json
{
  "seriesStatus": "In-Process",
  "forecastStatus": "Recommended",
  "hasLiveVirusConflict": false,
  "dose1": {
    "satisfied": true  // 28 days meets minimum spacing
  }
}
```

**Rationale:** MMR given exactly 28 days after Varicella meets minimum spacing for live virus vaccines. Valid.

---

## Test Group 4: Special Cases

### Scenario 14: Healthcare Worker - Born Before 1957
**CDSI Reference**: Custom (based on CDSI immunity exclusion logic)

**Patient:**
- DOB: 1955-06-20
- Assessment Date: Today
- Immunization History: None
- Observations:
  - Healthcare Personnel: true (SNOMED 223366009)

**Expected CQL Results:**
```json
{
  "seriesStatus": "Not Complete",
  "forecastStatus": "Recommended",
  "hasEvidenceOfImmunity": false,  // Exclusion applies
  "bornBefore1957": true,
  "isHealthcarePersonnel": true,  // Exclusion!
  "nextDose": 1
}
```

**Rationale:** Healthcare personnel exclusion applies - even though born before 1957, they need vaccination.

---

### Scenario 15: MMRV Combination Vaccine
**CDSI Reference**: Test 2013-0550

**Patient:**
- DOB: 4 years ago
- Assessment Date: Today
- Immunization History:
  - 3 years ago: MMR (CVX 03) - at 12 months
  - 6 months ago: MMRV (CVX 94) - at 3.5 years

**Expected CQL Results:**
```json
{
  "seriesStatus": "Complete",
  "dose1": {
    "satisfied": true,
    "vaccineCode": {"code": "03"}
  },
  "dose2": {
    "satisfied": true,
    "vaccineCode": {"code": "94"}  // MMRV contains Measles
  }
}
```

**Rationale:** MMRV contains Measles antigen per CVX mapping, satisfies Dose 2 requirement.

---

### Scenario 16: Pregnant Patient (Contraindication)
**CDSI Reference**: Based on CDSI contraindication logic

**Patient:**
- DOB: 29 years ago
- Assessment Date: Today
- Immunization History:
  - 28 years ago: MMR (CVX 03) - at 12 months
- Conditions:
  - Pregnancy (SNOMED 77386006) - active

**Expected CQL Results:**
```json
{
  "seriesStatus": "Contraindicated",
  "forecastStatus": "Contraindicated",
  "forecastReason": "Pregnancy",
  "measlesContraindicated": true,
  "contraindicationReason": "Pregnancy",
  "nextDose": null
}
```

**Rationale:** Pregnancy is a contraindication for MMR (live virus vaccine).

---

### Scenario 17: Laboratory Evidence of Immunity
**CDSI Reference**: Based on CDSI immunity logic

**Patient:**
- DOB: 34 years ago
- Assessment Date: Today
- Immunization History: None
- Observations:
  - Measles Immune (SNOMED 371111005) - value: true, status: final

**Expected CQL Results:**
```json
{
  "seriesStatus": "Immune",
  "forecastStatus": "Immune",
  "forecastReason": "Laboratory evidence of immunity",
  "hasEvidenceOfImmunity": true,
  "hasLaboratoryEvidenceOfImmunity": true
}
```

**Rationale:** Laboratory confirmation of immunity documented, no vaccination needed.

---

### Scenario 18: Adolescent Grace Period
**CDSI Reference**: Test 2019-0022

**Patient:**
- DOB: 14 years ago
- Assessment Date: Today
- Immunization History:
  - 2 years ago: MMR (CVX 03) - at 12 years
  - 4 weeks minus 4 days ago: MMR (CVX 03) - 24 days after Dose 1

**Expected CQL Results:**
```json
{
  "seriesStatus": "Complete",
  "dose1": { "satisfied": true },
  "dose2": {
    "satisfied": true  // 24 days >= 24 days absMinInterval
  }
}
```

**Rationale:** Dose 2 given at 24 days (4 weeks - 4 days) is within grace period for interval. Valid.

---

## Running Tests

### Manual Testing

For each scenario:

1. **Create FHIR Resources**
   ```json
   {
     "Patient": { "birthDate": "..." },
     "Immunization": [ {...} ],
     "Condition": [ {...} ],
     "Observation": [ {...} ]
   }
   ```

2. **Execute CQL**
   ```javascript
   const result = cqlEngine.execute({
     library: 'MeaslesImmunizationForecast',
     expression: 'Recommendation',
     parameters: { AsOfDate: 'YYYY-MM-DD' },
     data: fhirBundle
   });
   ```

3. **Compare Results**
   - Check each field in expected vs actual results
   - Document any discrepancies

### Automated Testing

Using the manifest system at `/Users/danheslinga/CDSS_Rules_Repository/MMR/`:

1. **Convert scenarios to YAML manifests**
   ```yaml
   # manifests/cdsi/cdsi-2013-0523-dose1-at-15mo.yaml
   testCaseId: cdsi-2013-0523
   patient:
     birthDate: { relative: "22 months before reference" }
   immunizations:
     - occurrenceDateTime: { relative: "10 months before reference" }
       vaccineCode: { coding: [{ system: "CVX", code: "03" }] }
   ```

2. **Generate FHIR resources**
   ```bash
   node scripts/generate-test-cases.js
   ```

3. **Run CQL tests**
   ```bash
   # Using your preferred CQL execution engine
   cql-runner --library MeaslesImmunizationForecast \
              --data input/tests/MMR_Standard/cdsi-2013-0523/
   ```

---

## Coverage Summary

These 18 scenarios cover:

| Category | Scenarios | CDSI Tests |
|----------|-----------|------------|
| Basic functionality | 1-5 | 2013-0543, 2013-0523, 2013-0524, 2015-0024, 2019-0018 |
| Grace periods | 6-10 | 2013-0540, 2013-0541, 2013-0570, 2013-0571, 2013-0544 |
| Live virus conflicts | 11-13 | 2013-0545, 2013-0547, 2013-0548 |
| Special cases | 14-18 | 2013-0550, 2019-0022, custom |

**Total CDSI Coverage**: 13 official test cases + 5 custom scenarios

---

## Expected Pass Rate

- ✅ **Basic Functionality** (Scenarios 1-5): 100% expected pass
- ✅ **Grace Periods** (Scenarios 6-10): 100% expected pass
- ✅ **Live Virus Conflicts** (Scenarios 11-13): 100% expected pass
- ✅ **Special Cases** (Scenarios 14-18): 100% expected pass

**Overall**: 18/18 expected pass (100%) for POC scope
