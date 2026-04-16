"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw } from "lucide-react";
import { useState } from "react";

interface AnalysisCardProps {
  category: string;
  priority: string;
  draftReply: string;
  reasoning?: string;
  onRegenerate?: () => void;
}

const categoryColors: Record<string, string> = {
  bug: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  feature_request: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  refund: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  complaint: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-500 text-white",
  medium: "bg-yellow-500 text-white",
  low: "bg-green-500 text-white",
};

export function AnalysisCard({ 
  category, 
  priority, 
  draftReply, 
  reasoning,
  onRegenerate 
}: AnalysisCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draftReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categoryLabel = category.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Analysis Result</CardTitle>
        <div className="flex gap-2">
          {onRegenerate && (
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            {copied ? "Copied!" : "Copy Reply"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category and Priority Badges */}
        <div className="flex gap-3">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Category</span>
            <Badge className={categoryColors[category] || categoryColors.other}>
              {categoryLabel}
            </Badge>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Priority</span>
            <Badge className={priorityColors[priority] || priorityColors.medium}>
              {priority.toUpperCase()}
            </Badge>
          </div>
        </div>
        
        {/* Draft Reply */}
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400 block mb-2">Draft Reply</span>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border">
            <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {draftReply}
            </p>
          </div>
        </div>
        
        {/* Reasoning (if available) */}
        {reasoning && (
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400 block mb-2">Reasoning</span>
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">
              {reasoning}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
