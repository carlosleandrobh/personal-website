"""Images: remove every bit of metadata (EXIF, GPS, camera serial, XMP, ICC) before publishing."""

from pathlib import Path

from PIL import Image, ImageOps

from carlos_cms.config import MEDIA_DIR, PORTRAIT_FILE
from carlos_cms.text import slugify

PORTRAIT_SIZE = (1000, 1200)  # portrait ratio for the hero arch
MEDIA_MAX_WIDTH = 1600


def clean_copy(image: Image.Image) -> Image.Image:
    """Apply the camera orientation, then copy only the pixels into a brand-new image."""
    image = ImageOps.exif_transpose(image)
    if image.mode not in ('RGB', 'RGBA', 'L'):
        image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
    fresh = Image.new(image.mode, image.size)
    fresh.paste(image)
    return fresh  # fresh.info is empty: nothing from the original file survives


def has_metadata(path: Path) -> bool:
    with Image.open(path) as image:
        return bool(image.getexif()) or any(
            k in image.info for k in ('exif', 'xmp', 'XML:com.adobe.xmp', 'icc_profile')
        )


def portrait(source: Path, target: Path = PORTRAIT_FILE) -> tuple[Path, tuple[int, int], bool]:
    with Image.open(source) as original:
        small = original.width < PORTRAIT_SIZE[0]
        image = clean_copy(original).convert('RGB')
    # Crop to the portrait ratio, keeping the upper part (where faces usually are).
    image = ImageOps.fit(image, PORTRAIT_SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.3))
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, 'JPEG', quality=86, optimize=True, progressive=True, subsampling=0)
    return target, image.size, small


def add(source: Path, name: str | None = None, target_dir: Path = MEDIA_DIR) -> Path:
    slug = slugify(name or source.stem) or 'image'
    target = target_dir / f'{slug}.webp'
    with Image.open(source) as original:
        image = clean_copy(original)
    if image.width > MEDIA_MAX_WIDTH:
        height = round(image.height * MEDIA_MAX_WIDTH / image.width)
        image = image.resize((MEDIA_MAX_WIDTH, height), Image.Resampling.LANCZOS)
    target_dir.mkdir(parents=True, exist_ok=True)
    image.save(target, 'WEBP', quality=82, method=6)
    return target
