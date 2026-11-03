from backend.app.database.session import engine, Base
import backend.app.database.models # register all tables

def init_database():
    """Initializes SQLite database tables without dropping existing data."""
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_database()
    print("Database tables initialized successfully.")

