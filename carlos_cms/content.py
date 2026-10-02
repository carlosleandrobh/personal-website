"""Every editable site text except posts, in one YAML file you edit in VS Code.

Pull writes drafts/site-content.yaml; push writes back only what changed, so each
push triggers as few rebuilds as possible.
"""

import datetime as dt
import json
from pathlib import Path
from typing import Any

import yaml

from carlos_cms.config import DRAFTS, SEED_FILE

CONTENT_FILE = DRAFTS / 'site-content.yaml'

# table -> fields you may edit (`id` is the key and is never changed)
TABLES: dict[str, list[str]] = {
    'spectrum_areas': ['position', 'title', 'summary', 'icon', 'tags', 'is_visible'],
    'now_items': [
        'position',
        'label',
        'title',
        'description',
        'icon',
        'status_text',
        'meta_text',
        'is_visible',
    ],
    'certifications': [
        'position',
        'name',
        'issuer',
        'status',
        'progress',
        'target_label',
        'credential_url',
        'is_visible',
    ],
    'experiences': [
        'role',
        'company',
        'context',
        'location',
        'start_date',
        'end_date',
        'summary',
        'highlights',
        'tags',
        'is_visible',
    ],
    'education': ['degree', 'institution', 'location', 'start_date', 'end_date', 'in_progress', 'is_visible'],
    'labs': [
        'position',
        'slug',
        'name',
        'url',
        'summary',
        'status',
        'category',
        'tags',
        'icon',
        'learned',
        'notes_post_slug',
        'repo_url',
        'started_on',
        'featured',
        'is_visible',
    ],
    'homelab_items': ['position', 'title', 'icon', 'lines', 'is_visible'],
}
PROFILE_FIELDS = [
    'display_name',
    'full_name',
    'greeting',
    'headline',
    'subheadline',
    'role_line',
    'location',
    'availability_text',
    'is_available',
    'years_experience',
    'about_md',
    'linkedin_url',
    'github_username',
    'portrait_alt',
]
REPO_FIELDS = ['is_visible', 'featured']  # the rest of github_repos comes from GitHub

HEADER = """\
# carlos.nz — editable site content (everything except posts). New Zealand English.
# Edit, then: uv run cms content push --dry-run   (preview)   ->   uv run cms content push
# Keep each `id`. To add a row, copy one and delete its `id` line. Rows you delete are kept
# unless you push with --prune (or set is_visible: false to hide a row).
# Icons: Material Symbols names, e.g. material-symbols:dns-outline.
# Dates: YYYY-MM-DD; end_date: null means current.
# github_repos: only is_visible / featured can be changed (the rest comes from GitHub).
"""


class _Dumper(yaml.SafeDumper):
    """Readable YAML: multi-line text as | blocks, keys in their natural order."""


def _str(dumper: yaml.SafeDumper, data: str) -> yaml.ScalarNode:
    style = '|' if '\n' in data else None
    return dumper.represent_scalar('tag:yaml.org,2002:str', data, style=style)


_Dumper.add_representer(str, _str)


def dump_yaml(doc: dict[str, Any]) -> str:
    return yaml.dump(doc, Dumper=_Dumper, sort_keys=False, allow_unicode=True, width=110)


def _normalise(value: Any) -> Any:
    """YAML turns unquoted 2026-07-01 into a date; the database wants the string."""
    if isinstance(value, dt.date | dt.datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _normalise(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalise(v) for v in value]
    return value


def load_yaml(text: str) -> dict[str, Any]:
    return _normalise(yaml.safe_load(text) or {})


def _same(a: Any, b: Any) -> bool:
    # JSON comparison so that True never equals 1 and list order matters.
    return json.dumps(a, sort_keys=True, default=str) == json.dumps(b, sort_keys=True, default=str)


def _pick(row: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    return {f: row.get(f) for f in fields}


def diff_table(
    current: list[dict[str, Any]],
    edited: list[dict[str, Any]] | None,
    fields: list[str],
    *,
    allow_insert: bool = True,
    insert_unknown_ids: bool = False,
) -> dict[str, list[Any]]:
    """Pure function: what would a push change? (Unit-tested in tests/test_content.py.)"""
    by_id = {row['id']: row for row in current}
    seen: set[Any] = set()
    updates: list[dict[str, Any]] = []
    inserts: list[dict[str, Any]] = []
    errors: list[str] = []
    for row in edited or []:
        if row.get('id') is None:
            if allow_insert:
                inserts.append(_pick(row, fields))
            else:
                errors.append('rows cannot be added here')
            continue
        before = by_id.get(row['id'])
        if before is None:
            if insert_unknown_ids:  # restore: the row is gone from the database, recreate it
                inserts.append(_pick(row, fields))
            else:
                errors.append(f'id {row["id"]} does not exist (remove the id to add a new row)')
            continue
        seen.add(row['id'])
        changed = {f: row.get(f) for f in fields if f in row and not _same(row.get(f), before.get(f))}
        if changed:
            updates.append({'id': row['id'], 'changed': changed})
    removals = [row['id'] for row in current if row['id'] not in seen]
    return {'updates': updates, 'inserts': inserts, 'removals': removals, 'errors': errors}


def pull(client: Any, path: Path = CONTENT_FILE) -> Path:
    doc: dict[str, Any] = {}
    profile = client.table('profile').select('*').eq('id', 1).single().execute().data
    doc['profile'] = _pick(profile, PROFILE_FIELDS)
    for table, fields in TABLES.items():
        order = 'position' if 'position' in fields else 'id'
        rows = client.table(table).select('*').order(order).execute().data
        doc[table] = [{'id': r['id'], **_pick(r, fields)} for r in rows]
    repos = (
        client.table('github_repos')
        .select('id, full_name, is_visible, featured')
        .order('full_name')
        .execute()
    )
    doc['github_repos'] = [
        {'id': r['id'], 'full_name': r['full_name'], **_pick(r, REPO_FIELDS)} for r in repos.data
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(HEADER + dump_yaml(doc), encoding='utf-8')
    return path


def push(
    client: Any, *, path: Path = CONTENT_FILE, dry_run: bool = False, prune: bool = False
) -> tuple[list[str], int]:
    doc = load_yaml(path.read_text(encoding='utf-8'))
    log: list[str] = []
    writes = 0

    profile = client.table('profile').select('*').eq('id', 1).single().execute().data
    edited_profile = doc.get('profile') or {}
    profile_changes = {
        f: edited_profile.get(f)
        for f in PROFILE_FIELDS
        if f in edited_profile and not _same(edited_profile.get(f), profile.get(f))
    }

    plans: list[tuple[str, dict[str, list[Any]]]] = []
    for table, fields in TABLES.items():
        current = client.table(table).select('*').execute().data
        plans.append((table, diff_table(current, doc.get(table), fields)))
    repos = client.table('github_repos').select('id, is_visible, featured').execute().data
    plans.append(
        ('github_repos', diff_table(repos, doc.get('github_repos'), REPO_FIELDS, allow_insert=False))
    )

    problems = [f'{table}: {e}' for table, plan in plans for e in plan['errors']]
    if problems:
        raise ValueError('Nothing was saved:\n  ' + '\n  '.join(problems))

    if profile_changes:
        log.append(f'profile: update {", ".join(profile_changes)}')
        if not dry_run:
            client.table('profile').update(profile_changes).eq('id', 1).execute()
            writes += 1

    for table, plan in plans:
        for update in plan['updates']:
            log.append(f'{table} #{update["id"]}: update {", ".join(update["changed"])}')
            if not dry_run:
                client.table(table).update(update['changed']).eq('id', update['id']).execute()
                writes += 1
        for row in plan['inserts']:
            label = row.get('title') or row.get('name') or row.get('role') or row.get('degree') or 'row'
            log.append(f'{table}: add "{label}"')
            if not dry_run:
                client.table(table).insert(row).execute()
                writes += 1
        if table != 'github_repos' and plan['removals']:
            ids = ', #'.join(str(i) for i in plan['removals'])
            if prune:
                log.append(f'{table}: delete #{ids}')
                if not dry_run:
                    client.table(table).delete().in_('id', plan['removals']).execute()
                    writes += 1
            else:
                log.append(f'{table}: #{ids} missing from the file — kept (use --prune to delete)')
    return log, writes


def seed(client: Any) -> list[str]:
    """First run only: load supabase/seed/content.json. Never overwrites existing rows."""
    content = json.loads(SEED_FILE.read_text(encoding='utf-8'))
    log: list[str] = []
    client.table('profile').upsert({'id': 1, **content['profile']}).execute()
    log.append('profile: saved')
    for table in [
        'spectrum_areas',
        'now_items',
        'certifications',
        'experiences',
        'education',
        'homelab_items',
    ]:
        existing = client.table(table).select('id', count='exact').limit(1).execute().count or 0
        if existing:
            log.append(f'{table}: already has rows — skipped')
            continue
        client.table(table).insert(content[table]).execute()
        log.append(f'{table}: {len(content[table])} rows')
    for table in ['labs', 'posts']:
        client.table(table).upsert(content[table], on_conflict='slug', ignore_duplicates=True).execute()
        log.append(f'{table}: {len(content[table])} rows (existing slugs untouched)')
    return log
