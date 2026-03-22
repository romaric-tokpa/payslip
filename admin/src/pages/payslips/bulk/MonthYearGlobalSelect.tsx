import { Button, Select } from 'antd'
import { MONTHS_FR, yearOptions } from '../payslipUploadConstants'
import '../payslip-upload.css'

type MonthYearGlobalSelectProps = {
  month: number | null
  year: number | null
  onMonthChange: (m: number | null) => void
  onYearChange: (y: number | null) => void
  onApplyToAll: () => void
  disabled?: boolean
}

export function MonthYearGlobalSelect({
  month,
  year,
  onMonthChange,
  onYearChange,
  onApplyToAll,
  disabled = false,
}: MonthYearGlobalSelectProps) {
  const years = yearOptions()
  const canApply = month != null && year != null && !disabled

  return (
    <div className="bulk-review-global">
      <span className="bulk-review-global__label">Mois global :</span>
      <Select
        placeholder="Mois"
        allowClear
        disabled={disabled}
        style={{ minWidth: 130 }}
        value={month ?? undefined}
        options={MONTHS_FR.map((label, i) => ({
          value: i + 1,
          label,
        }))}
        onChange={(v) => onMonthChange(v == null ? null : Number(v))}
        popupMatchSelectWidth={false}
      />
      <Select
        placeholder="Année"
        allowClear
        disabled={disabled}
        style={{ minWidth: 100 }}
        value={year ?? undefined}
        options={years.map((y) => ({ value: y, label: String(y) }))}
        onChange={(v) => onYearChange(v == null ? null : Number(v))}
      />
      <Button
        type="primary"
        disabled={!canApply}
        onClick={() => {
          if (canApply) {
            onApplyToAll()
          }
        }}
        className="payslip-btn-teal"
      >
        Appliquer
      </Button>
    </div>
  )
}
