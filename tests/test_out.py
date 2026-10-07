import io

from carlos_cms import out


def test_use_utf8_output_survives_a_cp1252_console(monkeypatch):
    raw = io.BytesIO()
    console = io.TextIOWrapper(raw, encoding='cp1252')
    monkeypatch.setattr('sys.stdout', console)
    monkeypatch.setattr('sys.stderr', console)

    out.use_utf8_output()
    out.ok('done')
    console.flush()

    assert raw.getvalue().decode('utf-8').strip().endswith('✔ done')
