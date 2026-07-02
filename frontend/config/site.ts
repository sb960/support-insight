import { BookOpen, LayoutDashboard, Ticket, type LucideIcon } from "lucide-react";

export const siteConfig = {
    name: "SupportInsight",
    description: "AI-powered customer support triage for B2B teams",
};

export type NavItem = {
    name: string;
    href: string;
    icon: LucideIcon;
};

export const navigations: NavItem[] = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Tickets", href: "/tickets", icon: Ticket },
    { name: "SOPs", href: "/sop", icon: BookOpen },
];
