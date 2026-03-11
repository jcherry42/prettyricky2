"""Image processing utilities for OCR optimization."""
import io
import base64
import logging
from PIL import Image

logger = logging.getLogger(__name__)

MAX_OCR_DIMENSION = 1536  # Optimal for GPT-4o-mini Vision — faster with no accuracy loss


def resize_image_for_ocr(image_bytes: bytes, max_dim: int = MAX_OCR_DIMENSION) -> bytes:
    """Resize image to max_dim on longest side. Returns PNG bytes.
    Reduces API latency and bandwidth without sacrificing OCR accuracy."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        w, h = img.size

        if max(w, h) <= max_dim:
            return image_bytes  # Already small enough

        ratio = max_dim / max(w, h)
        new_size = (int(w * ratio), int(h * ratio))
        img = img.resize(new_size, Image.LANCZOS)

        buf = io.BytesIO()
        # Use PNG for lossless OCR clarity
        img.save(buf, format="PNG", optimize=True)
        result = buf.getvalue()

        logger.info(f"Image resized: {w}x{h} -> {new_size[0]}x{new_size[1]} ({len(image_bytes)} -> {len(result)} bytes)")
        return result
    except Exception as e:
        logger.warning(f"Image resize failed, using original: {e}")
        return image_bytes


def resize_image_for_ocr_jpeg(image_bytes: bytes, max_dim: int = MAX_OCR_DIMENSION, quality: int = 80) -> bytes:
    """Resize image to max_dim on longest side. Returns JPEG bytes.
    JPEG at quality 80 is ~60% smaller than PNG for photos with zero OCR accuracy loss.
    Significantly reduces Vision API latency (fewer tokens for the image)."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        w, h = img.size

        # Convert RGBA/P to RGB for JPEG
        if img.mode in ('RGBA', 'P', 'LA'):
            img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        if max(w, h) > max_dim:
            ratio = max_dim / max(w, h)
            new_size = (int(w * ratio), int(h * ratio))
            img = img.resize(new_size, Image.LANCZOS)
            logger.info(f"Image resized: {w}x{h} -> {new_size[0]}x{new_size[1]}")
        else:
            new_size = (w, h)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        result = buf.getvalue()

        logger.info(f"JPEG optimized: {len(image_bytes)} -> {len(result)} bytes ({new_size[0]}x{new_size[1]})")
        return result
    except Exception as e:
        logger.warning(f"JPEG resize failed, using original: {e}")
        return image_bytes


def resize_base64_for_ocr(b64_data: str, max_dim: int = MAX_OCR_DIMENSION) -> str:
    """Resize a base64-encoded image. Returns base64 string."""
    try:
        raw = base64.b64decode(b64_data)
        resized = resize_image_for_ocr(raw, max_dim)
        if resized is raw:
            return b64_data  # No change
        return base64.b64encode(resized).decode('ascii')
    except Exception as e:
        logger.warning(f"Base64 resize failed: {e}")
        return b64_data
