"""Posts: write Markdown in VS Code, push to Supabase, publish."""

from pathlib import Path
from typing import Any

import frontmatter

from carlos_cms.config import DRAFTS, SITE_URL
from carlos_cms.text import slugify

TEMPLATE_BODY = 'Write the post here in Markdown.\n\n## A section\n\nText.\n'
FRONT_MATTER_FIELDS = [
    'title',
    'slug',
    'excerpt',
    'category',
    'tags',
    'share_to_linkedin',
    'linkedin_commentary',
    'cover_image_url',
    'cover_alt',
    'seo_description',
]


def new(title: str, category: str = 'Notes') -> Path:
    slug = slugify(title)
    if not slug:
        raise ValueError('The title needs at least one letter or number.')
    path = DRAFTS / f'{slug}.md'
    if path.exists():
        raise FileExistsError(f'{path} already exists')
    post = frontmatter.Post(
        TEMPLATE_BODY,
        title=title,
        slug=slug,
        excerpt='One or two sentences that make someone want to read this (10–320 characters).',
        category=category,
        tags=[],
        share_to_linkedin=True,
        linkedin_commentary=None,
        cover_image_url=None,
        cover_alt=None,
    )
    DRAFTS.mkdir(parents=True, exist_ok=True)
    path.write_text(frontmatter.dumps(post) + '\n', encoding='utf-8')
    return path


POST_STATUSES = ('draft', 'published', 'archived')


def row_from_file(path: Path, *, publish: bool = False, restore: bool = False) -> dict[str, Any]:
    post = frontmatter.load(path)
    meta = post.metadata
    title, excerpt = str(meta.get('title') or '').strip(), str(meta.get('excerpt') or '').strip()
    if not title or not excerpt:
        raise ValueError('The front matter needs at least a title and an excerpt.')
    if not 10 <= len(excerpt) <= 320:
        raise ValueError(f'The excerpt must be 10–320 characters (it has {len(excerpt)}).')
    row: dict[str, Any] = {
        'slug': meta.get('slug') or slugify(title),
        'title': title,
        'excerpt': excerpt,
        'body_md': post.content.strip(),
        'category': meta.get('category') or 'Notes',
        'tags': list(meta.get('tags') or []),
        'cover_image_url': meta.get('cover_image_url'),
        'cover_alt': meta.get('cover_alt'),
        'share_to_linkedin': bool(meta.get('share_to_linkedin', True)),
        'linkedin_commentary': meta.get('linkedin_commentary'),
        'seo_description': meta.get('seo_description'),
    }
    if publish:
        row['status'] = 'published'
    if restore:  # backups keep the status and publication date; normal pushes never change them
        status = meta.get('status', 'draft')
        if status not in POST_STATUSES:
            raise ValueError(f'{path.name}: unknown status "{status}"')
        row['status'] = status
        row['published_at'] = str(meta['published_at']) if meta.get('published_at') else None
    return row


def push(client: Any, path: Path, *, publish: bool = False) -> dict[str, Any]:
    row = row_from_file(path, publish=publish)
    saved = client.table('posts').upsert(row, on_conflict='slug').execute().data[0]
    saved['url'] = f'{SITE_URL}/posts/{saved["slug"]}/'
    return saved


def pull(client: Any, slug: str) -> Path:
    data = client.table('posts').select('*').eq('slug', slug).single().execute().data
    meta = {field: data.get(field) for field in FRONT_MATTER_FIELDS}
    path = DRAFTS / f'{slug}.md'
    DRAFTS.mkdir(parents=True, exist_ok=True)
    path.write_text(
        frontmatter.dumps(frontmatter.Post(data['body_md'] + '\n', **meta)) + '\n', encoding='utf-8'
    )
    return path


def listing(client: Any) -> list[str]:
    rows = (
        client.table('posts')
        .select('slug, status, published_at, share_to_linkedin, linkedin_shares(shared_at, last_error)')
        .order('created_at', desc=True)
        .execute()
        .data
    )
    lines = []
    for p in rows:
        share = p.get('linkedin_shares') or {}
        if isinstance(share, list):
            share = share[0] if share else {}
        if share.get('shared_at'):
            state = 'on LinkedIn ✔'
        elif share.get('last_error'):
            state = f'LinkedIn error: {share["last_error"][:60]}'
        else:
            state = 'LinkedIn pending' if p['share_to_linkedin'] else 'no LinkedIn'
        lines.append(f'{p["status"]:<10} {(p["published_at"] or "")[:10]:<11} {p["slug"]}  — {state}')
    return lines
