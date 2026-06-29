import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const Container = forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
    function Container({ className, children, ...props }, ref) {
        return (
            <div
                ref={ref}
                className={cn("mx-auto w-full max-w-7xl flex-1 p-6 md:p-8", className)}
                {...props}
            >
                {children}
            </div>
        );
    },
);

export default Container;
