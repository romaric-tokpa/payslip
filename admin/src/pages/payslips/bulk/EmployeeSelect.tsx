import { Select, Spin } from 'antd'
import type { SelectProps } from 'antd/es/select'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as employeesApi from '../../../services/employees.service'
import type { EmployeeUser } from '../../../types/employees'
import { formatEmployeeOption } from '../payslipUploadConstants'

type Option = { value: string; label: string }

type EmployeeSelectProps = {
  value: string | null
  onChange: (userId: string | null) => void
  /** Libellé affiché quand l’utilisateur est pré-rempli sans recherche. */
  preset?: { userId: string; label: string } | null
  placeholder?: string
  status?: SelectProps['status']
  allowClear?: boolean
  disabled?: boolean
  /** Classe sur le composant Select racine (bordures personnalisées, etc.). */
  className?: string
}

function userToOption(u: EmployeeUser): Option {
  return { value: u.id, label: formatEmployeeOption(u) }
}

export function EmployeeSelect({
  value,
  onChange,
  preset,
  placeholder = 'Rechercher un collaborateur',
  status,
  allowClear = true,
  disabled = false,
  className,
}: EmployeeSelectProps) {
  const [fetching, setFetching] = useState(false)
  const [options, setOptions] = useState<Option[]>(() => {
    if (preset) {
      return [{ value: preset.userId, label: preset.label }]
    }
    return []
  })
  const searchSeq = useRef(0)

  useEffect(() => {
    if (!preset) {
      return
    }
    setOptions((prev) => {
      const has = prev.some((o) => o.value === preset.userId)
      if (has) {
        return prev
      }
      return [{ value: preset.userId, label: preset.label }, ...prev]
    })
  }, [preset])

  const debouncedSearch = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    return (raw: string) => {
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        void (async () => {
          const q = raw.trim()
          const seq = ++searchSeq.current
          if (q.length < 2) {
            return
          }
          setFetching(true)
          try {
            const res = await employeesApi.getEmployees({
              search: q,
              limit: 30,
              page: 1,
            })
            if (seq !== searchSeq.current) {
              return
            }
            setOptions(res.data.map(userToOption))
          } finally {
            if (seq === searchSeq.current) {
              setFetching(false)
            }
          }
        })()
      }, 320)
    }
  }, [])

  const handleSearch = useCallback(
    (q: string) => {
      debouncedSearch(q)
    },
    [debouncedSearch],
  )

  const selectedLabel = useMemo(() => {
    if (!value) {
      return undefined
    }
    return options.find((o) => o.value === value)?.label
  }, [options, value])

  return (
    <Select
      className={className}
      showSearch
      allowClear={allowClear}
      placeholder={placeholder}
      status={status}
      disabled={disabled}
      filterOption={false}
      value={value ?? undefined}
      options={options}
      notFoundContent={fetching ? <Spin size="small" /> : null}
      onSearch={handleSearch}
      onChange={(v) => {
        if (v == null || v === '') {
          onChange(null)
          return
        }
        onChange(String(v))
      }}
      onClear={() => onChange(null)}
      style={{ minWidth: 220, width: '100%' }}
      popupMatchSelectWidth={false}
      aria-label={placeholder}
      title={selectedLabel}
    />
  )
}
