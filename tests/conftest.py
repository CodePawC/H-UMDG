import os
import sys
from pathlib import Path

os.environ.setdefault("API_KEY", "change-me")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://umdg:umdg@localhost:5432/umdg")

BACKEND_SRC = Path(__file__).resolve().parents[1] / "src" / "backend"
sys.path.insert(0, str(BACKEND_SRC))
