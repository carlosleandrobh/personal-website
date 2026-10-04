"""Ask GitHub Actions to rebuild the site, then report whether GitHub accepted the request."""

import time
from collections.abc import Callable
from typing import Any, Literal

Outcome = Literal['accepted', 'rejected', 'unknown']

REASONS = {
    401: 'The GitHub token in Vault is invalid or has expired (401). Update `github_dispatch_token`.',
    403: 'GitHub refused the token (403). It needs Contents: read & write on this repository.',
    404: 'GitHub could not find the repository (404). Check that `github_repository` is owner/name.',
    422: 'GitHub rejected the request body (422).',
}


def explain(response: dict[str, Any]) -> tuple[Outcome, str]:
    """Turn one row of GitHub's answer into an outcome and a plain message."""
    status = response.get('status_code')
    if status == 204:
        return 'accepted', 'Rebuild requested: GitHub accepted it.'
    if status is None:
        return 'rejected', f'The request to GitHub failed: {response.get("error_msg") or "no answer"}.'
    detail = (response.get('content') or '').strip()
    reason = REASONS.get(status) or f'GitHub answered {status}.'
    return 'rejected', f'{reason} {detail}'.strip()


def request(
    client: Any,
    source: str = 'cli',
    *,
    attempts: int = 10,
    delay: float = 1.0,
    sleep: Callable[[float], None] = time.sleep,
) -> tuple[Outcome, str]:
    """Send the rebuild request and wait a few seconds for GitHub's answer."""
    request_id = client.rpc('request_rebuild', {'p_source': source}).execute().data
    if request_id is None:  # the old function returned nothing: the migration has not been applied yet
        return (
            'rejected',
            'The database is out of date. Apply supabase/migrations/20261004000000_rebuild_feedback.sql.',
        )
    for attempt in range(attempts):
        rows = client.rpc('rebuild_result', {'p_request_id': request_id}).execute().data
        if rows:
            return explain(rows[0])
        if attempt < attempts - 1:
            sleep(delay)
    return (
        'unknown',
        'The request was sent but GitHub has not answered yet. Check the Actions tab in a minute.',
    )
