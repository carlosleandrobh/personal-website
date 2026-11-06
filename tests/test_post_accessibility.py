import pytest

from carlos_cms import posts

GOOD = '---\ntitle: Kia ora\nexcerpt: A short but valid excerpt.\n---\n'


def row(body='', **fields):
    return {'body_md': body, 'cover_image_url': None, 'cover_alt': None, **fields}


def test_a_post_without_images_has_no_problems():
    assert posts.accessibility_problems(row('Just text.\n\n## A section')) == []


def test_images_with_real_alt_text_pass():
    body = (
        '![The three Proxmox nodes in a rack](/media/rack.webp)\n\n'
        '![Dashboard](https://example.com/a.png "title")'
    )
    assert posts.accessibility_problems(row(body)) == []


def test_an_image_without_alt_text_is_reported_with_its_position_and_source():
    problems = posts.accessibility_problems(row('![ok alt](/a.webp)\n\n![](/media/rack.webp)'))
    assert len(problems) == 1
    assert 'Image 2 (/media/rack.webp)' in problems[0] and 'no alt text' in problems[0]


@pytest.mark.parametrize('alt', ['rack.jpg', 'IMG_1234.PNG', 'image', 'Screenshot'])
def test_alt_text_that_says_nothing_is_reported(alt):
    problems = posts.accessibility_problems(row(f'![{alt}](/media/x.webp)'))
    assert len(problems) == 1 and 'says nothing' in problems[0]


def test_very_long_alt_text_is_reported():
    problems = posts.accessibility_problems(row(f'![{"word " * 60}](/media/x.webp)'))
    assert len(problems) == 1 and 'over 250 characters' in problems[0]


def test_images_inside_code_are_ignored():
    body = 'Write `![](x.png)` for an image.\n\n```md\n![](/media/x.webp)\n```\n'
    assert posts.accessibility_problems(row(body)) == []


def test_a_cover_needs_alt_text_unless_it_is_marked_decorative():
    def problems(**fields):
        return posts.accessibility_problems(row(cover_image_url='/media/c.webp', **fields))

    assert problems(cover_alt=None)
    assert problems(cover_alt='') == []
    assert problems(cover_alt='A rack of four nodes') == []
    assert posts.accessibility_problems(row(cover_alt=None)) == []  # no cover, nothing to describe


def test_publishing_is_blocked_but_drafts_are_saved_with_warnings(tmp_path, fake_db):
    path = tmp_path / 'kia-ora.md'
    path.write_text(GOOD + '![](/media/rack.webp)\n')

    with pytest.raises(ValueError, match=r'(?s)Not published.*no alt text'):
        posts.push(fake_db, path, publish=True)

    saved = posts.push(fake_db, path)  # a draft is still saved
    assert saved['slug'] == 'kia-ora'
    assert 'no alt text' in saved['accessibility_problems'][0]


def test_a_clean_post_publishes(tmp_path, fake_db):
    path = tmp_path / 'kia-ora.md'
    path.write_text(GOOD + '![Four nodes in a rack](/media/rack.webp)\n')
    saved = posts.push(fake_db, path, publish=True)
    assert saved['status'] == 'published' and saved['accessibility_problems'] == []
