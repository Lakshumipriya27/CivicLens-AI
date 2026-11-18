"""Generate synthetic, clearly-labelled illustration images for fictional demo records.

These are drawn programmatically (no real photographs), so no real people or places are depicted.
"""
import io
import random

from PIL import Image, ImageDraw, ImageFilter

W, H = 800, 600


def _noise_bg(rng: random.Random, base: tuple[int, int, int], spread: int) -> Image.Image:
    img = Image.new("RGB", (W // 4, H // 4), base)
    px = img.load()
    for x in range(img.width):
        for y in range(img.height):
            d = rng.randint(-spread, spread)
            px[x, y] = tuple(max(0, min(255, c + d)) for c in base)
    return img.resize((W, H), Image.Resampling.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))


def _label(img: Image.Image) -> Image.Image:
    d = ImageDraw.Draw(img)
    d.rectangle([0, H - 34, W, H], fill=(20, 28, 40))
    d.text((14, H - 26), "FICTIONAL DEMO IMAGE - CivicLens AI (synthetic illustration)", fill=(235, 235, 235))
    return img


def pothole(variant: int = 0) -> Image.Image:
    rng = random.Random(100 + variant)
    img = _noise_bg(rng, (118, 118, 116), 22)
    d = ImageDraw.Draw(img)
    # lane marking
    for i in range(0, W, 120):
        d.rectangle([i + variant * 6, 90, i + 70 + variant * 6, 104], fill=(220, 218, 205))
    cx, cy = 400 + variant * 18, 330 + variant * 10
    pts = []
    for k in range(18):
        import math
        a = k / 18 * 2 * math.pi
        r = 150 + rng.randint(-25, 25)
        pts.append((cx + r * math.cos(a) * 1.3, cy + r * math.sin(a) * 0.7))
    d.polygon(pts, fill=(48, 46, 44))
    inner = [((x - cx) * 0.7 + cx, (y - cy) * 0.6 + cy + 8) for x, y in pts]
    d.polygon(inner, fill=(30, 29, 28))
    for _ in range(6):
        x0, y0 = rng.randint(150, 650), rng.randint(180, 500)
        d.line([x0, y0, x0 + rng.randint(-80, 80), y0 + rng.randint(-40, 40)], fill=(60, 58, 55), width=3)
    return _label(img.filter(ImageFilter.GaussianBlur(0.6)))


def garbage(variant: int = 0) -> Image.Image:
    rng = random.Random(200 + variant)
    img = _noise_bg(rng, (150, 140, 120), 18)
    d = ImageDraw.Draw(img)
    d.rectangle([300, 160, 500, 420], fill=(30, 110, 60), outline=(20, 70, 40), width=6)
    colors = [(220, 60, 50), (240, 200, 40), (40, 120, 220), (250, 250, 250), (200, 80, 180), (60, 180, 90),
              (250, 140, 30)]
    for _ in range(140):
        x, y = rng.randint(180, 640), rng.randint(110, 540)
        if 300 < x < 500 and 170 < y < 410 and rng.random() < 0.7:
            continue
        r = rng.randint(10, 32)
        d.ellipse([x - r, y - r, x + r, y + r * 0.8], fill=rng.choice(colors), outline=(40, 40, 40))
    return _label(img)


def streetlight(variant: int = 0) -> Image.Image:
    rng = random.Random(300 + variant)
    img = _noise_bg(rng, (18, 22, 34), 8)
    d = ImageDraw.Draw(img)
    d.rectangle([390, 120, 404, 560], fill=(55, 58, 64))
    d.rectangle([404, 120, 520, 132], fill=(55, 58, 64))
    d.ellipse([495, 128, 535, 150], fill=(70, 70, 60))
    for _ in range(12):
        x, y = rng.randint(0, W), rng.randint(0, 200)
        d.ellipse([x, y, x + 3, y + 3], fill=(245, 245, 230))
    d.rectangle([0, 470, W, H], fill=(28, 30, 36))
    return _label(img)


def drain(variant: int = 0) -> Image.Image:
    rng = random.Random(400 + variant)
    img = _noise_bg(rng, (105, 100, 92), 16)
    d = ImageDraw.Draw(img)
    d.rectangle([180, 200, 620, 470], fill=(60, 55, 40))
    d.ellipse([140, 170, 660, 500], fill=(72, 66, 44))
    for i in range(220, 600, 34):
        d.rectangle([i, 250, i + 14, 420], fill=(25, 25, 25))
    for _ in range(40):
        x, y = rng.randint(180, 620), rng.randint(220, 460)
        d.ellipse([x, y, x + 18, y + 10], fill=(90, 80, 50))
    return _label(img)


def water_leak(variant: int = 0) -> Image.Image:
    rng = random.Random(500 + variant)
    img = _noise_bg(rng, (120, 120, 118), 14)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 120, W, 160], fill=(90, 100, 110))
    d.ellipse([60, 200, 760, 560], fill=(60, 120, 190))
    d.ellipse([140, 250, 660, 520], fill=(80, 145, 210))
    for _ in range(30):
        x = rng.randint(100, 700)
        d.line([x, 160, x + rng.randint(-10, 10), 220], fill=(150, 190, 230), width=3)
    return _label(img)


def pathway(variant: int = 0) -> Image.Image:
    rng = random.Random(600 + variant)
    img = _noise_bg(rng, (170, 165, 155), 10)
    d = ImageDraw.Draw(img)
    for x in range(0, W, 80):
        for y in range(0, H - 34, 80):
            shade = 150 + rng.randint(-15, 15)
            if rng.random() < 0.18:
                d.polygon([(x + 10, y + 10), (x + 70, y + 20), (x + 60, y + 70), (x + 15, y + 60)],
                          fill=(70, 62, 55))
            else:
                d.rectangle([x + 3, y + 3, x + 77, y + 77], fill=(shade, shade - 4, shade - 10))
            d.line([x, y, x + 80, y], fill=(100, 95, 90), width=3)
            d.line([x, y, x, y + 80], fill=(100, 95, 90), width=3)
    return _label(img)


GENERATORS = {
    "pothole_road_damage": pothole, "garbage_overflow": garbage, "illegal_dumping": garbage,
    "broken_streetlight": streetlight, "blocked_drainage": drain, "water_leakage": water_leak,
    "unsafe_pathway": pathway, "damaged_infrastructure": pathway,
}


def jpeg_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88)
    return buf.getvalue()
