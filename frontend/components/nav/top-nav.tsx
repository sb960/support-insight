"use client";

import Container from "@/components/container";
import { ThemeToggle } from "@/components/theme-toggle";

export default function TopNav({ title, description }: { title: string; description?: string }) {
    return (
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <Container className="flex items-center justify-between py-4 md:py-5">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
                    {description ? (
                        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                    ) : null}
                </div>
                <ThemeToggle />
            </Container>
        </header>
    );
}
