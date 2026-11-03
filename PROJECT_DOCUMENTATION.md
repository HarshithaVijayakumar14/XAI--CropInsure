# PROJECT DOCUMENTATION
## Explainable AI for Transparent Crop-Insurance Claim Assessment (XAI-CropInsure)

---

### 1. Project Title
**Explainable AI for Transparent Crop-Insurance Claim Assessment (XAI-CropInsure)**

---

### 2. Abstract
Agricultural crop insurance in developing nations, particularly under India's Pradhan Mantri Fasal Bima Yojana (PMFBY), represents a vital safety net against climate-induced yield volatility, extreme weather events, and localized agro-climatic catastrophes. However, traditional claim settlement processes frequently suffer from prolonged delays, subjective loss assessments, lack of transparency, and opaque automated scoring mechanisms that undermine farmer trust. 

This project presents **XAI-CropInsure**, an end-to-end explainable machine learning decision-support platform. By synthesizing multi-source environmental observations (rainfall deficits, satellite-derived Normalized Difference Vegetation Index (NDVI) shifts, temperature anomalies, and soil moisture measurements), XAI-CropInsure trains supervised predictive models while integrating **SHAP (SHapley Additive exPlanations)** grounded in cooperative game theory. Technical feature attributions are deterministically translated into plain-language summaries and professional PDF audit reports, empowering insurance claim assessors and agricultural officers with transparent, human-in-the-loop verification tools.

---

### 3. Problem Statement
Crop insurance claim evaluation faces a fundamental tension:
- **Delay & Scalability Bottlenecks:** Manual field crop-cutting experiments (CCEs) require extensive manpower and often take several months to finalize claim compensation.
- **Opacity of Modern ML Solutions:** While automated machine-learning models can rapidly process remote-sensing data, conventional models operate as "black boxes." Assessors cannot explain why a claim was flagged, farmers cannot understand the basis of denial, and potential algorithmic biases remain undetectable.
- **Risk of Premature Automation:** Relying on unverified automated decisions without human oversight creates severe legal, financial, and ethical risks for smallholder farmers.

---

### 4. Aim and Objectives
The overarching aim is to establish a transparent, auditable, and interpretable decision-support framework for agricultural claim assessment.

#### Core Objectives:
1. **Data Management:** Ingest and validate multi-source agro-meteorological, satellite, and historical claim datasets with strict data-quality safeguards.
2. **Feature Engineering:** Derive physically grounded indicators, including Rainfall Deficit, Relative Rainfall Deficit, NDVI Vigor Change, and Compound Moisture Stress.
3. **Machine Learning Pipelines:** Implement separate, leak-free pipelines for Claim-Validity Classification and Payout Benchmark Estimation.
4. **Explainable AI Integration:** Compute genuine local (waterfall) and global SHAP attributions using TreeExplainer and LinearExplainer.
5. **Farmer-Friendly Communication:** Translate quantitative game-theoretic Shapley values into clear natural language that explains positive and negative drivers.
6. **Auditability & Governance:** Enforce an immutable, append-only chronological log of all inferences, data imports, and human assessor judgments.

---

### 5. Existing Problem and Motivation
Under traditional schemes, farmers often perceive claim approvals and rejections as arbitrary. When remote sensing is introduced without explanation, farmers whose fields suffered genuine drought may be rejected because an aggregated pixel did not register distress. Assessors lack granular insight into whether a rejection was driven by rainfall deficits, temperature shifts, or irrigation classification. 

Explainable AI bridges this trust deficit: by isolating each variable's additive contribution to the prediction, assessors can cross-reference model outputs with localized field reports, verify data veracity, and document rationale when human findings diverge from automated patterns.

---

### 6. Proposed Solution
XAI-CropInsure provides a complete full-stack web platform consisting of:
1. **Assessor Dashboard:** Live metrics, workflow distribution charts, crop-wise breakdowns, and regional mapping.
2. **New Claim Registration:** Strict validation of geographic, agronomic, and remote sensing parameters.
3. **Data Management Module:** CSV upload, automated quality checks (range validity, null percentages, duplicate detection), and synthetic benchmark generation.
4. **Machine Learning Workbench:** Stratified training, held-out evaluation (Confusion Matrix, ROC-AUC, Precision, Recall, MAE, RMSE), and model versioning.
5. **SHAP Local Waterfall & Global Importance:** Genuine Shapley value calculation visualised as interactive directional bar charts.
6. **Farmer-Friendly Summary Generator:** Plain-language interpretation highlighting primary supporting and opposing factors.
7. **ReportLab PDF Generator:** One-click generation of structured, print-ready assessment reports with assessor signature blocks.
8. **Human Review Workflow:** Enforces that final decisions rest with authorized human assessors, with mandatory rationale documentation when overruling model predictions.

---

### 7. System Architecture
```
+-------------------------------------------------------------------------------+
|                             CLIENT / BROWSER                                  |
|     React 18 + TypeScript + Vite + Tailwind CSS + Recharts + Lucide Icons     |
+---------------------------------------+---------------------------------------+
                                        | HTTP / JSON REST
                                        v
+-------------------------------------------------------------------------------+
|                            FASTAPI BACKEND RUNTIME                            |
|  +-------------------+  +---------------------+  +-------------------------+  |
|  |  Health & Config  |  |  Claims Management  |  |   Datasets & Quality    |  |
|  +-------------------+  +---------------------+  +-------------------------+  |
|  +-------------------+  +---------------------+  +-------------------------+  |
|  | Models & Training |  | SHAP Explanations   |  | Reports & PDF Generator |  |
|  +-------------------+  +---------------------+  +-------------------------+  |
|  +-------------------+  +---------------------+  +-------------------------+  |
|  | Human Review Log  |  | Audit Event Stream  |  | Plain-Language Summary  |  |
|  +-------------------+  +---------------------+  +-------------------------+  |
+---------------------------------------+---------------------------------------+
                                        | ORM (SQLAlchemy 2.0)
                                        v
+-------------------------------------------------------------------------------+
|                             STORAGE & PERSISTENCE                             |
|  - SQLite Database (xai_cropinsure.db) -> Migratable to PostgreSQL           |
|  - Model Artifacts (.joblib bundles with pipeline, explainer & metadata)      |
|  - Generated PDF Reports (/reports/*.pdf)                                     |
|  - Synthetic Datasets & CSV Templates (/data/*)                              |
+-------------------------------------------------------------------------------+
```

---

### 8. Module Descriptions

#### Module A: Dashboard & Analytics
Provides instant operational awareness for insurance executives and regional officers. Computes real-time counts from the database, visualizes workflow status transitions, plots claims across dates, breaks down claims by crop and state, and highlights top SHAP features from the active model.

#### Module B: Claim Registration & Validation
Captures farmer identification, policy references, spatial coordinates, sowing schedules, agronomic variables (soil type, irrigation, growth stage), and environmental evidence. Automatically validates physical NDVI limits ($-1.0 \le \text{NDVI} \le 1.0$), non-negative rainfall, and temporal sequence consistency.

#### Module C: Agricultural Data Management
Facilitates uploading, inspecting, and standardizing historical datasets. Features an automated data-quality engine that quantifies missingness, checks for duplicates, inspects target availability, and generates standardized CSV templates.

#### Module D: Feature Engineering & Preprocessing
Computes derived agrometeorological indicators:
$$\text{rainfall\_deficit} = \text{reference\_rainfall} - \text{observed\_rainfall}$$
$$\text{relative\_rainfall\_deficit} = \frac{\text{reference\_rainfall} - \text{observed\_rainfall}}{\text{reference\_rainfall}} \quad (\text{for } \text{reference\_rainfall} > 0)$$
$$\text{ndvi\_change} = \text{current\_ndvi} - \text{reference\_ndvi}$$
$$\text{temperature\_anomaly} = \text{observed\_temperature} - \text{reference\_temperature}$$
$$\text{compound\_stress\_indicator} = 0.6 \cdot \max(0, \text{rel\_deficit}) + 0.4 \cdot \max(0, -\text{ndvi\_change})$$

Preprocessing utilizes scikit-learn `ColumnTransformer` pipelines fitted strictly on training data to prevent data leakage.

#### Module E: Machine Learning Training & Evaluation
Implements two distinct pipelines:
- **Task A (Classification):** Supervised estimation of historical claim outcomes (Approved vs Rejected) using Random Forest, Gradient Boosting, Decision Tree, or Logistic Regression.
- **Task B (Regression):** Estimation of payout benchmarks in INR currency using Random Forest Regressor, Gradient Boosting Regressor, or Linear Regression.

#### Module F: SHAP Explainability Engine
Leverages `shap.TreeExplainer` and `shap.LinearExplainer` to extract genuine Shapley values. Formulates:
1. Local instance waterfalls showing how specific feature anomalies shift log-odds relative to the base reference value $E[f(x)]$.
2. Global feature importance rankings quantified by mean absolute impact:
$$\text{Importance}_j = \frac{1}{N} \sum_{i=1}^{N} |\phi_j^{(i)}|$$

#### Module G: Farmer-Friendly Translation
Converts statistical Shapley outputs into plain, empathetic language. Details what the model evaluated, identifies the primary positive and negative factors, acknowledges missing data, and reiterates mandatory human review.

#### Module H: PDF Assessment Report Generation
Uses ReportLab to construct print-ready official reports complete with claim metadata, remote-sensing comparison tables, SHAP feature attribution breakdowns, plain-language summaries, statutory disclaimers, and assessor sign-off sections.

#### Module I: Human Review & Audit Logging
Enforces human-in-the-loop decision-making. Assessors record their official determination, rationale, and specific justifications if their judgment diverges from the model's pattern. Every action is permanently recorded in an append-only audit trail.

---

### 9. Technology Stack Justification
- **FastAPI:** High-performance asynchronous REST API with automatic OpenAPI Swagger documentation and strict Pydantic schema validation.
- **scikit-learn & SHAP:** Standard, stable, and reproducible machine learning and explainability libraries in data science.
- **React & Vite:** Ultra-fast bundling, modular component structure, and strong developer ergonomics.
- **Tailwind CSS:** Professional agricultural design system with cohesive color palettes (`agri-600`), responsive grids, and accessible components.
- **Recharts:** High-performance SVG-based responsive data visualisations for time series, distributions, and SHAP waterfalls.
- **ReportLab:** Pure-Python document generator producing high-fidelity PDF documents without external headless browser dependencies.

---

### 10. Data Sources & Integration Strategy
The application architecture includes an extensible provider interface capable of receiving data from:
1. **India Meteorological Department (IMD):** Gridded daily rainfall and temperature observations.
2. **Sentinel-2 & Landsat-8/9 Satellite Products:** High-resolution optical reflectance for NDVI surface vigor calculations.
3. **data.gov.in (Open Government Data Portal):** District-level historical PMFBY yield thresholds and crop-cutting yields.
4. **Soil Moisture Active Passive (SMAP) / ASCAT:** Surface and root-zone moisture percentiles.

*Note:* Where external live APIs are unavailable or require proprietary subscriptions, the system seamlessly supports standard CSV ingestion and reproducible synthetic benchmark generation.

---

### 11. Security and Privacy Considerations
- **Data Minimization:** No unnecessary personally identifiable information (Aadhaar numbers, bank account credentials) is collected or stored.
- **Parameterized Queries:** All persistence operations utilize SQLAlchemy ORM with parameterized statements to eliminate SQL injection vulnerabilities.
- **File Upload Safeguards:** Uploads are strictly restricted to `.csv` format with file-size limits (25 MB) and sanitized local filenames.
- **Audit Logging:** System administrative actions, review overrides, and model training events are append-only.

---

### 12. Human-in-the-Loop Protocol
XAI-CropInsure strictly enforces that the ML model is an **assistive decision-support tool**, not an automated judge.
```
Claim Submission ---> Automated Data Validation ---> Model Pattern Assessment & SHAP
                                                               |
                                                               v
Official Decision <--- Authorized Assessor Review <--- Farmer-Friendly Report
 (Approved / Rejected)   (Verifies CCE, AWS & Policy)
```
If an assessor selects a decision that differs from the model's pattern, the application mandates recording an explicit rationale before the review can be finalized.

---

### 13. Testing Methodology
The project includes automated tests using `pytest` and `httpx`:
- **API Health Verification:** Validates database connectivity, active models, and service state.
- **Feature Engineering Correctness:** Tests mathematical formulas for rainfall deficit, relative deficit, and NDVI change.
- **Data Quality Validator:** Tests boundary conditions (NDVI out of $[-1, 1]$, negative rainfall, inverted dates).
- **Claim Lifecycle:** Covers creation, retrieval, updates, ML assessment, review recording, and deletion.
- **Model Training & SHAP Pipeline:** Verifies model fitting on held-out splits, serialization, TreeExplainer initialization, and feature attribution extraction.
- **Payout Regression Pipeline:** Tests continuous target evaluation (MAE, RMSE, R²).
- **PDF Report Generation:** Verifies binary PDF structure and ReportLab layout compilation.

---

### 14. Known Limitations
1. **Synthetic Data Context:** In the default demonstration configuration, benchmark models are trained on simulated data. Performance metrics illustrate pipeline functionality and cannot be cited as real-world operational efficacy.
2. **Cooperative Attribution vs Causality:** SHAP isolates statistical feature attribution within the model. It cannot diagnose biological pathology (e.g., distinguishing fungal blast from drought-induced wilting if both cause leaf browning).
3. **Local Database:** Default deployment utilizes SQLite for ease of setup; production deployments require migrating to a managed PostgreSQL cluster.

---

### 15. Future Enhancements
1. **Automated Weather Station (AWS) API Integration:** Real-time API connectors to state meteorological networks.
2. **Satellite Cloud-Masking:** Direct ingestion of Google Earth Engine Sentinel-2 bands with automated cloud and shadow removal.
3. **Multi-Lingual Audio Explanations:** Integration of text-to-speech synthesis in regional Indian languages (Hindi, Marathi, Telugu, Tamil, Kannada) for farmer communication.
4. **Multi-Model Ensembling:** Automated comparison of XGBoost, LightGBM, and TabNet with automated Bayesian hyperparameter tuning.

---

### 16. Reproducing the Demonstration
1. Run `start_all.bat` (or execute backend and frontend commands manually).
2. Click **"Seed Demo Data"** in the top navbar or navigate to **Agricultural Data** to generate benchmark claims.
3. Go to **Model Performance**, select the synthetic dataset, and train a Random Forest Classifier.
4. Open **Claims Management**, click **Assess** on any claim, and inspect the genuine SHAP waterfall chart.
5. Click **Download PDF Report** to view the generated document.
6. Record an assessor review in the **Human Review Panel** and inspect the updated event in **Audit History**.

