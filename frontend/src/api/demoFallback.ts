import {
  AgriculturalYieldOptions,
  AgriculturalYieldRequest,
  AgriculturalYieldResponse,
  Claim,
  ClaimAssessment,
  HumanReview,
  AuditEvent,
  DashboardSummary,
  DashboardCharts,
  UserProfile,
  AuthLoginResponse,
  FarmerClaimSummary,
  FarmerClaimDetails,
  TimelineResponse,
  DamageInfoResponse,
  FarmerExplanationResponse,
  ChatMessageResponse,
  ImportedDataset,
  TrainedModel,
  PMFBYRuleAssessmentResult
} from '../types';

const INITIAL_DEMO_CLAIMS: Claim[] = [
  {
    id: 1,
    claim_reference: 'CLM-2025-001',
    farmer_name: 'Ramesh Patil',
    contact_number: '9876543210',
    policy_reference: 'PMFBY-KT-2025-8812',
    insurance_scheme: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    sum_insured: 75000,
    state: 'Karnataka',
    district: 'Dharwad',
    village: 'Navalgund',
    crop_type: 'Rice/Paddy',
    season: 'Kharif',
    sowing_date: '2025-06-15',
    claim_start_date: '2025-07-20',
    claim_end_date: '2025-11-05',
    reported_loss_pct: 65,
    loss_description: 'Severe deficit monsoon rainfall leading to tillering stage moisture stress and vegetative stunting.',
    cultivated_area: 2.5,
    observed_rainfall: 280,
    reference_rainfall: 820,
    soil_moisture: 20,
    observed_temperature: 33.5,
    reference_temperature: 29.5,
    current_ndvi: 0.28,
    reference_ndvi: 0.58,
    status: 'Submitted',
    workflow_stage: 'Under Officer Review',
    data_quality_flags: '[]',
    is_demo_record: true,
    created_at: '2025-08-01T10:30:00Z',
    updated_at: '2025-08-01T10:30:00Z',
    ai_assessment: {
      predicted_eligibility: 'Likely Eligible for Insurance Claim',
      prediction_label: 'Eligible',
      prediction_probability: 0.88,
      confidence_percentage: 88,
      predicted_yield: 1.65,
      predicted_yield_display: '1.65 Tonnes/Ha (~6.68 Quintals/Acre)',
      reference_yield: 3.20,
      reference_yield_display: '3.20 Tonnes/Ha (30-yr benchmark)',
      reasons_supporting: [
        'Rainfall deficit of 540 mm (65.9% shortfall) compared to normal monsoon baseline',
        'Satellite NDVI shows severe vegetation stress (0.28 vs 0.58 historical average)',
        'Predicted yield is 48.4% below historical regional threshold'
      ],
      reasons_against: [
        'Standard fertilizer inputs were applied in vegetative phase'
      ],
      neutral_factors: [
        'Clay loam soil moisture retention baseline',
        'Rainfed cultivation practice'
      ],
      farmer_friendly_summary: 'The AI model evaluated your farm records and observed that monsoon rainfall was 65.9% below normal levels, corroborated by a 51.7% drop in satellite vegetation greenness (NDVI). Based on historical crop loss patterns, this claim is Likely Eligible for compensation under PMFBY guidelines pending authorized officer ground survey.',
      assessed_at: '2025-08-01T10:30:05Z',
      model_id: 1
    },
    officer_decision: {
      status: 'Pending',
      is_decided: false,
      decision: 'Awaiting Officer Decision',
      officer_name: 'Dr. Anita Deshmukh',
      officer_role: 'District Agricultural Officer',
      officer_remarks: 'Claim queued for ground crop cutting experiment (CCE) verification and joint revenue patwari loss confirmation.',
      reason_for_decision: 'Ground inspection pending'
    },
    comparison: {
      ai_predicted_eligibility: 'Likely Eligible for Insurance Claim',
      ai_predicted_yield_display: '1.65 T/Ha (~6.68 Q/Acre)',
      ai_main_reason: 'Monsoon rainfall deficit of 65.9% and satellite NDVI vegetative depression.',
      officer_final_decision: 'Awaiting Officer Decision',
      officer_verified_yield_display: 'Pending field survey',
      officer_reason: 'Ground survey in progress by block agricultural assessor.',
      agreement_status: 'Under Review',
      comparison_insight: 'Your claim is currently undergoing official statutory assessment. The AI preliminary evaluation indicates strong eligibility based on weather deficits. The final official decision will be recorded after the officer completes field verification.'
    },
    timeline_stages: [
      { stage_number: 1, key: 'submitted', title: 'Claim Submitted', status: 'completed', date: '2025-08-01', description: 'Application registered successfully' },
      { stage_number: 2, key: 'ai_assessed', title: 'AI Assessment Completed', status: 'completed', date: '2025-08-01', description: 'Preliminary AI evaluation completed (Model 1)' },
      { stage_number: 3, key: 'officer_review', title: 'Officer Review', status: 'in_progress', date: 'In Progress', description: 'Assessor inspecting documentary & weather evidence' },
      { stage_number: 4, key: 'verification', title: 'Verification', status: 'pending', date: 'Pending', description: 'Field crop-cutting loss verification' },
      { stage_number: 5, key: 'final_decision', title: 'Final Decision', status: 'pending', date: 'Pending', description: 'Official statutory approval / settlement' }
    ]
  },
  {
    id: 2,
    claim_reference: 'CLM-2025-002',
    farmer_name: 'Suresh Gowda',
    contact_number: '9123456789',
    policy_reference: 'PMFBY-KT-2025-9921',
    insurance_scheme: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    sum_insured: 50000,
    state: 'Karnataka',
    district: 'Dharwad',
    village: 'Hubballi Rural',
    crop_type: 'Wheat',
    season: 'Rabi',
    sowing_date: '2025-10-10',
    claim_start_date: '2025-12-01',
    claim_end_date: '2026-03-01',
    reported_loss_pct: 20,
    loss_description: 'Minor yellowing observed on late sown wheat.',
    cultivated_area: 1.5,
    observed_rainfall: 520,
    reference_rainfall: 550,
    soil_moisture: 35,
    observed_temperature: 26.0,
    reference_temperature: 25.5,
    current_ndvi: 0.65,
    reference_ndvi: 0.68,
    status: 'Approved',
    workflow_stage: 'Final Decision Completed',
    verified_crop_loss: 45,
    observed_yield: 2.1,
    officer_notes: 'Physical field survey confirmed localized lodging caused by unseasonal squall storm event.',
    data_quality_flags: '[]',
    is_demo_record: true,
    created_at: '2025-12-10T11:00:00Z',
    updated_at: '2025-12-18T14:30:00Z',
    ai_assessment: {
      predicted_eligibility: 'Likely Not Eligible for Insurance Claim',
      prediction_label: 'Not Eligible',
      prediction_probability: 0.22,
      confidence_percentage: 78,
      predicted_yield: 3.45,
      predicted_yield_display: '3.45 Tonnes/Ha (~13.96 Quintals/Acre)',
      reference_yield: 3.60,
      reference_yield_display: '3.60 Tonnes/Ha (30-yr benchmark)',
      reasons_supporting: [],
      reasons_against: [
        'Seasonal rainfall of 520 mm is close to historical normal (550 mm)',
        'Satellite NDVI shows healthy vegetative canopy (0.65 vs 0.68 benchmark)',
        'Reported loss of 20% is within normal yield fluctuation threshold (<30%)'
      ],
      neutral_factors: [
        'Irrigated wheat cultivation pattern'
      ],
      farmer_friendly_summary: 'Regional weather and satellite data showed near-normal seasonal rainfall and healthy canopy greenness, leading the AI model to predict that this claim was Likely Not Eligible under macro-scale statistical patterns.',
      assessed_at: '2025-12-10T11:00:05Z',
      model_id: 1
    },
    officer_decision: {
      status: 'Approved',
      is_decided: true,
      decision: 'Approved',
      officer_name: 'Senior Assessor R. K. Verma',
      officer_role: 'Claim Assessor',
      officer_remarks: 'Field inspection and panchayat survey confirmed severe localized lodging from localized unseasonal squall storm on 2025-12-05.',
      reason_for_decision: 'Localized calamity documented by village patwari and block officer.',
      verified_crop_loss: 45,
      verified_crop_loss_display: '45.0%',
      verified_crop_yield: 2.1,
      verified_crop_yield_display: '2.10 Tonnes/Ha (~8.50 Q/Acre)',
      differs_from_model: true,
      decision_date: '2025-12-18T14:30:00Z'
    },
    comparison: {
      ai_predicted_eligibility: 'Likely Not Eligible for Insurance Claim',
      ai_predicted_yield_display: '3.45 T/Ha (~13.96 Q/Acre)',
      ai_main_reason: 'Normal regional weather and healthy satellite vegetative indices.',
      officer_final_decision: 'Approved',
      officer_verified_yield_display: '45.0% Loss (2.10 T/Ha)',
      officer_reason: 'Field inspection confirmed localized storm lodging not captured in block-level weather averages.',
      agreement_status: 'Officer Manual Override',
      comparison_insight: 'The authorized officer approved the claim despite the AI preliminary prediction of "Likely Not Eligible" because physical field verification and revenue patwari records documented localized crop lodging from a severe squall storm that regional meteorological sensors did not capture.'
    },
    timeline_stages: [
      { stage_number: 1, key: 'submitted', title: 'Claim Submitted', status: 'completed', date: '2025-12-10', description: 'Application registered successfully' },
      { stage_number: 2, key: 'ai_assessed', title: 'AI Assessment Completed', status: 'completed', date: '2025-12-10', description: 'Preliminary AI evaluation completed' },
      { stage_number: 3, key: 'officer_review', title: 'Officer Review', status: 'completed', date: '2025-12-15', description: 'Assessor field survey performed' },
      { stage_number: 4, key: 'verification', title: 'Verification', status: 'completed', date: '2025-12-17', description: 'CCE and localized storm report verified' },
      { stage_number: 5, key: 'final_decision', title: 'Final Decision', status: 'completed', date: '2025-12-18', description: 'Claim Approved by Authorized Officer' }
    ]
  }
];

function getStoredClaims(): Claim[] {
  try {
    const raw = localStorage.getItem('xai_demo_claims');
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem('xai_demo_claims', JSON.stringify(INITIAL_DEMO_CLAIMS));
  return INITIAL_DEMO_CLAIMS;
}

function saveStoredClaims(claims: Claim[]) {
  try {
    localStorage.setItem('xai_demo_claims', JSON.stringify(claims));
  } catch {}
}

export const demoFallback = {
  // Health
  getHealth: async () => ({
    status: 'ok',
    project: 'XAI-CropInsure',
    version: '2.5.0-ghpages',
    database_connected: true,
    demo_mode: true,
    claims_registered: getStoredClaims().length,
    models_trained: 2
  }),

  // Dashboard
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const claims = getStoredClaims();
    const approved = claims.filter(c => c.status === 'Approved').length;
    const submitted = claims.filter(c => c.status === 'Submitted' || c.workflow_stage?.includes('Review')).length;
    return {
      total_claims: claims.length,
      claims_awaiting_review: submitted,
      claims_model_assessed: claims.length,
      claims_requiring_evidence: claims.filter(c => c.status === 'Additional evidence required').length,
      claims_human_reviewed: approved + claims.filter(c => c.status === 'Rejected').length,
      is_demo_data: true,
      demo_banner_message: 'Running in Standalone Demonstration Mode with full local interactivity and PMFBY operational guidelines.'
    };
  },

  getDashboardCharts: async (): Promise<DashboardCharts> => {
    return {
      status_distribution: [
        { name: 'Approved', value: 18 },
        { name: 'Under Review', value: 4 },
        { name: 'Needs Evidence', value: 2 }
      ],
      claims_over_time: [
        { name: 'Jun', value: 5 },
        { name: 'Jul', value: 12 },
        { name: 'Aug', value: 18 },
        { name: 'Sep', value: 24 }
      ],
      prediction_distribution: [
        { name: 'Likely Eligible', value: 16 },
        { name: 'Likely Ineligible', value: 8 }
      ],
      crop_distribution: [
        { name: 'Rice/Paddy', value: 14 },
        { name: 'Wheat', value: 6 },
        { name: 'Maize', value: 3 },
        { name: 'Cotton', value: 1 }
      ],
      region_distribution: [
        { name: 'Karnataka', value: 15 },
        { name: 'Punjab', value: 5 },
        { name: 'Maharashtra', value: 4 }
      ],
      top_model_features: [
        { name: 'Rainfall Deficit', value: 0.38 },
        { name: 'NDVI Vegetation Stress', value: 0.27 },
        { name: 'Historical APY Yield Benchmark', value: 0.19 },
        { name: 'Temperature Anomaly', value: 0.16 }
      ],
      data_quality_summary: {
        total_claims_checked: 24,
        claims_with_warnings: 1,
        total_warnings_detected: 1,
        warning_types: { 'Minor NDVI sensor cloud interference': 1 }
      },
      recent_activity: [
        { id: 1, event_type: 'Assessment Completed', actor: 'AI Engine (Model 1)', details: 'Evaluated claim CLM-2025-001 with 88% confidence', timestamp: '2025-08-01 10:30' },
        { id: 2, event_type: 'Officer Review', actor: 'Senior Assessor R. K. Verma', details: 'Approved CLM-2025-002 with localized calamity override', timestamp: '2025-12-18 14:30' }
      ]
    };
  },

  // Datasets
  getDatasets: async (): Promise<ImportedDataset[]> => [
    {
      id: 1,
      name: 'APY India Agriculture Production & IMD Weather',
      source: 'Ministry of Agriculture & Farmers Welfare (APY) and IMD',
      category: 'crop_production',
      row_count: 310813,
      column_count: 14,
      columns: ['State', 'District', 'Crop', 'Season', 'Area', 'Production', 'Yield', 'Annual_Rainfall', 'Avg_Temp'],
      missing_summary: {},
      quality_summary: {
        total_rows: 310813,
        total_columns: 14,
        duplicate_rows: 0,
        has_target_column: true,
        detected_targets: ['Yield'],
        range_checks: {}
      },
      is_synthetic: false,
      import_status: 'ready',
      created_at: '2025-01-15T08:00:00Z'
    }
  ],

  getDatasetDetails: async (id: number): Promise<ImportedDataset> => ({
    id,
    name: 'APY India Agriculture Production & IMD Weather',
    source: 'Ministry of Agriculture & Farmers Welfare (APY) and IMD',
    category: 'crop_production',
    row_count: 310813,
    column_count: 14,
    columns: ['State', 'District', 'Crop', 'Season', 'Area', 'Production', 'Yield', 'Annual_Rainfall', 'Avg_Temp'],
    missing_summary: {},
    quality_summary: {
      total_rows: 310813,
      total_columns: 14,
      duplicate_rows: 0,
      has_target_column: true,
      detected_targets: ['Yield'],
      range_checks: {}
    },
    is_synthetic: false,
    import_status: 'ready',
    created_at: '2025-01-15T08:00:00Z'
  }),

  loadDemoDataset: async () => ({
    message: 'Demo dataset loaded successfully',
    dataset_id: 1,
    dataset_name: 'APY India Agriculture Production',
    rows_generated: 150,
    demo_claims_created: 2,
    provenance: 'IMD & MoA&FW APY Benchmark'
  }),

  // Models
  getModels: async (): Promise<TrainedModel[]> => [
    {
      id: 1,
      model_name: 'Claim Eligibility Classifier',
      model_version: 'v1.0.0',
      algorithm: 'Random Forest Classifier',
      task_type: 'classification',
      target_column: 'claim_approved',
      features_used: 'rainfall_deficit, ndvi_vegetation_stress, temperature_anomaly, cultivated_area',
      metrics_json: JSON.stringify({ accuracy: 0.912, f1_score: 0.895 }),
      is_synthetic_trained: true,
      is_active: true,
      created_at: '2025-01-15T10:00:00Z'
    },
    {
      id: 2,
      model_name: 'Agricultural Crop Yield Predictor',
      model_version: 'v2.cdff65',
      algorithm: 'Dual Random Forest Regressor & Classifier',
      task_type: 'regression',
      target_column: 'Yield_Tonnes_Per_Ha',
      features_used: 'Crop, Season, State, District, Area, Annual_Rainfall, Avg_Temp',
      metrics_json: JSON.stringify({ r2_score: 0.9136, mae: 1.1245, rmse: 3.8412 }),
      is_synthetic_trained: false,
      is_active: false,
      created_at: '2025-02-10T12:00:00Z'
    }
  ],

  getModel: async (id: number): Promise<TrainedModel> => {
    const models = await demoFallback.getModels();
    return models.find(m => m.id === id) || models[0];
  },

  activateModel: async (id: number) => ({
    message: `Model ${id} is ready.`
  }),

  getGlobalExplanations: async (modelId: number) => ({
    model_id: modelId,
    model_name: modelId === 2 ? 'Agricultural Crop Yield & Insurance Indication Engine' : 'Claim Eligibility Classifier',
    model_version: modelId === 2 ? 'v2.cdff65' : 'v1.0.0',
    evaluation_sample_size: 500,
    summary_description: 'Global SHAP feature importance calculated across verified cross-validation samples.',
    feature_importance: [
      { feature: 'Annual_Rainfall', name: 'Annual & Monsoon Rainfall', importance: 0.384 },
      { feature: 'Crop_Type', name: 'Crop Historical Baseline', importance: 0.282 },
      { feature: 'Avg_Temp', name: 'Growing Season Temperature', importance: 0.178 },
      { feature: 'Cultivated_Area', name: 'Cultivated Land Area', importance: 0.106 },
      { feature: 'State_District', name: 'Geographic Agro-Climatic Zone', importance: 0.050 }
    ]
  }),

  // APY Yield Predictor
  getCropYieldOptions: async (): Promise<AgriculturalYieldOptions> => {
    return {
      states: [
        'Karnataka', 'Punjab', 'Maharashtra', 'Rajasthan', 'Uttar Pradesh',
        'Madhya Pradesh', 'Haryana', 'Andhra Pradesh', 'Gujarat', 'Tamil Nadu',
        'West Bengal', 'Bihar', 'Odisha', 'Kerala'
      ],
      districts_by_state: {
        'Karnataka': ['Dharwad', 'Belagavi', 'Vijayapura', 'Bagalkote', 'Kalaburagi', 'Ballari', 'Shivamogga', 'Mysuru'],
        'Punjab': ['Ludhiana', 'Amritsar', 'Patiala', 'Jalandhar', 'Bathinda', 'Sangrur', 'Ferozepur'],
        'Maharashtra': ['Kolhapur', 'Pune', 'Nashik', 'Nagpur', 'Aurangabad', 'Solapur', 'Satara', 'Ahmednagar'],
        'Rajasthan': ['Barmer', 'Jodhpur', 'Bikaner', 'Jaipur', 'Kota', 'Udaipur', 'Alwar', 'Sriganganagar'],
        'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Meerut', 'Prayagraj', 'Bareilly']
      },
      crops: [
        { crop_name: 'Rice', historical_median_yield: 2.45, shortfall_threshold: 1.72, unit: 'Tonnes/Ha' },
        { crop_name: 'Wheat', historical_median_yield: 3.10, shortfall_threshold: 2.17, unit: 'Tonnes/Ha' },
        { crop_name: 'Maize', historical_median_yield: 2.80, shortfall_threshold: 1.96, unit: 'Tonnes/Ha' },
        { crop_name: 'Sugarcane', historical_median_yield: 68.50, shortfall_threshold: 47.95, unit: 'Tonnes/Ha' },
        { crop_name: 'Cotton', historical_median_yield: 1.45, shortfall_threshold: 1.02, unit: 'Tonnes/Ha' },
        { crop_name: 'Soybean', historical_median_yield: 1.35, shortfall_threshold: 0.95, unit: 'Tonnes/Ha' },
        { crop_name: 'Bajra', historical_median_yield: 1.15, shortfall_threshold: 0.81, unit: 'Tonnes/Ha' },
        { crop_name: 'Gram', historical_median_yield: 0.95, shortfall_threshold: 0.67, unit: 'Tonnes/Ha' }
      ],
      seasons: ['Kharif', 'Rabi', 'Whole Year', 'Summer', 'Autumn', 'Winter'],
      model_metadata: {
        model_id: 2,
        model_name: 'Agricultural Crop Yield & Insurance Indication Engine (APY-IMD-v2)',
        model_version: 'v2.cdff65',
        algorithm: 'Dual Random Forest Regressor & Classifier',
        task_type: 'regression',
        target: 'Yield_Tonnes_Per_Ha',
        dataset_name: 'APY India Agriculture Production (1997-2020) + IMD Weather',
        training_records: 310813,
        r2_score: 0.9136,
        mae: 1.1245,
        rmse: 3.8412,
        is_active: false,
        regression_metrics: {
          random_split_r2: 0.9136,
          random_split_mae: 1.1245,
          random_split_rmse: 3.8412,
          temporal_split_r2: 0.8400,
          temporal_split_mae: 1.4520,
          temporal_split_rmse: 4.6200
        },
        classification_metrics: {
          temporal_accuracy: 0.8850,
          temporal_precision: 0.8720,
          temporal_recall: 0.8800,
          temporal_f1: 0.8748,
          random_accuracy: 0.9310,
          random_f1: 0.9240
        }
      },
      district_defaults: {
        'Karnataka|Dharwad': { Annual_Rainfall: 820.0, Avg_Temp: 26.5, Fertilizer_per_ha: 140.0, Pesticide_per_ha: 0.45 },
        'Punjab|Ludhiana': { Annual_Rainfall: 710.0, Avg_Temp: 24.0, Fertilizer_per_ha: 215.0, Pesticide_per_ha: 0.85 },
        'Maharashtra|Kolhapur': { Annual_Rainfall: 1150.0, Avg_Temp: 27.0, Fertilizer_per_ha: 180.0, Pesticide_per_ha: 0.55 },
        'Rajasthan|Barmer': { Annual_Rainfall: 280.0, Avg_Temp: 32.0, Fertilizer_per_ha: 35.0, Pesticide_per_ha: 0.08 }
      }
    };
  },

  predictCropYield: async (req: AgriculturalYieldRequest): Promise<AgriculturalYieldResponse> => {
    const area = req.area || 2.5;
    const crop = req.crop || 'Rice';
    const rain = req.annual_rainfall || 820;
    const temp = req.avg_temperature || 26.5;

    const medians: Record<string, number> = {
      'Rice': 2.45,
      'Wheat': 3.10,
      'Maize': 2.80,
      'Sugarcane': 68.50,
      'Cotton': 1.45,
      'Soybean': 1.35,
      'Bajra': 1.15,
      'Gram': 0.95
    };
    const median = medians[crop] || 2.20;
    const threshold = Number((median * 0.70).toFixed(2));

    let factor = 1.0;
    if (rain < 400) factor *= 0.65;
    else if (rain < 600) factor *= 0.82;
    else if (rain > 1400) factor *= 1.05;

    if (temp > 33) factor *= 0.85;

    const predictedYield = Number((median * factor).toFixed(2));
    const totalProd = Number((predictedYield * area).toFixed(2));
    const quintalsPerAcre = Number((predictedYield * 4.047).toFixed(2));
    const totalQuintals = Number((totalProd * 10).toFixed(1));

    const isShortfall = predictedYield < threshold;
    const shortfallPct = isShortfall ? Math.round(((median - predictedYield) / median) * 100) : 0;

    const eligibility = isShortfall
      ? 'Likely Eligible for Insurance Claim'
      : 'Likely Not Eligible for Insurance Claim';

    const supportingReasons = isShortfall
      ? [
          `Predicted yield of ${predictedYield} T/Ha is ${shortfallPct}% below historical median (${median} T/Ha)`,
          rain < 600 ? `Annual precipitation of ${rain} mm indicates seasonal moisture deficit` : `Yield shortfall below the 70% statutory threshold (${threshold} T/Ha)`
        ]
      : [];

    const opposingReasons = !isShortfall
      ? [
          `Predicted yield of ${predictedYield} T/Ha exceeds the shortfall threshold (${threshold} T/Ha)`,
          `Precipitation of ${rain} mm and temperature of ${temp}°C support normal vegetative canopy`
        ]
      : [];

    const neutralReasons = [
      `Cultivated area evaluated: ${area} Hectares`,
      `Standard regional agronomic inputs modeled for ${req.season || 'Kharif'} season`
    ];

    const shapContributions = [
      {
        feature: 'Annual_Rainfall',
        label: 'Monsoon Rainfall',
        input_value: `${rain} mm`,
        shap_value: rain < 600 ? -0.42 : 0.18,
        direction: (rain < 600 ? 'negative' : 'positive') as any,
        impact_description: rain < 600 ? 'Severe deficit in precipitation significantly reduced predicted harvest' : 'Adequate seasonal precipitation supported normal yield'
      },
      {
        feature: 'Crop_Type',
        label: 'Crop Baseline',
        input_value: crop,
        shap_value: 0.12,
        direction: 'positive' as any,
        impact_description: `Historical 30-year APY benchmark for ${crop}`
      },
      {
        feature: 'Cultivated_Area',
        label: 'Farm Area Scale',
        input_value: `${area} Ha`,
        shap_value: 0.04,
        direction: 'positive' as any,
        impact_description: 'Cultivation landholding area scaling'
      },
      {
        feature: 'Avg_Temp',
        label: 'Surface Temperature',
        input_value: `${temp} °C`,
        shap_value: temp > 32 ? -0.21 : 0.05,
        direction: (temp > 32 ? 'negative' : 'positive') as any,
        impact_description: temp > 32 ? 'Elevated temperature induced crop thermal stress' : 'Normal thermal range'
      }
    ];

    return {
      predicted_yield_tonnes_per_ha: predictedYield,
      predicted_total_production_tonnes: totalProd,
      cultivated_area_ha: area,
      unit_yield: 'Tonnes per Hectare',
      unit_production: 'Tonnes',
      predicted_yield_quintals_per_acre: quintalsPerAcre,
      predicted_total_quintals: totalQuintals,
      yield_classification: isShortfall ? 'NO' : 'YES',
      yield_classification_label: isShortfall ? 'Crop Shortfall Expected' : 'Normal Harvest Expected',
      classification_probability: 0.86,
      crop_historical_median_yield: median,
      crop_yield_threshold: threshold,
      shortfall_percentage: shortfallPct,
      predicted_insurance_eligibility: eligibility,
      insurance_indication: isShortfall ? 'Likely Eligible for Insurance Claim' : 'Likely Not Eligible for Insurance Claim',
      insurance_indication_detail: isShortfall
        ? `The predicted crop yield of ${predictedYield} T/Ha is ${shortfallPct}% below historical median (${median} T/Ha), which breaches the statutory 70% threshold. You are likely eligible to apply for compensation.`
        : `The predicted crop yield of ${predictedYield} T/Ha exceeds the minimum shortfall threshold of ${threshold} T/Ha. Under normal weather conditions, significant crop loss compensation is unlikely.`,
      reasons_supporting_claim: supportingReasons,
      reasons_against_claim: opposingReasons,
      neutral_factors: neutralReasons,
      shap_explanation: {
        base_value: median,
        feature_contributions: shapContributions,
        top_positive_features: ['Crop_Type'],
        top_negative_features: rain < 600 ? ['Annual_Rainfall'] : [],
        neutral_features: ['Cultivated_Area'],
        plain_text_summary: `Predicted yield: ${predictedYield} Tonnes/Ha. Main drivers: ${rain < 600 ? 'precipitation deficit' : 'favorable moisture and canopy growth'}.`
      },
      farmer_friendly_explanation: `For your ${crop} crop on ${area} hectares in ${req.district}, ${req.state}, the AI engine predicts an expected harvest yield of ${predictedYield} Tonnes/Ha (about ${quintalsPerAcre} Quintals per Acre). Total production is estimated at ${totalProd} Tonnes. ${isShortfall ? `Because of deficit rainfall, this is ${shortfallPct}% lower than the historical baseline (${median} T/Ha), making this crop Likely Eligible for PMFBY compensation.` : `Conditions are favorable, and expected output exceeds the loss threshold (${threshold} T/Ha).`}`,
      environmental_inputs: {
        annual_rainfall_mm: rain,
        annual_rainfall_provenance: 'IMD Meteorological / User observation',
        avg_temperature_c: temp,
        avg_temperature_provenance: 'District agro-climatic normal',
        fertilizer_kg_per_ha: 140,
        fertilizer_provenance: 'State Agricultural Dept normal',
        pesticide_kg_per_ha: 0.45,
        pesticide_provenance: 'State Agricultural Dept normal'
      },
      baseline_mean_yield: median,
      difference_from_baseline: Number((predictedYield - median).toFixed(2)),
      model_info: {
        model_id: 2,
        model_name: 'Agricultural Crop Yield & Insurance Indication Engine',
        model_version: 'v2.cdff65',
        algorithm: 'Dual Random Forest',
        task_type: 'Regression & Threshold Classification',
        dataset_name: 'APY Harmonized (1997-2020) + IMD Weather',
        r2_score: 0.9136,
        is_active: false
      },
      disclaimer: 'This estimation is based on historical agricultural and meteorological datasets. It does not represent an official insurance settlement decision.',
      warnings: []
    };
  },

  // Claims
  getClaims: async (): Promise<{ items: Claim[]; total: number; skip: number; limit: number }> => {
    const claims = getStoredClaims();
    return { items: claims, total: claims.length, skip: 0, limit: 100 };
  },

  getClaim: async (id: number): Promise<Claim> => {
    const claims = getStoredClaims();
    const found = claims.find(c => c.id === id);
    if (found) return found;
    return claims[0];
  },

  createClaim: async (data: Partial<Claim>): Promise<Claim> => {
    const claims = getStoredClaims();
    const newId = claims.length > 0 ? Math.max(...claims.map(c => c.id)) + 1 : 1;
    const ref = `CLM-2025-00${newId}`;

    const isLoss = (data.reported_loss_pct || 50) > 30;
    const area = data.cultivated_area || 2.5;

    const newClaim: Claim = {
      id: newId,
      claim_reference: ref,
      farmer_name: data.farmer_name || 'Ramesh Patil',
      contact_number: data.contact_number || '9876543210',
      policy_reference: data.policy_reference || `PMFBY-2025-${newId}`,
      insurance_scheme: data.insurance_scheme || 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
      sum_insured: data.sum_insured || 60000,
      state: data.state || 'Karnataka',
      district: data.district || 'Dharwad',
      village: data.village || 'Navalgund',
      crop_type: data.crop_type || 'Rice/Paddy',
      season: data.season || 'Kharif',
      sowing_date: data.sowing_date || '2025-06-20',
      claim_start_date: data.claim_start_date || '2025-07-20',
      claim_end_date: data.claim_end_date || '2025-11-20',
      reported_loss_pct: data.reported_loss_pct || 50,
      loss_description: data.loss_description || 'Deficit rainfall during tillering stage.',
      cultivated_area: area,
      observed_rainfall: data.observed_rainfall || 320,
      reference_rainfall: data.reference_rainfall || 850,
      soil_moisture: data.soil_moisture || 22,
      observed_temperature: data.observed_temperature || 33.5,
      reference_temperature: data.reference_temperature || 29.5,
      current_ndvi: data.current_ndvi || 0.32,
      reference_ndvi: data.reference_ndvi || 0.60,
      status: 'Submitted',
      workflow_stage: 'Submitted / Under Officer Review',
      data_quality_flags: '[]',
      is_demo_record: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ai_assessment: {
        predicted_eligibility: isLoss ? 'Likely Eligible for Insurance Claim' : 'Likely Not Eligible for Insurance Claim',
        prediction_label: isLoss ? 'Eligible' : 'Not Eligible',
        prediction_probability: isLoss ? 0.85 : 0.25,
        confidence_percentage: isLoss ? 85 : 75,
        predicted_yield: isLoss ? 1.75 : 3.20,
        predicted_yield_display: isLoss ? '1.75 Tonnes/Ha (~7.08 Quintals/Acre)' : '3.20 Tonnes/Ha (~12.95 Quintals/Acre)',
        reference_yield: 3.20,
        reference_yield_display: '3.20 Tonnes/Ha (30-yr benchmark)',
        reasons_supporting: isLoss ? [
          `Reported crop loss of ${data.reported_loss_pct}% breaches the 30% statutory threshold`,
          `Seasonal rainfall deficit confirms moisture deficit`,
          `Satellite NDVI vegetation index shows vegetative stress`
        ] : [],
        reasons_against: !isLoss ? [
          'Reported loss is within normal seasonal yield threshold',
          'Monsoon rainfall and vegetative conditions are near historical normal'
        ] : [],
        neutral_factors: [
          `Cultivated area: ${area} Ha`,
          `Season: ${data.season || 'Kharif'}`
        ],
        farmer_friendly_summary: `Your claim application for ${data.crop_type} on ${area} Ha has been received. Preliminary AI analysis indicates that due to reported crop loss and seasonal weather patterns, your claim is ${isLoss ? 'Likely Eligible' : 'Likely Not Eligible'} for compensation. An authorized officer will inspect the field records for final approval.`,
        assessed_at: new Date().toISOString(),
        model_id: 1
      },
      officer_decision: {
        status: 'Pending',
        is_decided: false,
        decision: 'Awaiting Officer Decision',
        officer_name: 'Dr. Anita Deshmukh',
        officer_role: 'District Agricultural Officer',
        officer_remarks: 'Application under official review by designated assessor.',
        reason_for_decision: 'Ground inspection pending'
      },
      comparison: {
        ai_predicted_eligibility: isLoss ? 'Likely Eligible for Insurance Claim' : 'Likely Not Eligible for Insurance Claim',
        ai_predicted_yield_display: isLoss ? '1.75 T/Ha' : '3.20 T/Ha',
        ai_main_reason: isLoss ? 'Reported crop loss and regional precipitation deficit.' : 'Normal weather and vegetative health.',
        officer_final_decision: 'Awaiting Officer Decision',
        officer_verified_yield_display: 'Pending field survey',
        officer_reason: 'Under official assessment.',
        agreement_status: 'Under Review',
        comparison_insight: 'Your claim has been registered and is awaiting officer decision. The AI indication is displayed for transparency.'
      },
      timeline_stages: [
        { stage_number: 1, key: 'submitted', title: 'Claim Submitted', status: 'completed', date: new Date().toISOString().slice(0, 10), description: 'Application registered successfully' },
        { stage_number: 2, key: 'ai_assessed', title: 'AI Assessment Completed', status: 'completed', date: new Date().toISOString().slice(0, 10), description: 'Preliminary AI evaluation completed' },
        { stage_number: 3, key: 'officer_review', title: 'Officer Review', status: 'in_progress', date: 'In Progress', description: 'Assessor inspecting evidence' },
        { stage_number: 4, key: 'verification', title: 'Verification', status: 'pending', date: 'Pending', description: 'Field crop-cutting loss verification' },
        { stage_number: 5, key: 'final_decision', title: 'Final Decision', status: 'pending', date: 'Pending', description: 'Official statutory approval / settlement' }
      ]
    };

    claims.unshift(newClaim);
    saveStoredClaims(claims);
    return newClaim;
  },

  updateClaim: async (id: number, data: Partial<Claim>): Promise<Claim> => {
    const claims = getStoredClaims();
    const idx = claims.findIndex(c => c.id === id);
    if (idx !== -1) {
      claims[idx] = { ...claims[idx], ...data, updated_at: new Date().toISOString() };
      saveStoredClaims(claims);
      return claims[idx];
    }
    return claims[0];
  },

  deleteClaim: async (id: number) => {
    const claims = getStoredClaims();
    const filtered = claims.filter(c => c.id !== id);
    saveStoredClaims(filtered);
    return { message: `Claim ${id} deleted` };
  },

  // Assessments
  runAssessment: async (claimId: number, modelId?: number): Promise<ClaimAssessment> => {
    const claim = await demoFallback.getClaim(claimId);
    return {
      id: claimId,
      claim_id: claimId,
      claim_reference: claim.claim_reference,
      model_id: modelId || 1,
      model_name: 'Claim Eligibility Classifier (Demonstration)',
      model_version: 'v1.0.0',
      prediction_label: claim.ai_assessment?.prediction_label || 'Eligible',
      prediction_probability: claim.ai_assessment?.prediction_probability || 0.85,
      payout_estimate: Math.round((claim.sum_insured || 60000) * ((claim.reported_loss_pct || 50) / 100)),
      base_value: 0.5,
      shap_contributions: [
        { feature: 'rainfall_deficit', feature_name_display: 'Rainfall Deficit', observed_value: '540 mm shortfall', shap_value: 0.38, direction: 'positive', interpretation: 'Severe shortfall increased eligibility' },
        { feature: 'ndvi_vegetation_stress', feature_name_display: 'NDVI Vegetation Stress', observed_value: '0.28 vs 0.58 baseline', shap_value: 0.27, direction: 'positive', interpretation: 'Low vegetation canopy corroborates crop loss' }
      ],
      farmer_friendly_summary: claim.ai_assessment?.farmer_friendly_summary || 'Claim likely eligible due to moisture deficits.',
      data_quality_status: 'VALID',
      data_quality_warnings: [],
      assessed_at: new Date().toISOString()
    };
  },

  getAssessment: async (claimId: number): Promise<ClaimAssessment> => {
    return demoFallback.runAssessment(claimId);
  },

  getStatutoryRules: async (claimId: number): Promise<PMFBYRuleAssessmentResult> => {
    const claim = await demoFallback.getClaim(claimId);
    return {
      loss_category: 'Mid-Season Adversity / Severe Deficit Rainfall',
      loss_category_description: 'Adverse seasonal conditions leading to expected yield shortfall >50% compared to normal benchmark.',
      reported_peril: claim.loss_description || 'Severe deficit monsoon rainfall',
      is_peril_consistent: true,
      peril_consistency_notes: 'Drought and seasonal deficit rainfall are notified perils under PMFBY Operational Guidelines Section 4.1.',
      preliminary_triage: 'Eligible for On-Field Joint Loss Assessment',
      triage_summary: 'Notified coverage record verified. Notification within statutory 72-hour window. Field inspection required.',
      checks: [
        { check_id: 'RULE-01', title: 'Notified Crop & Insurance Coverage', status: 'Passed', details: `${claim.crop_type} is notified for Kharif season in ${claim.district}, ${claim.state}.`, evidence_used: 'State Government Kharif PMFBY Notification', rule_reference: 'PMFBY Sec 2.1' },
        { check_id: 'RULE-02', title: 'Loss Intimation Window Check', status: 'Passed', details: 'Notification recorded within statutory 72 hours of damage event.', evidence_used: 'Claim timestamp and farmer log', rule_reference: 'PMFBY Sec 6.3' },
        { check_id: 'RULE-03', title: 'Loss Severity Threshold (>=33%)', status: 'Passed', details: `Reported crop loss of ${claim.reported_loss_pct}% exceeds minimum 33% threshold.`, evidence_used: 'Farmer application self-declaration', rule_reference: 'PMFBY Sec 4.2' },
        { check_id: 'RULE-04', title: 'Post-Harvest Spreading & Drying Window', status: 'Not Applicable', details: 'Claim reported for standing crop; post-harvest 14-day rule does not apply.', evidence_used: 'Standing crop stage confirmation', rule_reference: 'PMFBY Sec 4.4' }
      ],
      evidence_checklist: [
        { document_or_evidence: 'Land Record (RoR / Pahani)', required_for: 'Acreage validation', status: 'Verified', guidance: 'Aadhaar-linked land record confirmed.' },
        { document_or_evidence: 'Crop Cutting Experiment (CCE) Yield Report', required_for: 'Final indemnity calculation', status: 'Needs Physical Inspection', guidance: 'Block Agriculture Officer and revenue inspector must conduct joint survey.' },
        { document_or_evidence: 'Geotagged Photo of Damaged Field', required_for: 'Crop loss verification', status: 'Verified', guidance: 'Photo uploaded showing vegetative moisture stress.' }
      ],
      applicable_deadline_hours: 72,
      elapsed_hours_to_notification: 36,
      disclaimer: 'This statutory triage represents preliminary operational guidelines verification. Final indemnity depends on official CCE harvest data.',
      assessed_at: new Date().toISOString()
    };
  },

  // Reviews
  recordReview: async (claimId: number, data: any): Promise<HumanReview> => {
    const claims = getStoredClaims();
    const idx = claims.findIndex(c => c.id === claimId);
    if (idx !== -1) {
      const c = claims[idx];
      const decision = data.review_decision || data.decision || 'Approved';
      c.status = decision === 'Approved' ? 'Approved' : (decision === 'Rejected' ? 'Rejected' : 'Additional evidence required');
      c.workflow_stage = decision === 'Approved' || decision === 'Rejected' ? 'Final Decision Completed' : 'Verification in Progress';
      c.verified_crop_loss = data.verified_crop_loss;
      c.observed_yield = data.verified_crop_yield;
      c.officer_notes = data.rationale;

      c.officer_decision = {
        status: decision,
        is_decided: true,
        decision: decision,
        officer_name: data.reviewer_name || 'Senior Assessor R. K. Verma',
        officer_role: data.reviewer_role || 'Claim Assessor',
        officer_remarks: data.rationale,
        reason_for_decision: data.rationale,
        verified_crop_loss: data.verified_crop_loss,
        verified_crop_loss_display: data.verified_crop_loss ? `${data.verified_crop_loss}%` : undefined,
        verified_crop_yield: data.verified_crop_yield,
        verified_crop_yield_display: data.verified_crop_yield ? `${data.verified_crop_yield} T/Ha` : undefined,
        required_evidence: data.required_evidence,
        differs_from_model: Boolean(data.differs_from_model),
        decision_date: new Date().toISOString()
      };

      if (c.comparison) {
        c.comparison.officer_final_decision = decision;
        c.comparison.officer_reason = data.rationale;
        c.comparison.officer_verified_yield_display = data.verified_crop_loss ? `${data.verified_crop_loss}% Loss` : 'Field Verified';
        c.comparison.agreement_status = data.differs_from_model ? 'Officer Manual Override' : 'Concurred';
        c.comparison.comparison_insight = data.differs_from_model
          ? `The authorized officer recorded a manual override based on physical field inspection: "${data.rationale}".`
          : `The authorized officer confirmed the AI preliminary assessment after reviewing field evidence.`;
      }

      if (c.timeline_stages) {
        c.timeline_stages[2].status = 'completed';
        c.timeline_stages[3].status = decision === 'Additional evidence required' ? 'in_progress' : 'completed';
        c.timeline_stages[4].status = decision === 'Approved' || decision === 'Rejected' ? 'completed' : 'pending';
        c.timeline_stages[4].description = decision;
      }

      claims[idx] = c;
      saveStoredClaims(claims);
    }

    return {
      id: Date.now(),
      claim_id: claimId,
      reviewer_name: data.reviewer_name || 'Senior Assessor R. K. Verma',
      reviewer_role: data.reviewer_role || 'Claim Assessor',
      review_decision: data.review_decision || data.decision || 'Approved',
      differs_from_model: Boolean(data.differs_from_model),
      rationale: data.rationale || '',
      required_evidence: data.required_evidence,
      reviewed_at: new Date().toISOString()
    };
  },

  getClaimReviews: async (claimId: number): Promise<HumanReview[]> => {
    const claim = await demoFallback.getClaim(claimId);
    if (claim.officer_decision && claim.officer_decision.is_decided) {
      return [{
        id: claimId * 10,
        claim_id: claimId,
        reviewer_name: claim.officer_decision.officer_name || 'Senior Assessor R. K. Verma',
        reviewer_role: claim.officer_decision.officer_role || 'Claim Assessor',
        review_decision: claim.officer_decision.decision,
        differs_from_model: Boolean(claim.officer_decision.differs_from_model),
        rationale: claim.officer_decision.officer_remarks || claim.officer_decision.reason_for_decision || '',
        required_evidence: claim.officer_decision.required_evidence,
        reviewed_at: claim.officer_decision.decision_date || claim.updated_at || new Date().toISOString()
      }];
    }
    return [];
  },

  getClaimAudit: async (claimId: number): Promise<AuditEvent[]> => [
    { id: 1, claim_id: claimId, event_type: 'Claim Registered', actor: 'Farmer Ramesh Patil', details: 'Application submitted via Farmer Portal', timestamp: '2025-08-01 10:30' },
    { id: 2, claim_id: claimId, event_type: 'Preliminary AI Assessment', actor: 'Model ID 1 (Classifier)', details: 'AI predicted Likely Eligible (88% confidence)', timestamp: '2025-08-01 10:30' },
    { id: 3, claim_id: claimId, event_type: 'Statutory Verification', actor: 'PMFBY Rule Engine', details: 'Notified coverage and 72-hour window passed', timestamp: '2025-08-01 10:31' }
  ],

  getAllAudit: async (): Promise<AuditEvent[]> => [
    { id: 1, claim_id: 1, event_type: 'Claim Registered', actor: 'Farmer Ramesh Patil', details: 'CLM-2025-001 submitted', timestamp: '2025-08-01 10:30' },
    { id: 2, claim_id: 1, event_type: 'Preliminary AI Assessment', actor: 'Model ID 1', details: 'Predicted Likely Eligible', timestamp: '2025-08-01 10:30' },
    { id: 3, claim_id: 2, event_type: 'Officer Review', actor: 'Assessor R. K. Verma', details: 'CLM-2025-002 Approved (Override)', timestamp: '2025-12-18 14:30' }
  ],

  // Authentication
  auth: {
    login: async (username: string) => {
      const user = username.includes('officer')
        ? { id: 2, username: 'officer_verma', full_name: 'Dr. Anita Deshmukh', role: 'officer' as const, preferred_language: 'en-IN', state: 'Karnataka', district: 'Dharwad' }
        : { id: 1, username: 'farmer_ramesh', full_name: 'Ramesh Patil', role: 'farmer' as const, preferred_language: 'kn-IN', state: 'Karnataka', district: 'Dharwad' };
      return {
        access_token: 'demo-jwt-token',
        token_type: 'bearer',
        user
      };
    },

    getMe: async (): Promise<UserProfile> => ({
      id: 1,
      username: 'farmer_ramesh',
      full_name: 'Ramesh Patil',
      role: 'farmer',
      preferred_language: 'kn-IN',
      state: 'Karnataka',
      district: 'Dharwad',
      village: 'Navalgund',
      phone_number: '9876543210'
    }),

    demoSwitch: async (username: string): Promise<AuthLoginResponse> => {
      const isOfficer = username.includes('officer');
      const user: UserProfile = isOfficer
        ? { id: 2, username: 'officer_verma', full_name: 'Dr. Anita Deshmukh', role: 'officer', preferred_language: 'en-IN', state: 'Karnataka', district: 'Dharwad' }
        : { id: 1, username: 'farmer_ramesh', full_name: 'Ramesh Patil', role: 'farmer', preferred_language: 'kn-IN', state: 'Karnataka', district: 'Dharwad', village: 'Navalgund', phone_number: '9876543210' };
      return {
        access_token: 'demo-jwt-token',
        token_type: 'bearer',
        user
      };
    },

    getDemoUsers: async (): Promise<UserProfile[]> => [
      { id: 1, username: 'farmer_ramesh', full_name: 'Ramesh Patil (Farmer)', role: 'farmer', preferred_language: 'kn-IN', state: 'Karnataka', district: 'Dharwad', village: 'Navalgund' },
      { id: 2, username: 'officer_verma', full_name: 'Dr. Anita Deshmukh (Officer)', role: 'officer', preferred_language: 'en-IN', state: 'Karnataka', district: 'Dharwad' }
    ],

    setLanguage: async (code: string) => ({ status: 'success', language_code: code })
  },

  // Farmer Portal
  farmer: {
    getProfile: async (): Promise<UserProfile> => ({
      id: 1,
      username: 'farmer_ramesh',
      full_name: 'Ramesh Patil',
      role: 'farmer',
      preferred_language: 'kn-IN',
      state: 'Karnataka',
      district: 'Dharwad',
      village: 'Navalgund',
      phone_number: '9876543210'
    }),

    getMyClaims: async (): Promise<FarmerClaimSummary[]> => {
      const claims = getStoredClaims();
      return claims.map(c => ({
        id: c.id,
        claim_reference: c.claim_reference,
        crop_type: c.crop_type,
        season: c.season,
        cultivated_area: c.cultivated_area,
        reported_loss_pct: c.reported_loss_pct,
        status: c.status,
        workflow_stage: c.workflow_stage || 'Under Officer Review',
        sowing_date: c.sowing_date,
        created_at: c.created_at || '2025-08-01'
      }));
    },

    getMyClaimDetails: async (claimId: number): Promise<FarmerClaimDetails> => {
      const c = await demoFallback.getClaim(claimId);
      return {
        id: c.id,
        claim_reference: c.claim_reference,
        farmer_name: c.farmer_name,
        crop_name: c.crop_type,
        crop_type: c.crop_type,
        village: c.village || 'Navalgund',
        district: c.district,
        state: c.state,
        land_area_hectares: c.cultivated_area,
        land_area_acres: Number((c.cultivated_area * 2.471).toFixed(1)),
        season_year: `${c.season} 2025`,
        policy_number: c.policy_reference,
        claim_application_number: c.claim_reference,
        date_of_application: c.created_at ? c.created_at.slice(0, 10) : '2025-08-01',
        reported_crop_damage: `${c.reported_loss_pct}% loss due to deficit monsoon rainfall`,
        status: c.status,
        workflow_stage: c.workflow_stage || 'Under Officer Review',
        missing_documents: [],
        uploaded_documents: [
          { doc_type: 'Aadhaar Card', name: 'aadhaar_card.pdf', status: 'Verified', upload_date: '2025-08-01' },
          { doc_type: 'Land Record (Pahani)', name: 'land_record.pdf', status: 'Verified', upload_date: '2025-08-01' },
          { doc_type: 'Sowing Certificate', name: 'sowing_certificate.pdf', status: 'Verified', upload_date: '2025-08-01' }
        ],
        next_expected_action: c.status === 'Approved' ? 'Indemnity bank transfer in progress' : 'Joint field verification by block assessor',
        payment_status: c.status === 'Approved' ? 'Processing' : 'Pending Review',
        payment_amount: c.status === 'Approved' ? Math.round((c.sum_insured || 60000) * ((c.verified_crop_loss || 45) / 100)) : undefined
      };
    },

    getTimeline: async (claimId: number): Promise<TimelineResponse> => {
      const c = await demoFallback.getClaim(claimId);
      return {
        claim_reference: c.claim_reference,
        current_stage: c.workflow_stage || 'Under Officer Review',
        last_status_update: '2025-08-01',
        stages: [
          { stage: '1', title: 'Application Submitted', status: 'completed', date: '2025-08-01', note: 'Claim registered with initial farm documents' },
          { stage: '2', title: 'Preliminary AI Assessment', status: 'completed', date: '2025-08-01', note: 'AI evaluation completed' },
          { stage: '3', title: 'Officer Field Review', status: c.status === 'Approved' || c.status === 'Rejected' ? 'completed' : 'in_progress', date: '2025-08-05', note: 'Agricultural assessor verifying weather and field data' },
          { stage: '4', title: 'Crop Loss Verification', status: c.status === 'Approved' || c.status === 'Rejected' ? 'completed' : 'pending', date: 'Pending', note: 'Joint loss survey by village patwari and block officer' },
          { stage: '5', title: 'Final Decision & Settlement', status: c.status === 'Approved' || c.status === 'Rejected' ? 'completed' : 'pending', date: c.status === 'Approved' ? '2025-08-15' : 'Pending', note: c.status === 'Approved' ? 'Claim Approved for compensation' : 'Awaiting official approval' }
        ],
        missing_documents: [],
        next_expected_action: c.status === 'Approved' ? 'Direct Benefit Transfer (DBT) credit to bank' : 'Field survey'
      };
    },

    getDamageInfo: async (claimId: number): Promise<DamageInfoResponse> => {
      const c = await demoFallback.getClaim(claimId);
      return {
        claim_reference: c.claim_reference,
        crop_type: c.crop_type,
        farmer_reported: {
          crop_type: c.crop_type,
          reported_loss_pct: `${c.reported_loss_pct}%`,
          date_of_damage: '2025-07-20',
          loss_cause_description: c.loss_description || 'Deficit rainfall during tillering',
          source_type: 'Farmer Declaration'
        },
        external_sources: {
          observed_rainfall: `${c.observed_rainfall} mm`,
          normal_seasonal_rainfall: `${c.reference_rainfall} mm`,
          rainfall_deficit: `${Math.round(((c.reference_rainfall - c.observed_rainfall) / c.reference_rainfall) * 100)}% Deficit`,
          observed_temperature: `${c.observed_temperature} °C`,
          temperature_anomaly: '+4.0 °C above normal',
          source_type: 'IMD Meteorological Weather Station'
        },
        ai_estimated: {
          satellite_ndvi_vegetation_drop: `${Math.round(((c.reference_ndvi - c.current_ndvi) / c.reference_ndvi) * 100)}% Canopy Reduction`,
          ai_pattern_resemblance: 'High resemblance to 2018 regional drought cluster',
          ai_certainty: `${c.ai_assessment?.confidence_percentage || 88}% Certainty`,
          source_type: 'Sentinel-2 Satellite & AI Model 1'
        },
        officer_verified: {
          status: c.officer_decision?.status || 'Pending',
          officer_verified_crop_loss: c.officer_decision?.verified_crop_loss_display || (c.status === 'Approved' ? '45%' : 'Pending'),
          officer_decision: c.officer_decision?.decision || 'Awaiting Officer Review',
          officer_name: c.officer_decision?.officer_name || 'Dr. Anita Deshmukh',
          field_survey_notes: c.officer_decision?.officer_remarks || 'Inspection in progress',
          source_type: 'Department of Agriculture Field Report'
        }
      };
    },

    getExplanation: async (claimId: number): Promise<FarmerExplanationResponse> => {
      const c = await demoFallback.getClaim(claimId);
      return {
        claim_reference: c.claim_reference,
        crop_type: c.crop_type,
        assessment_label: c.ai_assessment?.predicted_eligibility || 'Likely Eligible for Insurance Claim',
        certainty_pct: c.ai_assessment?.confidence_percentage || 88,
        main_reasons: [
          {
            factor_name: 'Monsoon Rainfall Deficit',
            what_we_know: `Your district recorded ${c.observed_rainfall} mm of rainfall versus the normal ${c.reference_rainfall} mm.`,
            why_it_matters: 'Severe moisture deficit during tillering stage stunts crop vegetative growth and reduces grain filling.',
            influence: 'supports',
            verification_status: 'Confirmed by IMD meteorological data'
          },
          {
            factor_name: 'Satellite Greenness (NDVI)',
            what_we_know: `Satellite vegetation index dropped from ${c.reference_ndvi} to ${c.current_ndvi}.`,
            why_it_matters: 'A significant decline in canopy greenness reflects moisture stress and plant canopy loss.',
            influence: 'supports',
            verification_status: 'Confirmed by Sentinel-2 Earth observation'
          },
          {
            factor_name: 'Cultivated Land Area',
            what_we_know: `${c.cultivated_area} Hectares registered.`,
            why_it_matters: 'Insured area aligns with village land records.',
            influence: 'neutral',
            verification_status: 'Verified against Pahani land records'
          }
        ],
        visual_summary: [
          { factor: 'Rainfall Deficit', status: 'Supports Claim', color: '#10b981' },
          { factor: 'Vegetation Health (NDVI)', status: 'Supports Claim', color: '#10b981' },
          { factor: 'Farm Land Area', status: 'Normal / Neutral', color: '#6b7280' }
        ],
        plain_summary: c.ai_assessment?.farmer_friendly_summary || 'Your claim appears Likely Eligible based on severe weather deficit and satellite vegetation stress.',
        statutory_note: 'This AI indication is for transparency and does not replace official joint survey by the District Agriculture Officer.'
      };
    },

    chatAssistant: async (_claimId: number, message: string): Promise<ChatMessageResponse> => {
      const msg = message.toLowerCase();
      let reply = "Hello! I am your AI Crop Insurance Assistant. You can ask me about your claim status, why a decision was reached, or what documents are needed.";

      if (msg.includes('status') || msg.includes('happening') || msg.includes('progress')) {
        reply = "Your claim CLM-2025-001 has successfully passed preliminary AI assessment with 'Likely Eligible' status based on verified rainfall deficits. It is currently under review by the District Agricultural Officer for field crop-cutting verification.";
      } else if (msg.includes('why') || msg.includes('reason') || msg.includes('eligible')) {
        reply = "The preliminary assessment identified that your farm experienced a 65.9% rainfall deficit (280 mm observed vs 820 mm normal) along with a 51.7% drop in satellite vegetation greenness (NDVI 0.28 vs 0.58). These severe indicators match historical PMFBY drought compensation thresholds.";
      } else if (msg.includes('document') || msg.includes('submit') || msg.includes('missing')) {
        reply = "Your primary documents (Aadhaar, Land Record/Pahani, Sowing Certificate) are already verified. The remaining step is the official joint Crop Cutting Experiment (CCE) field loss report conducted by the local agricultural officer.";
      } else if (msg.includes('next') || msg.includes('action') || msg.includes('what should i do')) {
        reply = "No action is needed from your end right now. The block agriculture surveyor and village patwari will schedule an on-field inspection. You can view progress updates anytime on the 'My Claims' page.";
      }

      return {
        role: 'assistant',
        content: reply,
        suggested_followups: [
          "Why was my claim assessed this way?",
          "When will the officer visit my field?",
          "How is my yield calculated?"
        ],
        claim_reference: 'CLM-2025-001'
      };
    }
  },

  // Officer Portal
  officer: {
    getSummary: async () => ({
      title: 'Agricultural Insurance Assessment Portal',
      officer_name: 'Dr. Anita Deshmukh',
      kpis: {
        total_claims: 24,
        waiting_for_review: 2,
        claims_approved: 18,
        claims_needing_attention: 4
      },
      aggregate_charts: {
        crop_distribution: [
          { crop: 'Rice/Paddy', count: 14 },
          { crop: 'Wheat', count: 6 },
          { crop: 'Maize', count: 3 },
          { crop: 'Cotton', count: 1 }
        ],
        district_distribution: [
          { district: 'Dharwad', count: 15 },
          { district: 'Belagavi', count: 5 },
          { district: 'Vijayapura', count: 4 }
        ],
        label: 'Claims across Karnataka Agro-Climatic Districts'
      },
      notice: 'PMFBY Kharif 2025 joint assessment guidelines in effect.'
    }),

    getClaims: async (filterType: string = 'all') => {
      const claims = getStoredClaims();
      let filtered = claims;
      if (filterType === 'waiting') {
        filtered = claims.filter(c => c.status === 'Submitted' || c.workflow_stage?.includes('Review'));
      } else if (filterType === 'approved') {
        filtered = claims.filter(c => c.status === 'Approved');
      } else if (filterType === 'attention') {
        filtered = claims.filter(c => c.status === 'Additional evidence required' || c.status === 'Rejected');
      }
      return filtered.map(c => ({
        id: c.id,
        claim_reference: c.claim_reference,
        farmer_name: c.farmer_name,
        crop_type: c.crop_type,
        district: c.district,
        state: c.state,
        cultivated_area: c.cultivated_area,
        reported_loss_pct: c.reported_loss_pct,
        verified_crop_loss: c.verified_crop_loss,
        status: c.status,
        workflow_stage: c.workflow_stage || 'Under Officer Review',
        sowing_date: c.sowing_date,
        missing_documents: [],
        created_at: c.created_at
      }));
    },

    recordReview: async (claimId: number, data: any) => {
      await demoFallback.recordReview(claimId, {
        reviewer_name: 'Dr. Anita Deshmukh',
        reviewer_role: 'District Agricultural Officer',
        review_decision: data.decision,
        differs_from_model: Boolean(data.differs_from_model),
        rationale: data.rationale,
        verified_crop_loss: data.verified_crop_loss,
        required_evidence: data.required_evidence
      });
      return {
        status: 'success',
        claim_id: claimId,
        new_status: data.decision,
        workflow_stage: data.decision === 'Approved' ? 'Final Decision Completed' : 'Under Review'
      };
    }
  },

  // Regional
  regional: {
    getLanguages: async () => ({
      languages: [
        { code: 'en-IN', name: 'English', native_name: 'English', is_default: true },
        { code: 'kn-IN', name: 'Kannada', native_name: 'ಕನ್ನಡ', is_priority: true },
        { code: 'hi-IN', name: 'Hindi', native_name: 'हिन्दी' },
        { code: 'ta-IN', name: 'Tamil', native_name: 'தமிழ்' },
        { code: 'te-IN', name: 'Telugu', native_name: 'తెలుగు' },
        { code: 'mr-IN', name: 'Marathi', native_name: 'मराठी' },
        { code: 'ml-IN', name: 'Malayalam', native_name: 'മലയാളം' },
        { code: 'bn-IN', name: 'Bengali', native_name: 'বাংলা' },
        { code: 'gu-IN', name: 'Gujarati', native_name: 'ગુજરાતી' },
        { code: 'pa-IN', name: 'Punjabi', native_name: 'ਪੰਜਾਬੀ' },
        { code: 'od-IN', name: 'Odia', native_name: 'ଓಡ଼ିଆ' }
      ],
      sarvam_api_configured: false,
      default_language: 'en-IN',
      priority_language: 'kn-IN'
    }),

    translate: async (text: string, targetLanguage: string) => ({
      translated_text: text,
      source_lang: 'en-IN',
      target_lang: targetLanguage,
      source: 'offline_client_dictionary'
    }),

    translateBatch: async (texts: string[], targetLanguage: string) => ({
      translations: texts,
      target_lang: targetLanguage,
      source: 'offline_client_dictionary'
    }),

    tts: async (_text: string, _targetLanguage: string = 'kn-IN') => ({
      success: true,
      audios: [],
      format: 'base64',
      message: 'Client-side speech synthesis available via Web Speech API'
    }),

    stt: async (_audioBlob: Blob, _languageCode?: string) => ({
      success: true,
      transcript: 'ನನ್ನ ಬೆಳೆ ವಿಮಾ ಅರ್ಜಿಯ ಪ್ರಗತಿ ಏನು?',
      language_code: _languageCode || 'kn-IN',
      message: 'Demonstration speech recognition transcript'
    })
  },

  // External Agricultural Data Services
  external: {
    fetchWeather: async (payload: {
      state: string;
      district: string;
      start_date: string;
      end_date: string;
      latitude?: number;
      longitude?: number;
    }) => ({
      status: 'SUCCESS',
      is_automatic: true,
      source: 'Open-Meteo ERA5 Historical Agro-Climatic Reanalysis',
      retrieval_date: new Date().toISOString(),
      observation_period: `${payload.start_date} to ${payload.end_date}`,
      resolved_latitude: payload.latitude || 15.4589,
      resolved_longitude: payload.longitude || 75.0078,
      coordinate_source: 'District Headquarters Geolocation',
      data: {
        observed_rainfall: 280,
        reference_rainfall: 820,
        observed_temperature: 33.5,
        reference_temperature: 29.5,
        rainfall_unit: 'mm',
        temperature_unit: '°C'
      }
    }),

    fetchPmfbyReference: async (payload: {
      state: string;
      district: string;
      crop: string;
      season: string;
      year?: number;
    }) => ({
      matched: true,
      source: 'PMFBY Kharif/Rabi Official State Notification Database',
      reference_period: `${payload.season} ${payload.year || 2025}`,
      notified_district: payload.district,
      notified_state: payload.state,
      notified_crop: payload.crop,
      sum_insured_per_ha: 60000,
      actuarial_premium_rate_pct: 12.5,
      farmer_share_pct: 2.0,
      indemnity_level_pct: 70.0,
      insurance_company: 'Agriculture Insurance Company of India (AICIL)',
      disclaimer: 'Notified coverage record verified from official gazette notification.'
    }),

    fetchSatelliteNdvi: async (payload: {
      state: string;
      district: string;
      observation_date: string;
      latitude?: number;
      longitude?: number;
    }) => ({
      status: 'AVAILABLE',
      observation_status: 'Cloud-free observation verified',
      source: 'Copernicus Sentinel-2 10m Multispectral Surface Reflectance',
      check_date: payload.observation_date,
      data: {
        current_ndvi: 0.28,
        reference_ndvi: 0.58
      }
    })
  }
};
