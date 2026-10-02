import os

import pytest
from cryptography.exceptions import InvalidTag

from carlos_cms import linkedin


def test_token_encryption_round_trip_and_tamper_detection():
    key = os.urandom(32)
    sealed = linkedin.encrypt('AQX-secret-token', key)
    assert 'AQX' not in sealed
    assert linkedin.decrypt(sealed, key) == 'AQX-secret-token'
    with pytest.raises(InvalidTag):
        linkedin.decrypt(sealed, os.urandom(32))
    iv, body = sealed.split('.')
    tampered = f'{iv}.{body[:-4]}AAAA'
    with pytest.raises(InvalidTag):
        linkedin.decrypt(tampered, key)


def test_connection_code_must_match_this_session():
    assert linkedin.parse_connection_code('  abc123:the-code \n', 'abc123') == 'the-code'
    for bad in ['other:the-code', 'abc123', 'abc123:', ':the-code']:
        with pytest.raises(ValueError):
            linkedin.parse_connection_code(bad, 'abc123')


def test_authorise_url_has_state_scope_and_redirect():
    url = linkedin.authorise_url('client', 'https://carlos.nz/linkedin/callback/', 'st4te')
    assert 'state=st4te' in url and 'w_member_social' in url.replace('+', ' ').replace('%20', ' ')
    assert 'redirect_uri=https%3A%2F%2Fcarlos.nz%2Flinkedin%2Fcallback%2F' in url


def test_post_body_uses_commentary_escaping_and_thumbnail():
    post = {
        'slug': 'homelab',
        'title': 'Homelab (part 1)',
        'excerpt': 'Four nodes.',
        'linkedin_commentary': None,
    }
    body = linkedin.build_post_body(post, 'urn:li:person:abc', 'urn:li:image:xyz')
    assert body['commentary'] == 'Homelab \\(part 1\\)\n\nFour nodes.'
    assert body['content']['article']['source'] == 'https://carlos.nz/posts/homelab/'
    assert body['content']['article']['thumbnail'] == 'urn:li:image:xyz'
    assert 'thumbnail' not in linkedin.build_post_body(post, 'urn:li:person:abc', None)['content']['article']
