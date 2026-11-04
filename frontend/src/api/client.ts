import {
  Claim,
  ClaimAssessment,
  ImportedDataset,
  TrainedModel,
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
  RegionalLanguage,
  AgriculturalYieldOptions,
  AgriculturalYieldRequest,
  AgriculturalYieldResponse,
  PMFBYRuleAssessmentResult
} from '../types';

const API_BASE = '/api';

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('xai_cropinsure_token');
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Request failed (${res.status} ${res.statusText})`;
    try {
      const errorData = await res.json();
      if (errorData.detail) {
        errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // Ignore json parse error
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // Health
  getHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<{
      status: string;
      project: string;
      version: string;
      database_connected: boolean;
      demo_mode: boolean;
      claims_registered: number;
      models_trained: number;
    }>(res);
  },

  // Dashboard
  getDashboardSummary: async () => {
    const res = await fetch(`${API_BASE}/dashboard/summary`);
    return handleResponse<DashboardSummary>(res);
  },

  getDashboardCharts: async () => {
    const res = await fetch(`${API_BASE}/dashboard/charts`);
    return handleResponse<DashboardCharts>(res);
  },

  // Claims
  getClaims: async (params?: { skip?: number; limit?: number; search?: string; status?: string; crop_type?: string; state?: string }) => {
    const query = new URLSearchParams();
    if (params?.skip !== undefined) query.set('skip', params.skip.toString());
    if (params?.limit !== undefined) query.set('limit', params.limit.toString());
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.crop_type) query.set('crop_type', params.crop_type);
    if (params?.state) query.set('state', params.state);

    const res = await fetch(`${API_BASE}/claims?${query.toString()}`);
    return handleResponse<{ items: Claim[]; total: number; skip: number; limit: number }>(res);
  },

  getClaim: async (id: number) => {
    const res = await fetch(`${API_BASE}/claims/${id}`);
    return handleResponse<Claim>(res);
  },

  createClaim: async (data: Partial<Claim>) => {
    const res = await fetch(`${API_BASE}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Claim>(res);
  },

  updateClaim: async (id: number, data: Partial<Claim>) => {
    const res = await fetch(`${API_BASE}/claims/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Claim>(res);
  },

  deleteClaim: async (id: number) => {
    const res = await fetch(`${API_BASE}/claims/${id}`, { method: 'DELETE' });
    return handleResponse<{ message: string }>(res);
  },

  // Datasets
  getDatasets: async () => {
    const res = await fetch(`${API_BASE}/datasets`);
    return handleResponse<ImportedDataset[]>(res);
  },

  getDatasetDetails: async (id: number) => {
    const res = await fetch(`${API_BASE}/datasets/${id}`);
    return handleResponse<ImportedDataset>(res);
  },

  uploadDataset: async (file: File, name?: string, category?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('dataset_name', name);
    if (category) formData.append('category', category);

    const res = await fetch(`${API_BASE}/datasets/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<any>(res);
  },

  loadDemoDataset: async (samples: number = 150) => {
    const res = await fetch(`${API_BASE}/datasets/demo/load?num_samples=${samples}`, {
      method: 'POST',
    });
    return handleResponse<{ message: string; dataset_id: number; dataset_name: string; rows_generated: number; demo_claims_created: number; provenance: string }>(res);
  },

  getTemplateDownloadUrl: () => `${API_BASE}/datasets/template/download`,

  // Models
  getModels: async () => {
    const res = await fetch(`${API_BASE}/models`);
    return handleResponse<TrainedModel[]>(res);
  },

  getModel: async (id: number) => {
    const res = await fetch(`${API_BASE}/models/${id}`);
    return handleResponse<TrainedModel>(res);
  },

  trainModel: async (params: {
    dataset_id: number;
    task_type: string;
    algorithm: string;
    target_column: string;
    features: string[];
    test_size?: number;
    model_name?: string;
  }) => {
    const res = await fetch(`${API_BASE}/models/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse<TrainedModel>(res);
  },

  activateModel: async (id: number) => {
    const res = await fetch(`${API_BASE}/models/${id}/activate`, {
      method: 'POST',
    });
    return handleResponse<{ message: string }>(res);
  },

  getGlobalExplanations: async (modelId: number) => {
    const res = await fetch(`${API_BASE}/models/${modelId}/explanations/global`);
    return handleResponse<{
      model_id: number;
      model_name: string;
      model_version: string;
      feature_importance: { feature: string; name: string; importance: number }[];
      dataset_name?: string;
      evaluation_sample_size: number;
      summary_description: string;
    }>(res);
  },

  // Agricultural Crop Yield Model (APY-India, Model ID 2)
  getCropYieldOptions: async () => {
    const res = await fetch(`${API_BASE}/models/agricultural-yield/options`);
    return handleResponse<AgriculturalYieldOptions>(res);
  },

  predictCropYield: async (data: AgriculturalYieldRequest) => {
    const res = await fetch(`${API_BASE}/models/agricultural-yield/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<AgriculturalYieldResponse>(res);
  },

  // Assessments
  runAssessment: async (claimId: number, modelId?: number) => {
    const res = await fetch(`${API_BASE}/claims/${claimId}/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId }),
    });
    return handleResponse<ClaimAssessment>(res);
  },

  getAssessment: async (claimId: number) => {
    const res = await fetch(`${API_BASE}/claims/${claimId}/assessment`);
    return handleResponse<ClaimAssessment>(res);
  },

  getStatutoryRules: async (claimId: number) => {
    const res = await fetch(`${API_BASE}/claims/${claimId}/statutory-rules`);
    return handleResponse<PMFBYRuleAssessmentResult>(res);
  },

  // Reviews & Audit
  recordReview: async (claimId: number, data: {
    reviewer_name: string;
    reviewer_role?: string;
    review_decision: string;
    differs_from_model: boolean;
    rationale: string;
    required_evidence?: string;
  }) => {
    const res = await fetch(`${API_BASE}/claims/${claimId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<HumanReview>(res);
  },

  getClaimReviews: async (claimId: number) => {
    const res = await fetch(`${API_BASE}/claims/${claimId}/reviews`);
    return handleResponse<HumanReview[]>(res);
  },

  getClaimAudit: async (claimId: number) => {
    const res = await fetch(`${API_BASE}/claims/${claimId}/audit`);
    return handleResponse<AuditEvent[]>(res);
  },

  getAllAudit: async (limit: number = 100) => {
    const res = await fetch(`${API_BASE}/audit?limit=${limit}`);
    return handleResponse<AuditEvent[]>(res);
  },

  // Reports
  getReportPdfUrl: (claimId: number) => `${API_BASE}/claims/${claimId}/report`,
  getExportCsvUrl: (claimId: number) => `${API_BASE}/claims/${claimId}/export`,

  // Authentication & User Scoping
  auth: {
    login: async (username: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      return handleResponse<AuthLoginResponse>(res);
    },

    getMe: async () => {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeaders()
      });
      return handleResponse<UserProfile>(res);
    },

    demoSwitch: async (username: string) => {
      const res = await fetch(`${API_BASE}/auth/demo-switch?username=${encodeURIComponent(username)}`, {
        method: 'POST'
      });
      return handleResponse<AuthLoginResponse>(res);
    },

    getDemoUsers: async () => {
      const res = await fetch(`${API_BASE}/auth/demo-users`);
      return handleResponse<UserProfile[]>(res);
    },

    setLanguage: async (languageCode: string) => {
      const res = await fetch(`${API_BASE}/auth/set-language`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ language_code: languageCode })
      });
      return handleResponse<{ status: string; language_code: string }>(res);
    }
  },

  // Farmer-Specific Scoped API
  farmer: {
    getProfile: async () => {
      const res = await fetch(`${API_BASE}/farmer/profile`, {
        headers: getAuthHeaders()
      });
      return handleResponse<UserProfile>(res);
    },

    getMyClaims: async () => {
      const res = await fetch(`${API_BASE}/farmer/claims`, {
        headers: getAuthHeaders()
      });
      return handleResponse<FarmerClaimSummary[]>(res);
    },

    getMyClaimDetails: async (claimId: number) => {
      const res = await fetch(`${API_BASE}/farmer/claims/${claimId}`, {
        headers: getAuthHeaders()
      });
      return handleResponse<FarmerClaimDetails>(res);
    },

    getTimeline: async (claimId: number) => {
      const res = await fetch(`${API_BASE}/farmer/claims/${claimId}/timeline`, {
        headers: getAuthHeaders()
      });
      return handleResponse<TimelineResponse>(res);
    },

    getDamageInfo: async (claimId: number) => {
      const res = await fetch(`${API_BASE}/farmer/claims/${claimId}/damage-info`, {
        headers: getAuthHeaders()
      });
      return handleResponse<DamageInfoResponse>(res);
    },

    getExplanation: async (claimId: number) => {
      const res = await fetch(`${API_BASE}/farmer/claims/${claimId}/explanation`, {
        headers: getAuthHeaders()
      });
      return handleResponse<FarmerExplanationResponse>(res);
    },

    chatAssistant: async (claimId: number, message: string, languageCode: string = 'en-IN') => {
      const res = await fetch(`${API_BASE}/farmer/assistant/chat`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ claim_id: claimId, message, language_code: languageCode })
      });
      return handleResponse<ChatMessageResponse>(res);
    }
  },

  // Officer-Specific Scoped API
  officer: {
    getSummary: async () => {
      const res = await fetch(`${API_BASE}/officer/dashboard/summary`, {
        headers: getAuthHeaders()
      });
      return handleResponse<{
        title: string;
        officer_name: string;
        kpis: {
          total_claims: number;
          waiting_for_review: number;
          claims_approved: number;
          claims_needing_attention: number;
        };
        aggregate_charts: {
          crop_distribution: { crop: string; count: number }[];
          district_distribution: { district: string; count: number }[];
          label: string;
        };
        notice: string;
      }>(res);
    },

    getClaims: async (filterType: string = 'all') => {
      const res = await fetch(`${API_BASE}/officer/claims?filter_type=${encodeURIComponent(filterType)}`, {
        headers: getAuthHeaders()
      });
      return handleResponse<{
        id: number;
        claim_reference: string;
        farmer_name: string;
        crop_type: string;
        district: string;
        state: string;
        cultivated_area: number;
        reported_loss_pct?: number;
        verified_crop_loss?: number;
        status: string;
        workflow_stage: string;
        sowing_date: string;
        missing_documents: string[];
        created_at?: string;
      }[]>(res);
    },

    recordReview: async (claimId: number, data: {
      decision: string;
      rationale: string;
      verified_crop_loss?: number;
      required_evidence?: string;
    }) => {
      const res = await fetch(`${API_BASE}/officer/claims/${claimId}/review`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data)
      });
      return handleResponse<{ status: string; claim_id: number; new_status: string; workflow_stage: string }>(res);
    }
  },

  // Sarvam AI Regional Languages API
  regional: {
    getLanguages: async () => {
      const res = await fetch(`${API_BASE}/regional/languages`);
      return handleResponse<{
        languages: RegionalLanguage[];
        sarvam_api_configured: boolean;
        default_language: string;
        priority_language: string;
      }>(res);
    },

    translate: async (text: string, targetLanguage: string, sourceLanguage: string = 'en-IN') => {
      const res = await fetch(`${API_BASE}/regional/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_language: targetLanguage, source_language: sourceLanguage })
      });
      return handleResponse<{ translated_text: string; source_lang: string; target_lang: string; source: string }>(res);
    },

    translateBatch: async (texts: string[], targetLanguage: string) => {
      const res = await fetch(`${API_BASE}/regional/translate-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, target_language: targetLanguage })
      });
      return handleResponse<{ translations: string[]; target_language: string }>(res);
    },

    tts: async (text: string, targetLanguage: string = 'kn-IN') => {
      const res = await fetch(`${API_BASE}/regional/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_language: targetLanguage })
      });
      return handleResponse<{ success: boolean; audios: string[]; format?: string; message?: string }>(res);
    },

    stt: async (audioBlob: Blob, languageCode?: string) => {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice_recording.wav');
      if (languageCode) {
        formData.append('language_code', languageCode);
      }
      const res = await fetch(`${API_BASE}/regional/stt`, {
        method: 'POST',
        body: formData
      });
      return handleResponse<{ success: boolean; transcript: string; language_code?: string; message?: string }>(res);
    }
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
    }) => {
      const res = await fetch(`${API_BASE}/external/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        status: string;
        is_automatic: boolean;
        source?: string;
        retrieval_date?: string;
        observation_period?: string;
        resolved_latitude?: number;
        resolved_longitude?: number;
        coordinate_source?: string;
        data?: {
          observed_rainfall: number;
          reference_rainfall: number;
          observed_temperature: number;
          reference_temperature: number;
          rainfall_unit: string;
          temperature_unit: string;
        };
        error?: string;
        disclaimer?: string;
      }>(res);
    },

    fetchPmfbyReference: async (payload: {
      state: string;
      district: string;
      crop: string;
      season: string;
      year?: number;
    }) => {
      const res = await fetch(`${API_BASE}/external/pmfby-reference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        matched: boolean;
        source: string;
        reference_period?: string;
        notified_district?: string;
        notified_state?: string;
        notified_crop?: string;
        sum_insured_per_ha?: number;
        actuarial_premium_rate_pct?: number;
        farmer_share_pct?: number;
        indemnity_level_pct?: number;
        insurance_company?: string;
        message?: string;
        disclaimer?: string;
      }>(res);
    },

    fetchSatelliteNdvi: async (payload: {
      state: string;
      district: string;
      observation_date: string;
      latitude?: number;
      longitude?: number;
    }) => {
      const res = await fetch(`${API_BASE}/external/satellite-ndvi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return handleResponse<{
        status: string;
        observation_status: string;
        source: string;
        check_date: string;
        reason?: string;
        farmer_guidance?: string;
        data?: {
          current_ndvi?: number | null;
          reference_ndvi?: number | null;
        };
      }>(res);
    }
  }
};

