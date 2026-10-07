from carlos_cms import content
from carlos_cms.content import REPO_FIELDS, TABLES, diff_table

CURRENT = [
    {
        'id': 1,
        'position': 1,
        'title': 'A',
        'summary': 's',
        'icon': 'i',
        'tags': ['x'],
        'is_visible': True,
        'updated_at': 't',
    },
    {'id': 2, 'position': 2, 'title': 'B', 'summary': 's', 'icon': 'i', 'tags': [], 'is_visible': True},
]


def test_unchanged_rows_produce_no_writes():
    edited = [{k: v for k, v in r.items() if k != 'updated_at'} for r in CURRENT]
    plan = diff_table(CURRENT, edited, TABLES['spectrum_areas'])
    assert plan == {'updates': [], 'inserts': [], 'removals': [], 'errors': []}


def test_changes_inserts_and_removals_are_detected():
    edited = [
        {
            'id': 1,
            'position': 1,
            'title': 'A2',
            'summary': 's',
            'icon': 'i',
            'tags': ['y', 'x'],
            'is_visible': True,
        },
        {'position': 3, 'title': 'New', 'summary': 'n', 'icon': 'i', 'tags': []},
    ]
    plan = diff_table(CURRENT, edited, TABLES['spectrum_areas'])
    assert plan['updates'] == [{'id': 1, 'changed': {'title': 'A2', 'tags': ['y', 'x']}}]
    assert plan['inserts'][0]['title'] == 'New'
    assert plan['removals'] == [2]


def test_unknown_id_is_an_error():
    assert diff_table(CURRENT, [{'id': 99, 'title': 'X'}], TABLES['spectrum_areas'])['errors']


def test_true_is_not_equal_to_one():
    plan = diff_table([{'id': 1, 'position': 1}], [{'id': 1, 'position': True}], ['position'])
    assert plan['updates'] == [{'id': 1, 'changed': {'position': True}}]


def test_repos_only_allow_flag_changes():
    plan = diff_table(
        [{'id': 5, 'is_visible': True, 'featured': False}],
        [{'id': 5, 'full_name': 'u/r', 'is_visible': False, 'featured': True}, {'full_name': 'new'}],
        REPO_FIELDS,
        allow_insert=False,
    )
    assert plan['updates'] == [{'id': 5, 'changed': {'is_visible': False, 'featured': True}}]
    assert plan['errors'] == ['rows cannot be added here']


def test_yaml_round_trip_keeps_paragraphs_and_dates_as_text():
    doc = {'profile': {'about_md': 'Para one.\n\nPara two.'}, 'experiences': [{'start_date': '2026-07-01'}]}
    text = content.dump_yaml(doc)
    assert 'about_md: |' in text
    assert content.load_yaml(text) == doc
    # an unquoted date typed by hand still comes back as a string
    assert (
        content.load_yaml('experiences:\n- start_date: 2026-07-01\n')['experiences'][0]['start_date']
        == '2026-07-01'
    )


def test_pull_then_push_only_writes_what_changed(fake_db, tmp_path):
    path = tmp_path / 'site-content.yaml'
    content.pull(fake_db, path)
    text = path.read_text()
    assert text.startswith('# carlos.nz')
    path.write_text(text.replace('Old headline', 'I turn business problems into working solutions.'))

    log, writes = content.push(fake_db, path=path, dry_run=True)
    assert log == ['profile: update headline'] and writes == 0 and not fake_db.writes

    log, writes = content.push(fake_db, path=path)
    assert writes == 1
    assert fake_db.tables['profile'][0]['headline'] == 'I turn business problems into working solutions.'
    assert fake_db.tables['profile'][0]['about_md'] == 'Para one.\n\nPara two.'  # untouched, no false change


def test_experience_company_url_can_be_pushed(fake_db, tmp_path):
    path = tmp_path / 'site-content.yaml'
    content.pull(fake_db, path)
    doc = content.load_yaml(path.read_text())
    assert doc['experiences'][0]['company_url'] is None
    doc['experiences'][0]['company_url'] = 'https://example.com'
    path.write_text(content.dump_yaml(doc))
    log, writes = content.push(fake_db, path=path)
    assert writes == 1 and log == ['experiences #7: update company_url']
    assert fake_db.tables['experiences'][0]['company_url'] == 'https://example.com'


def test_removed_rows_are_kept_unless_pruned(fake_db, tmp_path):
    path = tmp_path / 'site-content.yaml'
    content.pull(fake_db, path)
    doc = content.load_yaml(path.read_text())
    doc['labs'] = []
    path.write_text(content.dump_yaml(doc))
    log, _ = content.push(fake_db, path=path)
    assert any('missing from the file — kept' in line for line in log)
    assert fake_db.tables['labs']
    content.push(fake_db, path=path, prune=True)
    assert fake_db.tables['labs'] == []
