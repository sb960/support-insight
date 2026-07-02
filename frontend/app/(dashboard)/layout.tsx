import { SideNav } from "@/components/nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-background">
            <SideNav />
            <div className="flex min-h-screen min-w-0 flex-1 flex-col">{children}</div>
        </div>
    );
}
