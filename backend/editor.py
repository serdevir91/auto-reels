import os
import subprocess
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("auto_reels_editor")

FONT_PATH = "C\\:/Windows/Fonts/arial.ttf"

def escape_ffmpeg_text(text: str) -> str:
    """Escapes special characters for FFmpeg drawtext filter."""
    text = text.replace("\\", "\\\\")
    text = text.replace("'", "'\\\\''")
    text = text.replace(":", "\\:")
    text = text.replace("%", "\\%")
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
    y_percent: float = 85.0
) -> dict:
    """
    Overlays text on video using FFmpeg drawtext with exact positioning.
    """
    if not os.path.exists(input_path):
        return {"success": False, "error": f"Input file not found: {input_path}"}
    
    escaped_text = escape_ffmpeg_text(text.strip())
    
    # Position logic
    if position == "top":
        pos_expr = "x=(w-text_w)/2:y=h*0.1"
    elif position == "center":
        pos_expr = "x=(w-text_w)/2:y=(h-text_h)/2"
    elif position == "bottom":
        pos_expr = "x=(w-text_w)/2:y=h*0.82-text_h"
    else: # Custom drag & drop positioning
        # Clamp percentages between 0 and 100
        xp = max(0.0, min(100.0, float(x_percent))) / 100.0
        yp = max(0.0, min(100.0, float(y_percent))) / 100.0
        pos_expr = f"x=(w-text_w)*{xp:.3f}:y=(h-text_h)*{yp:.3f}"
        
    # Background Box logic
    box_expr = "box=0"
    if bg_color == "black":
        box_expr = "box=1:boxcolor=black@0.65:boxborderw=12"
    elif bg_color == "white":
        box_expr = "box=1:boxcolor=white@0.85:boxborderw=12:fontcolor=black"
    elif bg_color == "yellow":
        box_expr = "box=1:boxcolor=yellow@0.9:boxborderw=12:fontcolor=black"
    elif bg_color == "red":
        box_expr = "box=1:boxcolor=red@0.85:boxborderw=12"

    # Override color if black text is needed on light box
    text_color = color
    if bg_color in ["white", "yellow"] and color == "white":
        text_color = "black"

    vf_filter = f"drawtext=fontfile='{FONT_PATH}':text='{escaped_text}':fontsize={font_size}:fontcolor={text_color}:{pos_expr}:{box_expr}"
    
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-vf", vf_filter,
        "-c:a", "copy",
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
        return {"success": False, "error": e.stderr or "FFmpeg processing failed"}
    except Exception as e:
        logger.error(f"Unexpected editor error: {e}")
        return {"success": False, "error": str(e)}
