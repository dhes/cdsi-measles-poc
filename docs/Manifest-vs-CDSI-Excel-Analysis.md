# Manifest vs. CDSI Excel Files: Architecture Decision

## Your Current Infrastructure

### Strengths ✅

**1. Date Freshness (Critical Advantage)**
```yaml
birthDate:
  relative: "4 years before reference"
occurrenceDateTime:
  relative: "27 months before reference"
```
- Tests **never go stale**
- Can run same tests at any reference date
- Eliminates the #1 problem with static test files

**2. Readability & Maintainability**
```yaml
testCaseId: 4-year-old-no-mmr
description: "No prior MMR doses, age 4 years (48 months)"
clinicalScenario:
  priorMMRDoses: 0
expectedResults:
  All Doses Due Now: null
  Any Dose Due Now: False
```
- Self-documenting
- Clear clinical intent
- Easy to modify
- Reviewable in pull requests

**3. Version Control**
- Text-based format → full git history
- Can diff changes
- Code review workflow
- Branching/merging works naturally

**4. Automation**
- Single command regenerates all tests
- Can parameterize reference date
- Scriptable CI/CD integration
- Consistent output structure

**5. Metadata & Documentation**
```yaml
metadata:
  created: "2025-11-27"
  purpose: "Test lower boundary of routine Dose 2 age range"
  notes: "This is a boundary test"
  cdcGuidance: "Routine MMR dose 1 at 12-15 months"
```
- Inline rationale
- Links to CDC guidance
- Test creation date
- Clinical context preserved

### Weaknesses ⚠️

**1. Conversion Effort**
- Manual conversion of 50+ CDSI tests
- Time-consuming
- Potential for transcription errors

**2. Divergence from Authority**
- CDSI Excel is CDC's official format
- Your manifests become a derivative work
- Need to track which CDSI version you're based on

**3. Maintenance Burden**
- When CDSI updates (annually), need to sync manifests
- Risk of manifests drifting from official specs

## CDSI Excel Files

### Strengths ✅

**1. Authoritative Source**
- Published by CDC
- Used industry-wide
- Official validation suite
- Vetted by immunization experts

**2. Comprehensive Coverage**
- 50+ MMR test cases
- Edge cases you might not think of
- All vaccine groups covered
- Includes rationale for each case

**3. Standard Format**
- Other implementers use same tests
- Can compare results across systems
- Industry benchmarking possible

### Weaknesses ⚠️

**1. Date Staleness**
```
DOB: 2011-10-01
Date_Administered_1: 2012-01-15
```
- Fixed dates go stale
- Excel files from 2013 have dates in the past
- Tests become less realistic over time

**2. Binary Format**
- Not version control friendly
- Can't diff changes
- Requires Excel to view/edit
- Not easily scriptable

**3. Readability**
- Columnar layout is dense
- Hard to see clinical intent
- Comments limited
- Multiple sheets to navigate

## Recommended Hybrid Approach

### **Option A: Dual System (RECOMMENDED)**

**Use Manifests For:**
1. **Active Development Tests** - The ~15-20 tests you run frequently
2. **POC-Specific Tests** - Custom scenarios for your implementation
3. **Regression Tests** - Critical path validation
4. **CI/CD Integration** - Automated testing with fresh dates

**Use CDSI Excel For:**
1. **Reference Documentation** - Authoritative source of truth
2. **Comprehensive Validation** - Full test suite before release
3. **Benchmarking** - Compare to other implementations
4. **Traceability** - Link manifests to official test IDs

### **Structure**

```
/Users/danheslinga/CDSS_Rules_Repository/MMR/
├── assets/
│   ├── cdsi-healthy-childhood-and-adult-test-cases-v4.45.xlsx  # Official
│   └── CDSi-underlying-conditions-test-cases-v4.6.xlsx         # Official
├── manifests/
│   ├── cdsi/                     # NEW: CDSI-derived manifests
│   │   ├── cdsi-2013-0523-dose1-at-15mo.yaml
│   │   ├── cdsi-2013-0524-dose2-at-4y.yaml
│   │   ├── cdsi-2013-0540-dose1-below-grace.yaml
│   │   ├── cdsi-2013-0541-dose1-with-grace.yaml
│   │   ├── cdsi-2015-0024-born-before-1957.yaml
│   │   └── ...                   # Priority 15-20 tests
│   └── custom/                   # Your custom tests
│       ├── 4-year-old-no-mmr.yaml
│       ├── mmr-rule1-positive.yaml
│       └── ...
└── scripts/
    ├── generate-test-cases.js    # Existing
    └── convert-cdsi-to-manifest.js  # NEW: Excel → Manifest converter
```

### **Manifest Naming Convention**

Use CDSI test ID in filename for traceability:
```
cdsi-2013-0523-dose1-at-15mo.yaml
└─┬─┘ └──┬───┘ └─────┬────────┘
  │      │           └─ Descriptive name
  │      └─ Official CDSI Test ID
  └─ Prefix indicating source
```

### **Manifest Header**

Add CDSI traceability to manifests:
```yaml
# CDSI Test Case Conversion
cdsiSource:
  testId: 2013-0523
  fileName: "cdsi-healthy-childhood-and-adult-test-cases-v4.45.xlsx"
  version: "v4.45"
  convertedDate: "2024-11-29"

testCaseId: cdsi-2013-0523
description: "#1 at 15 months (CDSI Test 2013-0523)"

# Expected results from CDSI
expectedResults:
  Dose1_EvaluationStatus: Valid
  Dose2_EvaluationStatus: null
  Series_Status: In-Process
  Forecast_Status: Recommended
  Forecast_Dose_Number: 2
  Forecast_Earliest: "13 months"
  Forecast_Recommended: "4 years"

# Patient demographics
patient:
  id: cdsi-2013-0523
  birthDate:
    relative: "15 months before reference"
```

## Priority Conversion List

### **Tier 1: Must Convert** (Core Functionality)
1. `cdsi-2013-0543` - Newborn forecast
2. `cdsi-2013-0542` - Dose 1 at 12 months
3. `cdsi-2013-0524` - Dose 2 at 4 years (complete)
4. `cdsi-2019-0018` - Adult one dose (conditional skip)
5. `cdsi-2015-0024` - Born before 1957 (immunity)

**Effort**: ~2 hours

### **Tier 2: Should Convert** (Grace Periods)
6. `cdsi-2013-0540` - Dose 1 at 12m - 5d (FAIL)
7. `cdsi-2013-0541` - Dose 1 at 12m - 4d (PASS)
8. `cdsi-2013-0570` - Dose 2 at 13m - 5d (FAIL)
9. `cdsi-2013-0571` - Dose 2 at 13m - 4d (PASS)
10. `cdsi-2013-0544` - Dose 2 at 28 days (PASS)

**Effort**: ~2 hours

### **Tier 3: Nice to Have** (Live Virus)
11. `cdsi-2013-0545` - MMR + VZ same day (PASS)
12. `cdsi-2013-0547` - VZ → MMR 27 days (FAIL)
13. `cdsi-2013-0548` - VZ → MMR 28 days (PASS)

**Effort**: ~1.5 hours

### **Tier 4: Future** (Complex Scenarios)
14. `cdsi-2013-0550` - MMRV with grace
15. `cdsi-2019-0022` - Adolescent grace period

**Effort**: ~1 hour

**Total Conversion Effort**: ~6.5 hours for 15 tests

## Conversion Strategy

### **Semi-Automated Approach**

Create a conversion helper script:

```javascript
// scripts/convert-cdsi-to-manifest.js

/**
 * Reads CDSI Excel, prompts for test IDs to convert,
 * generates manifest templates with:
 * - Pre-filled patient demographics
 * - Pre-filled immunizations
 * - Expected results commented out for manual verification
 */

// Usage:
// node scripts/convert-cdsi-to-manifest.js \
//   --excel assets/cdsi-healthy-childhood-and-adult-test-cases-v4.45.xlsx \
//   --test-ids 2013-0523,2013-0524,2013-0540
```

### **Manual Review Process**

1. **Generate template** from Excel
2. **Convert absolute dates** to relative specs
3. **Verify expected results** match CDSI
4. **Add metadata** (purpose, notes, CDC guidance)
5. **Test generation** with script
6. **Validate FHIR output** matches expectations

### **Quality Checks**

```yaml
# Every CDSI-derived manifest must have:
cdsiSource:
  testId: REQUIRED
  fileName: REQUIRED
  version: REQUIRED
  convertedDate: REQUIRED
  verifiedBy: RECOMMENDED  # Your name
  verifiedDate: RECOMMENDED
```

## Decision Matrix

| Criterion | Manifests | CDSI Excel | Hybrid |
|-----------|-----------|------------|--------|
| Date freshness | ✅ Always current | ❌ Goes stale | ✅ Best of both |
| Readability | ✅ Excellent | ⚠️ Moderate | ✅ Excellent |
| Authority | ⚠️ Derivative | ✅ Official | ✅ Traceable |
| Maintenance | ⚠️ Manual sync | ✅ CDC updates | ⚠️ Partial sync |
| Version control | ✅ Full git | ❌ Binary | ✅ Full git |
| Automation | ✅ Scriptable | ⚠️ Requires parsing | ✅ Scriptable |
| Coverage | ⚠️ Subset | ✅ Comprehensive | ✅ Both available |
| Benchmarking | ❌ Not standard | ✅ Industry standard | ✅ Can compare |

## Recommendation

### **DO Convert to Manifests:**

1. ✅ **Priority 15-20 CDSI tests** → Your active development test suite
2. ✅ **Custom POC tests** → Scenarios specific to your implementation
3. ✅ **Regression tests** → Critical path validation

### **DON'T Convert to Manifests:**

1. ❌ **All 1000+ CDSI tests** → Too much effort, low ROI
2. ❌ **Non-MMR tests** → Out of scope
3. ❌ **Deprecated tests** → Listed in "Deleted Test Cases" sheet

### **Keep CDSI Excel For:**

1. ✅ **Reference documentation** → Link to official test IDs
2. ✅ **Comprehensive validation** → Before production release
3. ✅ **Benchmarking** → Compare to other systems
4. ✅ **Audit trail** → Prove compliance with CDC specs

## Implementation Plan

### **Phase 1: Infrastructure** (1 day)
- [ ] Create `manifests/cdsi/` directory
- [ ] Create `manifests/custom/` directory
- [ ] Add CDSI traceability fields to manifest schema
- [ ] Update `generate-test-cases.js` to handle both directories

### **Phase 2: Core Conversions** (1 day)
- [ ] Convert Tier 1 tests (5 tests)
- [ ] Convert Tier 2 tests (5 tests)
- [ ] Validate generated FHIR matches CDSI expectations

### **Phase 3: Extended Conversions** (0.5 day)
- [ ] Convert Tier 3 tests (3 tests)
- [ ] Convert Tier 4 tests (2 tests)

### **Phase 4: Automation** (optional, 1 day)
- [ ] Create `convert-cdsi-to-manifest.js` helper
- [ ] Add Excel parsing library
- [ ] Generate manifest templates from Excel

## Conclusion

**YES, convert CDSI tests to manifests** - but strategically:

✅ **Convert 15-20 priority tests** that cover your POC scope
✅ **Use manifests for active development** (fresh dates, CI/CD)
✅ **Keep Excel as reference** (authority, benchmarking)
✅ **Add traceability metadata** (link manifests to CDSI IDs)
✅ **Document the mapping** (which manifests = which CDSI tests)

**Don't try to convert everything** - that's wasted effort. The hybrid approach gives you:
- The **automation benefits** of manifests
- The **authority** of CDSI
- The **flexibility** to add custom tests
- The **traceability** for validation

Your manifest infrastructure is excellent - leverage it for your working test suite while keeping CDSI Excel as your source of truth.

---

**Estimated Effort**: ~8 hours total (infrastructure + 15 conversions)
**Value**: High - fresh tests, automated validation, industry-standard coverage
**Risk**: Low - Excel remains as authoritative reference
