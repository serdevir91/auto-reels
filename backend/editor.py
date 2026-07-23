import os
import subprocess
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("auto_reels_editor")

WIN_FONT_PATH = "C:/Windows/Fonts/arial.ttf"
WIN_FONT_ESCAPED = "C\\:/Windows/Fonts/arial.ttf"

def escape_ffmpeg_text(text: str) -> str:
    """Escapes special characters for FFmpeg drawtext filter."""
    text = text.replace("\\", "/")
    text = text.replace("'", "")
    text = text.replace(":", "\\:")
    text = text.replace("%", "\\%")
    text = text.replace('"', '')
    return text

def add_text_to_video(
    input_path: str,
    output_path: str,
    text: str,
    font_size: int = 40,
    color: str = "white",
    bg_color: str = "black",
    position: str = "bottom",
    x_percent: float = 50.0,
    y_percent: float = 50.0
) -> dict:
    """
    Overlays text on video using FFmpeg drawtext with smooth H264 faststart & AAC audio.
    """
    if not os.path.exists(input_path):
        return {"success": False, "error": f"Input file not found: {input_path}"}
    
    clean_txt = escape_ffmpeg_text(text.strip())
    
    # Position calculation
    if position == "top":
        pos_expr = "x=(w-text_w)/2:y=h*0.1"
    elif position == "center":
        pos_expr = "x=(w-text_w)/2:y=(h-text_h)/2"
    elif position == "bottom":
        pos_expr = "x=(w-text_w)/2:y=h*0.82-text_h"
    else: # custom
        xp = max(0.02, min(0.98, float(x_percent) / 100.0))
        yp = max(0.02, min(0.98, float(y_percent) / 100.0))
        pos_expr = f"x=(w-text_w)*{xp:.3f}:y=(h-text_h)*{yp:.3f}"
        
    # Background Box calculation
    box_expr = "box=0"
    if bg_color == "black":
        box_expr = "box=1:boxcolor=black@0.7:boxborderw=12"
    elif bg_color == "white":
        box_expr = "box=1:boxcolor=white@0.9:boxborderw=12"
    elif bg_color == "yellow":
        box_expr = "box=1:boxcolor=yellow@0.95:boxborderw=12"
    elif bg_color == "red":
        box_expr = "box=1:boxcolor=red@0.85:boxborderw=12"

    text_color = color
    if color == "black":
        text_color = "black"

    font_param = f":fontfile='{WIN_FONT_ESCAPED}'" if os.path.exists(WIN_FONT_PATH) else ""
    vf_filter = f"drawtext=text='{clean_txt}'{font_param}:fontsize={font_size}:fontcolor={text_color}:{pos_expr}:{box_expr}"
    
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-vf", vf_filter,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-b:a", "128k",
        output_path
    ]
    
    logger.info(f"Running FFmpeg: {' '.join(cmd)}")
    
    try:
        process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return {"success": True, "output_path": output_path}
        else:
            return {"success": False, "error": "FFmpeg output missing"}
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg error: {e.stderr}")
        return {"success": False, "error": e.stderr or "FFmpeg error"}
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return {"success": False, "error": str(e)}
