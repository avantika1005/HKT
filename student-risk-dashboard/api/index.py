import sys
import os

# Add the backend directory to sys.path so we can import main
# This allows us to keep the backend code in the 'backend' folder
backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.append(backend_path)

from main import app

# Vercel's Python runtime expects the variable 'app' to be exported
