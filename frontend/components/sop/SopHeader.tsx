import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    onCreate: () => void;
};

export const SopHeader: React.FC<Props> = ({ searchTerm, setSearchTerm, onCreate }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

  return (
    <header className="flex items-center justify-between mb-4" aria-label="SOP controls">
        <Input
            placeholder="Search SOPs by title or tag"
            value={searchTerm}
            onChange={handleChange}
            className="w-80"
            aria-label="Search SOPs"
        />

        <Button onClick={onCreate} className="ml-4" aria-label="Create new SOP">
            + New SOP
        </Button>
    </header>
  );
};