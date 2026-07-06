export type DemoSop = {
    title: string;
    content: string;
    tags: string[];
};

export const DEFAULT_DEMO_SOPS: DemoSop[] = [
    {
        title: "Refund Policy",
        tags: ["refund"],
        content:
            "Verify the charge within 48 hours of the request. If duplicate billing is confirmed, issue a full refund within 5 business days. Apologize for the inconvenience and confirm the refund timeline in the reply.",
    },
    {
        title: "Billing Inquiries",
        tags: ["billing"],
        content:
            "Ask for invoice number and last four digits of the payment method. Never share full card details over email. Escalate disputed charges above $500 to a billing manager.",
    },
    {
        title: "Bug Reports",
        tags: ["bug"],
        content:
            "Acknowledge impact, request steps to reproduce, browser/OS version, and screenshots. Set expectation for engineering review within 24 hours for high-severity issues.",
    },
];

export const STATIC_BLOG_EXAMPLE = {
    topic: "How to handle duplicate billing charges",
    target_audience: "SaaS customers and support agents",
    title: "What to Do When You're Charged Twice for Your Subscription",
    slug: "duplicate-billing-charges",
    excerpt:
        "Duplicate charges happen — here's how our support team verifies, refunds, and prevents repeat billing issues using your company's SOPs and resolved ticket history.",
    seo_keywords: ["duplicate charge", "billing refund", "subscription billing", "customer support"],
    status: "pending_review" as const,
    body_markdown: `## Why duplicate charges occur

Duplicate charges usually stem from retry logic after a failed payment, an upgrade proration overlap, or a webhook delay from your payment provider.

## Our standard resolution flow

1. **Verify** the duplicate within 48 hours using invoice IDs and payment timestamps.
2. **Confirm** with the customer which charge should remain active.
3. **Refund** the duplicate within 5 business days and send written confirmation.
4. **Log** the case so product can trace upstream billing events.

## What customers should include

- Account email and invoice number
- Date and amount of both charges
- Last four digits of the card used

> *This is a sample article. Signed-in workspaces generate posts from **your** SOPs and resolved tickets — not generic templates.*`,
};

export type GuestTicket = {
    id: string;
    original_message: string;
    category: string;
    priority: string;
    draft_reply: string;
    reasoning?: string;
    is_sop_compliant: boolean;
    confidence_score: number;
    sop_rules_followed: string[];
    status: string;
    internal_notes?: string;
    created_at: string;
};
