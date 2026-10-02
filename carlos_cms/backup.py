"""Backup and restore of the site content.

A backup is a dated folder you can read without any tool:
    site-content.yaml   profile, experience, labs, now, certifications, homelab, repo flags
    posts/<slug>.md     every post (drafts included) with its status and publication date
    manifest.json       when, from where, how many — and what was deliberately left out

Left out on purpose: contact-form messages (other people's personal data — they are deleted
after 12 months by design) and LinkedIn credentials (a secret; reconnect instead).
"""

import datetime as dt
import json
from pathlib import Path
from typing import Any

import frontmatter

from carlos_cms import content, posts
from carlos_cms.config import ROOT, SITE_URL

BACKUP_ROOT = ROOT / 'backups'
FORMAT_VERSION = 1
EXCLUDED = [
    "contact_messages: visitors' personal data, deleted after 12 months by design",
    'linkedin_credentials: a secret; run `uv run cms linkedin connect` after a restore',
    'github_repos: re-synced from GitHub on the next deploy (your is_visible/featured flags ARE backed up)',
]


def backup(client: Any, target: Path | None = None) -> tuple[Path, dict[str, int]]:
    stamp = dt.datetime.now().strftime('%Y-%m-%d-%H%M%S')
    folder = (target or BACKUP_ROOT) / f'carlos-nz-{stamp}'
    (folder / 'posts').mkdir(parents=True)

    content.pull(client, folder / 'site-content.yaml')
    doc = content.load_yaml((folder / 'site-content.yaml').read_text(encoding='utf-8'))

    rows = client.table('posts').select('*').order('created_at').execute().data
    # Keep the LinkedIn share record so a restore never posts the same article twice.
    shares = {
        s['post_id']: s
        for s in client.table('linkedin_shares').select('*').execute().data
        if s.get('shared_at')
    }
    for row in rows:
        meta = {field: row.get(field) for field in posts.FRONT_MATTER_FIELDS}
        meta |= {'status': row['status'], 'published_at': row.get('published_at')}
        if share := shares.get(row.get('id')):
            meta |= {'linkedin_shared_at': share['shared_at'], 'linkedin_post_urn': share.get('post_urn')}
        text = frontmatter.dumps(frontmatter.Post(row['body_md'] + '\n', **meta)) + '\n'
        (folder / 'posts' / f'{row["slug"]}.md').write_text(text, encoding='utf-8')

    counts = {table: len(doc.get(table) or []) for table in [*content.TABLES, 'github_repos']}
    counts['posts'] = len(rows)
    manifest = {
        'format': FORMAT_VERSION,
        'created_at': dt.datetime.now(dt.UTC).isoformat(),
        'site': SITE_URL,
        'counts': counts,
        'excluded': EXCLUDED,
    }
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    return folder, counts


def restore(client: Any, folder: Path, *, dry_run: bool = False) -> list[str]:
    """Bring the content back. Never deletes anything; rows that still exist are only updated if different."""
    manifest_file = folder / 'manifest.json'
    if not manifest_file.exists():
        raise FileNotFoundError(f'{folder} is not a carlos.nz backup (manifest.json missing).')
    if json.loads(manifest_file.read_text(encoding='utf-8')).get('format') != FORMAT_VERSION:
        raise ValueError('This backup was made by a different version of the tool.')

    doc = content.load_yaml((folder / 'site-content.yaml').read_text(encoding='utf-8'))
    log: list[str] = []

    # Profile (a brand-new database has no profile row yet)
    existing = client.table('profile').select('*').eq('id', 1).execute().data
    wanted = {field: (doc.get('profile') or {}).get(field) for field in content.PROFILE_FIELDS}
    if not existing or any(existing[0].get(k) != v for k, v in wanted.items()):
        log.append('profile: restore')
        if not dry_run:
            client.table('profile').upsert({'id': 1, **wanted}).execute()

    # Tables: update rows that differ, recreate rows that are missing. Nothing is deleted.
    for table, fields in content.TABLES.items():
        current = client.table(table).select('*').execute().data
        plan = content.diff_table(current, doc.get(table), fields, insert_unknown_ids=True)
        for update in plan['updates']:
            log.append(f'{table} #{update["id"]}: restore {", ".join(update["changed"])}')
            if not dry_run:
                client.table(table).update(update['changed']).eq('id', update['id']).execute()
        if plan['inserts']:
            log.append(f'{table}: recreate {len(plan["inserts"])} row(s)')
            if not dry_run:
                client.table(table).insert(plan['inserts']).execute()

    # GitHub curation flags, for repositories that exist again after the next sync
    repos = client.table('github_repos').select('id, is_visible, featured').execute().data
    flags = content.diff_table(repos, doc.get('github_repos'), content.REPO_FIELDS, insert_unknown_ids=False)
    known = {r['id'] for r in repos}
    for update in flags['updates']:
        if update['id'] in known:
            log.append(f'github_repos #{update["id"]}: restore flags')
            if not dry_run:
                client.table('github_repos').update(update['changed']).eq('id', update['id']).execute()

    # Posts, matched by slug
    post_files = sorted((folder / 'posts').glob('*.md'))
    if post_files:
        rows = [posts.row_from_file(path, restore=True) for path in post_files]
        log.append(f'posts: restore {len(rows)} (matched by slug)')
        if not dry_run:
            client.table('posts').upsert(rows, on_conflict='slug').execute()

        # Re-create the "already shared on LinkedIn" records, so nothing is shared twice.
        shared = {}
        for path in post_files:
            meta = frontmatter.load(path).metadata
            if meta.get('linkedin_shared_at'):
                shared[meta.get('slug') or path.stem] = meta
        if shared:
            log.append(f'linkedin_shares: keep {len(shared)} post(s) marked as already shared')
            if not dry_run:
                ids = client.table('posts').select('id, slug').in_('slug', list(shared)).execute().data
                records = [
                    {
                        'post_id': row['id'],
                        'claimed_at': str(shared[row['slug']]['linkedin_shared_at']),
                        'shared_at': str(shared[row['slug']]['linkedin_shared_at']),
                        'post_urn': shared[row['slug']].get('linkedin_post_urn'),
                    }
                    for row in ids
                ]
                client.table('linkedin_shares').upsert(records, on_conflict='post_id').execute()
    return log
