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
  data_quality_flags: string;
  is_demo_record: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShapContribution {
  feature: string;
  feature_name_display: string;
  observed_value: any;
  shap_value: number;
  direction: 'positive' | 'negative' | 'neutral';
  interpretation: string;
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

