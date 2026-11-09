"""Poster / screenshot to text with Tesseract.

Pre-processing pipeline (improves accuracy on colourful event flyers):
  1. Convert to greyscale (L mode)
  2. Upscale small images so characters are at least ~30 px tall
  3. Apply Otsu-style threshold → pure black-and-white bitmap
  4. Run Tesseract with page-segmentation mode 6 (uniform block of text)
"""
import io


class OCRUnavailable(Exception):
    pass


def _preprocess(image):
    """Return a binarised version of *image* optimised for Tesseract."""
    # 1. greyscale
    img = image.convert("L")

    # 2. upscale if the image is very small (Tesseract struggles below ~300 px)
    min_dim = 800
    w, h = img.size
    if max(w, h) < min_dim:
        scale = min_dim / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)))

    # 3. binarise with a fixed threshold (128) — good enough for most flyers;
    #    avoids the ImageOps.autocontrast dependency so it stays lightweight.
    img = img.point(lambda p: 255 if p > 128 else 0, "1")
    return img


def image_to_text(data: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image, UnidentifiedImageError
    except ImportError:
        raise OCRUnavailable("Poster reading is not set up on the server. Paste the event text instead.")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError):
        raise OCRUnavailable("That file is not a readable image. Upload a PNG or JPG, or paste the text.")
    try:
        processed = _preprocess(image)
        # PSM 6: assume a single uniform block of text — works well for flyers
        text = pytesseract.image_to_string(processed, config="--psm 6")
        # fall back to raw greyscale if binarisation stripped too much
        if len(text.strip()) < 10:
            text = pytesseract.image_to_string(image.convert("L"))
    except pytesseract.TesseractNotFoundError:
        raise OCRUnavailable("Tesseract is not installed on the server. Paste the event text instead.")
    if not text.strip():
        raise OCRUnavailable("No text found in that image. Try a clearer picture or paste the text.")
    return text
