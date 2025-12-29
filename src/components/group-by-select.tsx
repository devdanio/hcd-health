import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type GroupBy = 'hour' | 'day' | 'week' | 'month' | 'year'

export interface GroupBySelectProps {
  value: GroupBy
  onValueChange: (value: GroupBy) => void
  className?: string
}

const groupByOptions: Array<{ value: GroupBy; label: string }> = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
]

export function GroupBySelect({
  value,
  onValueChange,
  className,
}: GroupBySelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select grouping" />
      </SelectTrigger>
      <SelectContent>
        {groupByOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
