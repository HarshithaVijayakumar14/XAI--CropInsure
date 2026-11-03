from typing import List, Tuple
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer

DEFAULT_NUMERIC_FEATURES = [
    "rainfall_deficit",
    "relative_rainfall_deficit",
    "ndvi_change",
    "temperature_anomaly",
    "soil_moisture",
    "cultivated_area"
]

DEFAULT_CATEGORICAL_FEATURES = [
    "crop_type",
    "season",
    "state"
]

def build_preprocessor(numeric_features: List[str], categorical_features: List[str]) -> ColumnTransformer:
    """
    Constructs a ColumnTransformer for preprocessing agricultural data.
    - Fits imputation and scaling strictly on training sets.
    - OneHotEncoder ignores unknown categories during inference without error.
    """
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value='Unknown')),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ],
        remainder='drop'
    )
    return preprocessor

