"""Settings: `.env` locally, secrets/variables in GitHub Actions. Real environment variables win."""

import os
from pathlib import Path

from dotenv import load_dotenv

from carlos_cms.out import fail

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env', override=False)

DRAFTS = ROOT / 'drafts'
SEED_FILE = ROOT / 'supabase' / 'seed' / 'content.json'
MEDIA_DIR = ROOT / 'public' / 'media'
PORTRAIT_FILE = ROOT / 'src' / 'assets' / 'portrait.jpg'
SITE_URL = os.environ.get('SITE_URL', 'https://carlos.nz').rstrip('/')


def need(name: str) -> str:
    """A required setting; stops with a clear message when it's missing."""
    value = os.environ.get(name, '').strip()
    if not value:
        fail(f'Missing {name}. Add it to .env (see .env.example).')
    return value


def get(name: str, default: str = '') -> str:
    return os.environ.get(name, default).strip()
