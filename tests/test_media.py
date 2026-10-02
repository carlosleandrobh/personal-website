from PIL import Image

from carlos_cms import media

GPS = {0x0001: 'S', 0x0002: (36.0, 50.0, 0.0), 0x0003: 'E', 0x0004: (174.0, 45.0, 0.0)}


def _photo_with_gps(path, size=(1400, 1600)):
    image = Image.new('RGB', size, (200, 180, 160))
    exif = image.getexif()
    exif[0x010F] = 'TestCam'  # Make
    exif[0x0110] = 'Secret-Model-123'  # Model
    exif[0x0112] = 6  # Orientation: rotate 90°
    exif.get_ifd(0x8825).update(GPS)  # GPS
    image.save(path, 'JPEG', exif=exif)
    return path


def test_portrait_removes_all_metadata_and_applies_orientation(tmp_path):
    source = _photo_with_gps(tmp_path / 'me.jpg')
    assert media.has_metadata(source)
    target, size, small = media.portrait(source, tmp_path / 'portrait.jpg')
    assert size == (1000, 1200) and not small
    assert not media.has_metadata(target)
    raw = target.read_bytes()
    assert b'Secret-Model' not in raw and b'TestCam' not in raw


def test_media_add_converts_to_webp_without_metadata(tmp_path):
    source = _photo_with_gps(tmp_path / 'Rack Photo.jpg', size=(3200, 2000))
    target = media.add(source, None, tmp_path / 'media')
    assert target.name == 'rack-photo.webp'
    with Image.open(target) as image:
        assert image.width == 1600 and image.format == 'WEBP'
    assert not media.has_metadata(target)
    assert b'Secret-Model' not in target.read_bytes()
