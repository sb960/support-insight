"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useHydration } from "@/hooks/use-hydration";

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const hydrated = useHydration();

    if (!hydrated) {
        return (
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle theme" />
        );
    }

    const isDark = resolvedTheme === "dark";

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Toggle theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
        >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
    );
}
