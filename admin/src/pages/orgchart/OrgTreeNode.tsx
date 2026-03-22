import { EditOutlined, UserOutlined } from '@ant-design/icons'
import type { MouseEvent } from 'react'

export type OrgTreeNodeVariant = 'company' | 'direction' | 'department' | 'service'

export interface OrgTreeNodeProps {
  variant: OrgTreeNodeVariant
  title: string
  count: number
  selected?: boolean
  onSelect: () => void
  showEdit?: boolean
  onEdit?: (e: MouseEvent) => void
}

export function OrgTreeNode({
  variant,
  title,
  count,
  selected = false,
  onSelect,
  showEdit = false,
  onEdit,
}: OrgTreeNodeProps) {
  const cls = `org-node org-node--${variant}${selected ? ' org-node--selected' : ''}`

  function handleEdit(e: MouseEvent) {
    e.stopPropagation()
    onEdit?.(e)
  }

  if (variant === 'company') {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cls}
        onClick={onSelect}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault()
            onSelect()
          }
        }}
      >
        <p className="org-node--company-title">{title}</p>
        <p className="org-node--company-count">{count} collaborateurs</p>
      </div>
    )
  }

  if (variant === 'direction') {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cls}
        onClick={onSelect}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault()
            onSelect()
          }
        }}
      >
        {showEdit ? (
          <button
            type="button"
            className="org-node--direction-edit"
            aria-label="Modifier"
            onClick={handleEdit}
          >
            <EditOutlined style={{ fontSize: 10 }} />
          </button>
        ) : null}
        <p className="org-node--direction-title">{title}</p>
        <div className="org-node--direction-meta">
          <UserOutlined />
          <span>{count}</span>
        </div>
      </div>
    )
  }

  if (variant === 'department') {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cls}
        onClick={onSelect}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault()
            onSelect()
          }
        }}
      >
        {showEdit ? (
          <button
            type="button"
            className="org-node--department-edit"
            aria-label="Modifier"
            onClick={handleEdit}
          >
            <EditOutlined style={{ fontSize: 9 }} />
          </button>
        ) : null}
        <p className="org-node--department-title">{title}</p>
        <div className="org-node--department-meta">
          <UserOutlined />
          <span>{count}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cls}
      onClick={onSelect}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          onSelect()
        }
      }}
    >
      {showEdit ? (
        <button
          type="button"
          className="org-node--service-edit"
          aria-label="Modifier"
          onClick={handleEdit}
        >
          <EditOutlined style={{ fontSize: 8 }} />
        </button>
      ) : null}
      <p className="org-node--service-title">{title}</p>
      <div className="org-node--service-meta">
        <UserOutlined />
        <span>{count}</span>
      </div>
    </div>
  )
}
