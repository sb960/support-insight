import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { GuestTicket } from "@/lib/demo-data";

export function DemoQueue({ tickets }: { tickets: GuestTicket[] }) {
    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-xl font-semibold tracking-tight">Your demo queue</h2>
                <p className="text-sm text-muted-foreground">
                    Stored in this browser session only — sign up to persist to your workspace.
                </p>
            </div>
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Confidence</TableHead>
                                <TableHead>Message</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tickets.map((ticket) => (
                                <TableRow key={ticket.id}>
                                    <TableCell className="capitalize">{ticket.category}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{ticket.priority}</Badge>
                                    </TableCell>
                                    <TableCell>{ticket.status}</TableCell>
                                    <TableCell>
                                        {Math.round(ticket.confidence_score * 100)}%
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate text-muted-foreground">
                                        {ticket.original_message}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </section>
    );
}
