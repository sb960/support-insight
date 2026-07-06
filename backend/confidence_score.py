"""Confidence scoring for SupportInsight.

This module calculates a multi-signal confidence score designed for high-precision routing.
It heavily weights SOP similarity (retrieval quality and evidence density) against the ticket,
using empirical min-max scaling to prevent real-world scores from artificially flattening.
"""

from __future__ import annotations

import re
from typing import Any, Iterable, Optional

DEFAULT_WEIGHTS = {
    "retrieval": 0.40,   # How well the ticket matches the SOP context
    "evidence": 0.15,    # Number of matching keywords (capped realistically)
    "certainty": 0.25,   # LLM Logprobs
    "compliance": 0.20,  # Boolean SOP adherence
}

_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "how", "i", "in", "is", "it", "of", "on", "or", "that", "the",
    "this", "to", "was", "what", "when", "where", "which", "who",
    "why", "with", "you", "your",
}


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _min_max_scale(value: float, min_val: float, max_val: float) -> float:
    """Scales a real-world observed value to a 0.0 - 1.0 range."""
    if max_val == min_val:
        return 0.0
    return _clamp01((value - min_val) / (max_val - min_val))


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
    """Extract the average token log-probability from an OpenAI/DeepSeek-style response."""
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
    max_evidence_chunks: int = 3,
) -> tuple[float, int]:
    """Derive simple retrieval quality and evidence density signals from text overlap."""
    query_tokens = _tokenize(query_text)
    context_tokens = _tokenize(context_text)

    if not query_tokens or not context_tokens:
        return 0.0, 0

    overlap = query_tokens & context_tokens
    evidence_count = min(len(overlap), max_evidence_chunks)
    
    # Calculate Jaccard-style overlap
    retrieval_score = len(overlap) / max(len(query_tokens), 1)
    return retrieval_score, evidence_count


def calculate_confidence(
    retrieval_score: Optional[float],
    evidence_count: Optional[int],
    avg_logprobs: Optional[float],
    compliance_met: bool,
    max_evidence_chunks: int = 3, # Saturate at 3, not 5
    weights: Optional[dict[str, float]] = None,
    compliance_cap: float = 0.4,
) -> float:
    """Calculate a gated, multi-signal confidence score centered on SOP similarity."""
    selected_weights = _normalize_weights(weights)

    # Retrieval Normalization: Map realistic overlap [0.15 to 0.60] -> [0.0, 1.0]
    retrieval_val = 0.0 if retrieval_score is None else retrieval_score
    retrieval_norm = _min_max_scale(retrieval_val, min_val=0.15, max_val=0.60)

    # Evidence Normalization
    evidence_val = 0 if not evidence_count else evidence_count
    evidence_norm = _min_max_scale(evidence_val, min_val=0, max_val=max_evidence_chunks)

    # Model Certainty: Map realistic logprobs [-2.5 to -0.2] -> [0.0, 1.0]
    logprob_val = -3.0 if avg_logprobs is None else avg_logprobs
    certainty_norm = _min_max_scale(logprob_val, min_val=-2.5, max_val=-0.2)

    # Compliance Gate
    compliance_norm = 1.0 if compliance_met else 0.0

    # Weighted Sum
    weighted_score = (
        selected_weights["retrieval"] * retrieval_norm
        + selected_weights["evidence"] * evidence_norm
        + selected_weights["certainty"] * certainty_norm
        + selected_weights["compliance"] * compliance_norm
    )

    # Apply hard cap if the SOP was fundamentally violated
    if not compliance_met:
        weighted_score = min(weighted_score, compliance_cap)

    return round(_clamp01(weighted_score), 3)


if __name__ == "__main__":
    print("Strong SOP Match, Compliant: ", calculate_confidence(0.55, 3, -0.4, True))
    print("Average SOP Match, Compliant:", calculate_confidence(0.30, 2, -1.2, True))
    print("Poor SOP Match, Compliant:   ", calculate_confidence(0.10, 0, -2.1, True))
    print("Strong Match, NON-compliant: ", calculate_confidence(0.55, 3, -0.4, False))