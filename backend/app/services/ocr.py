"""Poster / screenshot to text with Tesseract."""
import io


class OCRUnavailable(Exception):
    pass


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
        text = pytesseract.image_to_string(image.convert("L"))
    except pytesseract.TesseractNotFoundError:
        raise OCRUnavailable("Tesseract is not installed on the server. Paste the event text instead.")
    if not text.strip():
        raise OCRUnavailable("No text found in that image. Try a clearer picture or paste the text.")
    return text
