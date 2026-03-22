import {
  CheckOutlined,
  LinkOutlined,
  PlusOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { App, Button, Spin, Tooltip } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  OrgResolutionDecision,
  OrgResolutionItem,
  OrgResolutionResult,
} from '../../../types/org'
import * as orgApi from '../../../services/org.service'
import { getApiErrorMessage } from '../../../utils/apiErrorMessage'
import {
  decisionStorageKey,
  OrgResolutionCard,
} from './OrgResolutionCard'
import { buildOrgResolveAggregates } from './buildOrgResolveAggregates'
import { extractOrgLabelsFromRows } from './importOrgExtract'
import type { CanonicalImportRow } from './importTransform'

export type OrgResolutionStepProps = {
  rows: CanonicalImportRow[]
  hasDirectionColumn: boolean
  hasDepartmentColumn: boolean
  hasServiceColumn: boolean
  existingDirections: { id: string; name: string }[]
  existingDepartments: { id: string; name: string; directionId?: string | null }[]
  existingServices: { id: string; name: string; departmentId?: string | null }[]
  onComplete: (result: OrgResolutionResult) => void
  onBack: () => void
}

function buildOrgResolutionResultExistingOnly(
  dirItems: OrgResolutionItem[],
  deptItems: OrgResolutionItem[],
  svcItems: OrgResolutionItem[],
  existingDepartments: OrgResolutionStepProps['existingDepartments'],
  existingServices: OrgResolutionStepProps['existingServices'],
): OrgResolutionResult {
  const directionMap: Record<string, string> = {}
  const departmentMap: Record<string, string> = {}
  const serviceMap: Record<string, string> = {}
  const deptNameById = new Map(
    existingDepartments.map((x) => [x.id, x.name] as const),
  )
  const svcNameById = new Map(
    existingServices.map((x) => [x.id, x.name] as const),
  )
  const departmentDisplayByFileLabel: Record<string, string> = {}
  const serviceDisplayByFileLabel: Record<string, string> = {}

  for (const it of dirItems) {
    if (it.status === 'existing' && it.existingId) {
      directionMap[it.value] = it.existingId
    }
  }
  for (const it of deptItems) {
    if (it.status === 'existing' && it.existingId) {
      departmentMap[it.value] = it.existingId
      departmentDisplayByFileLabel[it.value] =
        deptNameById.get(it.existingId) ?? it.value
    }
  }
  for (const it of svcItems) {
    if (it.status === 'existing' && it.existingId) {
      serviceMap[it.value] = it.existingId
      serviceDisplayByFileLabel[it.value] =
        svcNameById.get(it.existingId) ?? it.value
    }
  }

  return {
    directionMap,
    departmentMap,
    serviceMap,
    ignoredDirections: [],
    ignoredDepartments: [],
    ignoredServices: [],
    departmentDisplayByFileLabel,
    serviceDisplayByFileLabel,
  }
}

function useStableUuidMap() {
  const ref = useRef(new Map<string, string>())
  const get = useCallback((kind: string, norm: string) => {
    const k = `${kind}:${norm}`
    let u = ref.current.get(k)
    if (!u) {
      u = crypto.randomUUID()
      ref.current.set(k, u)
    }
    return u
  }, [])
  return get
}

export function OrgResolutionStep({
  rows,
  hasDirectionColumn,
  hasDepartmentColumn,
  hasServiceColumn,
  existingDirections,
  existingDepartments,
  existingServices,
  onComplete,
  onBack,
}: OrgResolutionStepProps) {
  const { message } = App.useApp()
  const getDirUuid = useStableUuidMap()
  const getDeptUuid = useStableUuidMap()
  const getSvcUuid = useStableUuidMap()

  const [resolveLoading, setResolveLoading] = useState(true)
  const [resolveSucceeded, setResolveSucceeded] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const autoSkipRef = useRef(false)
  const [dirItems, setDirItems] = useState<OrgResolutionItem[]>([])
  const [deptItems, setDeptItems] = useState<OrgResolutionItem[]>([])
  const [svcItems, setSvcItems] = useState<OrgResolutionItem[]>([])
  const [decisions, setDecisions] = useState<
    Record<string, OrgResolutionDecision>
  >({})

  useEffect(() => {
    let cancelled = false
    setResolveLoading(true)
    setResolveSucceeded(false)
    autoSkipRef.current = false
    void (async () => {
      try {
        const { directions: directionLabels, departments: departmentLabels, services: serviceLabels } =
          extractOrgLabelsFromRows(rows)
        const res = await orgApi.resolveOrg({
          directions: hasDirectionColumn ? directionLabels : [],
          departments: hasDepartmentColumn ? departmentLabels : [],
          services: hasServiceColumn ? serviceLabels : [],
          orgAggregates: buildOrgResolveAggregates(rows),
        })
        if (cancelled) {
          return
        }
        const dirs = res.directions ?? []
        const depts = res.departments ?? []
        const svcs = res.services ?? []
        setDirItems(dirs)
        setDeptItems(depts)
        setSvcItems(svcs)
        const next: Record<string, OrgResolutionDecision> = {}
        const seed = (list: OrgResolutionItem[], prefix: 'dir' | 'dept' | 'svc') => {
          for (const it of list) {
            if (it.status === 'existing') {
              continue
            }
            const key = decisionStorageKey(prefix, it.normalizedValue)
            if (it.status === 'similar') {
              next[key] = {
                value: it.value,
                action: 'associate',
                associateToId: it.suggestedId,
              }
            } else {
              next[key] = {
                value: it.value,
                action: 'create',
                parentId: it.suggestedParentId,
                parentName: it.suggestedParentName,
              }
            }
          }
        }
        seed(dirs, 'dir')
        seed(depts, 'dept')
        seed(svcs, 'svc')
        setDecisions(next)
        setResolveSucceeded(true)
      } catch (e) {
        message.error(getApiErrorMessage(e, 'Analyse organisationnelle impossible'))
      } finally {
        if (!cancelled) {
          setResolveLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    rows,
    hasDirectionColumn,
    hasDepartmentColumn,
    hasServiceColumn,
    message,
  ])

  useEffect(() => {
    if (resolveLoading || !resolveSucceeded) {
      return
    }
    if (autoSkipRef.current) {
      return
    }
    const needsUserInput = [...dirItems, ...deptItems, ...svcItems].some(
      (i) => i.status !== 'existing',
    )
    if (needsUserInput) {
      return
    }
    autoSkipRef.current = true
    onCompleteRef.current(
      buildOrgResolutionResultExistingOnly(
        dirItems,
        deptItems,
        svcItems,
        existingDepartments,
        existingServices,
      ),
    )
  }, [
    resolveLoading,
    resolveSucceeded,
    dirItems,
    deptItems,
    svcItems,
    existingDepartments,
    existingServices,
  ])

  const directionParentOptions = useMemo(() => {
    const opts: { id: string; name: string; isNew?: boolean }[] =
      existingDirections.map((d) => ({
        id: d.id,
        name: d.name,
        isNew: false,
      }))
    for (const it of dirItems) {
      if (it.status === 'existing') {
        continue
      }
      const key = decisionStorageKey('dir', it.normalizedValue)
      const dec = decisions[key]
      if (dec?.action === 'create') {
        opts.push({
          id: getDirUuid('dir', it.normalizedValue),
          name: it.value,
          isNew: true,
        })
      }
    }
    return opts
  }, [existingDirections, dirItems, decisions, getDirUuid])

  const departmentParentOptions = useMemo(() => {
    const opts: { id: string; name: string; isNew?: boolean }[] =
      existingDepartments.map((d) => ({
        id: d.id,
        name: d.name,
        isNew: false,
      }))
    for (const it of deptItems) {
      if (it.status === 'existing') {
        continue
      }
      const key = decisionStorageKey('dept', it.normalizedValue)
      const dec = decisions[key]
      if (dec?.action === 'create') {
        opts.push({
          id: getDeptUuid('dept', it.normalizedValue),
          name: it.value,
          isNew: true,
        })
      }
    }
    return opts
  }, [existingDepartments, deptItems, decisions, getDeptUuid])

  const parentAutoByKey = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const it of deptItems) {
      if (it.status !== 'new' || !it.suggestedParentId) {
        continue
      }
      const key = decisionStorageKey('dept', it.normalizedValue)
      const dec = decisions[key]
      if (
        dec?.action === 'create' &&
        dec.parentId === it.suggestedParentId
      ) {
        m[key] = true
      }
    }
    for (const it of svcItems) {
      if (it.status !== 'new' || !it.suggestedParentId) {
        continue
      }
      const key = decisionStorageKey('svc', it.normalizedValue)
      const dec = decisions[key]
      if (
        dec?.action === 'create' &&
        dec.parentId === it.suggestedParentId
      ) {
        m[key] = true
      }
    }
    return m
  }, [deptItems, svcItems, decisions])

  const parentInvalidByKey = useMemo(() => {
    const out: Record<string, string | undefined> = {}
    for (const it of deptItems) {
      if (it.status === 'existing') {
        continue
      }
      const sk = decisionStorageKey('dept', it.normalizedValue)
      const sd = decisions[sk]
      if (!sd || sd.action !== 'create' || !sd.parentId) {
        continue
      }
      for (const d of dirItems) {
        if (d.status === 'existing') {
          continue
        }
        const dk = decisionStorageKey('dir', d.normalizedValue)
        const dd = decisions[dk]
        if (
          dd?.action === 'ignore' &&
          getDirUuid('dir', d.normalizedValue) === sd.parentId
        ) {
          out[sk] =
            'La direction parent sera ignorée — choisissez une autre direction.'
        }
      }
    }
    for (const it of svcItems) {
      if (it.status === 'existing') {
        continue
      }
      const sk = decisionStorageKey('svc', it.normalizedValue)
      const sd = decisions[sk]
      if (!sd || sd.action !== 'create' || !sd.parentId) {
        continue
      }
      for (const d of deptItems) {
        if (d.status === 'existing') {
          continue
        }
        const dk = decisionStorageKey('dept', d.normalizedValue)
        const dd = decisions[dk]
        if (
          dd?.action === 'ignore' &&
          getDeptUuid('dept', d.normalizedValue) === sd.parentId
        ) {
          out[sk] =
            'Le département parent sera ignoré — choisissez un autre parent.'
        }
      }
    }
    return out
  }, [deptItems, svcItems, dirItems, decisions, getDirUuid, getDeptUuid])

  const summary = useMemo(() => {
    let exist = 0
    let create = 0
    let associate = 0
    let ignore = 0
    const bump = (list: OrgResolutionItem[], prefix: 'dir' | 'dept' | 'svc') => {
      for (const it of list) {
        if (it.status === 'existing') {
          exist += 1
          continue
        }
        const k = decisionStorageKey(prefix, it.normalizedValue)
        const d = decisions[k]
        if (!d) {
          continue
        }
        if (d.action === 'create') {
          create += 1
        } else if (d.action === 'associate') {
          associate += 1
        } else {
          ignore += 1
        }
      }
    }
    bump(dirItems, 'dir')
    bump(deptItems, 'dept')
    bump(svcItems, 'svc')
    return { exist, create, associate, ignore }
  }, [dirItems, deptItems, svcItems, decisions])

  const continueDisabledReason = useMemo(() => {
    for (const k of Object.keys(parentInvalidByKey)) {
      if (parentInvalidByKey[k]) {
        return parentInvalidByKey[k]
      }
    }
    return null
  }, [parentInvalidByKey])

  function setDecision(key: string, d: OrgResolutionDecision) {
    setDecisions((prev) => ({ ...prev, [key]: d }))
  }

  function applyAutoAll() {
    setDecisions((prev) => {
      const next = { ...prev }
      const apply = (list: OrgResolutionItem[], prefix: 'dir' | 'dept' | 'svc') => {
        for (const it of list) {
          if (it.status === 'existing') {
            continue
          }
          const key = decisionStorageKey(prefix, it.normalizedValue)
          if (it.status === 'similar') {
            next[key] = {
              value: it.value,
              action: 'associate',
              associateToId: it.suggestedId,
            }
          } else {
            next[key] = {
              value: it.value,
              action: 'create',
              parentId: it.suggestedParentId,
              parentName: it.suggestedParentName,
            }
          }
        }
      }
      apply(dirItems, 'dir')
      apply(deptItems, 'dept')
      apply(svcItems, 'svc')
      return next
    })
  }

  async function handleContinue() {
    if (continueDisabledReason) {
      return
    }
    setBulkLoading(true)
    try {
      const bulkDirs: { name: string; id?: string }[] = []
      const bulkDepts: {
        name: string
        directionId?: string
        id?: string
      }[] = []
      const bulkSvcs: {
        name: string
        departmentId?: string
        id?: string
      }[] = []

      for (const it of dirItems) {
        if (it.status === 'existing') {
          continue
        }
        const key = decisionStorageKey('dir', it.normalizedValue)
        const d = decisions[key]
        if (d?.action === 'create') {
          bulkDirs.push({
            name: it.value,
            id: getDirUuid('dir', it.normalizedValue),
          })
        }
      }
      for (const it of deptItems) {
        if (it.status === 'existing') {
          continue
        }
        const key = decisionStorageKey('dept', it.normalizedValue)
        const d = decisions[key]
        if (d?.action === 'create') {
          const dirId = d.parentId?.trim()
          bulkDepts.push({
            name: it.value,
            id: getDeptUuid('dept', it.normalizedValue),
            ...(dirId ? { directionId: dirId } : {}),
          })
        }
      }
      for (const it of svcItems) {
        if (it.status === 'existing') {
          continue
        }
        const key = decisionStorageKey('svc', it.normalizedValue)
        const d = decisions[key]
        if (d?.action === 'create') {
          const depId = d.parentId?.trim()
          bulkSvcs.push({
            name: it.value,
            id: getSvcUuid('svc', it.normalizedValue),
            ...(depId ? { departmentId: depId } : {}),
          })
        }
      }

      let bulkRes: Awaited<ReturnType<typeof orgApi.bulkCreateOrg>> | null =
        null
      if (
        bulkDirs.length > 0 ||
        bulkDepts.length > 0 ||
        bulkSvcs.length > 0
      ) {
        bulkRes = await orgApi.bulkCreateOrg({
          directions: bulkDirs,
          departments: bulkDepts,
          services: bulkSvcs,
        })
      }

      const directionMap: Record<string, string> = {}
      const departmentMap: Record<string, string> = {}
      const serviceMap: Record<string, string> = {}
      const ignoredDirections: string[] = []
      const ignoredDepartments: string[] = []
      const ignoredServices: string[] = []
      const departmentDisplayByFileLabel: Record<string, string> = {}
      const serviceDisplayByFileLabel: Record<string, string> = {}

      const deptNameById = new Map(
        existingDepartments.map((x) => [x.id, x.name] as const),
      )
      const svcNameById = new Map(
        existingServices.map((x) => [x.id, x.name] as const),
      )
      if (bulkRes) {
        for (const x of bulkRes.createdDepartments) {
          deptNameById.set(x.id, x.name)
        }
        for (const x of bulkRes.reusedDepartments ?? []) {
          deptNameById.set(x.id, x.name)
        }
        for (const x of bulkRes.createdServices) {
          svcNameById.set(x.id, x.name)
        }
        for (const x of bulkRes.reusedServices ?? []) {
          svcNameById.set(x.id, x.name)
        }
      }

      const recordDir = (fileLabel: string, id: string) => {
        directionMap[fileLabel] = id
      }
      const recordDept = (fileLabel: string, id: string) => {
        departmentMap[fileLabel] = id
        departmentDisplayByFileLabel[fileLabel] =
          deptNameById.get(id) ?? fileLabel
      }
      const recordSvc = (fileLabel: string, id: string) => {
        serviceMap[fileLabel] = id
        serviceDisplayByFileLabel[fileLabel] =
          svcNameById.get(id) ?? fileLabel
      }

      for (const it of dirItems) {
        if (it.status === 'existing') {
          recordDir(it.value, it.existingId!)
          continue
        }
        const key = decisionStorageKey('dir', it.normalizedValue)
        const d = decisions[key]
        if (!d || d.action === 'ignore') {
          ignoredDirections.push(it.value)
          continue
        }
        if (d.action === 'associate' && d.associateToId) {
          recordDir(it.value, d.associateToId)
          continue
        }
        if (d.action === 'create') {
          recordDir(it.value, getDirUuid('dir', it.normalizedValue))
        }
      }

      for (const it of deptItems) {
        if (it.status === 'existing') {
          recordDept(it.value, it.existingId!)
          continue
        }
        const key = decisionStorageKey('dept', it.normalizedValue)
        const d = decisions[key]
        if (!d || d.action === 'ignore') {
          ignoredDepartments.push(it.value)
          continue
        }
        if (d.action === 'associate' && d.associateToId) {
          recordDept(it.value, d.associateToId)
          continue
        }
        if (d.action === 'create') {
          recordDept(it.value, getDeptUuid('dept', it.normalizedValue))
        }
      }

      for (const it of svcItems) {
        if (it.status === 'existing') {
          recordSvc(it.value, it.existingId!)
          continue
        }
        const key = decisionStorageKey('svc', it.normalizedValue)
        const d = decisions[key]
        if (!d || d.action === 'ignore') {
          ignoredServices.push(it.value)
          continue
        }
        if (d.action === 'associate' && d.associateToId) {
          recordSvc(it.value, d.associateToId)
          continue
        }
        if (d.action === 'create') {
          recordSvc(it.value, getSvcUuid('svc', it.normalizedValue))
        }
      }

      onComplete({
        directionMap,
        departmentMap,
        serviceMap,
        ignoredDirections,
        ignoredDepartments,
        ignoredServices,
        departmentDisplayByFileLabel,
        serviceDisplayByFileLabel,
      })
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Création des entités impossible'))
    } finally {
      setBulkLoading(false)
    }
  }

  const showBanner =
    dirItems.some((i) => i.status !== 'existing') ||
    deptItems.some((i) => i.status !== 'existing') ||
    svcItems.some((i) => i.status !== 'existing')

  const gridCols =
    [
      hasDirectionColumn && dirItems.length > 0,
      hasDepartmentColumn && deptItems.length > 0,
      hasServiceColumn && svcItems.length > 0,
    ].filter(Boolean).length

  const gridTemplate =
    gridCols === 0
      ? '1fr'
      : gridCols === 1
        ? '1fr'
        : gridCols === 2
          ? '1fr 1fr'
          : '1fr 1fr 1fr'

  if (resolveLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin description="Analyse de la structure organisationnelle…" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {showBanner ? (
        <div
          style={{
            background: '#FEF3E5',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'rgba(242,140,40,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <WarningOutlined style={{ color: '#F28C28' }} />
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: '#854F0B',
                marginBottom: 4,
              }}
            >
              Votre fichier contient des directions, départements et services
              inconnus
            </div>
            <div style={{ fontSize: 13, color: '#A67C52' }}>
              Choisissez quoi faire pour chaque élément : le créer
              automatiquement, l&apos;associer à un existant, ou l&apos;ignorer.
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap: 12,
        }}
      >
        {hasDirectionColumn && dirItems.length > 0 ? (
          <OrgResolutionCard
            decisionPrefix="dir"
            title="Directions"
            color="#0F5C5E"
            items={dirItems}
            decisions={decisions}
            onDecisionChange={setDecision}
            existingEntities={existingDirections}
          />
        ) : null}
        {hasDepartmentColumn && deptItems.length > 0 ? (
          <OrgResolutionCard
            decisionPrefix="dept"
            title="Départements"
            color="#2980B9"
            items={deptItems}
            decisions={decisions}
            onDecisionChange={setDecision}
            existingEntities={existingDepartments}
            parentEntities={
              hasDirectionColumn ? directionParentOptions : undefined
            }
            parentLabel="Direction"
            parentAutoByItemKey={parentAutoByKey}
            parentInvalidByItemKey={parentInvalidByKey}
          />
        ) : null}
        {hasServiceColumn && svcItems.length > 0 ? (
          <OrgResolutionCard
            decisionPrefix="svc"
            title="Services"
            color="#F28C28"
            items={svcItems}
            decisions={decisions}
            onDecisionChange={setDecision}
            existingEntities={existingServices}
            parentEntities={departmentParentOptions}
            parentLabel="Département"
            parentAutoByItemKey={parentAutoByKey}
            parentInvalidByItemKey={parentInvalidByKey}
          />
        ) : null}
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          border: '0.5px solid #E8E8E8',
          padding: '12px 14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <span style={{ fontSize: 13, color: '#389e0d' }}>
            <CheckOutlined style={{ marginRight: 4 }} />
            {summary.exist} existants
          </span>
          <span style={{ fontSize: 13, color: '#0F5C5E' }}>
            <PlusOutlined style={{ marginRight: 4 }} />
            {summary.create} à créer
          </span>
          <span style={{ fontSize: 13, color: '#2980B9' }}>
            <LinkOutlined style={{ marginRight: 4 }} />
            {summary.associate} associés
          </span>
          <span style={{ fontSize: 13, color: '#BDC3C7' }}>
            {summary.ignore} ignorés
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button size="middle" onClick={onBack} disabled={bulkLoading}>
            Retour
          </Button>
          <Button
            size="middle"
            style={{
              background: '#F4F6F6',
              borderRadius: 6,
              fontSize: 13,
              color: '#7F8C8D',
            }}
            onClick={applyAutoAll}
            disabled={bulkLoading}
          >
            Tout créer automatiquement
          </Button>
          {continueDisabledReason ? (
            <Tooltip title={continueDisabledReason}>
              <span>
                <Button
                  type="primary"
                  size="middle"
                  style={{
                    background: '#0F5C5E',
                    borderColor: '#0F5C5E',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                  loading={bulkLoading}
                  disabled
                >
                  Continuer
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button
              type="primary"
              size="middle"
              style={{
                background: '#0F5C5E',
                borderColor: '#0F5C5E',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
              }}
              loading={bulkLoading}
              disabled={bulkLoading}
              onClick={() => void handleContinue()}
            >
              Continuer
            </Button>
          )}
        </div>
      </div>

      {bulkLoading ? (
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <Spin size="small" description="Création des entités en cours…" />
        </div>
      ) : null}
    </div>
  )
}
