import os
import sys

# Ensure the backend directory is in the path
backend_path = os.path.join(os.path.dirname(__file__), "..", "student-risk-dashboard", "backend")
sys.path.append(backend_path)

# Import the FastAPI app from main.py
from main import app as application

# This exposes the FastAPI app to Vercel