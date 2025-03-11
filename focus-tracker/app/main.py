# app/main.py
import time
import logging
import os
import glob
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.endpoints import alerts
from app.core.settings import settings

# Configure logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Function to clean screenshots directory
def clean_screenshots_directory():
    """Remove all files from the screenshots directory"""
    screenshots_dir = "screenshots"  # Use the same directory name as in Monitor initialization
    
    if os.path.exists(screenshots_dir):
        # Clear all files in the screenshots directory
        files = glob.glob(os.path.join(screenshots_dir, "*"))
        for f in files:
            try:
                if os.path.isfile(f):
                    os.remove(f)
                    logger.info(f"Startup cleanup: Removed old screenshot: {f}")
            except Exception as e:
                logger.error(f"Error removing file {f}: {e}")
        logger.info(f"Cleaned screenshots directory: {screenshots_dir}")
    else:
        # Create the directory if it doesn't exist
        os.makedirs(screenshots_dir)
        logger.info(f"Created screenshots directory at {screenshots_dir}")

# Clean screenshots directory on startup
clean_screenshots_directory()

app = FastAPI(
    title="Focus Tracker API",
    description="API for monitoring user focus through screenshot analysis",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include our router
app.include_router(alerts.router)

# Find the correct path to the static directory
static_directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
logger.info(f"Serving static files from: {static_directory}")

# Mount static files directory
app.mount("/static", StaticFiles(directory=static_directory), name="static")

@app.get("/")
async def read_root():
    """Root endpoint - serve the index.html file"""
    index_path = os.path.join(static_directory, "index.html")
    logger.info(f"Serving index.html from: {index_path}")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        logger.error(f"Index file not found at: {index_path}")
        return {"error": "Index file not found"}

@app.get("/health")
def health_check():
    """Health check endpoint"""
    logger.info("Health check request received")
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "api_version": "1.0.0"
    }

# Add a catch-all route at the end of the file to handle page refreshes
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    """Handle all other routes - serves the index.html for client-side routing"""
    index_path = os.path.join(static_directory, "index.html")
    logger.info(f"Catch-all route accessed for path: {full_path} - serving index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        logger.error(f"Index file not found at: {index_path}")
        return {"error": "Index file not found"}