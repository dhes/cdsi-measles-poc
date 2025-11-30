/*
 * Library: MeaslesScheduleData
 * Version: 1.0.0
 * Description: Configuration data for Measles immunization forecasting based on CDC CDSi
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
codesystem "SNOMED": 'http://snomed.info/sct'
codesystem "ConditionClinical": 'http://terminology.hl7.org/CodeSystem/condition-clinical'
codesystem "ConditionVerification": 'http://terminology.hl7.org/CodeSystem/condition-ver-status'

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

// Condition clinical status codes
code "Active": 'active' from "ConditionClinical" display 'Active'
code "Recurrence": 'recurrence' from "ConditionClinical" display 'Recurrence'
code "Relapse": 'relapse' from "ConditionClinical" display 'Relapse'
code "Inactive": 'inactive' from "ConditionClinical" display 'Inactive'
code "Remission": 'remission' from "ConditionClinical" display 'Remission'
code "Resolved": 'resolved' from "ConditionClinical" display 'Resolved'

// Condition verification status codes
code "Confirmed": 'confirmed' from "ConditionVerification" display 'Confirmed'
code "Unconfirmed": 'unconfirmed' from "ConditionVerification" display 'Unconfirmed'

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
parameter "Dose1_AbsMinAge_Days" default 348 'days'  // 12 months - 4 days
parameter "Dose1_MinAge_Days" default 365 'days'      // 12 months
parameter "Dose1_EarliestRecAge_Days" default 365 'days'  // 12 months
parameter "Dose1_LatestRecAge_Days" default 512 'days'    // 16 months + 4 weeks

// Standard 2-dose series - Dose 2
parameter "Dose2_AbsMinAge_Days" default 391 'days'   // 13 months - 4 days
parameter "Dose2_MinAge_Days" default 395 'days'      // 13 months
parameter "Dose2_EarliestRecAge_Days" default 1460 'days'  // 4 years
parameter "Dose2_LatestRecAge_Days" default 2583 'days'    // 7 years + 4 weeks

// Dose 2 intervals from previous dose
parameter "Dose2_AbsMinInterval_Days" default 24 'days'   // 4 weeks - 4 days
parameter "Dose2_MinInterval_Days" default 28 'days'      // 4 weeks
parameter "Dose2_EarliestRecInterval_Days" default 1095 'days'  // 3 years
parameter "Dose2_LatestRecInterval_Days" default 2163 'days'    // 6 years + 4 weeks

// Dose 2 conditional skip - age 19 years
parameter "Dose2_ConditionalSkip_Age_Days" default 6935  // 19 years - 4 days

// Immunity - born before date
parameter "Immunity_BirthDate" default @1957-01-01

// Live virus conflict interval
parameter "LiveVirusConflict_MinInterval_Days" default 24 'days'  // with grace period
parameter "LiveVirusConflict_Interval_Days" default 28 'days'

// Blood product intervals (examples - full list has 17+ types)
parameter "BloodTransfusion_Whole_Interval_Months" default 6
parameter "BloodTransfusion_Packed_Interval_Months" default 6
parameter "IGIV_Kawasaki_Interval_Months" default 11

// ============================================================================
// HELPER CONCEPTS - Internal Status Codes for CDSi Logic
// ============================================================================

// Define a custom codesystem for CDSi internal statuses
codesystem "CDSi-Status": 'http://example.org/fhir/CodeSystem/cdsi-status'

// Dose statuses (from CDSi Logic Specification Chapter 3)
code "Valid Code": 'valid' from "CDSi-Status" display 'Valid'
code "Not Valid Code": 'not-valid' from "CDSi-Status" display 'Not Valid'
code "Extraneous Code": 'extraneous' from "CDSi-Status" display 'Extraneous'
code "Skipped Code": 'skipped' from "CDSi-Status" display 'Skipped'
code "Satisfied Code": 'satisfied' from "CDSi-Status" display 'Satisfied'
code "Not Satisfied Code": 'not-satisfied' from "CDSi-Status" display 'Not Satisfied'

// Series statuses
code "Complete Code": 'complete' from "CDSi-Status" display 'Complete'
code "Not Complete Code": 'not-complete' from "CDSi-Status" display 'Not Complete'
code "Immune Code": 'immune' from "CDSi-Status" display 'Immune'
code "Contraindicated Code": 'contraindicated' from "CDSi-Status" display 'Contraindicated'

// Forecast statuses
code "Recommended Code": 'recommended' from "CDSi-Status" display 'Recommended'
code "Not Recommended Code": 'not-recommended' from "CDSi-Status" display 'Not Recommended'
code "Conditional Code": 'conditional' from "CDSi-Status" display 'Conditional'

// Concepts grouping related codes
concept "Valid": { "Valid Code" } display 'Valid'
concept "Not Valid": { "Not Valid Code" } display 'Not Valid'
concept "Extraneous": { "Extraneous Code" } display 'Extraneous'
concept "Skipped": { "Skipped Code" } display 'Skipped'
concept "Satisfied": { "Satisfied Code" } display 'Satisfied'
concept "Not Satisfied": { "Not Satisfied Code" } display 'Not Satisfied'
concept "Complete": { "Complete Code" } display 'Complete'
concept "Not Complete": { "Not Complete Code" } display 'Not Complete'
concept "Immune": { "Immune Code" } display 'Immune'
concept "Contraindicated": { "Contraindicated Code" } display 'Contraindicated'
concept "Recommended": { "Recommended Code" } display 'Recommended'
concept "Not Recommended": { "Not Recommended Code" } display 'Not Recommended'
concept "Conditional": { "Conditional Code" } display 'Conditional'
