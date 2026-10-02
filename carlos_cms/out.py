"""Terminal output. In GitHub Actions, warnings become annotations on the run."""

import os
from typing import NoReturn

import typer

IN_CI = os.environ.get('GITHUB_ACTIONS') == 'true'


def ok(message: str) -> None:
    typer.secho(f'✔ {message}', fg=typer.colors.GREEN)


def info(message: str) -> None:
    typer.echo(f'  {message}')


def warn(message: str) -> None:
    if IN_CI:
        typer.echo(f'::warning::{message}')
    else:
        typer.secho(f'⚠ {message}', fg=typer.colors.YELLOW)


def fail(message: str) -> NoReturn:
    if IN_CI:
        typer.echo(f'::error::{message}')
    typer.secho(f'✖ {message}', fg=typer.colors.RED, err=True)
    raise typer.Exit(1)
