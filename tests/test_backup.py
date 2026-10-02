import json

import pytest

from carlos_cms import backup
from carlos_cms.content import TABLES, diff_table
from tests.conftest import FakeSupabase


def _empty_db() -> FakeSupabase:
    return FakeSupabase(
        {name: [] for name in [*TABLES, 'profile', 'github_repos', 'posts', 'linkedin_shares']}
    )


def test_backup_contains_content_and_posts_but_no_personal_data_or_secrets(fake_db, tmp_path):
    folder, counts = backup.backup(fake_db, tmp_path)
    assert (folder / 'site-content.yaml').exists() and (folder / 'manifest.json').exists()
    assert sorted(p.name for p in (folder / 'posts').glob('*.md')) == ['homelab-notes.md', 'odoo-draft.md']
    assert counts['posts'] == 2 and counts['labs'] == 1
    everything = ''.join(p.read_text() for p in folder.rglob('*') if p.is_file())
    assert 'visitor@example.com' not in everything and 'Private!' not in everything
    assert 'SECRET-TOKEN' not in everything
    assert 'status: draft' in (folder / 'posts' / 'odoo-draft.md').read_text()
    assert json.loads((folder / 'manifest.json').read_text())['format'] == backup.FORMAT_VERSION


def test_restore_into_an_empty_database_recreates_everything(fake_db, tmp_path):
    folder, _ = backup.backup(fake_db, tmp_path)
    fresh = _empty_db()
    log = backup.restore(fresh, folder)
    assert 'profile: restore' in log
    assert fresh.tables['profile'][0]['headline'] == 'Old headline'
    assert [r['role'] for r in fresh.tables['experiences']] == ['Business Analyst']
    assert [r['name'] for r in fresh.tables['labs']] == ['BentoPDF']
    restored = {p['slug']: p for p in fresh.tables['posts']}
    assert restored['homelab-notes']['status'] == 'published'
    assert restored['homelab-notes']['published_at'].startswith('2026-09-20')
    assert restored['odoo-draft']['status'] == 'draft' and restored['odoo-draft']['published_at'] is None
    assert restored['homelab-notes']['body_md'] == '## Why\n\nBecause.'


def test_restore_never_shares_an_already_shared_post_again(fake_db, tmp_path):
    folder, _ = backup.backup(fake_db, tmp_path)
    assert 'linkedin_shared_at' in (folder / 'posts' / 'homelab-notes.md').read_text()
    assert 'linkedin_shared_at' not in (folder / 'posts' / 'odoo-draft.md').read_text()
    fresh = _empty_db()
    backup.restore(fresh, folder)
    homelab_id = next(p['id'] for p in fresh.tables['posts'] if p['slug'] == 'homelab-notes')
    assert fresh.tables['linkedin_shares'] == [
        {
            'id': 'gen-1',
            'post_id': homelab_id,
            'claimed_at': '2026-09-20T10:00:00+00:00',
            'shared_at': '2026-09-20T10:00:00+00:00',
            'post_urn': 'urn:li:share:1',
        }
    ]


def test_restoring_onto_the_same_data_is_idempotent(fake_db, tmp_path):
    folder, _ = backup.backup(fake_db, tmp_path)
    fake_db.writes.clear()
    log = backup.restore(fake_db, folder)
    assert log == [
        'posts: restore 2 (matched by slug)',
        'linkedin_shares: keep 1 post(s) marked as already shared',
    ]
    assert [w[0] for w in fake_db.writes] == ['upsert', 'upsert']  # upserts only: nothing duplicated
    assert len(fake_db.tables['posts']) == 2
    assert len(fake_db.tables['linkedin_shares']) == 1


def test_dry_run_writes_nothing(fake_db, tmp_path):
    folder, _ = backup.backup(fake_db, tmp_path)
    fresh = _empty_db()
    log = backup.restore(fresh, folder, dry_run=True)
    assert log and not fresh.writes


def test_restore_refuses_a_folder_that_is_not_a_backup(fake_db, tmp_path):
    with pytest.raises(FileNotFoundError):
        backup.restore(fake_db, tmp_path)


def test_insert_unknown_ids_mode_recreates_missing_rows():
    plan = diff_table([], [{'id': 5, 'title': 'Gone'}], ['title'], insert_unknown_ids=True)
    assert plan['inserts'] == [{'title': 'Gone'}] and not plan['errors']
