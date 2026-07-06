import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId
from openai import OpenAI

from database import blogs_collection, sops_collection, tickets_collection

deepseek_client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url=os.getenv("DEEPSEEK_BASE_URL"),
)

BLOG_MODEL = os.getenv("BLOG_MODEL", "deepseek-chat")


def _safe_json_loads(raw: str) -> dict[str, Any]:
    return json.loads(raw)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "blog-post"


async def _fetch_internal_context(tenant_id: str, topic: str) -> str:
    sop_cursor = (
        sops_collection.find({"tenant_id": tenant_id})
        .sort("updated_at", -1)
        .limit(10)
    )
    ticket_cursor = (
        tickets_collection.find(
            {
                "tenant_id": tenant_id,
                "status": {"$in": ["Resolved", "Auto-Drafted"]},
            }
        )
        .sort("created_at", -1)
        .limit(10)
    )

    sops = await sop_cursor.to_list(length=10)
    tickets = await ticket_cursor.to_list(length=10)

    parts: list[str] = [f"Topic: {topic}", ""]
    if sops:
        parts.append("Approved SOP knowledge:")
        for sop in sops:
            title = sop.get("title", "")
            content = sop.get("content", "")
            parts.append(f"- {title}: {content}")

    if tickets:
        parts.append("")
        parts.append("Approved historical ticket knowledge:")
        for ticket in tickets:
            original = ticket.get("original_message", "")
            reply = ticket.get("draft_reply", "")
            parts.append(f"- Customer issue: {original}")
            if reply:
                parts.append(f"  Approved reply: {reply}")

    return "\n".join(parts).strip()


async def _llm_json(messages: list[dict[str, str]]) -> dict[str, Any]:
    response = deepseek_client.chat.completions.create(
        model=BLOG_MODEL,
        response_format={"type": "json_object"},
        messages=messages,
    )
    content = response.choices[0].message.content or "{}"
    return _safe_json_loads(content)


async def _run_outliner(topic: str, context: str, target_audience: Optional[str]) -> dict[str, Any]:
    system_prompt = (
        "You are the Outliner. Create a concise JSON outline for a blog post. "
        "Return only valid JSON with fields: angle, suggested_title, sections (array of "
        "{heading, bullets[]}), key_claims, seo_keywords. "
        "Each section heading should be a clear H2 title; bullets are talking points for that section."
    )
    user_prompt = (
        f"Topic: {topic}\n"
        f"Target audience: {target_audience or 'general'}\n\n"
        f"Context:\n{context}"
    )
    return await _llm_json(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
    )


async def _run_writer(topic: str, context: str, outline: dict[str, Any]) -> str:
    system_prompt = (
        "You are the Writer. Write a well-structured markdown blog post from the outline and context.\n"
        "Structure rules (follow strictly):\n"
        "- Open with 2-3 short introductory sentences (plain paragraphs, no heading).\n"
        "- Use ## for each main section from the outline (3-5 sections).\n"
        "- Use ### only for subsections when needed.\n"
        "- Keep paragraphs to 2-4 sentences. Put a blank line between every paragraph, heading, and list.\n"
        "- Use numbered lists (1. 2. 3.) for step-by-step processes.\n"
        "- Use bullet lists (- item) for requirements, tips, or examples.\n"
        "- Use **bold** sparingly for key terms.\n"
        "- Close with a brief ## Conclusion or ## Next steps section.\n"
        "Output markdown only. No code fences. No JSON."
    )
    user_prompt = (
        f"Topic: {topic}\n\n"
        f"Outline JSON:\n{json.dumps(outline, ensure_ascii=False)}\n\n"
        f"Context:\n{context}"
    )
    response = deepseek_client.chat.completions.create(
        model=BLOG_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content or ""


async def _run_editor(topic: str, context: str, outline: dict[str, Any], draft_markdown: str) -> dict[str, Any]:
    system_prompt = (
        "You are the Editor. Refine the draft for clarity and consistency. "
        "Return only valid JSON with fields: title, slug, excerpt, body_markdown, seo_keywords. "
        "For body_markdown: preserve clear markdown structure with ## section headings, "
        "short paragraphs separated by blank lines, and bullet or numbered lists. "
        "Never collapse the article into one paragraph or remove headings/lists."
    )
    user_prompt = (
        f"Topic: {topic}\n\n"
        f"Outline JSON:\n{json.dumps(outline, ensure_ascii=False)}\n\n"
        f"Draft markdown:\n{draft_markdown}\n\n"
        f"Context:\n{context}"
    )
    result = await _llm_json(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
    )

    title = result.get("title") or outline.get("suggested_title") or topic
    slug = result.get("slug") or _slugify(title)

    seo_keywords = result.get("seo_keywords")
    if not isinstance(seo_keywords, list):
        seo_keywords = []

    return {
        "title": title,
        "slug": slug,
        "excerpt": result.get("excerpt", ""),
        "body_markdown": result.get("body_markdown", draft_markdown),
        "seo_keywords": [str(item) for item in seo_keywords],
    }


async def generate_blog_task(draft_id: str, tenant_id: str, topic: str, target_audience: str | None = None) -> None:
    now = datetime.now(timezone.utc)

    try:
        context = await _fetch_internal_context(tenant_id=tenant_id, topic=topic)

        outline = await _run_outliner(
            topic=topic,
            context=context,
            target_audience=target_audience,
        )

        draft_markdown = await _run_writer(
            topic=topic,
            context=context,
            outline=outline,
        )

        final_data = await _run_editor(
            topic=topic,
            context=context,
            outline=outline,
            draft_markdown=draft_markdown,
        )

        await blogs_collection.update_one(
            {"_id": ObjectId(draft_id), "tenant_id": tenant_id},
            {
                "$set": {
                    "topic": topic,
                    "target_audience": target_audience,
                    "title": final_data["title"],
                    "slug": final_data["slug"],
                    "body_markdown": final_data["body_markdown"],
                    "excerpt": final_data["excerpt"],
                    "seo_keywords": final_data["seo_keywords"],
                    "status": "pending_review",
                    "updated_at": now,
                }
            },
        )

    except Exception as exc:
        await blogs_collection.update_one(
            {"_id": ObjectId(draft_id), "tenant_id": tenant_id},
            {
                "$set": {
                    "status": "failed",
                    "updated_at": datetime.now(timezone.utc),
                    "excerpt": f"Blog generation failed: {exc}",
                }
            },
        )
        raise