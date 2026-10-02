"""Public, non-fork GitHub repositories -> github_repos (display only; links go to GitHub).

Your curation flags (is_visible, featured) are never overwritten. Repositories that are
deleted or made private disappear from the site at the next sync.
"""

import datetime as dt
import re
from typing import Any

import httpx

from carlos_cms.config import get
from carlos_cms.out import info, ok, warn


def to_row(repo: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': repo['id'],
        'name': repo['name'],
        'full_name': repo['full_name'],
        'description': repo.get('description'),
        'html_url': repo['html_url'],
        'homepage': repo.get('homepage') or None,
        'language': repo.get('language'),
        'topics': repo.get('topics') or [],
        'stargazers_count': repo.get('stargazers_count', 0),
        'forks_count': repo.get('forks_count', 0),
        'pushed_at': repo.get('pushed_at'),
        'synced_at': dt.datetime.now(dt.UTC).isoformat(),
    }


def keep(repo: dict[str, Any], username: str) -> bool:
    return not repo.get('private') and not repo.get('fork') and repo['name'].lower() != username.lower()


def sync(client: Any) -> None:
    username = get('GITHUB_USERNAME')
    if not username:
        profile = client.table('profile').select('github_username').eq('id', 1).execute().data
        username = (profile[0].get('github_username') if profile else '') or ''
    if not username:
        info('No GitHub username configured (GITHUB_USERNAME or profile.github_username) — skipping.')
        return
    if not re.fullmatch(r'[A-Za-z0-9-]{1,39}', username):
        warn('The GitHub username is not valid — skipping.')
        return

    headers = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'carlos-nz-sync',
    }
    if token := get('GITHUB_TOKEN'):
        headers['Authorization'] = f'Bearer {token}'

    repos: list[dict[str, Any]] = []
    with httpx.Client(timeout=30, headers=headers) as http:
        for page in range(1, 6):
            response = http.get(
                f'https://api.github.com/users/{username}/repos',
                params={'type': 'owner', 'sort': 'pushed', 'per_page': 100, 'page': page},
            )
            if response.status_code != 200:
                # Never fail a deploy because GitHub is slow: keep the last good data.
                warn(f'GitHub API returned {response.status_code}; keeping the repositories synced before.')
                return
            batch = response.json()
            repos.extend(batch)
            if len(batch) < 100:
                break

    rows = [to_row(r) for r in repos if keep(r, username)]
    if rows:
        client.table('github_repos').upsert(rows, on_conflict='id').execute()
    ids = [r['id'] for r in rows]
    stale = client.table('github_repos').delete()
    (stale.not_.in_('id', ids) if ids else stale.gte('id', 0)).execute()
    ok(f'Synced {len(rows)} public repositories for {username}.')
