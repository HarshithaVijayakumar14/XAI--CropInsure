export interface Claim {
  id: number;
  claim_reference: string;
  farmer_name: string;
  contact_number?: string;
  policy_reference: string;
  insurance_scheme: string;
  sum_insured?: number;
  state: string;
  district: string;
  village?: string;
  latitude?: number;
  longitude?: number;
  crop_type: string;
  season: string;
  sowing_date: string;
  claim_start_date: string;
  claim_end_date: string;
  loss_date?: string;
  reported_loss_pct?: number;
  loss_description?: string;
  growth_stage?: string;
  cultivated_area: number;
  expected_yield?: number;
  observed_yield?: number;
  soil_type?: string;
  irrigation_type?: string;
  observed_rainfall: number;
  reference_rainfall: number;
  soil_moisture?: number;
  observed_temperature: number;
  reference_temperature: number;
  current_ndvi: number;
  reference_ndvi: number;
  historical_outcome?: string;
  status: string;
  workflow_stage?: string;
  verified_crop_loss?: number;
  officer_notes?: string;
  missing_documents?: string;
  data_quality_flags: string;
  is_demo_record: boolean;
  created_at: string;
  updated_at: string;
  
  // Enriched sections for transparent farmer and officer workflows
  ai_assessment?: ClaimAiAssessment;
  ai_prediction?: ClaimAiAssessment;
  officer_decision?: ClaimOfficerDecision;
  comparison?: ClaimComparison;
  timeline_stages?: ClaimProgressStage[];
}

export interface ClaimAiAssessment {
  predicted_eligibility: 'Likely Eligible for Insurance Claim' | 'Likely Not Eligible for Insurance Claim' | 'Insufficient Information to Predict' | string;
  prediction_label: string;
  prediction_probability: number;
  confidence_percentage?: number;
  predicted_yield?: number;
  predicted_yield_display?: string;
  reference_yield?: number;
  reference_yield_display?: string;
  reasons_supporting: string[];
  reasons_against: string[];
  neutral_factors?: string[];
  shap_contributions?: any[];
  farmer_friendly_summary?: string;
  assessed_at?: string;
  model_id?: number;
}

export interface ClaimOfficerDecision {
  status: string;
  is_decided: boolean;
  decision: 'Approved' | 'Rejected' | 'Additional Evidence Required' | 'Awaiting Officer Decision' | string;
  officer_name?: string;
  officer_role?: string;
  officer_remarks?: string;
  reason_for_decision?: string;
  verified_crop_loss?: number;
  verified_crop_loss_display?: string;
  verified_crop_yield?: number;
  verified_crop_yield_display?: string;
  required_evidence?: string;
  differs_from_model?: boolean;
  decision_date?: string;
}

export interface ClaimComparison {
  ai_predicted_eligibility: string;
  ai_predicted_yield_display: string;
  ai_main_reason: string;
  officer_final_decision: string;
  officer_verified_yield_display: string;
  officer_reason: string;
  agreement_status: string;
  comparison_insight: string;
}

export interface ClaimProgressStage {
  stage_number: number;
  key: string;
  title: string;
  status: 'completed' | 'in_progress' | 'pending';
  date: string;
  description: string;
}

export interface ShapContribution {
  feature: string;
  feature_name_display: string;
  observed_value: any;
  shap_value: number;
  direction: 'positive' | 'negative' | 'neutral';
  interpretation: string;
}

export interface StatutoryCheckItem {
  check_id: string;
  title: string;
  status: 'Passed' | 'Failed' | 'Needs Verification' | 'Not Applicable' | string;
  details: string;
  evidence_used: string;
  rule_reference: string;
}

export interface MissingEvidenceItem {
  document_or_evidence: string;
  required_for: string;
  status: 'Verified' | 'Pending / Missing' | 'Needs Physical Inspection' | 'Not Applicable' | string;
  guidance: string;
}

export interface PMFBYRuleAssessmentResult {
  loss_category: string;
  loss_category_description: string;
  reported_peril: string;
  is_peril_consistent?: boolean | null;
  peril_consistency_notes: string;
  preliminary_triage: string;
  triage_summary: string;
  checks: StatutoryCheckItem[];
  evidence_checklist: MissingEvidenceItem[];
  applicable_deadline_hours?: number | null;
  elapsed_hours_to_notification?: number | null;
  notified_coverage_benchmark?: Record<string, any> | null;
  disclaimer: string;
  assessed_at: string;
}

export interface ClaimAssessment {
  id: number;
  claim_id: number;
  claim_reference: string;
  model_id: number;
  model_name: string;
  model_version: string;
  prediction_label?: string;
  prediction_probability?: number;
  payout_estimate?: number;
  base_value?: number;
  shap_contributions: ShapContribution[];
  farmer_friendly_summary: string;
  missing_evidence_notes?: string;
  data_quality_status: string;
  data_quality_warnings: string[];
  statutory_rules?: PMFBYRuleAssessmentResult;
  assessed_at: string;
}

export interface ImportedDataset {
  id: number;
  name: string;
  source: string;
  category: string;
  row_count: number;
  column_count: number;
  columns: string[];
  missing_summary: Record<string, { null_count: number; null_percentage: number; dtype: string }>;
  quality_summary: {
    total_rows: number;
    total_columns: number;
    duplicate_rows: number;
    has_target_column: boolean;
    detected_targets: string[];
    range_checks: Record<string, number>;
  };
  is_synthetic: boolean;
  import_status: string;
  created_at: string;
  preview?: any[];
}

export interface TrainedModel {
  id: number;
  model_name: string;
  model_version: string;
  task_type: 'classification' | 'regression';
  algorithm: string;
  target_column: string;
  features_used: string;
  metrics_json: string;
  is_synthetic_trained: boolean;
  is_active: boolean;
  dataset_name?: string;
  training_notes?: string;
  created_at: string;
}

export interface HumanReview {
  id: number;
  claim_id: number;
  reviewer_name: string;
  reviewer_role: string;
  review_decision: string;
  differs_from_model: boolean;
  rationale: string;
  required_evidence?: string;
  reviewed_at: string;
}

export interface AuditEvent {
  id: number;
  claim_id?: number;
  event_type: string;
  actor: string;
  previous_status?: string;
  new_status?: string;
  details: string;
  timestamp: string;
}

export interface DashboardSummary {
  total_claims: number;
  claims_awaiting_review: number;
  claims_model_assessed: number;
  claims_requiring_evidence: number;
  claims_human_reviewed: number;
  is_demo_data: boolean;
  demo_banner_message: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  secondary_value?: number;
  category?: string;
}

export interface DashboardCharts {
  status_distribution: ChartDataPoint[];
  claims_over_time: ChartDataPoint[];
  prediction_distribution: ChartDataPoint[];
  crop_distribution: ChartDataPoint[];
  region_distribution: ChartDataPoint[];
  top_model_features: ChartDataPoint[];
  data_quality_summary: {
    total_claims_checked: number;
    claims_with_warnings: number;
    total_warnings_detected: number;
    warning_types: Record<string, number>;
  };
  recent_activity: {
    id: number;
    event_type: string;
    actor: string;
    details: string;
    timestamp: string;
  }[];
}

// User & Authentication Types
export interface UserProfile {
  id: number;
  username: string;
  full_name: string;
  role: 'farmer' | 'officer';
  phone_number?: string;
  state?: string;
  district?: string;
  village?: string;
  preferred_language: string;
}

export interface AuthLoginResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

// Farmer Scoped Data Models
export interface FarmerClaimSummary {
  id: number;
  claim_reference: string;
  crop_type: string;
  season: string;
  cultivated_area: number;
  reported_loss_pct?: number;
  status: string;
  workflow_stage: string;
  sowing_date: string;
  created_at: string;
}

export interface FarmerClaimDetails {
  id: number;
  claim_reference: string;
  farmer_name: string;
  crop_name: string;
  crop_type: string;
  village: string;
  district: string;
  state: string;
  land_area_hectares: number;
  land_area_acres?: number;
  season_year: string;
  policy_number: string;
  claim_application_number: string;
  date_of_application: string;
  reported_crop_damage: string;
  status: string;
  workflow_stage: string;
  missing_documents: string[];
  uploaded_documents: {
    doc_type: string;
    name: string;
    status: string;
    upload_date?: string;
  }[];
  next_expected_action: string;
  payment_status: string;
  payment_amount?: number;
  payment_reference?: string;
}

export interface TimelineStage {
  stage: string;
  title: string;
  status: 'completed' | 'in_progress' | 'pending';
  date: string;
  note: string;
}

export interface TimelineResponse {
  claim_reference: string;
  current_stage: string;
  last_status_update: string;
  stages: TimelineStage[];
  missing_documents: string[];
  next_expected_action: string;
}

export interface DamageInfoResponse {
  claim_reference: string;
  crop_type: string;
  farmer_reported: {
    crop_type: string;
    reported_loss_pct: string;
    date_of_damage: string;
    loss_cause_description: string;
    source_type: string;
  };
  external_sources: {
    observed_rainfall: string;
    normal_seasonal_rainfall: string;
    rainfall_deficit: string;
    observed_temperature: string;
    temperature_anomaly: string;
    source_type: string;
  };
  ai_estimated: {
    satellite_ndvi_vegetation_drop: string;
    ai_pattern_resemblance: string;
    ai_certainty: string;
    source_type: string;
  };
  officer_verified: {
    status: string;
    officer_verified_crop_loss: string;
    officer_decision: string;
    officer_name: string;
    field_survey_notes: string;
    source_type: string;
  };
}

export interface FactorExplanation {
  factor_name: string;
  what_we_know: string;
  why_it_matters: string;
  influence: 'supports' | 'requires_checking' | 'neutral';
  influence_score?: number;
  verification_status: string;
}

export interface FarmerExplanationResponse {
  claim_reference: string;
  crop_type: string;
  assessment_label: string;
  certainty_pct?: number;
  main_reasons: FactorExplanation[];
  visual_summary: {
    factor: string;
    status: string;
    color: string;
  }[];
  plain_summary: string;
  statutory_note: string;
}

export interface ChatMessageResponse {
  role: 'user' | 'assistant';
  content: string;
  suggested_followups: string[];
  claim_reference: string;
}

export interface RegionalLanguage {
  code: string;
  name: string;
  native_name: string;
  is_default?: boolean;
  is_priority?: boolean;
}

export interface AgriculturalYieldCrop {
  crop_name: string;
  historical_median_yield: number;
  shortfall_threshold: number;
  unit: string;
}

export interface AgriculturalYieldOptions {
  states: string[];
  districts_by_state?: Record<string, string[]>;
  all_districts_count?: number;
  crops: Array<string | AgriculturalYieldCrop>;
  crop_names?: string[];
  seasons: string[];
  districts_count?: number;
  state_defaults?: Record<string, {
    Annual_Rainfall: number;
    Avg_Temp: number;
    Fertilizer_per_ha: number;
    Pesticide_per_ha: number;
  }>;
  district_defaults?: Record<string, {
    Annual_Rainfall: number;
    Avg_Temp: number;
    Fertilizer_per_ha: number;
    Pesticide_per_ha: number;
  }>;
  model_metadata: {
    model_id: number;
    model_name: string;
    model_version: string;
    task_type: string;
    algorithm: string;
    target: string;
    dataset_name: string;
    training_records?: number;
    r2_score?: number;
    mae?: number;
    rmse?: number;
    train_records?: number;
    test_records?: number;
    baseline_mean_yield?: number;
    is_active: boolean;
    regression_metrics?: {
      random_split_r2: number;
      random_split_mae: number;
      random_split_rmse: number;
      temporal_split_r2: number;
      temporal_split_mae: number;
      temporal_split_rmse: number;
    };
    classification_metrics?: {
      temporal_accuracy: number;
      temporal_precision: number;
      temporal_recall: number;
      temporal_f1: number;
      random_accuracy: number;
      random_f1: number;
    };
    dataset_sources?: string[];
  };
}

export interface AgriculturalYieldRequest {
  state: string;
  district: string;
  crop: string;
  season: string;
  area: number;
  annual_rainfall?: number;
  avg_temperature?: number;
  fertilizer_per_ha?: number;
  pesticide_per_ha?: number;
}

export interface AgriculturalYieldShapFeature {
  feature: string;
  label: string;
  input_value: string | number;
  shap_value: number;
  direction: 'positive' | 'negative' | 'neutral';
  impact_description: string;
}

export interface AgriculturalYieldResponse {
  predicted_yield_tonnes_per_ha: number;
  predicted_total_production_tonnes: number;
  cultivated_area_ha: number;
  unit_yield: string;
  unit_production: string;
  predicted_yield_quintals_per_acre?: number;
  predicted_total_quintals?: number;
  
  // Core Question 2: Will yield come or not?
  yield_classification: 'YES' | 'NO';
  yield_classification_label: string;
  classification_probability: number;
  crop_historical_median_yield: number;
  crop_yield_threshold: number;
  shortfall_percentage?: number | null;
  
  // AI Crop Insurance Eligibility Prediction (Requirement 1B & 1C)
  predicted_insurance_eligibility?: 'Likely Eligible for Insurance Claim' | 'Likely Not Eligible for Insurance Claim' | 'Insufficient Information to Predict' | string;
  insurance_indication: string;
  insurance_indication_detail: string;
  reasons_supporting_claim?: string[];
  reasons_against_claim?: string[];
  neutral_factors?: string[];
  
  // Core Question 3: Why did model give this result?
  shap_explanation: {
    base_value: number;
    feature_contributions: AgriculturalYieldShapFeature[];
    top_positive_features: string[];
    top_negative_features: string[];
    neutral_features?: string[];
    plain_text_summary: string;
  };
  farmer_friendly_explanation: string;
  
  // Environmental & Agro-climatic Inputs
  environmental_inputs?: {
    annual_rainfall_mm: number;
    annual_rainfall_provenance: string;
    avg_temperature_c: number;
    avg_temperature_provenance: string;
    fertilizer_kg_per_ha: number;
    fertilizer_provenance: string;
    pesticide_kg_per_ha: number;
    pesticide_provenance: string;
    satellite_ndvi_status?: string;
  };

  // Backward compatibility
  baseline_mean_yield: number;
  difference_from_baseline: number;
  model_info: {
    model_id: number;
    model_name: string;
    model_version: string;
    algorithm: string;
    task_type: string;
    dataset_name: string;
    r2_score?: number;
    mae?: number;
    rmse?: number;
    temporal_r2?: number;
    temporal_f1?: number;
    training_records?: number;
    is_active: boolean;
  };
  disclaimer: string;
  warnings: string[];
}


