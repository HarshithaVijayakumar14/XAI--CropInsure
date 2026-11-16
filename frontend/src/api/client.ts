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
import { demoFallback } from './demoFallback';

const API_BASE = '/api';

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('xai_cropinsure_token');
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithFallback<T>(
  fetchFn: () => Promise<Response>,
  fallbackFn: () => Promise<T> | T
): Promise<T> {
  try {
    const res = await fetchFn();
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Network or server offline; proceed to fallback
  }
  return await fallbackFn();
}

export const api = {
  // Health
  getHealth: async () => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/health`),
      demoFallback.getHealth
    );
  },

  // Dashboard
  getDashboardSummary: async () => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/dashboard/summary`),
      demoFallback.getDashboardSummary
    );
  },

  getDashboardCharts: async () => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/dashboard/charts`),
      demoFallback.getDashboardCharts
    );
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

    return fetchWithFallback(
      () => fetch(`${API_BASE}/claims?${query.toString()}`),
      demoFallback.getClaims
    );
  },

  getClaim: async (id: number) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/claims/${id}`),
      () => demoFallback.getClaim(id)
    );
  },

  createClaim: async (data: Partial<Claim>) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
      () => demoFallback.createClaim(data)
    );
  },

  updateClaim: async (id: number, data: Partial<Claim>) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
      () => demoFallback.updateClaim(id, data)
    );
  },

  deleteClaim: async (id: number) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/claims/${id}`, { method: 'DELETE' }),
      () => demoFallback.deleteClaim(id)
    );
  },

  // Datasets
  getDatasets: async () => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/datasets`),
      demoFallback.getDatasets
    );
  },

  getDatasetDetails: async (id: number) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/datasets/${id}`),
      () => demoFallback.getDatasetDetails(id)
    );
  },

  uploadDataset: async (file: File, name?: string, category?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('dataset_name', name);
    if (category) formData.append('category', category);

    return fetchWithFallback(
      () => fetch(`${API_BASE}/datasets/upload`, {
        method: 'POST',
        body: formData,
      }),
      () => ({ message: 'Dataset upload recorded', filename: file.name })
    );
  },

  loadDemoDataset: async (samples: number = 150) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/datasets/demo/load?num_samples=${samples}`, {
        method: 'POST',
      }),
      demoFallback.loadDemoDataset
    );
  },

  getTemplateDownloadUrl: () => `${API_BASE}/datasets/template/download`,

  // Models
  getModels: async () => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/models`),
      demoFallback.getModels
    );
  },

  getModel: async (id: number) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/models/${id}`),
      () => demoFallback.getModel(id)
    );
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
    return fetchWithFallback(
      () => fetch(`${API_BASE}/models/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }),
      () => demoFallback.getModel(1)
    );
  },

  activateModel: async (id: number) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/models/${id}/activate`, {
        method: 'POST',
      }),
      () => demoFallback.activateModel(id)
    );
  },

  getGlobalExplanations: async (modelId: number) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/models/${modelId}/explanations/global`),
      () => demoFallback.getGlobalExplanations(modelId)
    );
  },

  // Agricultural Crop Yield Model (APY-India, Model ID 2)
  getCropYieldOptions: async () => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/models/agricultural-yield/options`),
      demoFallback.getCropYieldOptions
    );
  },

  predictCropYield: async (data: AgriculturalYieldRequest) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/models/agricultural-yield/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
      () => demoFallback.predictCropYield(data)
    );
  },

  // Assessments
  runAssessment: async (claimId: number, modelId?: number) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/claims/${claimId}/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId }),
      }),
      () => demoFallback.runAssessment(claimId, modelId)
    );
  },

  getAssessment: async (claimId: number) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/claims/${claimId}/assessment`),
      () => demoFallback.getAssessment(claimId)
    );
  },

  getStatutoryRules: async (claimId: number) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/claims/${claimId}/statutory-rules`),
      () => demoFallback.getStatutoryRules(claimId)
    );
  },

  // Reviews & Audit
  recordReview: async (claimId: number, data: {
    reviewer_name: string;
    reviewer_role?: string;
    review_decision: string;
    differs_from_model: boolean;
    rationale: string;
    required_evidence?: string;
    verified_crop_loss?: number;
    verified_crop_yield?: number;
  }) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/claims/${claimId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
      () => demoFallback.recordReview(claimId, data)
    );
  },

  getClaimReviews: async (claimId: number) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/claims/${claimId}/reviews`),
      () => demoFallback.getClaimReviews(claimId)
    );
  },

  getClaimAudit: async (claimId: number) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/claims/${claimId}/audit`),
      () => demoFallback.getClaimAudit(claimId)
    );
  },

  getAllAudit: async (_limit: number = 100) => {
    return fetchWithFallback(
      () => fetch(`${API_BASE}/audit?limit=${_limit}`),
      demoFallback.getAllAudit
    );
  },

  // Reports
  getReportPdfUrl: (claimId: number) => `${API_BASE}/claims/${claimId}/report`,
  getExportCsvUrl: (claimId: number) => `${API_BASE}/claims/${claimId}/export`,

  // Authentication & User Scoping
  auth: {
    login: async (username: string, password: string) => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        }),
        () => demoFallback.auth.login(username)
      );
    },

    getMe: async () => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/auth/me`, {
          headers: getAuthHeaders()
        }),
        demoFallback.auth.getMe
      );
    },

    demoSwitch: async (username: string) => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/auth/demo-switch?username=${encodeURIComponent(username)}`, {
          method: 'POST'
        }),
        () => demoFallback.auth.demoSwitch(username)
      );
    },

    getDemoUsers: async () => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/auth/demo-users`),
        demoFallback.auth.getDemoUsers
      );
    },

    setLanguage: async (languageCode: string) => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/auth/set-language`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ language_code: languageCode })
        }),
        () => demoFallback.auth.setLanguage(languageCode)
      );
    }
  },

  // Farmer-Specific Scoped API
  farmer: {
    getProfile: async () => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/farmer/profile`, {
          headers: getAuthHeaders()
        }),
        demoFallback.farmer.getProfile
      );
    },

    getMyClaims: async () => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/farmer/claims`, {
          headers: getAuthHeaders()
        }),
        demoFallback.farmer.getMyClaims
      );
    },

    getMyClaimDetails: async (claimId: number) => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/farmer/claims/${claimId}`, {
          headers: getAuthHeaders()
        }),
        () => demoFallback.farmer.getMyClaimDetails(claimId)
      );
    },

    getTimeline: async (claimId: number) => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/farmer/claims/${claimId}/timeline`, {
          headers: getAuthHeaders()
        }),
        () => demoFallback.farmer.getTimeline(claimId)
      );
    },

    getDamageInfo: async (claimId: number) => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/farmer/claims/${claimId}/damage-info`, {
          headers: getAuthHeaders()
        }),
        () => demoFallback.farmer.getDamageInfo(claimId)
      );
    },

    getExplanation: async (claimId: number) => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/farmer/claims/${claimId}/explanation`, {
          headers: getAuthHeaders()
        }),
        () => demoFallback.farmer.getExplanation(claimId)
      );
    },

    chatAssistant: async (claimId: number, message: string, languageCode: string = 'en-IN') => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/farmer/assistant/chat`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ claim_id: claimId, message, language_code: languageCode })
        }),
        () => demoFallback.farmer.chatAssistant(claimId, message)
      );
    }
  },

  // Officer-Specific Scoped API
  officer: {
    getSummary: async () => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/officer/dashboard/summary`, {
          headers: getAuthHeaders()
        }),
        demoFallback.officer.getSummary
      );
    },

    getClaims: async (filterType: string = 'all') => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/officer/claims?filter_type=${encodeURIComponent(filterType)}`, {
          headers: getAuthHeaders()
        }),
        () => demoFallback.officer.getClaims(filterType)
      );
    },

    recordReview: async (claimId: number, data: {
      decision: string;
      rationale: string;
      verified_crop_loss?: number;
      required_evidence?: string;
      differs_from_model?: boolean;
    }) => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/officer/claims/${claimId}/review`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(data)
        }),
        () => demoFallback.officer.recordReview(claimId, data)
      );
    }
  },

  // Regional
  regional: {
    getLanguages: async () => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/regional/languages`),
        demoFallback.regional.getLanguages
      );
    },

    translate: async (text: string, targetLanguage: string, sourceLanguage: string = 'en-IN') => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/regional/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, target_language: targetLanguage, source_language: sourceLanguage })
        }),
        () => demoFallback.regional.translate(text, targetLanguage)
      );
    },

    translateBatch: async (texts: string[], targetLanguage: string) => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/regional/translate/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts, target_language: targetLanguage })
        }),
        () => demoFallback.regional.translateBatch(texts, targetLanguage)
      );
    },

    tts: async (text: string, targetLanguage: string = 'kn-IN') => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/regional/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, target_language: targetLanguage })
        }),
        () => demoFallback.regional.tts(text, targetLanguage)
      );
    },

    stt: async (audioBlob: Blob, languageCode?: string) => {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice_recording.wav');
      if (languageCode) {
        formData.append('language_code', languageCode);
      }
      return fetchWithFallback(
        () => fetch(`${API_BASE}/regional/stt`, {
          method: 'POST',
          body: formData
        }),
        () => demoFallback.regional.stt(audioBlob, languageCode)
      );
    },

    synthesizeSpeech: async (text: string, languageCode: string = 'kn-IN', speakerGender: string = 'female') => {
      const res = await fetch(`${API_BASE}/regional/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language_code: languageCode, speaker_gender: speakerGender })
      });
      if (!res.ok) {
        throw new Error('TTS service unavailable');
      }
      return res.json();
    },

    recognizeSpeech: async (audioBlob: Blob, languageCode: string = 'kn-IN') => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.wav');
      formData.append('language_code', languageCode);

      const res = await fetch(`${API_BASE}/regional/speech-to-text`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        throw new Error('STT service unavailable');
      }
      return res.json();
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
      return fetchWithFallback(
        () => fetch(`${API_BASE}/external/weather`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }),
        () => demoFallback.external.fetchWeather(payload)
      );
    },

    fetchPmfbyReference: async (payload: {
      state: string;
      district: string;
      crop: string;
      season: string;
      year?: number;
    }) => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/external/pmfby-reference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }),
        () => demoFallback.external.fetchPmfbyReference(payload)
      );
    },

    fetchSatelliteNdvi: async (payload: {
      state: string;
      district: string;
      observation_date: string;
      latitude?: number;
      longitude?: number;
    }) => {
      return fetchWithFallback(
        () => fetch(`${API_BASE}/external/satellite-ndvi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }),
        () => demoFallback.external.fetchSatelliteNdvi(payload)
      );
    }
  }
};
