import pytest

from carlos_cms import rebuild


def answer(fake_db, request_id, response):
    """Script the two RPCs: request_rebuild returns an id, rebuild_result returns GitHub's answer."""
    fake_db.rpc_handlers['request_rebuild'] = lambda _p: request_id
    fake_db.rpc_handlers['rebuild_result'] = lambda _p: [response]


def run(fake_db, **kwargs):
    return rebuild.request(fake_db, sleep=lambda _s: None, **kwargs)


def test_accepted_when_github_answers_204(fake_db):
    answer(fake_db, 42, {'status_code': 204, 'error_msg': None, 'content': ''})
    outcome, message = run(fake_db)
    assert outcome == 'accepted'
    assert 'accepted' in message
    assert fake_db.rpc_calls[0] == ('request_rebuild', {'p_source': 'cli'})
    assert fake_db.rpc_calls[1] == ('rebuild_result', {'p_request_id': 42})


@pytest.mark.parametrize(
    ('status', 'hint'),
    [(401, 'expired'), (403, 'Contents'), (404, 'owner/name'), (422, 'body'), (500, '500')],
)
def test_rejected_explains_the_github_status(fake_db, status, hint):
    answer(fake_db, 1, {'status_code': status, 'error_msg': None, 'content': '{"message":"Bad"}'})
    outcome, message = run(fake_db)
    assert outcome == 'rejected'
    assert hint in message
    assert '{"message":"Bad"}' in message


def test_rejected_when_the_request_itself_failed(fake_db):
    answer(fake_db, 1, {'status_code': None, 'error_msg': 'Timeout of 5000 ms reached', 'content': None})
    outcome, message = run(fake_db)
    assert outcome == 'rejected'
    assert 'Timeout' in message


def test_waits_until_the_answer_arrives(fake_db):
    answers = iter([[], [], [{'status_code': 204, 'error_msg': None, 'content': ''}]])
    fake_db.rpc_handlers['request_rebuild'] = lambda _p: 7
    fake_db.rpc_handlers['rebuild_result'] = lambda _p: next(answers)
    sleeps: list[float] = []
    outcome, _ = rebuild.request(fake_db, sleep=sleeps.append)
    assert outcome == 'accepted'
    assert len(sleeps) == 2


def test_unknown_when_github_has_not_answered(fake_db):
    fake_db.rpc_handlers['request_rebuild'] = lambda _p: 7
    fake_db.rpc_handlers['rebuild_result'] = lambda _p: []
    outcome, message = run(fake_db, attempts=3)
    assert outcome == 'unknown'
    assert 'Actions tab' in message
    assert [name for name, _ in fake_db.rpc_calls].count('rebuild_result') == 3


def test_old_database_without_the_migration_is_reported(fake_db):
    fake_db.rpc_handlers['request_rebuild'] = lambda _p: None  # the old function returned void
    outcome, message = run(fake_db)
    assert outcome == 'rejected'
    assert 'migration' in message
