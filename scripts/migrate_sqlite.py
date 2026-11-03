import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "xai_cropinsure.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

def get_columns(table):
    cursor.execute(f"PRAGMA table_info({table})")
    return [c[1] for c in cursor.fetchall()]

# 1. Check trained_models
tm_cols = get_columns("trained_models")
print("trained_models existing columns:", tm_cols)
if "dataset_id" not in tm_cols:
    print("Adding dataset_id to trained_models...")
    cursor.execute("ALTER TABLE trained_models ADD COLUMN dataset_id INTEGER")
if "training_records" not in tm_cols:
    print("Adding training_records to trained_models...")
    cursor.execute("ALTER TABLE trained_models ADD COLUMN training_records INTEGER DEFAULT 0")

conn.commit()
print("Migration completed successfully!")
conn.close()

