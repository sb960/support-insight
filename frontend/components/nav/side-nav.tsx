"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftToLine, ArrowRightToLine, LogOut } from "lucide-react";
import { useState } from "react";

import { navigations, siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SideNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);

    const handleLogout = async () => {
        await fetch("/api/auth/login", { method: "DELETE" });
        router.push("/login");
    };

    return (
        <>
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
                    collapsed ? "w-[72px]" : "w-64",
                )}
            >
                <div className="flex h-14 items-center border-b border-sidebar-border px-4">
                    {!collapsed && (
                        <span className="font-semibold tracking-tight truncate">{siteConfig.name}</span>
                    )}
                </div>

                <nav className="flex-1 space-y-1 p-3">
                    {navigations.map((item) => {
                        const Icon = item.icon;
                        const active =
                            pathname === item.href ||
                            (item.href !== "/dashboard" && pathname.startsWith(item.href));

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    active
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                                )}
                                title={collapsed ? item.name : undefined}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                {!collapsed && <span>{item.name}</span>}
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-sidebar-border p-3 space-y-2">
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full justify-start gap-3 text-sidebar-foreground/80",
                            collapsed && "justify-center px-0",
                        )}
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Sign out</span>}
                    </Button>
                </div>
            </aside>

            <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="fixed bottom-6 z-40 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-[left] duration-200 hover:bg-muted"
                style={{ left: collapsed ? "56px" : "248px" }}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {collapsed ? (
                    <ArrowRightToLine className="h-4 w-4" />
                ) : (
                    <ArrowLeftToLine className="h-4 w-4" />
                )}
            </button>

            <div
                className={cn("shrink-0 transition-[width] duration-200", collapsed ? "w-[72px]" : "w-64")}
                aria-hidden
            />
        </>
    );
}
