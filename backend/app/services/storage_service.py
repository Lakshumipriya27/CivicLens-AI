"""Safe image upload handling: type/size validation, re-encoding, random filenames."""
import io
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings
from app.utils.helpers import dhash

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "MPO"}
MAX_DIMENSION = 2048
Image.MAX_IMAGE_PIXELS = 40_000_000  # guard against decompression bombs


@dataclass
class StoredImage:
    relative_path: str  # e.g. "reports/3f2a...jpg"
    absolute_path: Path
    image_hash: str
    jpeg_bytes: bytes
    width: int
    height: int


async def read_upload(file: UploadFile) -> bytes:
    settings = get_settings()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            "Only JPEG, PNG or WEBP images are accepted.")
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE,
                            f"Image is larger than {settings.MAX_UPLOAD_MB} MB.")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The uploaded file is empty.")
    return data


def store_image(data: bytes, folder: str) -> StoredImage:
    """Validate image content, strip metadata (incl. GPS EXIF), re-encode as JPEG and save."""
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        img = Image.open(io.BytesIO(data))
        if img.format not in ALLOWED_FORMATS:
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unsupported image format.")
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is not a valid image.")

    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)  # re-encoding drops EXIF metadata
    jpeg = buf.getvalue()

    settings = get_settings()
    target_dir = settings.upload_path / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.jpg"
    abs_path = target_dir / name
    abs_path.write_bytes(jpeg)
    return StoredImage(relative_path=f"{folder}/{name}", absolute_path=abs_path,
                       image_hash=dhash(img), jpeg_bytes=jpeg, width=img.width, height=img.height)


def resolve_path(relative_path: str) -> Path | None:
    """Resolve a stored relative path safely inside the upload folder."""
    base = get_settings().upload_path.resolve()
    candidate = (base / relative_path).resolve()
    if base not in candidate.parents or not candidate.is_file():
        return None
    return candidate
