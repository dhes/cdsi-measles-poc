/*
 * Library: MeaslesImmunizationForecast
 * Version: 1.0.0
 * Description: Evaluation and forecasting logic for Measles immunization based on
 *              CDC CDSI Logic Specification v4.6 for Standard 2-dose series.
 *
 * Implements:
 * - Immunization history organization (Chapter 4.2)
 * - Dose evaluation (Chapter 6)
 * - Contraindication checking (Chapter 7.3)
 * - Evidence of immunity (Chapter 7.2)
 * - Forecasting (Chapter 7.5)
 * - Live virus conflict checking (ScheduleSupportingData.xml)
 *
 * Based on: AntigenSupportingData- Measles-508.xml (Standard 2-dose series)
 */

library MeaslesImmunizationForecast version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'
include MeaslesScheduleData version '1.0.0' called Schedule

// ============================================================================
// PARAMETERS
// ============================================================================

parameter AsOfDate DateTime default Now()

// ============================================================================
// CONTEXT
// ============================================================================

context Patient

// ============================================================================
// PATIENT DEMOGRAPHICS
// ============================================================================

define "Patient Birth Date":
  Patient.birthDate.value

define "Patient Age In Days":
  days between "Patient Birth Date" and date from AsOfDate

define "Patient Age In Months":
  months between "Patient Birth Date" and date from AsOfDate

define "Patient Age In Years":
  years between "Patient Birth Date" and date from AsOfDate

// ============================================================================
// IMMUNIZATION HISTORY - Organize by Antigen (CDSI Chapter 4.2)
// ============================================================================

/*
 * All immunizations containing Measles antigen, regardless of vaccine type.
 * This includes: MMR (CVX 03), Measles-Rubella (04), Measles (05), MMRV (94)
 * Per CDSI 4.2: "Break apart vaccine doses into their antigen parts"
 */
define "All Measles Immunizations":
  [Immunization] I
  where I.status.value = 'completed'
    and (
      I.vaccineCode ~ Schedule."MMR"
      or I.vaccineCode ~ Schedule."Measles-Rubella"
      or I.vaccineCode ~ Schedule."Measles"
      or I.vaccineCode ~ Schedule."MMRV"
    )
  sort by (occurrence as dateTime).value

/*
 * Patient's Measles immunization history with calculated attributes
 */
define "Measles Immunization History":
  "All Measles Immunizations" I
  return {
    date: I.occurrence as dateTime,
    vaccineCode: I.vaccineCode,
    ageAtAdministration: days between "Patient Birth Date" and (I.occurrence as dateTime),
    lotExpirationDate: I.lotNumber  // Would need extension for actual lot expiration
  }

// ============================================================================
// CONTRAINDICATIONS (CDSI Chapter 7.3)
// ============================================================================

/*
 * From AntigenSupportingData: observationCode 007 - Pregnancy
 */
define "Is Pregnant":
  exists(
    [Condition: Schedule."Pregnancy"] C
    where C.clinicalStatus ~ Schedule."Active"
  )

/*
 * From AntigenSupportingData: observationCode 154 - HIV/AIDS severely immunocompromised
 * Simplified version - full version would check CD4 count, viral load, etc.
 * TODO: Replace with actual valueset or specific SNOMED codes
 */
define "Has Severe Immunocompromise":
  exists(
    [Condition: Schedule."Severe Immunocompromise"] C
    where C.clinicalStatus ~ Schedule."Active"
  )

/*
 * From AntigenSupportingData: observationCodes 126-141 - Blood product administration
 * Example for whole blood transfusion within 6 months
 * TODO: Create ValueSet resource or use specific procedure codes
 */
define "Recent Blood Product Administration":
  false  // Placeholder - replace with actual valueset or specific codes

/*
 * Aggregate contraindication check
 * Per CDSI 7.3: "Is the Relevant Patient Series a Contraindicated Patient Series?"
 */
define "Measles Contraindicated":
  "Is Pregnant"
  or "Has Severe Immunocompromise"
  or "Recent Blood Product Administration"

define "Contraindication Reason":
  if "Is Pregnant" then 'Pregnancy'
  else if "Has Severe Immunocompromise" then 'Severe immunocompromise'
  else if "Recent Blood Product Administration" then 'Recent blood product administration'
  else null

// ============================================================================
// EVIDENCE OF IMMUNITY (CDSI Chapter 7.2)
// ============================================================================

/*
 * From AntigenSupportingData: clinicalHistory guidelineCode 020
 * Laboratory Evidence of Immunity for Measles
 */
define "Has Laboratory Evidence Of Immunity":
  exists(
    [Observation: Schedule."Measles Immune"] O
    where O.status in {'final', 'amended', 'corrected'}
      and O.value is true
  )

/*
 * From AntigenSupportingData: dateOfBirth immunityBirthDate 01/01/1957
 * with exclusion for healthcare personnel (observationCode 055)
 */
define "Born Before 1957":
  "Patient Birth Date" < Schedule."Immunity_BirthDate"

define "Is Healthcare Personnel":
  exists(
    [Observation: Schedule."Healthcare Personnel"] O
    where O.status in {'final', 'amended', 'corrected'}
  )

/*
 * Per CDSI 7.2 Table 7-3: Does the Patient have Evidence of Immunity?
 * Rules:
 * - If clinical history contains immunity guideline: Yes
 * - If born before 1957 AND not healthcare personnel: Yes
 * - Otherwise: No
 */
define "Has Evidence Of Immunity":
  "Has Laboratory Evidence Of Immunity"
  or ("Born Before 1957" and not "Is Healthcare Personnel")

// ============================================================================
// LIVE VIRUS CONFLICT (ScheduleSupportingData.xml)
// ============================================================================

/*
 * From ScheduleSupportingData liveVirusConflicts:
 * Live virus vaccines must be given either:
 * - Same day, OR
 * - At least 28 days apart (24 days with grace period)
 */
define "Recent Live Virus Administration":
  [Immunization] I
  where (I.vaccineCode ~ Schedule."MMR"
      or I.vaccineCode ~ Schedule."Measles-Rubella"
      or I.vaccineCode ~ Schedule."Measles"
      or I.vaccineCode ~ Schedule."MMRV"
      or I.vaccineCode ~ Schedule."Varicella CVX"
      or I.vaccineCode ~ Schedule."Yellow Fever CVX"
      or I.vaccineCode ~ Schedule."Zoster Live CVX"
      or I.vaccineCode ~ Schedule."Influenza LAIV CVX")
    and I.status.value = 'completed'
    and date from (I.occurrence as dateTime) < date from AsOfDate
    and days between date from (I.occurrence as dateTime) and date from AsOfDate >= 1
    and days between date from (I.occurrence as dateTime) and date from AsOfDate < 28

define "Has Live Virus Conflict":
  exists("Recent Live Virus Administration")

// ============================================================================
// DOSE 1 EVALUATION (CDSI Chapter 6)
// ============================================================================

/*
 * Evaluate Dose 1: Age at Administration
 * Per CDSI 6.4 Table 6-15: Was the Vaccine Dose Administered at a Valid Age?
 *
 * From AntigenSupportingData Dose 1:
 * - absMinAge: 12 months - 4 days
 * - minAge: 12 months
 * - maxAge: (empty, defaults to 12/31/2999)
 */
define "Dose 1 Candidates":
  "All Measles Immunizations" I
  where days between "Patient Birth Date" and (I.occurrence as dateTime) >= Schedule."Dose1_AbsMinAge_Days"

define "Dose 1 Valid Age":
  "Dose 1 Candidates" I
  where days between "Patient Birth Date" and (I.occurrence as dateTime) >= Schedule."Dose1_MinAge_Days"

/*
 * Evaluate Dose 1: Vaccine Type
 * Per CDSI 6.9: Was the vaccine dose administered an Allowable Vaccine?
 *
 * From AntigenSupportingData: allowableVaccine includes MMR (03), Measles-Rubella (04),
 * Measles (05), MMRV (94) with beginAge: 12 months - 4 days
 */
define "Dose 1 Valid Vaccine Type":
  "Dose 1 Candidates" I  // All Measles-containing vaccines are allowable

/*
 * Dose 1 Satisfied
 * Per CDSI 6.10 Table 6-31: Was the Target Dose Satisfied?
 * Requires: Valid age AND valid vaccine type
 */
define "Dose 1 Satisfied":
  exists(
    "Dose 1 Valid Age" intersect "Dose 1 Valid Vaccine Type"
  )

define "Dose 1 Valid":
  First("Dose 1 Valid Age" intersect "Dose 1 Valid Vaccine Type")

// ============================================================================
// DOSE 2 EVALUATION (CDSI Chapter 6)
// ============================================================================

/*
 * Conditional Skip for Dose 2
 * Per CDSI 6.2 and AntigenSupportingData conditionalSkip:
 * - Set 1: Age >= 19 years - 4 days
 * - Context: Both (Evaluation and Forecast)
 * - setLogic: n/a (only one set)
 */
define "Dose 2 Can Be Skipped":
  "Patient Age In Days" >= Schedule."Dose2_ConditionalSkip_Age_Days"

/*
 * Evaluate Dose 2: Age at Administration
 * From AntigenSupportingData Dose 2:
 * - absMinAge: 13 months - 4 days
 * - minAge: 13 months
 */
define "Dose 2 Age Candidates":
  "All Measles Immunizations" I
  where days between "Patient Birth Date" and (I.occurrence as dateTime) >= Schedule."Dose2_AbsMinAge_Days"
    and (I.occurrence as dateTime) > ("Dose 1 Valid".occurrence as dateTime)  // Must be after Dose 1

define "Dose 2 Valid Age":
  "Dose 2 Age Candidates" I
  where days between "Patient Birth Date" and (I.occurrence as dateTime) >= Schedule."Dose2_MinAge_Days"

/*
 * Evaluate Dose 2: Interval from Previous
 * Per CDSI 6.5 and 6.6: Evaluate Preferable/Allowable Interval
 *
 * From AntigenSupportingData Dose 2 interval:
 * - fromPrevious: Y
 * - absMinInt: 4 weeks - 4 days
 * - minInt: 4 weeks
 */
define "Dose 2 Valid Interval":
  "Dose 2 Age Candidates" I
  where "Dose 1 Valid" is not null
    and days between ("Dose 1 Valid".occurrence as dateTime) and (I.occurrence as dateTime)
        >= Schedule."Dose2_AbsMinInterval_Days"

define "Dose 2 Preferable Interval":
  "Dose 2 Valid Interval" I
  where days between ("Dose 1 Valid".occurrence as dateTime) and (I.occurrence as dateTime)
        >= Schedule."Dose2_MinInterval_Days"

/*
 * Dose 2 Satisfied
 * Per CDSI 6.10: Must satisfy age, interval, and vaccine type
 */
define "Dose 2 Satisfied":
  not "Dose 2 Can Be Skipped"
  and exists(
    "Dose 2 Valid Age" intersect "Dose 2 Valid Interval"
  )

define "Dose 2 Valid":
  if "Dose 2 Can Be Skipped" then null
  else First("Dose 2 Valid Age" intersect "Dose 2 Valid Interval")

// ============================================================================
// SERIES COMPLETION STATUS
// ============================================================================

/*
 * Per CDSI Chapter 8: Select Best Patient Series
 * For Standard 2-dose series:
 * - Complete: Dose 1 satisfied AND (Dose 2 satisfied OR Dose 2 skipped)
 * - In-Process: Dose 1 satisfied but Dose 2 not satisfied
 * - Not Started: Dose 1 not satisfied
 */
define "Series Status":
  if "Has Evidence Of Immunity" then 'Immune'
  else if "Measles Contraindicated" then 'Contraindicated'
  else if "Dose 1 Satisfied" and ("Dose 2 Satisfied" or "Dose 2 Can Be Skipped") then 'Complete'
  else if "Dose 1 Satisfied" then 'In-Process'
  else 'Not Complete'

define "Series Is Complete":
  "Series Status" in {'Complete', 'Immune'}

// ============================================================================
// FORECASTING (CDSI Chapter 7)
// ============================================================================

/*
 * Forecast Need
 * Per CDSI 7.4 Table 7-10: Should the Patient Receive Another Target Dose?
 */
define "Forecast Needed":
  not "Has Evidence Of Immunity"
  and not "Measles Contraindicated"
  and not "Series Is Complete"

/*
 * Generate Forecast Dates for Next Dose
 * Per CDSI 7.5 Table 7-12 and 7-13
 *
 * Dates to generate:
 * - Earliest Date (absolute minimum age/interval)
 * - Recommended Date (earliest recommended age/interval)
 * - Past Due Date (latest recommended age/interval)
 */
define "Next Dose Number":
  if not "Dose 1 Satisfied" then 1
  else if not "Dose 2 Satisfied" and not "Dose 2 Can Be Skipped" then 2
  else null

define "Forecast Earliest Date":
  if not "Forecast Needed" then null
  else if "Next Dose Number" = 1 then
    "Patient Birth Date" + Schedule."Dose1_AbsMinAge_Days"
  else if "Next Dose Number" = 2 then
    Max({
      "Patient Birth Date" + Schedule."Dose2_AbsMinAge_Days",
      date from ("Dose 1 Valid".occurrence as dateTime) + Schedule."Dose2_AbsMinInterval_Days"
    })
  else null

define "Forecast Recommended Date":
  if not "Forecast Needed" then null
  else if "Next Dose Number" = 1 then
    "Patient Birth Date" + Schedule."Dose1_EarliestRecAge_Days"
  else if "Next Dose Number" = 2 then
    Max({
      "Patient Birth Date" + Schedule."Dose2_EarliestRecAge_Days",
      date from ("Dose 1 Valid".occurrence as dateTime) + Schedule."Dose2_EarliestRecInterval_Days"
    })
  else null

define "Forecast Past Due Date":
  if not "Forecast Needed" then null
  else if "Next Dose Number" = 1 then
    "Patient Birth Date" + Schedule."Dose1_LatestRecAge_Days"
  else if "Next Dose Number" = 2 then
    Min({
      "Patient Birth Date" + Schedule."Dose2_LatestRecAge_Days",
      date from ("Dose 1 Valid".occurrence as dateTime) + Schedule."Dose2_LatestRecInterval_Days"
    })
  else null

/*
 * Recommended Vaccine
 * Per CDSI 7.5 and ScheduleSupportingData vaccineGroupMap
 * MMR vaccine group has administerFullVaccineGroup = Yes
 * Therefore, recommend MMR (not individual Measles vaccine)
 */
define "Recommended Vaccine":
  if "Forecast Needed" then 'MMR'
  else null

/*
 * Forecast Status with Reason
 */
define "Forecast Status":
  if "Has Evidence Of Immunity" then 'Immune'
  else if "Measles Contraindicated" then 'Contraindicated'
  else if "Has Live Virus Conflict" then 'Conditional'
  else if "Series Is Complete" then 'Complete'
  else if "Forecast Needed" then 'Recommended'
  else 'Not Recommended'

define "Forecast Reason":
  if "Has Evidence Of Immunity" then
    if "Has Laboratory Evidence Of Immunity" then 'Laboratory evidence of immunity'
    else if "Born Before 1957" then 'Born before 1957'
    else null
  else if "Measles Contraindicated" then "Contraindication Reason"
  else if "Has Live Virus Conflict" then 'Recent live virus vaccine - wait 28 days'
  else if "Series Is Complete" then 'Series complete'
  else null

// ============================================================================
// SUMMARY RECOMMENDATION
// ============================================================================

/*
 * Complete recommendation for the patient
 */
define "Recommendation":
  {
    status: "Forecast Status",
    reason: "Forecast Reason",
    nextDose: "Next Dose Number",
    recommendedVaccine: "Recommended Vaccine",
    earliestDate: "Forecast Earliest Date",
    recommendedDate: "Forecast Recommended Date",
    pastDueDate: "Forecast Past Due Date",
    seriesStatus: "Series Status",
    dose1: {
      satisfied: "Dose 1 Satisfied",
      date: "Dose 1 Valid".occurrence,
      vaccineCode: "Dose 1 Valid".vaccineCode
    },
    dose2: {
      satisfied: "Dose 2 Satisfied",
      canBeSkipped: "Dose 2 Can Be Skipped",
      date: "Dose 2 Valid".occurrence,
      vaccineCode: "Dose 2 Valid".vaccineCode
    }
  }
