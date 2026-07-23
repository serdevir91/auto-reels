import os
import sys
import subprocess
import webbrowser
import time

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

    print("==================================================")
    print("       Auto-Reels Server Starting... ")
    print("==================================================")

    # 1. Install dependencies if needed
    print("[1/3] Ensuring required packages are installed...")
    subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt", "--quiet"], check=False)

    # 2. Open browser automatically after 1.5 seconds
    def open_browser():
        time.sleep(1.5)
        print("Opening http://localhost:8000 in your browser...")
        webbrowser.open("http://localhost:8000")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # 3. Launch uvicorn server
    print("[2/3] Launching FastAPI App on http://localhost:8000 ...")
    print("[3/3] Press Ctrl+C to stop the server.")
    print("--------------------------------------------------")

    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
    main()
