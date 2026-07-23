import os
import re
import time
import logging
from pathlib import Path
import yt_dlp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("auto_reels_downloader")

def detect_platform(url: str) -> str:
    """Detects platform based on URL pattern."""
    url_lower = url.lower()
    if "tiktok.com" in url_lower or "vt.tiktok" in url_lower or "vm.tiktok" in url_lower:
        return "tiktok"
    elif "instagram.com" in url_lower or "instagr.am" in url_lower:
        return "instagram"
    elif "youtube.com" in url_lower or "youtu.be" in url_lower:
        if "/shorts/" in url_lower:
            return "youtube_shorts"
        return "youtube"
    elif "twitter.com" in url_lower or "x.com" in url_lower:
        return "twitter"
    return "generic"

def clean_filename(name: str) -> str:
    """Removes invalid filename characters."""
    return re.sub(r'[\\/*?:"<>|]', "", name).strip()

def get_video_info(url: str) -> dict:
    """Extracts metadata without downloading."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'skip_download': True,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            platform = detect_platform(url)
            
            # Resolve playlist / entries if applicable
            if 'entries' in info and len(info['entries']) > 0:
                info = info['entries'][0]
                
            return {
                "success": True,
                "title": info.get("title") or "Untitled Video",
                "duration": info.get("duration") or 0,
                "thumbnail": info.get("thumbnail") or info.get("thumbnails", [{}])[-1].get("url", ""),
                "uploader": info.get("uploader") or info.get("channel") or info.get("creator") or "Unknown",
                "platform": platform,
                "url": url,
                "view_count": info.get("view_count") or 0,
                "like_count": info.get("like_count") or 0,
            }
        except Exception as e:
            logger.error(f"Error fetching info for {url}: {e}")
            return {
                "success": False,
                "error": str(e),
                "platform": detect_platform(url),
                "url": url
            }

def download_video(url: str, format_type: str = "mp4", output_dir: str = "downloads", progress_callback=None) -> dict:
    """
    Downloads video/audio from TikTok, Instagram Reels, YouTube Shorts, etc.
    format_type: 'mp4' (video) or 'mp3' (audio only)
    """
    os.makedirs(output_dir, exist_ok=True)
    platform = detect_platform(url)
    
    # Custom progress hook wrapper
    def ydl_hook(d):
        if progress_callback and d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes', 0)
            percent = (downloaded / total * 100) if total > 0 else 0
            speed = d.get('speed', 0) or 0
            speed_str = f"{speed / (1024*1024):.2f} MB/s" if speed else "N/A"
            eta = d.get('eta', 0) or 0
            eta_str = f"{eta}s" if eta else "N/A"
            
            progress_callback({
                "status": "downloading",
                "percent": round(percent, 1),
                "downloaded_bytes": downloaded,
                "total_bytes": total,
                "speed": speed_str,
                "eta": eta_str,
                "filename": d.get('filename', '')
            })
        elif progress_callback and d['status'] == 'finished':
            progress_callback({
                "status": "processing",
                "percent": 100.0,
                "speed": "Done",
                "eta": "0s",
                "filename": d.get('filename', '')
            })

    output_template = os.path.join(output_dir, f"{platform}_%(id)s.%(ext)s")
    
    ydl_opts = {
        'outtmpl': output_template,
        'quiet': True,
        'no_warnings': True,
        'progress_hooks': [ydl_hook],
        'overwrites': True,
    }
    
    if format_type == "mp3":
        ydl_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        })
    else:
        # High quality MP4 video
        ydl_opts.update({
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'merge_output_format': 'mp4',
        })
        
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=True)
            if 'entries' in info and len(info['entries']) > 0:
                info = info['entries'][0]
                
            downloaded_filename = ydl.prepare_filename(info)
            if format_type == "mp3":
                downloaded_filename = os.path.splitext(downloaded_filename)[0] + ".mp3"
                
            basename = os.path.basename(downloaded_filename)
            file_size = os.path.getsize(downloaded_filename) if os.path.exists(downloaded_filename) else 0

            return {
                "success": True,
                "title": info.get("title") or "Downloaded Media",
                "filename": basename,
                "filepath": downloaded_filename,
                "file_size": file_size,
                "duration": info.get("duration") or 0,
                "thumbnail": info.get("thumbnail") or info.get("thumbnails", [{}])[-1].get("url", ""),
                "platform": platform,
                "format": format_type,
                "uploader": info.get("uploader") or info.get("channel") or "Unknown",
                "download_time": time.time(),
                "url": url,
            }
        except Exception as e:
            logger.error(f"Download failed for {url}: {e}")
            return {
                "success": False,
                "error": str(e),
                "platform": platform,
                "url": url
            }
