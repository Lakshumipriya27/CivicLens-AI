"""Small helpers: geo distance, text similarity, perceptual image hashing, codes."""
import math
import re
import secrets
from datetime import datetime, timezone

from PIL import Image

_STOPWORDS = set("""a an the and or of to in on at near by for with is are was were be been it this that
there here very from as has have had its into onto over under about our my your their we i you they
please kindly also so but not no can could would should will just some any more most""".split())


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", (text or "").lower())
    out = []
    for w in words:
        if w in _STOPWORDS or len(w) < 3:
            continue
        # very light stemming so "potholes" ~ "pothole", "leaking" ~ "leak"
        for suf in ("ing", "es", "s", "ed"):
            if w.endswith(suf) and len(w) - len(suf) >= 4:
                w = w[: -len(suf)]
                break
        out.append(w)
    return out


def text_similarity(a: str, b: str) -> float:
    """Cosine similarity of term-frequency vectors (0..1)."""
    ta, tb = tokenize(a), tokenize(b)
    if not ta or not tb:
        return 0.0
    fa, fb = {}, {}
    for t in ta:
        fa[t] = fa.get(t, 0) + 1
    for t in tb:
        fb[t] = fb.get(t, 0) + 1
    dot = sum(v * fb.get(k, 0) for k, v in fa.items())
    na = math.sqrt(sum(v * v for v in fa.values()))
    nb = math.sqrt(sum(v * v for v in fb.values()))
    return dot / (na * nb) if na and nb else 0.0


def dhash(img: Image.Image, size: int = 8) -> str:
    """Difference hash (64-bit) as 16 hex chars. Robust to resizing/compression."""
    g = img.convert("L").resize((size + 1, size), Image.Resampling.LANCZOS)
    px = list(g.tobytes())
    bits = 0
    for row in range(size):
        for col in range(size):
            left = px[row * (size + 1) + col]
            right = px[row * (size + 1) + col + 1]
            bits = (bits << 1) | (1 if left > right else 0)
    return f"{bits:016x}"


def hash_similarity(h1: str | None, h2: str | None) -> float | None:
    if not h1 or not h2:
        return None
    dist = bin(int(h1, 16) ^ int(h2, 16)).count("1")
    return 1 - dist / 64


def make_code(prefix: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%y%m")
    return f"{prefix}-{stamp}-{secrets.token_hex(3).upper()}"
