"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface FilterOption {
  value: string
  label: string
}

interface FilterBarProps {
  filters: {
    [key: string]: {
      value: string
      options: FilterOption[]
      label: string
    }
  }
  onFilterChange: (key: string, value: string) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function FilterBar({
  filters,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {Object.entries(filters).map(([key, filter]) => (
        <div key={key}>
          <Select value={filter.value} onValueChange={(value) => onFilterChange(key, value)}>
            <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700 text-white">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-white">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          Clear Filters
        </Button>
      )}
    </div>
  )
}
