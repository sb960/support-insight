import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  onCreate: () => void;
}

export function SopHeader({ searchTerm, setSearchTerm, onCreate }: Props) {
  return (
    <div className="flex items-center justify-between mb-4">
      <Input
        placeholder="Search SOPs by title or tag"
        value={searchTerm}
        onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
        className="w-80"
      />

      <Button onClick={onCreate} className="ml-4">
        + New SOP
      </Button>
    </div>
  );
}