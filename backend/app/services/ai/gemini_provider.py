"""Google Gemini vision provider (google-genai SDK)."""
import json
import logging
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from app.services.ai.base import AIServiceError, AnalysisResult, VisionProvider
from app.utils.constants import CATEGORIES

logger = logging.getLogger("civiclens.ai.gemini")

CategoryLiteral = Literal[tuple(CATEGORIES.keys())]  # type: ignore[valid-type]


class _GeminiSchema(BaseModel):
    is_civic_issue: bool = Field(description="True only if the image visibly shows a public civic infrastructure problem.")
    detected_category: CategoryLiteral  # type: ignore[valid-type]
    visible_observation: str = Field(description="1-3 sentences describing ONLY what is visible in the image.")
    possible_severity: Literal["low", "medium", "high", "critical"]
    confidence_score: float = Field(description="Your self-assessed confidence 0.0-1.0 in the category.")
    suggested_description: str = Field(description="Neutral one-sentence report description a citizen could submit.")
    safety_concern: str = Field(description="Visible safety risk, or empty string if none is visible.")


PROMPT = f"""You are assisting a municipal civic-issue reporting platform.
Analyse the attached photograph and classify the PUBLIC infrastructure problem it shows.

Allowed categories (use the key):
{json.dumps(CATEGORIES, indent=1)}

Rules:
- Describe only what is visibly supported by the image. Do not guess locations, causes, or people's identities.
- Do not claim the incident is verified; this is a suggestion for human review.
- If the image does not show a civic issue (e.g. a selfie, a document, an indoor scene), set is_civic_issue=false,
  detected_category="other" and explain briefly.
- Severity guide: low = cosmetic; medium = inconvenience; high = likely to cause injury/damage or blocks access;
  critical = immediate danger (e.g. exposed live wires, collapsed structure, deep open pit on a busy road).
- Never include personal data, faces or vehicle number plates in your text.
"""


class GeminiProvider(VisionProvider):
    name = "google-gemini"

    def __init__(self, api_key: str, model: str, timeout_s: int = 45):
        if not api_key:
            raise AIServiceError("AI_PROVIDER is 'gemini' but GEMINI_API_KEY is not configured on the server.", 503)
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:  # pragma: no cover
            raise AIServiceError("google-genai package is not installed on the server.", 503) from exc
        self._types = types
        self._client = genai.Client(api_key=api_key,
                                    http_options=types.HttpOptions(timeout=timeout_s * 1000))
        self.model = model

    def analyze(self, image_jpeg: bytes, user_hint: str | None = None) -> AnalysisResult:
        types = self._types
        prompt = PROMPT
        if user_hint:
            prompt += f"\nCitizen's optional note (may be inaccurate; rely on the image): {user_hint[:500]}"
        try:
            resp = self._client.models.generate_content(
                model=self.model,
                contents=[types.Part.from_bytes(data=image_jpeg, mime_type="image/jpeg"), prompt],
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    response_mime_type="application/json",
                    response_schema=_GeminiSchema,
                ),
            )
        except Exception as exc:  # SDK raises various error types
            logger.warning("Gemini request failed: %s", type(exc).__name__)
            msg = str(exc)
            if "API key" in msg or "PERMISSION_DENIED" in msg or "401" in msg or "403" in msg:
                raise AIServiceError("The Gemini API rejected the configured API key.", 502) from exc
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                raise AIServiceError("The Gemini API rate limit or quota was exceeded. Try again later.", 503) from exc
            raise AIServiceError("The AI service could not be reached or returned an error.", 502) from exc

        raw = resp.text or ""
        try:
            parsed = _GeminiSchema.model_validate_json(raw)
        except ValidationError as exc:
            logger.warning("Gemini returned invalid JSON structure")
            raise AIServiceError("The AI service returned an invalid response. Please retry.", 502) from exc

        return AnalysisResult(
            is_civic_issue=parsed.is_civic_issue,
            detected_category=parsed.detected_category,
            visible_observation=parsed.visible_observation[:1200],
            possible_severity=parsed.possible_severity,
            confidence_score=max(0.0, min(1.0, parsed.confidence_score)),
            confidence_note="Self-reported by the model; not a calibrated probability.",
            suggested_description=parsed.suggested_description[:1200],
            safety_concern=(parsed.safety_concern or None),
            analysis_provider=self.name,
            model_name=self.model,
            is_simulated=False,
            raw_response=raw[:8000],
        )
