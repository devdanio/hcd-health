import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type TimeRange = '24h' | '7d' | '14d' | '30d' | '90d' | '1y' | 'max'

export interface TimeframeSelectProps {
  value: TimeRange
  onValueChange: (value: TimeRange) => void
  className?: string
}

const timeRangeOptions: Array<{ value: TimeRange; label: string }> = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '14d', label: 'Last 14 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last Year' },
  { value: 'max', label: 'All Time' },
]

export function TimeframeSelect({
  value,
  onValueChange,
  className,
}: TimeframeSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select timeframe" />
      </SelectTrigger>
      <SelectContent>
        {timeRangeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
