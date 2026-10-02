"""Small text helpers shared by several commands."""

import re
import unicodedata


def slugify(value: str) -> str:
    """'Café in Tāmaki Makaurau' -> 'cafe-in-tamaki-makaurau' (same rules as the database)."""
    plain = unicodedata.normalize('NFD', value).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9]+', '-', plain.lower()).strip('-')


_LITTLE_TEXT_RESERVED = re.compile(r'([\\|{}@\[\]()<>#*_~])')


def escape_little_text(text: str) -> str:
    """LinkedIn post commentary uses 'little text format': reserved characters need a backslash."""
    return _LITTLE_TEXT_RESERVED.sub(r'\\\1', text)
