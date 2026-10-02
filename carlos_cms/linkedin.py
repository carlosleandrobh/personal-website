"""LinkedIn: connect your account (locally) and share newly published posts (in GitHub Actions).

Connecting: LinkedIn redirects to https://carlos.nz/linkedin/callback/, a static page that shows a
one-time code. You paste it into the terminal; this script checks the anti-forgery `state`, exchanges
the code using the client secret (which never leaves your computer), and stores the access token
encrypted (AES-256-GCM) in Supabase.
"""

import base64
import datetime as dt
import hmac
import os
import secrets
import webbrowser
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from carlos_cms.config import SITE_URL, get, need
from carlos_cms.out import fail, info, ok, warn
from carlos_cms.text import escape_little_text

AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'  # noqa: S105 (URL, not a secret)
USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'
POSTS_URL = 'https://api.linkedin.com/rest/posts'
IMAGES_URL = 'https://api.linkedin.com/rest/images?action=initializeUpload'
SCOPE = 'openid profile w_member_social'


# --- encryption ---------------------------------------------------------------------------------


def _key() -> bytes:
    raw = base64.b64decode(need('LINKEDIN_TOKEN_KEY'))
    if len(raw) != 32:
        fail('LINKEDIN_TOKEN_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32).')
    return raw


def encrypt(plain: str, key: bytes) -> str:
    iv = os.urandom(12)
    sealed = AESGCM(key).encrypt(iv, plain.encode(), None)
    return f'{base64.b64encode(iv).decode()}.{base64.b64encode(sealed).decode()}'


def decrypt(sealed: str, key: bytes) -> str:
    iv, _, body = sealed.partition('.')
    return AESGCM(key).decrypt(base64.b64decode(iv), base64.b64decode(body), None).decode()


# --- connect (run locally) ----------------------------------------------------------------------


def authorise_url(client_id: str, redirect_uri: str, state: str) -> str:
    query = {
        'response_type': 'code',
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'state': state,
        'scope': SCOPE,
    }
    return f'{AUTHORIZE_URL}?{urlencode(query)}'


def parse_connection_code(pasted: str, expected_state: str) -> str:
    """The callback page shows '<state>:<code>'. Returns the code if the state matches this session."""
    state, separator, code = pasted.strip().partition(':')
    if not separator or not code or not hmac.compare_digest(state, expected_state):
        raise ValueError('That code does not belong to this session. Run the command again.')
    return code


def connect(client: Any, prompt: Any) -> None:
    client_id, client_secret = need('LINKEDIN_CLIENT_ID'), need('LINKEDIN_CLIENT_SECRET')
    redirect_uri = get('LINKEDIN_REDIRECT_URI', f'{SITE_URL}/linkedin/callback/')
    state = secrets.token_urlsafe(32)
    url = authorise_url(client_id, redirect_uri, state)
    info('Opening LinkedIn. Approve access, then copy the code shown on the carlos.nz page.')
    info(url)
    webbrowser.open(url)
    try:
        code = parse_connection_code(prompt('Paste the connection code', hide_input=True), state)
    except ValueError as err:
        fail(str(err))

    with httpx.Client(timeout=30) as http:
        token = http.post(
            TOKEN_URL,
            data={
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': redirect_uri,
                'client_id': client_id,
                'client_secret': client_secret,
            },
        )
        if token.status_code != 200:
            fail(
                f'LinkedIn refused the code ({token.status_code}). Codes expire fast: run the command again.'
            )
        grant = token.json()
        me = http.get(USERINFO_URL, headers={'Authorization': f'Bearer {grant["access_token"]}'})
        me.raise_for_status()
        sub = me.json()['sub']

    expected = get('LINKEDIN_EXPECTED_SUB')
    if expected and expected != sub:
        fail('This LinkedIn account is not the one allowed for carlos.nz (LINKEDIN_EXPECTED_SUB).')
    expires = dt.datetime.now(dt.UTC) + dt.timedelta(seconds=int(grant['expires_in']))
    client.table('linkedin_credentials').upsert(
        {
            'id': 1,
            'member_urn': f'urn:li:person:{sub}',
            'access_token_enc': encrypt(grant['access_token'], _key()),
            'scope': grant.get('scope', SCOPE),
            'expires_at': expires.isoformat(),
        }
    ).execute()
    ok(f'LinkedIn connected. Posting works until {expires:%d %b %Y}.')
    if not expected:
        info(f'Add LINKEDIN_EXPECTED_SUB={sub} to your .env so no other account can ever be connected.')


# --- status and share (run in GitHub Actions after each deploy) --------------------------------


def credentials(client: Any) -> dict[str, Any] | None:
    rows = (
        client.table('linkedin_credentials')
        .select('member_urn, access_token_enc, expires_at')
        .eq('id', 1)
        .execute()
    )
    return rows.data[0] if rows.data else None


def days_left(creds: dict[str, Any]) -> int:
    expires = dt.datetime.fromisoformat(creds['expires_at'])
    return (expires - dt.datetime.now(dt.UTC)).days


def status(client: Any) -> dict[str, Any] | None:
    creds = credentials(client)
    if not creds:
        warn('LinkedIn is not connected. Run `uv run cms linkedin connect` on your computer.')
        return None
    days = days_left(creds)
    if days < 0:
        warn('The LinkedIn token has expired. Run `uv run cms linkedin connect` on your computer.')
        return None
    if days <= 10:
        warn(f'The LinkedIn token expires in {days} day(s). Run `uv run cms linkedin connect` soon.')
    else:
        ok(f'LinkedIn connected, token valid for {days} more days.')
    return creds


def _headers(token: str) -> dict[str, str]:
    return {
        'Authorization': f'Bearer {token}',
        'LinkedIn-Version': get(
            'LINKEDIN_API_VERSION', '202608'
        ),  # keep recent: LinkedIn retires old versions
        'X-Restli-Protocol-Version': '2.0.0',
    }


def _upload_thumbnail(http: httpx.Client, token: str, owner: str, png: bytes) -> str:
    init = http.post(IMAGES_URL, headers=_headers(token), json={'initializeUploadRequest': {'owner': owner}})
    if init.status_code != 200:
        raise RuntimeError(f'image init {init.status_code}: {init.text[:200]}')
    value = init.json()['value']
    put = http.put(value['uploadUrl'], headers={'Authorization': f'Bearer {token}'}, content=png)
    if put.status_code not in (200, 201):
        raise RuntimeError(f'image upload {put.status_code}')
    return value['image']


def build_post_body(post: dict[str, Any], author: str, thumbnail: str | None) -> dict[str, Any]:
    url = f'{SITE_URL}/posts/{post["slug"]}/'
    commentary = (post.get('linkedin_commentary') or '').strip() or f'{post["title"]}\n\n{post["excerpt"]}'
    article: dict[str, Any] = {
        'source': url,
        'title': post['title'][:200],
        'description': (post.get('seo_description') or post['excerpt'])[:256],
    }
    if thumbnail:
        article |= {'thumbnail': thumbnail, 'thumbnailAltText': post['title'][:120]}
    return {
        'author': author,
        'commentary': escape_little_text(commentary),
        'visibility': 'PUBLIC',
        'distribution': {
            'feedDistribution': 'MAIN_FEED',
            'targetEntities': [],
            'thirdPartyDistributionChannels': [],
        },
        'content': {'article': article},
        'lifecycleState': 'PUBLISHED',
        'isReshareDisabledByAuthor': False,
    }


def share(client: Any, og_dir: Path, limit: int = 3) -> None:
    creds = status(client)
    if not creds:
        return  # nothing is claimed, so posts wait for the next deploy
    token = decrypt(creds['access_token_enc'], _key())
    posts = client.rpc('claim_linkedin_shares', {'p_limit': limit}).execute().data or []
    if not posts:
        info('Nothing new to share on LinkedIn.')
        return
    with httpx.Client(timeout=60) as http:
        for post in posts:
            try:
                png_path = og_dir / f'{post["slug"]}.png'
                thumbnail = None
                if png_path.exists():
                    thumbnail = _upload_thumbnail(http, token, creds['member_urn'], png_path.read_bytes())
                else:
                    warn(f'No share image for {post["slug"]}; sharing without a thumbnail.')
                response = http.post(
                    POSTS_URL,
                    headers=_headers(token),
                    json=build_post_body(post, creds['member_urn'], thumbnail),
                )
                if response.status_code != 201:
                    raise RuntimeError(f'posts {response.status_code}: {response.text[:300]}')
                urn = response.headers.get('x-restli-id', '')
                client.table('linkedin_shares').update(
                    {
                        'shared_at': dt.datetime.now(dt.UTC).isoformat(),
                        'post_urn': urn,
                        'last_error': None,
                    }
                ).eq('post_id', post['id']).execute()
                ok(f'Shared {post["slug"]} on LinkedIn ({urn}).')
            except Exception as err:  # keep going: one failure must not block the others
                client.table('linkedin_shares').update({'last_error': str(err)[:500]}).eq(
                    'post_id', post['id']
                ).execute()
                warn(
                    f'LinkedIn share failed for {post["slug"]}: {err}. It will be retried on the next deploy.'
                )
