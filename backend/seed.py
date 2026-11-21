"""Database initialization script.

    python seed.py --reset    (resets all tables cleanly with 0 dummy accounts)

No demo data or dummy accounts are created. Clean production baseline.
"""
import sys

from app import create_app
from app.extensions import db


def main():
    app = create_app()
    with app.app_context():
        if "--reset" in sys.argv:
            db.drop_all()
            print("Dropped all existing tables.")
        db.create_all()
        print("Database schema initialized cleanly with 0 demo data.")


if __name__ == "__main__":
    main()
