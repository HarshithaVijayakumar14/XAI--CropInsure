from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class DatasetUploadResponse(BaseModel):
    id: int
    name: str
    row_count: int
    column_count: int
    columns: List[str]
    missing_summary: Dict[str, Any]
    quality_summary: Dict[str, Any]
    preview: List[Dict[str, Any]]
    is_synthetic: bool

class DatasetResponse(BaseModel):
    id: int
    name: str
    source: str
    category: str
    row_count: int
    column_count: int
    columns_json: str
    missing_summary: str
    quality_summary: str
    is_synthetic: bool
    import_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ColumnMappingRequest(BaseModel):
    mapping: Dict[str, str]  # target_standard_col: csv_col
