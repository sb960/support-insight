import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { STATIC_BLOG_EXAMPLE } from "@/lib/demo-data";

export function StaticBlogPreview() {
    const blog = STATIC_BLOG_EXAMPLE;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardDescription>Sample topic: {blog.topic}</CardDescription>
                        <CardTitle>{blog.title}</CardTitle>
                    </div>
                    <Badge variant="secondary">{blog.status.replace("_", " ")}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{blog.excerpt}</p>
                <div className="flex flex-wrap gap-2">
                    {blog.seo_keywords.map((kw) => (
                        <Badge key={kw} variant="outline">
                            {kw}
                        </Badge>
                    ))}
                </div>
                <MarkdownContent
                    content={blog.body_markdown}
                    className="rounded-md border bg-muted/30 p-4 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                    Live blog generation uses your tenant SOPs and resolved tickets.{" "}
                    <Button variant="link" className="h-auto p-0 text-xs" asChild>
                        <Link href="/register">Sign in to generate yours</Link>
                    </Button>
                </p>
            </CardContent>
        </Card>
    );
}
