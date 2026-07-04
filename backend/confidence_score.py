"""Confidence scoring for SupportInsight.

This module replaces the old single-signal logprob scorer with a multi-signal
confidence calculator designed for high-precision routing:

- retrieval quality
- evidence density
- model certainty
- compliance gating

The implementation intentionally fails low when signals are missing.
"""

from __future__ import annotations

import re
from typing import Any, Iterable, Optional

DEFAULT_WEIGHTS = {
    "retrieval": 0.35,
    "evidence": 0.15,
    "certainty": 0.30,
    "compliance": 0.20,
}

_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "you",
    "your",
}


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _normalize_weights(weights: Optional[dict[str, float]]) -> dict[str, float]:
    selected = dict(DEFAULT_WEIGHTS if weights is None else weights)
    required_keys = set(DEFAULT_WEIGHTS)
    if set(selected) != required_keys:
        missing = required_keys - set(selected)
        extra = set(selected) - required_keys
        raise ValueError(f"weights must contain exactly {sorted(required_keys)}; missing={sorted(missing)} extra={sorted(extra)}")

    total = sum(selected.values())
    if abs(total - 1.0) > 1e-6:
        raise ValueError(f"weights must sum to 1.0, got {total}")
    return selected


def _tokenize(text: Optional[str]) -> set[str]:
    if not text:
        return set()

    tokens = set()
    for raw_token in re.findall(r"[a-z0-9]+", text.lower()):
        if len(raw_token) < 3 or raw_token in _STOPWORDS:
            continue
        tokens.add(raw_token)
    return tokens


def extract_average_logprob(response: Any) -> Optional[float]:
    """Extract the average token log-probability from an OpenAI-style response."""
    logprobs: list[float] = []

    try:
        if hasattr(response, "choices"):
            choice = response.choices[0]
            content = getattr(getattr(choice, "logprobs", None), "content", None) or []
            for token_obj in content:
                token_logprob = getattr(token_obj, "logprob", None)
                if token_logprob is not None:
                    logprobs.append(float(token_logprob))
        elif isinstance(response, dict):
            choices = response.get("choices", [])
            if choices:
                content = choices[0].get("logprobs", {}).get("content", [])
                for token_obj in content:
                    token_logprob = token_obj.get("logprob")
                    if token_logprob is not None:
                        logprobs.append(float(token_logprob))
    except (IndexError, TypeError, AttributeError, KeyError, ValueError):
        return None

    if not logprobs:
        return None

    return sum(logprobs) / len(logprobs)


def derive_retrieval_signals(
    query_text: Optional[str],
    context_text: Optional[str],
    max_evidence_chunks: int = 5,
) -> tuple[float, int]:
    """Derive simple retrieval quality and evidence density signals from text overlap."""
    query_tokens = _tokenize(query_text)
    context_tokens = _tokenize(context_text)

    if not query_tokens or not context_tokens:
        return 0.0, 0

    overlap = query_tokens & context_tokens
    evidence_count = min(len(overlap), max_evidence_chunks)
    retrieval_score = len(overlap) / max(len(query_tokens), 1)
    return _clamp01(retrieval_score), evidence_count


def calculate_confidence(
    retrieval_score: Optional[float],
    evidence_count: Optional[int],
    avg_logprobs: Optional[float],
    compliance_met: bool,
    max_evidence_chunks: int = 5,
    weights: Optional[dict[str, float]] = None,
    compliance_cap: float = 0.4,
) -> float:
    """Calculate a gated, multi-signal confidence score in the range [0.0, 1.0]."""
    selected_weights = _normalize_weights(weights)

    retrieval_norm = 0.0 if retrieval_score is None else _clamp01(retrieval_score)
    evidence_norm = 0.0 if not evidence_count or evidence_count <= 0 else min(1.0, evidence_count / max_evidence_chunks)
    # Model certainty:
    # Instead of exp(), map the logprob range to [0, 1].
    # Typical logprobs: 0.0 (perfect) to -2.0 (low confidence).
    if avg_logprobs is None:
        certainty_norm = 0.0
    else:
        # Clamp between -2.0 and 0.0, then map to 0.0 - 1.0.
        # Anything better than 0 is 1.0, anything worse than -2 is 0.0.
        certainty_norm = 1.0 - (max(0.0, min(2.0, abs(avg_logprobs))) / 2.0)
    compliance_norm = 1.0 if compliance_met else 0.0

    weighted_score = (
        selected_weights["retrieval"] * retrieval_norm
        + selected_weights["evidence"] * evidence_norm
        + selected_weights["certainty"] * certainty_norm
        + selected_weights["compliance"] * compliance_norm
    )

    if not compliance_met:
        weighted_score = min(weighted_score, compliance_cap)

    return round(_clamp01(weighted_score), 3)


if __name__ == "__main__":
    import doctest

    doctest.testmod()

    print("Strong answer, compliant:      ", calculate_confidence(0.92, 3, -0.08, True))
    print("Strong answer, non-compliant:  ", calculate_confidence(0.92, 3, -0.08, False))
    print("No context, zero-token resp:   ", calculate_confidence(None, None, None, True))