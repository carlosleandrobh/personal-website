"""Supabase client with the server-side secret key. Never use this key in browser code."""

from functools import cache

from supabase import Client, create_client

from carlos_cms.config import need


@cache
def db() -> Client:
    return create_client(need('SUPABASE_URL'), need('SUPABASE_SECRET_KEY'))
