"""Terminal output. In GitHub Actions, warnings become annotations on the run."""

import os
import sys
from typing import NoReturn

import typer

IN_CI = os.environ.get('GITHUB_ACTIONS') == 'true'


def use_utf8_output() -> None:
    """Windows consoles default to cp1252, which can't print ✔ ⚠ ✖; never let a symbol crash a command."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, 'reconfigure', None)
        if reconfigure:
            reconfigure(encoding='utf-8', errors='replace')


use_utf8_output()


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
