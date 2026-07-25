import os
import re
import time
import logging
import urllib.parse
from pathlib import Path
from typing import Optional, Dict, Any
import requests
import yt_dlp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("auto_reels_downloader")

# Base directory paths
BASE_DIR = Path(__file__).resolve().parent.parent
COOKIES_FILE_1 = BASE_DIR / "cookies.txt"
COOKIES_FILE_2 = BASE_DIR / "instagram_cookies.txt"

def get_cookie_file() -> Optional[str]:
    """Returns path to cookies.txt if it exists."""
    if COOKIES_FILE_1.exists():
        return str(COOKIES_FILE_1)
    if COOKIES_FILE_2.exists():
        return str(COOKIES_FILE_2)
    return None

def clean_url_string(u: str) -> str:
    """Unescapes slashes, unicode escapes, and percent-encoding in extracted video URLs."""
    if not u:
        return ""
    u = u.replace('\\/', '/').replace('\\\\', '')
    u = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), u)
    u = urllib.parse.unquote(u)
    return u.strip()

def normalize_url(url: str) -> str:
    """Normalizes and cleans social media video URLs."""
    if not url:
        return ""
    url = url.strip()
    
    # Instagram Normalization
    if "instagram.com" in url.lower() or "instagr.am" in url.lower():
        match = re.search(r'instagram\.com/(?:reel|reels|p|tv|share/reel)/([A-Za-z0-9_-]+)', url, re.IGNORECASE)
        if match:
            return f"https://www.instagram.com/reel/{match.group(1)}/"
            
    # YouTube Shorts Normalization
    if "youtube.com/shorts/" in url.lower() or "youtu.be/" in url.lower():
        match = re.search(r'(?:shorts/|youtu\.be/)([A-Za-z0-9_-]+)', url, re.IGNORECASE)
        if match:
            return f"https://www.youtube.com/shorts/{match.group(1)}"
            
    # Remove tracking query parameters if present
    if "?" in url:
        base, query = url.split("?", 1)
        if "instagram.com" in url or "youtube.com" in url or "tiktok.com" in url:
            url = base
            
    return url

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

def extract_instagram_embed_fallback(url: str) -> Optional[Dict[str, Any]]:
    """
    Fallback method for Instagram Reels using direct embed HTML scraping.
    Works for many public posts when yt-dlp faces API block.
    """
    match = re.search(r'/(?:reel|reels|p|tv|share/reel)/([A-Za-z0-9_-]+)', url)
    if not match:
        return None
        
    code = match.group(1)
    embed_url = f"https://www.instagram.com/p/{code}/embed/captioned/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    
    try:
        r = requests.get(embed_url, headers=headers, timeout=8)
        if r.status_code != 200:
            return None
            
        text_raw = r.text
        text_clean = text_raw.replace('\\/', '/').replace('\\u0026', '&').replace('\\"', '"')
        
        video_url_match = re.search(r'"video_url"\s*:\s*"([^"]+)"', text_raw) or re.search(r'"video_url"\s*:\s*"([^"]+)"', text_clean)
        display_url_match = re.search(r'"display_url"\s*:\s*"([^"]+)"', text_raw) or re.search(r'"display_url"\s*:\s*"([^"]+)"', text_clean)
        caption_match = re.search(r'<div class="CaptionText">([\s\S]*?)</div>', r.text) or re.search(r'"caption"\s*:\s*"([^"]+)"', text_clean)
        username_match = re.search(r'"username"\s*:\s*"([^"]+)"', text_clean) or re.search(r'<a class="UsernameText"[^>]*>([^<]+)</a>', r.text)

        video_url = video_url_match.group(1) if video_url_match else None
        
        # Fallback to direct mp4 regex search
        if not video_url:
            mp4_matches = re.findall(r'https://[^\s"<>\'\\]+?\.mp4[^\s"<>\'\\]*', text_clean) or re.findall(r'https:\\[^\s"<>\'\\]+?\.mp4[^\s"<>\'\\]*', text_raw)
            if mp4_matches:
                video_url = mp4_matches[0]

        if video_url:
            video_url = clean_url_string(video_url)
            thumbnail = clean_url_string(display_url_match.group(1)) if display_url_match else ""
            title = caption_match.group(1).strip() if caption_match else "Instagram Reel"
            title = re.sub(r'<[^>]+>', '', title) # strip HTML tags
            uploader = username_match.group(1) if username_match else "Instagram User"
            
            return {
                "success": True,
                "title": title[:100],
                "duration": 0,
                "thumbnail": thumbnail,
                "uploader": uploader,
                "platform": "instagram",
                "url": url,
                "view_count": 0,
                "like_count": 0,
                "direct_video_url": video_url,
                "shortcode": code
            }
    except Exception as e:
        logger.warning(f"Instagram embed fallback error for {url}: {e}")
        
    return None

def get_base_ydl_opts(platform: str) -> dict:
    """Returns optimized options for yt-dlp based on platform."""
    cookie_path = get_cookie_file()
    
    opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'noplaylist': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Mode': 'navigate',
        },
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web', 'mweb', 'ios'],
                'player_skip': ['configs', 'webpage']
            },
            'instagram': {
                'check_post_verification': False
            }
        }
    }
    
    if cookie_path:
        opts['cookiefile'] = cookie_path
        
    return opts

def get_video_info(url: str) -> dict:
    """Extracts metadata without downloading."""
    normalized_url = normalize_url(url)
    platform = detect_platform(normalized_url)
    ydl_opts = get_base_ydl_opts(platform)
    ydl_opts['skip_download'] = True
    
    # 1. Try yt-dlp standard extraction
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(normalized_url, download=False)
            if 'entries' in info and len(info['entries']) > 0:
                info = info['entries'][0]
                
            return {
                "success": True,
                "title": info.get("title") or f"{platform.capitalize()} Video",
                "duration": info.get("duration") or 0,
                "thumbnail": info.get("thumbnail") or info.get("thumbnails", [{}])[-1].get("url", ""),
                "uploader": info.get("uploader") or info.get("channel") or info.get("creator") or "Unknown",
                "platform": platform,
                "url": normalized_url,
                "view_count": info.get("view_count") or 0,
                "like_count": info.get("like_count") or 0,
            }
        except Exception as e:
            logger.warning(f"yt-dlp info failed for {normalized_url}: {e}")

    # 2. Try Instagram Embed Fallback if Instagram
    if platform == "instagram":
        fallback_info = extract_instagram_embed_fallback(normalized_url)
        if fallback_info:
            return fallback_info

    # 3. Try browser cookies for yt-dlp as secondary fallback
    if platform in ["instagram", "youtube_shorts", "youtube"]:
        for browser in ['chrome', 'edge', 'firefox']:
            try:
                opts = ydl_opts.copy()
                opts['cookiesfrombrowser'] = (browser,)
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(normalized_url, download=False)
                    if 'entries' in info and len(info['entries']) > 0:
                        info = info['entries'][0]
                    return {
                        "success": True,
                        "title": info.get("title") or f"{platform.capitalize()} Video",
                        "duration": info.get("duration") or 0,
                        "thumbnail": info.get("thumbnail") or info.get("thumbnails", [{}])[-1].get("url", ""),
                        "uploader": info.get("uploader") or info.get("channel") or "Unknown",
                        "platform": platform,
                        "url": normalized_url,
                        "view_count": info.get("view_count") or 0,
                        "like_count": info.get("like_count") or 0,
                    }
            except Exception:
                continue

    # Diagnostic error response
    error_msg = "Video bilgileri alınamadı. Lütfen linkin geçerli ve herkese açık olduğunu kontrol edin."
    if platform == "instagram":
        error_msg += " (Instagram gizli hesaplar veya IP engeli nedeniyle cookies.txt gerektirebilir)."
        
    return {
        "success": False,
        "error": error_msg,
        "platform": platform,
        "url": normalized_url
    }

def download_video(url: str, format_type: str = "mp4", output_dir: str = "downloads", progress_callback=None) -> dict:
    """
    Downloads video/audio from TikTok, Instagram Reels, YouTube Shorts, etc.
    format_type: 'mp4' (video) or 'mp3' (audio only)
    """
    os.makedirs(output_dir, exist_ok=True)
    normalized_url = normalize_url(url)
    platform = detect_platform(normalized_url)
    
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
    ydl_opts = get_base_ydl_opts(platform)
    ydl_opts.update({
        'outtmpl': output_template,
        'progress_hooks': [ydl_hook],
        'overwrites': True,
    })
    
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
        # Robust format fallback (tries bestvideo+bestaudio, then best)
        ydl_opts.update({
            'format': 'bestvideo*+bestaudio/best[ext=mp4]/best',
            'merge_output_format': 'mp4',
        })

    # 1. Try yt-dlp main download
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(normalized_url, download=True)
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
                "url": normalized_url,
            }
        except Exception as e:
            logger.warning(f"Primary yt-dlp download failed for {normalized_url}: {e}")

    # 2. Instagram Direct Embed Downloader Fallback
    if platform == "instagram":
        logger.info("Attempting Instagram direct embed downloader fallback...")
        fallback_info = extract_instagram_embed_fallback(normalized_url)
        if fallback_info and fallback_info.get("direct_video_url"):
            try:
                direct_url = clean_url_string(fallback_info["direct_video_url"])
                code = fallback_info.get("shortcode") or "reel"
                ext = "mp3" if format_type == "mp3" else "mp4"
                filename = f"instagram_{code}.{ext}"
                filepath = os.path.join(output_dir, filename)
                
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                }
                
                logger.info(f"Downloading direct Instagram embed URL: {direct_url[:80]}...")
                res = requests.get(direct_url, headers=headers, stream=True, timeout=25)
                if res.status_code == 200:
                    total_len = int(res.headers.get('content-length', 0))
                    dl_len = 0
                    
                    with open(filepath, 'wb') as f:
                        for chunk in res.iter_content(chunk_size=65536):
                            if chunk:
                                f.write(chunk)
                                dl_len += len(chunk)
                                if progress_callback and total_len > 0:
                                    percent = round((dl_len / total_len) * 100, 1)
                                    progress_callback({
                                        "status": "downloading",
                                        "percent": percent,
                                        "downloaded_bytes": dl_len,
                                        "total_bytes": total_len,
                                        "speed": "Fast",
                                        "eta": "0s",
                                        "filename": filename
                                    })
                                    
                    file_size = os.path.getsize(filepath) if os.path.exists(filepath) else 0
                    
                    return {
                        "success": True,
                        "title": fallback_info.get("title") or "Instagram Reel",
                        "filename": filename,
                        "filepath": filepath,
                        "file_size": file_size,
                        "duration": 0,
                        "thumbnail": fallback_info.get("thumbnail") or "",
                        "platform": "instagram",
                        "format": format_type,
                        "uploader": fallback_info.get("uploader") or "Instagram User",
                        "download_time": time.time(),
                        "url": normalized_url,
                    }
                else:
                    logger.warning(f"Direct Instagram embed download HTTP status: {res.status_code}")
            except Exception as e:
                logger.error(f"Instagram embed direct download error: {e}")

    # 3. Try fallback with browser cookies
    if platform in ["instagram", "youtube_shorts", "youtube"]:
        for browser in ['chrome', 'edge', 'firefox']:
            try:
                opts = ydl_opts.copy()
                opts['cookiesfrombrowser'] = (browser,)
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(normalized_url, download=True)
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
                        "thumbnail": info.get("thumbnail") or "",
                        "platform": platform,
                        "format": format_type,
                        "uploader": info.get("uploader") or "Unknown",
                        "download_time": time.time(),
                        "url": normalized_url,
                    }
            except Exception:
                continue

    return {
        "success": False,
        "error": f"Video indirilemedi ({platform}). Lütfen linki kontrol edin.",
        "platform": platform,
        "url": normalized_url
    }
