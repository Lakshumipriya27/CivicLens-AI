"""Demonstration-mode provider.

This is NOT an AI vision model. It computes a few simple, measurable image statistics with Pillow
(brightness, colour saturation, dominant hue, edge density, dark-area ratio) and combines them with
keywords from the citizen's optional text hint. Every result is explicitly flagged `is_simulated=True`
and the UI labels it as simulated, so it is never presented as real AI analysis.
It is deterministic: the same image + hint always produce the same output.
"""
import io
import json

from PIL import Image, ImageFilter, ImageStat

from app.services.ai.base import AnalysisResult, VisionProvider
from app.utils.constants import CATEGORIES

KEYWORDS = {
    "pothole_road_damage": ["pothole", "road", "crack", "asphalt", "tar", "pit", "street damage"],
    "garbage_overflow": ["garbage", "bin", "trash", "waste", "overflow", "dustbin", "rubbish"],
    "illegal_dumping": ["dump", "dumping", "debris", "construction waste", "heap", "litter"],
    "blocked_drainage": ["drain", "drainage", "sewer", "clog", "blocked", "stagnant", "manhole"],
    "water_leakage": ["leak", "leakage", "pipe", "burst", "water", "tap"],
    "damaged_infrastructure": ["bench", "railing", "bridge", "wall", "signboard", "broken", "damaged"],
    "broken_streetlight": ["streetlight", "street light", "lamp", "light", "dark", "pole"],
    "unsafe_pathway": ["footpath", "sidewalk", "pavement", "tile", "pathway", "uneven", "walkway"],
}

TEMPLATES = {
    "pothole_road_damage": ("Road surface appears damaged; there may be a depression or broken asphalt.",
                            "Possible road surface damage that may affect vehicles and pedestrians."),
    "garbage_overflow": ("Image contains a cluster of varied colours and textures typical of accumulated waste.",
                         "Possible overflowing garbage collection point requiring clearance."),
    "illegal_dumping": ("Image shows an irregular heap of mixed material in an open area.",
                        "Possible unauthorised dumping of waste or debris."),
    "blocked_drainage": ("Image shows dark, low-contrast areas that may indicate stagnant water or a clogged drain.",
                         "Possible blocked drain causing water stagnation."),
    "water_leakage": ("Image is dominated by blue/reflective tones that may indicate water on a surface.",
                      "Possible water leakage or pipe burst."),
    "damaged_infrastructure": ("Image shows structural edges and surfaces that may be damaged.",
                               "Possible damage to public infrastructure."),
    "broken_streetlight": ("Image is predominantly dark, suggesting poor lighting conditions.",
                           "Possible non-functional streetlight leaving the area poorly lit."),
    "unsafe_pathway": ("Image shows an uneven, high-detail walking surface.",
                       "Possible unsafe or uneven pedestrian pathway."),
    "other": ("No clear civic-issue pattern could be identified from the simple image statistics.",
              "Civic issue reported by citizen; category requires manual confirmation."),
}


def _features(image_jpeg: bytes) -> dict:
    img = Image.open(io.BytesIO(image_jpeg)).convert("RGB")
    img.thumbnail((256, 256))
    stat = ImageStat.Stat(img)
    r, g, b = stat.mean
    hsv = img.convert("HSV")
    h_mean, s_mean, v_mean = ImageStat.Stat(hsv).mean
    gray = img.convert("L")
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_density = ImageStat.Stat(edges).mean[0] / 255
    px = list(gray.tobytes())
    dark_ratio = sum(1 for p in px if p < 60) / len(px)
    bright_ratio = sum(1 for p in px if p > 220) / len(px)
    return {
        "mean_rgb": [round(r), round(g), round(b)],
        "brightness": round(v_mean / 255, 3),
        "saturation": round(s_mean / 255, 3),
        "hue": round(h_mean / 255 * 360),
        "edge_density": round(edge_density, 3),
        "dark_ratio": round(dark_ratio, 3),
        "bright_ratio": round(bright_ratio, 3),
        "blue_dominant": b > r + 12 and b > g,
    }


def _image_scores(f: dict) -> dict[str, float]:
    s = {k: 0.0 for k in CATEGORIES}
    b, sat, edges, dark = f["brightness"], f["saturation"], f["edge_density"], f["dark_ratio"]
    # Very dark scene -> poor lighting
    if b < 0.22:
        s["broken_streetlight"] += 0.5 + (0.2 if f["bright_ratio"] > 0.002 else 0)
    # Blue / reflective tones in a normally lit scene -> water
    if f["blue_dominant"] and sat > 0.18 and b >= 0.3:
        s["water_leakage"] += 0.55
        s["blocked_drainage"] += 0.2
    # Grey, low-saturation surface
    if sat < 0.16 and 0.25 < b < 0.75:
        if dark > 0.1:
            s["pothole_road_damage"] += 0.65  # grey surface with a large dark cavity
        elif edges > 0.075:
            s["unsafe_pathway"] += 0.5  # grey surface with regular high-detail joints (tiles/slabs)
            s["damaged_infrastructure"] += 0.15
        else:
            s["pothole_road_damage"] += 0.3
    # Brownish, muddy tones with dark areas -> stagnant drain
    if 0.15 <= sat <= 0.3 and 30 <= f["hue"] <= 80 and dark > 0.1 and b >= 0.22:
        s["blocked_drainage"] += 0.55
    # Many saturated, varied colours with high detail -> accumulated waste
    if sat > 0.3 and edges > 0.07 and not f["blue_dominant"]:
        s["garbage_overflow"] += 0.5
        s["illegal_dumping"] += 0.3
    return s


def _hint_scores(hint: str | None) -> dict[str, float]:
    s = {k: 0.0 for k in CATEGORIES}
    text = (hint or "").lower()
    for cat, words in KEYWORDS.items():
        for w in words:
            if w in text:
                s[cat] += 0.4
    return s


def _severity(cat: str, f: dict, hint: str | None) -> str:
    text = (hint or "").lower()
    if any(w in text for w in ("accident", "injur", "collapsed", "live wire", "electrocut")):
        return "critical"
    if any(w in text for w in ("large", "deep", "school", "hospital", "dangerous", "huge", "flood")):
        return "high"
    if cat == "pothole_road_damage" and f["dark_ratio"] > 0.15:
        return "high"
    if cat in ("broken_streetlight", "unsafe_pathway", "blocked_drainage"):
        return "medium"
    return "medium" if cat != "other" else "low"


class DemoProvider(VisionProvider):
    name = "demo-heuristic"

    def analyze(self, image_jpeg: bytes, user_hint: str | None = None) -> AnalysisResult:
        f = _features(image_jpeg)
        img_s, hint_s = _image_scores(f), _hint_scores(user_hint)
        combined = {k: img_s[k] + hint_s[k] for k in CATEGORIES}
        best = max(combined, key=lambda k: (combined[k], k != "other"))
        top = combined[best]
        if top < 0.3:
            best = "other"
        ranked = sorted(combined.values(), reverse=True)
        margin = ranked[0] - ranked[1] if len(ranked) > 1 else ranked[0]
        # Heuristic agreement score, capped low on purpose: this is not a model probability.
        confidence = round(min(0.6, 0.2 + 0.25 * min(top, 1.0) + 0.3 * min(margin, 0.5)), 2) if best != "other" else 0.15

        obs_template, desc = TEMPLATES[best]
        observation = (
            f"[Simulated analysis] {obs_template} Measured: brightness {f['brightness']:.2f}, "
            f"colour saturation {f['saturation']:.2f}, edge density {f['edge_density']:.2f}, "
            f"dark-area ratio {f['dark_ratio']:.2f}."
        )
        if hint_s[best] > 0:
            observation += " Category also informed by keywords in the citizen's text."
        severity = _severity(best, f, user_hint)
        safety = None
        if best in ("pothole_road_damage", "unsafe_pathway"):
            safety = "May pose a tripping or vehicle-damage risk; requires on-site verification."
        elif best == "broken_streetlight":
            safety = "Poor lighting can reduce pedestrian safety at night; requires verification."
        elif best in ("blocked_drainage", "water_leakage"):
            safety = "Standing water may create slipping or hygiene risks; requires verification."

        return AnalysisResult(
            is_civic_issue=best != "other",
            detected_category=best,
            visible_observation=observation,
            possible_severity=severity,
            confidence_score=confidence,
            confidence_note="Heuristic agreement score from simple image statistics (demo mode) — not an AI model probability.",
            suggested_description=desc,
            safety_concern=safety,
            analysis_provider=self.name,
            model_name="pillow-image-statistics",
            is_simulated=True,
            raw_response=json.dumps({"features": f, "image_scores": img_s, "hint_scores": hint_s}),
        )
