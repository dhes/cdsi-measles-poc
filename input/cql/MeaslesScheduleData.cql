/*
 * Library: MeaslesScheduleData
 * Version: 1.0.0
 * Description: Configuration data for Measles immunization forecasting based on CDC CDSI
 *              Supporting Data Version 4.64. Contains CVX codes, observation codes,
 *              age/interval parameters, and other configuration from the Antigen and
 *              Schedule Supporting Data.
 *
 * Based on:
 * - AntigenSupportingData- Measles-508.xml
 * - ScheduleSupportingData.xml
 */

library MeaslesScheduleData version '1.0.0'

using FHIR version '4.0.1'

// ============================================================================
// CODE SYSTEMS
// ============================================================================

codesystem "CVX": 'http://hl7.org/fhir/sid/cvx'
  display 'CDC Vaccine Administered CVX Codes'

codesystem "SNOMED": 'http://snomed.info/sct'
  display 'SNOMED CT'

// ============================================================================
// CVX CODES - Measles-containing vaccines
// ============================================================================

code "MMR": '03' from "CVX" display 'MMR'
code "Measles-Rubella": '04' from "CVX" display 'Measles-Rubella'
code "Measles": '05' from "CVX" display 'Measles'
code "MMRV": '94' from "CVX" display 'MMRV'

// Live virus vaccines for conflict checking
code "Varicella CVX": '21' from "CVX" display 'Varicella'
code "Yellow Fever CVX": '37' from "CVX" display 'Yellow Fever'
code "Zoster Live CVX": '121' from "CVX" display 'Zoster Live'
code "Influenza LAIV CVX": '111' from "CVX" display 'Influenza LAIV'

// ============================================================================
// OBSERVATION CODES - From ScheduleSupportingData.xml
// ============================================================================

// Immunity evidence
code "Measles Immune": '371111005' from "SNOMED"
  display 'Measles immune (finding)'

// Contraindications
code "Pregnancy": '77386006' from "SNOMED"
  display 'Pregnancy'

code "HIV/AIDS": '62479008' from "SNOMED"
  display 'Acquired immune deficiency syndrome'

code "Severe Immunocompromise": '370391006' from "SNOMED"
  display 'Patient immunocompromised'

// Indications (from observation code 048, 055, etc.)
code "Healthcare Personnel": '223366009' from "SNOMED"
  display 'Healthcare professional'

// ============================================================================
// VALUE SETS - Groupings of codes
// ============================================================================

// All Measles-containing vaccines
valueset "Measles Vaccines": 'http://example.org/fhir/ValueSet/measles-vaccines'
// Contains: CVX 03, 04, 05, 94

// All live virus vaccines for conflict checking
valueset "Live Virus Vaccines": 'http://example.org/fhir/ValueSet/live-virus-vaccines'
// Contains: CVX 03, 04, 05, 94, 21, 37, 121, 111, etc.

// Contraindication observations
valueset "Severe Immunocompromise Conditions": 'http://example.org/fhir/ValueSet/severe-immunocompromise'
// Contains: SNOMED codes for SCID, DiGeorge, HIV with low CD4, etc.

valueset "Blood Product Administration": 'http://example.org/fhir/ValueSet/blood-products'
// Contains: procedure codes for blood transfusions, IGIV, etc.

// ============================================================================
// SCHEDULE PARAMETERS - From AntigenSupportingData- Measles-508.xml
// ============================================================================

// Standard 2-dose series - Dose 1
parameter "Dose1_AbsMinAge_Days" Integer default 348  // 12 months - 4 days
parameter "Dose1_MinAge_Days" Integer default 365      // 12 months
parameter "Dose1_EarliestRecAge_Days" Integer default 365  // 12 months
parameter "Dose1_LatestRecAge_Days" Integer default 512    // 16 months + 4 weeks

// Standard 2-dose series - Dose 2
parameter "Dose2_AbsMinAge_Days" Integer default 391   // 13 months - 4 days
parameter "Dose2_MinAge_Days" Integer default 395      // 13 months
parameter "Dose2_EarliestRecAge_Days" Integer default 1460  // 4 years
parameter "Dose2_LatestRecAge_Days" Integer default 2583    // 7 years + 4 weeks

// Dose 2 intervals from previous dose
parameter "Dose2_AbsMinInterval_Days" Integer default 24   // 4 weeks - 4 days
parameter "Dose2_MinInterval_Days" Integer default 28      // 4 weeks
parameter "Dose2_EarliestRecInterval_Days" Integer default 1095  // 3 years
parameter "Dose2_LatestRecInterval_Days" Integer default 2163    // 6 years + 4 weeks

// Dose 2 conditional skip - age 19 years
parameter "Dose2_ConditionalSkip_Age_Days" Integer default 6935  // 19 years - 4 days

// Immunity - born before date
parameter "Immunity_BirthDate" Date default @1957-01-01

// Live virus conflict interval
parameter "LiveVirusConflict_MinInterval_Days" Integer default 24  // with grace period
parameter "LiveVirusConflict_Interval_Days" Integer default 28

// Blood product intervals (examples - full list has 17+ types)
parameter "BloodTransfusion_Whole_Interval_Months" Integer default 6
parameter "BloodTransfusion_Packed_Interval_Months" Integer default 6
parameter "IGIV_Kawasaki_Interval_Months" Integer default 11

// ============================================================================
// HELPER CONCEPTS
// ============================================================================

// Dose statuses (from Logic Specification Chapter 3)
concept "Valid": { display 'Valid' }
concept "Not Valid": { display 'Not Valid' }
concept "Extraneous": { display 'Extraneous' }
concept "Skipped": { display 'Skipped' }
concept "Satisfied": { display 'Satisfied' }
concept "Not Satisfied": { display 'Not Satisfied' }

// Series statuses
concept "Complete": { display 'Complete' }
concept "Not Complete": { display 'Not Complete' }
concept "Immune": { display 'Immune' }
concept "Contraindicated": { display 'Contraindicated' }

// Forecast statuses
concept "Recommended": { display 'Recommended' }
concept "Not Recommended": { display 'Not Recommended' }
concept "Conditional": { display 'Conditional' }
