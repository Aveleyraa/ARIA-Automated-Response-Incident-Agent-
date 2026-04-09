"""
Codebase Client – fetches real source files from the Medusa.js
GitHub repository (v1.20.6) to provide grounded code context
for the triage agent.
"""
import logging
import httpx

logger = logging.getLogger("sre-agent.codebase")

MEDUSA_RAW = "https://raw.githubusercontent.com/medusajs/medusa/v1.20.6/packages/medusa/src"

# Mapping: affected_component → list of relevant source files
COMPONENT_FILES = {
    "checkout": [
        "services/cart.ts",
        "api/routes/store/carts/create-cart.ts",
    ],
    "cart": [
        "services/cart.ts",
    ],
    "payments": [
        "services/payment-provider.ts",
        "services/cart.ts",
    ],
    "orders": [
        "services/order.ts",
        "subscribers/order.ts",
    ],
    "fulfillment": [
        "services/fulfillment.ts",
    ],
    "inventory": [
        "services/product-variant-inventory.ts",
    ],
    "products": [
        "services/product.ts",
    ],
    "search": [
        "services/product.ts",
    ],
    "auth": [
        "services/auth.ts",
    ],
    "customers": [
        "services/customer.ts",
    ],
    "discounts": [
        "services/discount.ts",
    ],
    "admin": [
        "api/routes/admin/orders/list-orders.ts",
    ],
    "database": [
        "services/order.ts",
    ],
    "redis": [
        "services/cart.ts",
    ],
    "api-gateway": [
        "services/order.ts",
    ],
    "unknown": [
        "services/order.ts",
        "services/cart.ts",
    ],
}

# Max chars per file to avoid exceeding context window
MAX_FILE_CHARS = 2500


async def fetch_file(path: str) -> str | None:
    """Fetch a single file from Medusa GitHub. Returns content or None."""
    url = f"{MEDUSA_RAW}/{path}"
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(url, timeout=8)
            if r.status_code == 200:
                content = r.text[:MAX_FILE_CHARS]
                logger.info(f"Fetched {path} ({len(content)} chars)")
                return content
            else:
                logger.warning(f"Could not fetch {path}: HTTP {r.status_code}")
                return None
    except Exception as e:
        logger.warning(f"Error fetching {path}: {e}")
        return None


async def fetch_context_for_component(component: str) -> str:
    """
    Fetch relevant Medusa.js source files for a given component.
    Returns a formatted string ready to embed in the LLM prompt.
    """
    files = COMPONENT_FILES.get(component, COMPONENT_FILES["unknown"])
    sections = []

    for path in files:
        content = await fetch_file(path)
        if content:
            sections.append(
                f"### File: `packages/medusa/src/{path}`\n"
                f"```typescript\n{content}\n```"
            )

    if not sections:
        logger.warning(f"No files fetched for component '{component}', using fallback")
        return ""

    return (
        f"## Medusa.js Source Code Context (v1.20.6)\n"
        f"The following are real source files from the Medusa.js repository "
        f"relevant to the affected component '{component}':\n\n"
        + "\n\n".join(sections)
    )