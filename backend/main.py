import os
import subprocess
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from backend.downloader import get_video_info, download_video, detect_platform
from backend.editor import add_text_to_video

app = FastAPI(title="auto-reels API", version="1.0.0")

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
DOWNLOADS_DIR = BASE_DIR / "downloads"
FRONTEND_DIR = BASE_DIR / "frontend"

os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(FRONTEND_DIR, exist_ok=True)

# Mount static downloads directory for media playback
app.mount("/media", StaticFiles(directory=str(DOWNLOADS_DIR)), name="media")

class URLRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    format: Optional[str] = "mp4"

class DeleteRequest(BaseModel):
    filename: str

class EditRequest(BaseModel):
    filename: str
    text: str
    font_size: Optional[int] = 40
    color: Optional[str] = "white"
    bg_color: Optional[str] = "black"
    position: Optional[str] = "bottom"


@app.post("/api/info")
def api_get_info(req: URLRequest):
    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    info = get_video_info(req.url.strip())
    return info

@app.post("/api/download")
def api_download_video(req: DownloadRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    
    fmt = req.format if req.format in ["mp4", "mp3"] else "mp4"
    result = download_video(url=url, format_type=fmt, output_dir=str(DOWNLOADS_DIR))
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Download failed"))
    
    return result

@app.get("/api/history")
def api_get_history():
    files = []
    if os.path.exists(DOWNLOADS_DIR):
        for f in sorted(os.listdir(DOWNLOADS_DIR), key=lambda x: os.path.getmtime(os.path.join(DOWNLOADS_DIR, x)), reverse=True):
            filepath = os.path.join(DOWNLOADS_DIR, f)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                ext = Path(f).suffix.lower()
                
                # Determine platform from prefix
                platform = "generic"
                if f.startswith("tiktok_"): platform = "tiktok"
                elif f.startswith("instagram_"): platform = "instagram"
                elif f.startswith("youtube_shorts_"): platform = "youtube_shorts"
                elif f.startswith("youtube_"): platform = "youtube"
                
                files.append({
                    "filename": f,
                    "media_url": f"/media/{f}",
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "ext": ext.replace(".", ""),
                    "platform": platform,
                    "created_at": stat.st_mtime
                })
    return {"files": files}

@app.post("/api/open-folder")
def api_open_folder():
    try:
        if os.name == 'nt': # Windows
            os.startfile(str(DOWNLOADS_DIR))
            return {"success": True, "message": "Opened folder in File Explorer"}
        else:
            return {"success": False, "message": "Supported on Windows OS"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/delete-file")
def api_delete_file(req: DeleteRequest):
    target = DOWNLOADS_DIR / req.filename
    if target.exists() and target.is_file():
        os.remove(target)
        return {"success": True, "filename": req.filename}
    raise HTTPException(status_code=404, detail="File not found")

@app.post("/api/edit-video")
def api_edit_video(req: EditRequest):
    if not req.filename or not req.text.strip():
        raise HTTPException(status_code=400, detail="Filename and text are required")
    
    input_file = DOWNLOADS_DIR / req.filename
    if not input_file.exists():
        raise HTTPException(status_code=404, detail="Original video file not found")
        
    output_filename = f"edited_{Path(req.filename).stem}.mp4"
    output_file = DOWNLOADS_DIR / output_filename
    
    res = add_text_to_video(
        input_path=str(input_file),
        output_path=str(output_file),
        text=req.text,
        font_size=req.font_size or 40,
        color=req.color or "white",
        bg_color=req.bg_color or "black",
        position=req.position or "bottom"
    )
    
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Video editing failed"))
        
    return {
        "success": True,
        "filename": output_filename,
        "media_url": f"/media/{output_filename}"
    }

# Serve frontend at root URL
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
