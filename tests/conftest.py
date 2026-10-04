"""Shared fixtures: a tiny in-memory stand-in for the Supabase client."""

import copy
from typing import Any

import pytest


class _Result:
    def __init__(self, data: Any, count: int | None = None):
        self.data, self.count = data, count


class _Query:
    def __init__(self, store: 'FakeSupabase', table: str):
        self.store, self.table_name = store, table
        self.filters: list[tuple[str, str, Any]] = []
        self.mode, self.payload, self.is_single = 'select', None, False

    # chainable no-ops / filters
    def select(self, *_a: Any, **_k: Any) -> '_Query':
        return self

    def order(self, *_a: Any, **_k: Any) -> '_Query':
        return self

    def limit(self, *_a: Any) -> '_Query':
        return self

    def eq(self, key: str, value: Any) -> '_Query':
        self.filters.append(('eq', key, value))
        return self

    def in_(self, key: str, values: list[Any]) -> '_Query':
        self.filters.append(('in', key, values))
        return self

    def single(self) -> '_Query':
        self.is_single = True
        return self

    def update(self, payload: dict[str, Any]) -> '_Query':
        self.mode, self.payload = 'update', payload
        return self

    def insert(self, payload: Any) -> '_Query':
        self.mode, self.payload = 'insert', payload
        return self

    def delete(self) -> '_Query':
        self.mode = 'delete'
        return self

    def upsert(self, payload: Any, on_conflict: str = 'id', **_k: Any) -> '_Query':
        self.mode, self.payload, self.conflict_key = 'upsert', payload, on_conflict
        return self

    def _match(self, row: dict[str, Any]) -> bool:
        for kind, key, value in self.filters:
            if kind == 'eq' and row.get(key) != value:
                return False
            if kind == 'in' and row.get(key) not in value:
                return False
        return True

    def execute(self) -> _Result:
        rows = self.store.tables.setdefault(self.table_name, [])
        if self.mode != 'select':
            self.store.writes.append((self.mode, self.table_name, self.payload, list(self.filters)))
        if self.mode == 'update':
            for row in rows:
                if self._match(row):
                    row.update(self.payload)
            return _Result([])
        if self.mode == 'insert':
            rows.extend(self.payload if isinstance(self.payload, list) else [self.payload])
            return _Result([])
        if self.mode == 'upsert':
            for item in self.payload if isinstance(self.payload, list) else [self.payload]:
                match = next(
                    (r for r in rows if r.get(self.conflict_key) == item.get(self.conflict_key)), None
                )
                if match:
                    match.update(item)
                else:
                    rows.append({'id': f'gen-{len(rows) + 1}', **item})  # the database generates ids
            return _Result([])
        if self.mode == 'delete':
            self.store.tables[self.table_name] = [r for r in rows if not self._match(r)]
            return _Result([])
        found = [copy.deepcopy(r) for r in rows if self._match(r)]
        return _Result(found[0] if self.is_single else found, len(found))


class _Rpc:
    def __init__(self, result: Any):
        self.result = result

    def execute(self) -> _Result:
        return _Result(self.result)


class FakeSupabase:
    def __init__(self, tables: dict[str, list[dict[str, Any]]]):
        self.tables, self.writes = tables, []
        self.rpc_handlers: dict[str, Any] = {}  # name -> callable(params) returning the RPC's data
        self.rpc_calls: list[tuple[str, dict[str, Any]]] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def rpc(self, name: str, params: dict[str, Any] | None = None) -> _Rpc:
        self.rpc_calls.append((name, params or {}))
        return _Rpc(self.rpc_handlers[name](params or {}))


@pytest.fixture
def fake_db() -> FakeSupabase:
    return FakeSupabase(
        {
            'profile': [
                {
                    'id': 1,
                    'display_name': 'Carlos',
                    'headline': 'Old headline',
                    'about_md': 'Para one.\n\nPara two.',
                    'is_available': True,
                    'years_experience': 15,
                }
            ],
            'spectrum_areas': [
                {
                    'id': 1,
                    'position': 1,
                    'title': 'Business analysis',
                    'summary': 's',
                    'icon': 'i',
                    'tags': ['BPMN'],
                    'is_visible': True,
                }
            ],
            'now_items': [],
            'certifications': [],
            'education': [],
            'homelab_items': [],
            'experiences': [
                {
                    'id': 7,
                    'role': 'Business Analyst',
                    'company': 'Redvespa',
                    'context': None,
                    'location': None,
                    'start_date': '2026-07-01',
                    'end_date': None,
                    'summary': 'x',
                    'highlights': [],
                    'tags': [],
                    'is_visible': True,
                }
            ],
            'labs': [
                {
                    'id': 3,
                    'position': 1,
                    'slug': 'bentopdf',
                    'name': 'BentoPDF',
                    'url': 'https://pdf.carlos.nz',
                    'summary': None,
                    'status': 'live',
                    'category': 'Self-hosted',
                    'tags': [],
                    'icon': 'i',
                    'learned': None,
                    'notes_post_slug': None,
                    'repo_url': None,
                    'started_on': None,
                    'featured': True,
                    'is_visible': True,
                }
            ],
            'github_repos': [{'id': 900, 'full_name': 'carlos/demo', 'is_visible': True, 'featured': False}],
            'posts': [
                {
                    'id': 'p1',
                    'slug': 'homelab-notes',
                    'title': 'Homelab notes',
                    'excerpt': 'Four Proxmox nodes and why.',
                    'body_md': '## Why\n\nBecause.',
                    'category': 'Homelab',
                    'tags': ['Proxmox'],
                    'status': 'published',
                    'published_at': '2026-09-20T09:00:00+12:00',
                    'share_to_linkedin': True,
                    'linkedin_commentary': None,
                    'cover_image_url': None,
                    'cover_alt': None,
                    'seo_description': None,
                    'created_at': '2026-09-19',
                },
                {
                    'id': 'p2',
                    'slug': 'odoo-draft',
                    'title': 'Odoo draft',
                    'excerpt': 'Not published yet, keep me.',
                    'body_md': 'Draft body.',
                    'category': 'ERP',
                    'tags': [],
                    'status': 'draft',
                    'published_at': None,
                    'share_to_linkedin': True,
                    'linkedin_commentary': None,
                    'cover_image_url': None,
                    'cover_alt': None,
                    'seo_description': None,
                    'created_at': '2026-09-25',
                },
            ],
            'contact_messages': [
                {'id': 'm1', 'name': 'Visitor', 'email': 'visitor@example.com', 'message': 'Private!'}
            ],
            'linkedin_credentials': [{'id': 1, 'access_token_enc': 'SECRET-TOKEN'}],
            'linkedin_shares': [
                {'post_id': 'p1', 'shared_at': '2026-09-20T10:00:00+00:00', 'post_urn': 'urn:li:share:1'}
            ],
        }
    )
