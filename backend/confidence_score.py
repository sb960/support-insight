import math
from typing import Any, List

def calculate_mathematical_confidence(response: Any) -> float:
    """
    Calculates a confidence score (0.0 to 1.0) using the geometric mean
    of token probabilities from a modern OpenAI/Deepseek ChatCompletion response.
    """
    logprob_list: List[float] = []
    
    # 1. Safely extract logprobs from the modern response hierarchy
    try:
        # Case A: Standard OpenAI Python SDK Object Notation
        if hasattr(response, "choices"):
            content_logprobs = response.choices[0].logprobs.content
            if content_logprobs:
                for token_obj in content_logprobs:
                    if hasattr(token_obj, "logprob"):
                        logprob_list.append(float(token_obj.logprob))
                        
        # Case B: Dictionary Notation (if the response was dumped to JSON/dict)
        elif isinstance(response, dict) and "choices" in response:
            content_logprobs = response["choices"][0].get("logprobs", {}).get("content", [])
            if content_logprobs:
                for token_obj in content_logprobs:
                    if "logprob" in token_obj:
                        logprob_list.append(float(token_obj["logprob"]))
                        
    except (IndexError, TypeError, AttributeError, KeyError):
        # Failsafe for entirely malformed responses
        pass

    # 2. Return fallback if no logprobs were successfully extracted
    if not logprob_list:
        return 0.5
        
    # 3. Calculate the geometric mean of probabilities
    total = sum(logprob_list)
    n = len(logprob_list)
    
    avg_logprob = total / n
    confidence = math.exp(avg_logprob)
    
    # 4. Clamp the final float between 0.0 and 1.0 and round cleanly
    return round(max(0.0, min(1.0, confidence)), 3)