import sys
import os

# Add root directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.ml.synthetic_generator import generate_synthetic_agricultural_data
from backend.app.config import settings

def main():
    print("=" * 60)
    print("XAI-CropInsure: Synthetic Demonstration Data Generator")
    print("=" * 60)
    print("ETHICAL & SCIENTIFIC NOTICE:")
    print("SYNTHETIC DEMONSTRATION DATA — NOT REAL FARMER OR INSURANCE RECORDS.")
    print("=" * 60)

    output_file = os.path.join(settings.DATA_DIR, "demo", "synthetic_crop_claims_demo.csv")
    df = generate_synthetic_agricultural_data(num_samples=500, random_seed=42, save_path=output_file)

    print(f"Successfully generated {len(df)} synthetic crop insurance claim records.")
    print(f"Saved to: {output_file}")
    print(f"Columns: {list(df.columns)}")
    print(f"Historical outcomes distribution:\n{df['historical_outcome'].value_counts()}")
    print("=" * 60)

if __name__ == "__main__":
    main()

