import pytest

from carlos_cms import labs, posts
from carlos_cms.github_sync import keep
from carlos_cms.text import escape_little_text, slugify


@pytest.mark.parametrize(
    ('given', 'expected'),
    [
        ('Tāmaki Makaurau Lab — Ōtautahi', 'tamaki-makaurau-lab-otautahi'),
        ('Crème brûlée: BPMN 2.0', 'creme-brulee-bpmn-2-0'),
        ('  --Hello, World!--  ', 'hello-world'),
    ],
)
def test_slugify(given, expected):
    assert slugify(given) == expected


def test_little_text_reserved_characters_are_escaped():
    assert (
        escape_little_text('Proxmox (4 nodes) #homelab @carlos_nz')
        == r'Proxmox \(4 nodes\) \#homelab \@carlos\_nz'
    )


def test_lab_needs_https_and_valid_status():
    assert labs.build_row(name='n8n', url='https://n8n.carlos.nz', tags='Docker, n8n ,')['tags'] == [
        'Docker',
        'n8n',
    ]
    assert (
        labs.build_row(name='x', url='https://x.nz', icon='dns-outline')['icon']
        == 'material-symbols:dns-outline'
    )
    with pytest.raises(ValueError, match='https'):
        labs.build_row(name='x', url='http://x.nz')
    with pytest.raises(ValueError, match='status'):
        labs.build_row(name='x', url='https://x.nz', status='beta')


def test_post_file_validation(tmp_path):
    good = tmp_path / 'good.md'
    good.write_text('---\ntitle: Kia ora\nexcerpt: A short but valid excerpt.\ntags: [AI]\n---\nBody text.\n')
    row = posts.row_from_file(good, publish=True)
    assert row['slug'] == 'kia-ora' and row['status'] == 'published' and row['body_md'] == 'Body text.'
    assert 'status' not in posts.row_from_file(good)  # re-pushing never unpublishes

    short = tmp_path / 'short.md'
    short.write_text('---\ntitle: T\nexcerpt: Too short\n---\nx\n')
    with pytest.raises(ValueError, match='10–320'):
        posts.row_from_file(short)


def test_post_new_creates_a_template(tmp_path, monkeypatch):
    monkeypatch.setattr(posts, 'DRAFTS', tmp_path)
    path = posts.new('From one to four Proxmox nodes', 'Homelab')
    assert path.name == 'from-one-to-four-proxmox-nodes.md'
    assert posts.row_from_file(path)['category'] == 'Homelab'
    with pytest.raises(FileExistsError):
        posts.new('From one to four Proxmox nodes')


def test_github_filter_skips_private_forks_and_profile_readme():
    assert keep({'name': 'carlos-nz', 'private': False, 'fork': False}, 'carlos')
    assert not keep({'name': 'x', 'private': True, 'fork': False}, 'carlos')
    assert not keep({'name': 'x', 'private': False, 'fork': True}, 'carlos')
    assert not keep({'name': 'Carlos', 'private': False, 'fork': False}, 'carlos')
