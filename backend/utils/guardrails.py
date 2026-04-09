"""
Input Guardrails
- Prompt injection detection
- Input sanitization
- Email validation
- Attachment type allow-listing
"""
import re
import html

# Patterns that indicate prompt injection attempts
INJECTION_PATTERNS = [
    r"ignore\s+(previous|all|above)\s+instructions",
    r"you\s+are\s+now\s+(?:a|an)\s+",
    r"disregard\s+(your|all|previous)",
    r"act\s+as\s+(?:if\s+you\s+are|a|an)\s+",
    r"system\s*:\s*",
    r"<\s*system\s*>",
    r"\[INST\]|\[\/INST\]",
    r"###\s*instruction",
    r"jailbreak",
    r"DAN\s+mode",
    r"pretend\s+you\s+(?:are|have\s+no)",
    r"forget\s+(?:all|your|previous)",
    r"new\s+persona",
    r"override\s+(safety|guidelines|instructions)",
    r"<\|im_start\|>|<\|im_end\|>",
]

_INJECTION_RE = re.compile("|".join(INJECTION_PATTERNS), re.IGNORECASE)

ALLOWED_ATTACHMENT_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "text/plain", "text/csv", "application/json",
    "application/octet-stream",  # generic logs
}


def sanitize_input(text: str, max_len: int = 5000) -> str:
    """Strip HTML, normalize whitespace, enforce max length."""
    text = html.escape(text)
    text = text.strip()
    text = re.sub(r"\s{3,}", "  ", text)  # collapse excessive whitespace
    return text[:max_len]


def validate_email(email: str) -> bool:
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email)) and len(email) <= 254


def check_injection(text: str) -> bool:
    """Return True if the text appears to contain a prompt injection attempt."""
    return bool(_INJECTION_RE.search(text))


def validate_attachment_type(content_type: str) -> bool:
    return content_type in ALLOWED_ATTACHMENT_TYPES
