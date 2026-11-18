"""AI provider factory. Add new providers here (e.g. a local ONNX model) without touching routes."""
from app.core.config import get_settings
from app.services.ai.base import AIServiceError, AnalysisResult, VisionProvider

__all__ = ["get_provider", "provider_status", "AIServiceError", "AnalysisResult", "VisionProvider"]


def get_provider() -> VisionProvider:
    s = get_settings()
    if s.ai_provider == "demo":
        from app.services.ai.demo_provider import DemoProvider
        return DemoProvider()
    if s.ai_provider == "gemini":
        from app.services.ai.gemini_provider import GeminiProvider
        return GeminiProvider(s.GEMINI_API_KEY, s.GEMINI_MODEL, s.AI_TIMEOUT_SECONDS)
    raise AIServiceError(f"Unknown AI_PROVIDER '{s.AI_PROVIDER}'. Use 'demo' or 'gemini'.", 503)


def provider_status() -> dict:
    s = get_settings()
    mode = s.ai_provider
    if mode == "demo":
        return {"provider": "demo-heuristic", "mode": "demo", "configured": True, "is_simulated": True,
                "message": "Demonstration mode: image analysis is SIMULATED with simple image statistics. "
                           "No external AI model is used."}
    if mode == "gemini":
        ok = bool(s.GEMINI_API_KEY)
        return {"provider": "google-gemini", "mode": "live", "configured": ok, "is_simulated": False,
                "model": s.GEMINI_MODEL,
                "message": "Live AI analysis with Google Gemini." if ok
                else "Gemini selected but GEMINI_API_KEY is missing. AI analysis will fail until configured."}
    return {"provider": mode, "mode": "unknown", "configured": False, "is_simulated": False,
            "message": f"Unknown AI_PROVIDER '{mode}'."}
