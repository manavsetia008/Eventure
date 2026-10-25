import os

if __name__ == "__main__":
    # Tells the app it is running under the Flask reloader, so only the child process starts the scheduler.
    os.environ.setdefault("EVENTURE_DEBUG", "1")

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
