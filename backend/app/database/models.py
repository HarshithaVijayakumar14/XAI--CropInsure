from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database.session import Base

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    phone_number = Column(String(20), index=True, nullable=True)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="farmer", nullable=False)  # 'farmer' or 'officer'
    state = Column(String(50), nullable=True)
    district = Column(String(50), nullable=True)
    village = Column(String(100), nullable=True)
    preferred_language = Column(String(20), default="en-IN")
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    claims = relationship("Claim", back_populates="user")
    chat_messages = relationship("FarmerChatHistory", back_populates="user")


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    claim_reference = Column(String(50), unique=True, index=True, nullable=False)
    
    # User ownership link
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Farmer & Policy Info
    farmer_name = Column(String(100), nullable=False)
    contact_number = Column(String(20), nullable=True)
    policy_reference = Column(String(50), nullable=False)
    insurance_scheme = Column(String(50), default="Pradhan Mantri Fasal Bima Yojana (PMFBY)")
    sum_insured = Column(Float, nullable=True)
    
    # Location
    state = Column(String(50), nullable=False)
    district = Column(String(50), nullable=False)
    village = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Crop & Temporal
    crop_type = Column(String(50), nullable=False)
    season = Column(String(30), nullable=False)  # Kharif, Rabi, Zaid
    sowing_date = Column(String(30), nullable=False)
    claim_start_date = Column(String(30), nullable=False)
    claim_end_date = Column(String(30), nullable=False)
    loss_date = Column(String(30), nullable=True)
    reported_loss_pct = Column(Float, nullable=True)
    loss_description = Column(Text, nullable=True)

    # Agronomic
    growth_stage = Column(String(50), nullable=True)
    cultivated_area = Column(Float, nullable=False)  # in hectares
    expected_yield = Column(Float, nullable=True)
    observed_yield = Column(Float, nullable=True)
    soil_type = Column(String(50), nullable=True)
    irrigation_type = Column(String(50), nullable=True)

    # Environmental & Remote Sensing
    observed_rainfall = Column(Float, nullable=False)       # mm
    reference_rainfall = Column(Float, nullable=False)      # mm normal/historical
    soil_moisture = Column(Float, nullable=True)           # %
    observed_temperature = Column(Float, nullable=False)    # deg C
    reference_temperature = Column(Float, nullable=False)   # deg C
    current_ndvi = Column(Float, nullable=False)            # -1.0 to 1.0
    reference_ndvi = Column(Float, nullable=False)          # -1.0 to 1.0

    # Workflow & Detailed Tracking
    status = Column(String(50), default="Ready for assessment")
    workflow_stage = Column(String(50), default="application_submitted")
    stage_updated_at = Column(DateTime, default=utc_now)
    missing_documents = Column(Text, default="[]")  # JSON list of missing docs
    next_expected_action = Column(Text, nullable=True)
    timeline_events_json = Column(Text, default="[]")  # JSON list of timeline events
    verified_crop_loss = Column(Float, nullable=True)  # Officer verified loss %
    officer_notes = Column(Text, nullable=True)
    uploaded_documents_json = Column(Text, default="[]") # JSON list of uploaded docs
    payment_status = Column(String(50), default="Pending")
    payment_amount = Column(Float, nullable=True)
    payment_date = Column(String(50), nullable=True)
    payment_reference = Column(String(100), nullable=True)
    data_quality_flags = Column(Text, default="[]")  # JSON string of warnings
    is_demo_record = Column(Boolean, default=False)
    historical_outcome = Column(String(20), nullable=True) # Historical label if any

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # User relationship
    user = relationship("User", back_populates="claims")

    # Property Aliases for Schema Flexibility
    @property
    def farmer_contact(self):
        return self.contact_number
    @farmer_contact.setter
    def farmer_contact(self, val):
        self.contact_number = val

    @property
    def damage_date(self):
        return self.loss_date
    @damage_date.setter
    def damage_date(self, val):
        self.loss_date = val

    @property
    def reported_crop_loss(self):
        return self.reported_loss_pct
    @reported_crop_loss.setter
    def reported_crop_loss(self, val):
        self.reported_loss_pct = val

    @property
    def rainfall(self):
        return self.observed_rainfall
    @rainfall.setter
    def rainfall(self, val):
        self.observed_rainfall = val

    @property
    def temperature(self):
        return self.observed_temperature
    @temperature.setter
    def temperature(self, val):
        self.observed_temperature = val

    @property
    def workflow_status(self):
        return self.status
    @workflow_status.setter
    def workflow_status(self, val):
        self.status = val

    # Relationships
    assessments = relationship("ClaimAssessment", back_populates="claim", cascade="all, delete-orphan")
    reviews = relationship("HumanReview", back_populates="claim", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="claim", cascade="all, delete-orphan")


class ImportedDataset(Base):
    __tablename__ = "imported_datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    source = Column(String(100), default="Manual Upload")
    category = Column(String(50), default="Historical Claims")
    file_path = Column(String(255), nullable=False)
    row_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    columns_json = Column(Text, default="[]")
    missing_summary = Column(Text, default="{}")
    quality_summary = Column(Text, default="{}")
    is_synthetic = Column(Boolean, default=False)
    import_status = Column(String(30), default="Ready")
    created_at = Column(DateTime, default=utc_now)

    @property
    def dataset_name(self):
        return self.name
    @dataset_name.setter
    def dataset_name(self, val):
        self.name = val

    @property
    def filename(self):
        return self.file_path
    @filename.setter
    def filename(self, val):
        self.file_path = val

    @property
    def dataset_type(self):
        return self.category
    @dataset_type.setter
    def dataset_type(self, val):
        self.category = val

    @property
    def upload_date(self):
        return self.created_at

    @property
    def record_count(self):
        return self.row_count
    @record_count.setter
    def record_count(self, val):
        self.row_count = val

    @property
    def column_information(self):
        return self.columns_json
    @column_information.setter
    def column_information(self, val):
        self.columns_json = val

    @property
    def missing_values_summary(self):
        return self.missing_summary
    @missing_values_summary.setter
    def missing_values_summary(self, val):
        self.missing_summary = val

    @property
    def validation_status(self):
        return self.import_status
    @validation_status.setter
    def validation_status(self, val):
        self.import_status = val

    @property
    def description(self):
        return self.quality_summary
    @description.setter
    def description(self, val):
        self.quality_summary = val


class TrainedModel(Base):
    __tablename__ = "trained_models"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), nullable=False)
    model_version = Column(String(50), nullable=False, unique=True)
    task_type = Column(String(30), nullable=False)  # 'classification' or 'regression'
    algorithm = Column(String(50), nullable=False)  # 'Random Forest', 'Gradient Boosting', etc.
    dataset_id = Column(Integer, ForeignKey("imported_datasets.id"), nullable=True)
    target_column = Column(String(50), nullable=False)
    features_used = Column(Text, default="[]")  # JSON list
    metrics_json = Column(Text, default="{}")   # JSON dict of accuracy, precision, etc.
    file_path = Column(String(255), nullable=False)
    explainer_path = Column(String(255), nullable=True)
    is_synthetic_trained = Column(Boolean, default=True)
    is_active = Column(Boolean, default=False)
    dataset_name = Column(String(100), nullable=True)
    training_notes = Column(Text, nullable=True)
    training_records = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)

    @property
    def model_type(self):
        return self.task_type
    @model_type.setter
    def model_type(self, val):
        self.task_type = val

    @property
    def selected_features(self):
        return self.features_used
    @selected_features.setter
    def selected_features(self, val):
        self.features_used = val

    @property
    def model_path(self):
        return self.file_path
    @model_path.setter
    def model_path(self, val):
        self.file_path = val

    @property
    def preprocessing_configuration(self):
        return self.training_notes
    @preprocessing_configuration.setter
    def preprocessing_configuration(self, val):
        self.training_notes = val

    @property
    def training_date(self):
        return self.created_at

    @property
    def model_metrics(self):
        return self.metrics_json
    @model_metrics.setter
    def model_metrics(self, val):
        self.metrics_json = val

    @property
    def is_synthetic(self):
        return self.is_synthetic_trained
    @is_synthetic.setter
    def is_synthetic(self, val):
        self.is_synthetic_trained = val


class ClaimAssessment(Base):
    __tablename__ = "claim_assessments"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False)
    model_id = Column(Integer, ForeignKey("trained_models.id"), nullable=False)
    
    # Model Outputs
    prediction_label = Column(String(30), nullable=True)      # e.g., 'Approved', 'Rejected'
    prediction_probability = Column(Float, nullable=True)     # 0.0 to 1.0
    payout_estimate = Column(Float, nullable=True)            # in INR
    base_value = Column(Float, nullable=True)                 # E[f(x)]
    
    # SHAP & Explanations
    shap_values_json = Column(Text, default="{}")             # Local SHAP values per feature
    farmer_friendly_summary = Column(Text, nullable=False)
    missing_evidence_notes = Column(Text, nullable=True)
    data_quality_status = Column(String(50), default="Clean")
    
    assessed_at = Column(DateTime, default=utc_now)

    @property
    def prediction(self):
        return self.prediction_label
    @prediction.setter
    def prediction(self, val):
        self.prediction_label = val

    @property
    def estimated_payout(self):
        return self.payout_estimate
    @estimated_payout.setter
    def estimated_payout(self, val):
        self.payout_estimate = val

    @property
    def assessment_date(self):
        return self.assessed_at

    @property
    def explanation_summary(self):
        return self.farmer_friendly_summary
    @explanation_summary.setter
    def explanation_summary(self, val):
        self.farmer_friendly_summary = val

    # Relationships
    claim = relationship("Claim", back_populates="assessments")
    model = relationship("TrainedModel")


class HumanReview(Base):
    __tablename__ = "human_reviews"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False)
    reviewer_name = Column(String(100), nullable=False)
    reviewer_role = Column(String(50), default="Claim Assessor")
    review_decision = Column(String(50), nullable=False) # Approved, Rejected, Additional Evidence Required, Escalated
    differs_from_model = Column(Boolean, default=False)
    rationale = Column(Text, nullable=False)
    required_evidence = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, default=utc_now)

    @property
    def reviewer(self):
        return self.reviewer_name
    @reviewer.setter
    def reviewer(self, val):
        self.reviewer_name = val

    @property
    def review_notes(self):
        return self.rationale
    @review_notes.setter
    def review_notes(self, val):
        self.rationale = val

    @property
    def review_date(self):
        return self.reviewed_at

    claim = relationship("Claim", back_populates="reviews")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=True)
    event_type = Column(String(50), nullable=False)
    actor = Column(String(100), default="System")
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    details = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=utc_now)

    @property
    def action(self):
        return self.event_type
    @action.setter
    def action(self, val):
        self.event_type = val

    claim = relationship("Claim", back_populates="audit_events")


class FarmerChatHistory(Base):
    __tablename__ = "farmer_chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=True)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    language_code = Column(String(20), default="en-IN")
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="chat_messages")
    claim = relationship("Claim")

