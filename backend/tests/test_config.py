import os
import unittest
from unittest.mock import patch

from app.config import _database_url


class DatabaseUrlTests(unittest.TestCase):
    def test_repairs_http_scheme_only_for_complete_postgres_dsn(self):
        dsn = "https://app_user:secret@pooler.example.com:5432/postgres?sslmode=require"
        with patch.dict(os.environ, {"DATABASE_URL": dsn}):
            result = _database_url()
        self.assertEqual(
            result,
            "postgresql+psycopg://app_user:secret@pooler.example.com:5432/postgres?sslmode=require",
        )

    def test_rejects_supabase_api_url_with_actionable_message(self):
        with patch.dict(os.environ, {"DATABASE_URL": "https://project-ref.supabase.co"}):
            with self.assertRaisesRegex(RuntimeError, "Supabase API/project URL"):
                _database_url()

    def test_converts_legacy_postgres_scheme(self):
        dsn = "postgres://app_user:secret@pooler.example.com:5432/postgres"
        with patch.dict(os.environ, {"DATABASE_URL": dsn}):
            result = _database_url()
        self.assertEqual(
            result,
            "postgresql://app_user:secret@pooler.example.com:5432/postgres",
        )


if __name__ == "__main__":
    unittest.main()
