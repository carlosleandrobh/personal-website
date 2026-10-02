"""Labs: tools and experiments. Only a name and an https link are required."""

import datetime as dt
from typing import Any

STATUSES = ('live', 'testing', 'archived')


def build_row(
    *,
    name: str,
    url: str,
    status: str = 'testing',
    category: str = 'Self-hosted',
    summary: str | None = None,
    tags: str | None = None,
    icon: str | None = None,
    learned: str | None = None,
    featured: bool = False,
) -> dict[str, Any]:
    if not name.strip():
        raise ValueError('A lab needs a name.')
    if not url.startswith('https://'):
        raise ValueError('The link must start with https://')
    if status not in STATUSES:
        raise ValueError(f'--status must be one of: {", ".join(STATUSES)}')
    row: dict[str, Any] = {
        'name': name.strip(),
        'url': url,
        'status': status,
        'category': category,
        'summary': summary,
        'learned': learned,
        'featured': featured,
        'tags': [t.strip() for t in (tags or '').split(',') if t.strip()],
        'started_on': dt.date.today().isoformat(),
    }
    if icon:
        row['icon'] = icon if ':' in icon else f'material-symbols:{icon}'
    return row


def add(client: Any, **kwargs: Any) -> str:
    return client.table('labs').insert(build_row(**kwargs)).execute().data[0]['slug']


def listing(client: Any) -> list[str]:
    rows = client.table('labs').select('name, status, url, is_visible').order('position').execute().data
    return [
        f'{r["status"]:<9} {"" if r["is_visible"] else "(hidden) "}{r["name"]} — {r["url"]}' for r in rows
    ]
