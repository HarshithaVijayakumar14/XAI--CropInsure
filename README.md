which # XAI-CropInsure
### Explainable AI for Transparent Crop-Insurance Claim Assessment

An end-to-end, explainable machine-learning decision support web application designed to assist crop insurance assessors in examining agricultural claims under Indian agro-climatic conditions (Pradhan Mantri Fasal Bima Yojana - PMFBY).

---

## 🌾 Overview & Core Principles

**XAI-CropInsure** analyzes multi-source agricultural variables—including rainfall deficit, satellite vegetation index (NDVI) drop, temperature anomaly, soil moisture, and crop-cutting benchmarks—generates model-based risk predictions, and explains the contributing factors using genuine **SHAP (SHapley Additive exPlanations)**.

### Mandatory Scientific & Ethical Guidelines:
1. **Decision Support Only:** The system assists human assessors; it never automatically approves or rejects farmer claims or legal financial entitlements.
2. **Attribution ≠ Physical Causality:** SHAP values represent feature contributions to model log-odds/probability, not physical proof of crop destruction.
3. **No Fabricated Data:** Clear persistent tagging of demonstration datasets (`DEMO DATA — Illustrative records, not real farmer claims`).
4. **Mandatory Human-in-the-Loop:** Official review decisions and assessor rationale are stored independently from model predictions in an append-only audit trail.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons |
| **Backend** | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy, Uvicorn |
| **Machine Learning & XAI** | scikit-learn (Random Forest, Gradient Boosting, Logistic Regression), SHAP (TreeExplainer, LinearExplainer), pandas, NumPy |
| **Reporting & Export** | ReportLab (Downloadable PDF Reports), CSV tabular exports |
| **Database** | SQLite (persistent, migratable to PostgreSQL) |
| **Testing** | pytest, FastAPI TestClient |

---

## 🚀 Quick Start Instructions (Beginner-Friendly Windows Guide)

### Prerequisites
- **Python 3.12** (managed automatically via `uv` or installed locally)
- **Node.js** (v18+ recommended)
- **uv** (fast Python package manager)

---

### Method A: One-Click Startup (Recommended)
Simply double-click:
```cmd
start_all.bat
```
This script will automatically:
1. Check/create virtual environment (`backend\.venv`)
2. Initialise database and seed baseline models (`scripts\initialise_database.py`)
3. Launch backend API server on `http://127.0.0.1:8000`
4. Launch frontend development server on `http://localhost:5173`
5. Open your default web browser to the dashboard

---

### Method B: Manual Step-by-Step Startup

#### Step 1: Set up Backend Virtual Environment
Open PowerShell or Command Prompt in the project folder:
```powershell
uv venv --python 3.12 backend\.venv
uv pip install -r backend\requirements.txt --python backend\.venv\Scripts\python.exe
```

#### Step 2: Initialize Database and Train Baseline Model
```powershell
backend\.venv\Scripts\python.exe scripts\initialise_database.py
```

#### Step 3: Start Backend API Server
```powershell
backend\.venv\Scripts\uvicorn.exe backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
* Interactive Swagger API Docs: `http://127.0.0.1:8000/api/docs`
* Health Check: `http://127.0.0.1:8000/api/health`

#### Step 4: Start Frontend
Open a second terminal window:
```powershell
cd frontend
npm install
npm run dev
```
* Open your browser at `http://localhost:5173`

---

## 🧪 Running Automated Tests

Run the comprehensive automated test suite (API health, feature engineering, validation, model training, SHAP, and PDF generation):
```powershell
backend\.venv\Scripts\pytest -v
```
To verify frontend TypeScript compilation and bundling:
```powershell
cd frontend
npm run build
```

---

## 📋 Complete 18-Step End-to-End Demonstration Walkthrough

Follow this demonstration workflow for academic presentations:

1. **Launch Application:** Run `start_all.bat` and open `http://localhost:5173`.
2. **Explore Dashboard:** Observe the live database counters, workflow status distribution chart, claims over time, and regional state distributions.
3. **Inspect Agricultural Data:** Navigate to **Agricultural Data** (`/data`), view uploaded datasets, inspect columns, missing values, and data quality checks.
4. **Download Template:** Click "Download CSV Template" to verify standardized PMFBY variables.
5. **Generate Benchmark Data:** Click "Generate Benchmark Data" to create 200 synthetic records with realistic weather anomalies and drought stress.
6. **Open Model Performance:** Navigate to **Model Performance** (`/models`).
7. **Configure Training:** Select dataset, task type (*Claim Classification*), algorithm (*Random Forest*), and features (rainfall deficit, NDVI change, soil moisture, etc.).
8. **Train Model:** Click "Train Model & Validate". Review held-out Accuracy, Precision, Recall, F1 Score, and Confusion Matrix.
9. **Inspect Global SHAP:** Navigate to **Explainability** (`/explainability`) to view the global feature importance chart (mean |SHAP| values).
10. **Register a Claim:** Navigate to **New Claim** (`/new-claim`), input farmer name, crop, district, and environmental variables (e.g. 320mm observed rainfall vs 850mm reference, NDVI 0.34 vs 0.68).
11. **Form Validation:** Notice automatic validation of physical NDVI bounds [-1, 1], non-negative rainfall, and chronological dates.
12. **Submit Claim:** Save the claim; you will be redirected to the **Claim Assessment Workspace**.
13. **Run AI Assessment:** Click "Run Model Assessment". Observe the prediction match percentage and base reference value.
14. **Inspect Local SHAP Waterfall:** Review the interactive waterfall chart showing positive green bars (supporting damage claim) and negative red bars.
15. **Read Plain Language Summary:** Review the farmer-friendly narrative explaining the drivers in non-technical terms.
16. **Download Official PDF Report:** Click "Download PDF Report" to download a clean, structured assessment document with assessor signature block.
17. **Record Assessor Review:** In the Human Review panel, record your decision (*Approved* or *Rejected*), rationale, and note if it differs from the ML score.
18. **Verify Audit Trail:** Navigate to **Audit History** (`/audit`) to confirm immutable chronological logging of every event.

---

## 🏛️ Project Directory Structure

```
XAI-CropInsure/
├── backend/
│   ├── app/
│   │   ├── api/             # REST endpoints (health, dashboard, claims, datasets, models, assessments, reviews, reports)
│   │   ├── database/        # SQLAlchemy engine, session, and ORM models
│   │   ├── ml/              # Feature engineering, preprocessing, trainer, SHAP explainer, synthetic generator
│   │   ├── schemas/         # Pydantic v2 validation models
│   │   ├── services/        # Claim, dataset, explanation, audit, and PDF services
│   │   ├── config.py        # Settings and environment configuration
│   │   └── main.py          # FastAPI application entrypoint
│   ├── tests/               # Automated test suite
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── api/             # Typed API client
│   │   ├── components/      # Sidebar, Navbar, Layout, Cards
│   │   ├── pages/           # 10 dedicated functional pages
│   │   ├── types/           # TypeScript interfaces
│   │   ├── App.tsx          # Router setup
│   │   └── main.tsx         # Entrypoint
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── data/
│   ├── demo/                # Synthetic benchmark datasets
│   ├── templates/           # Standard CSV templates
│   └── models/              # Serialized ML model bundles (.joblib)
├── reports/                 # Generated PDF assessment reports
├── scripts/
│   ├── initialise_database.py
│   └── generate_demo_data.py
├── start_all.bat            # One-click startup script
├── start_backend.bat
├── start_frontend.bat
├── .env.example
├── .gitignore
├── README.md
└── PROJECT_DOCUMENTATION.md
```

---

## ⚖️ Ethical & Scientific Disclaimers

- This application is developed for research, education, and demonstrative decision support.
- Simulated benchmarks do not establish real-world operational efficacy under field underwriting conditions.
- Final insurance eligibility must always follow verified field Crop Cutting Experiments (CCE), statutory guidelines under the Pradhan Mantri Fasal Bima Yojana (PMFBY), and authorized administrative procedures.

