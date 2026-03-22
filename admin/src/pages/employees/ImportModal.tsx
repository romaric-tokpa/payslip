import { CheckCircleOutlined, CloudUploadOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Modal,
  Result,
  Space,
  Spin,
  Table,
  Typography,
  Upload,
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ImportFullNameSeparator,
  ImportResultDto,
  ImportRowDto,
  ValidateImportResponse,
} from '../../types/employees'
import type { OrgResolutionResult } from '../../types/org'
import * as employeesApi from '../../services/employees.service'
import * as orgApi from '../../services/org.service'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { ColumnMappingStep } from './import/ColumnMappingStep'
import { suggestColumnMappings } from './import/columnMatcher'
import type { MappingSelection } from './import/importMappingState'
import { mappingStepIsComplete } from './import/importMappingState'
import {
  extractOrgLabelsFromRows,
  fileNeedsOrgResolutionStep,
  flattenOrgTree,
} from './import/importOrgExtract'
import { buildMappingsPayload } from './import/importPreviewLogic'
import { buildImportRowDtos } from './import/buildImportRowDtos'
import './import/import-flow.css'
import { OrgResolutionStep } from './import/OrgResolutionStep'
import { ImportStepper } from './import/ImportStepper'
import { IMPORT_MAX_BYTES, parseEmployeeImportFile } from './import/parseImportFile'
import { rowToCanonical, type RawImportRow } from './import/importTransform'
import { ValidationStep } from './import/ValidationStep'
import { ActivationStep } from './import/ActivationStep'

const { Dragger } = Upload
const { Text, Paragraph } = Typography

type ImportModalProps = {
  open: boolean
  onClose: () => void
  onImportSuccess: () => void
  variant?: 'modal' | 'page'
}

function emptyMapping(): MappingSelection {
  return {}
}

function suggestionsToMapping(
  sug: ReturnType<typeof suggestColumnMappings>,
): MappingSelection {
  return {
    matricule: sug.matricule,
    prenom: sug.prenom,
    nom: sug.nom,
    email: sug.email,
    direction: sug.direction,
    departement: sug.departement,
    service: sug.service,
    poste: sug.poste,
    nomComplet: sug.nomComplet,
    contractType: sug.contractType,
    contractEndDate: sug.contractEndDate,
    entryDate: sug.entryDate,
  }
}

export function ImportModal({
  open,
  onClose,
  onImportSuccess,
  variant = 'modal',
}: ImportModalProps) {
  const { message } = App.useApp()
  const [current, setCurrent] = useState(0)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [parsedFile, setParsedFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<RawImportRow[]>([])
  const [mapping, setMapping] = useState<MappingSelection>(emptyMapping)
  const [suggestedSnapshot, setSuggestedSnapshot] =
    useState<MappingSelection>(emptyMapping)
  const [useFullNameSplit, setUseFullNameSplit] = useState(false)
  const [fullNameSeparator, setFullNameSeparator] =
    useState<ImportFullNameSeparator>(' ')
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validationLoading, setValidationLoading] = useState(false)
  const [validationResult, setValidationResult] =
    useState<ValidateImportResponse | null>(null)
  const [importResultDto, setImportResultDto] = useState<ImportResultDto | null>(
    null,
  )
  const [orgFlat, setOrgFlat] = useState<ReturnType<
    typeof flattenOrgTree
  > | null>(null)
  const [orgStepShown, setOrgStepShown] = useState(false)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const resetState = useCallback(() => {
    setCurrent(0)
    setFileList([])
    setParsedFile(null)
    setHeaders([])
    setRawRows([])
    setMapping(emptyMapping())
    setSuggestedSnapshot(emptyMapping())
    setUseFullNameSplit(false)
    setFullNameSeparator(' ')
    setParsing(false)
    setSubmitting(false)
    setValidationLoading(false)
    setValidationResult(null)
    setImportResultDto(null)
    setOrgFlat(null)
    setOrgStepShown(false)
  }, [])

  function handleClose() {
    resetState()
    onClose()
  }

  const sampleRows = useMemo(() => rawRows.slice(0, 3), [rawRows])

  const flowActive = variant === 'page' || open

  useEffect(() => {
    if (!flowActive || rawRows.length === 0) {
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const tree = await orgApi.getOrgTree()
        if (!cancelled) {
          setOrgFlat(flattenOrgTree(tree))
        }
      } catch {
        if (!cancelled) {
          setOrgFlat({ directions: [], departments: [], services: [] })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [flowActive, rawRows.length])

  const canonicalImportRows = useMemo(() => {
    const { mappings, splitFullName } = buildMappingsPayload(
      mapping,
      useFullNameSplit,
      fullNameSeparator,
    )
    return rawRows.map((row) => rowToCanonical(row, mappings, splitFullName))
  }, [rawRows, mapping, useFullNameSplit, fullNameSeparator])

  const needOrgStep = useMemo(() => {
    if (!orgFlat) {
      return false
    }
    const { directions, departments, services } =
      extractOrgLabelsFromRows(canonicalImportRows)
    const dirLabels = mapping.direction ? directions : []
    const depLabels = mapping.departement ? departments : []
    const svcLabels = mapping.service ? services : []
    if (
      dirLabels.length === 0 &&
      depLabels.length === 0 &&
      svcLabels.length === 0
    ) {
      return false
    }
    return fileNeedsOrgResolutionStep(dirLabels, depLabels, svcLabels, orgFlat)
  }, [orgFlat, canonicalImportRows, mapping])

  const runValidationWithOrg = useCallback(
    async (org: OrgResolutionResult | null, rollbackStep: number) => {
      if (rawRows.length === 0) {
        message.warning('Aucune ligne à valider')
        return
      }
      setValidationLoading(true)
      setValidationResult(null)
      setCurrent(3)
      try {
        const rows = buildImportRowDtos(
          rawRows,
          mapping,
          useFullNameSplit,
          fullNameSeparator,
          org,
        )
        const res = await employeesApi.validateImport(rows)
        setValidationResult(res)
      } catch (e) {
        message.error(getApiErrorMessage(e, 'Échec de la validation'))
        setCurrent(rollbackStep)
      } finally {
        setValidationLoading(false)
      }
    },
    [rawRows, mapping, useFullNameSplit, fullNameSeparator, message],
  )

  async function parseDroppedFile(file: File) {
    setParsing(true)
    setOrgFlat(null)
    try {
      const { headers: h, rows } = await parseEmployeeImportFile(file)
      setParsedFile(file)
      setHeaders(h)
      setRawRows(rows)
      const sug = suggestColumnMappings(h)
      const nextMap = suggestionsToMapping(sug)
      setMapping(nextMap)
      setSuggestedSnapshot(nextMap)
      setUseFullNameSplit(Boolean(sug.nomComplet))
      if (h.length === 0) {
        message.warning('Aucune colonne détectée : vérifiez la première ligne.')
      }
    } catch (e) {
      setParsedFile(null)
      setHeaders([])
      setRawRows([])
      setMapping(emptyMapping())
      setSuggestedSnapshot(emptyMapping())
      message.error(
        e instanceof Error ? e.message : 'Impossible de lire le fichier',
      )
    } finally {
      setParsing(false)
    }
  }

  const handleRevalidate = useCallback(
    async (updatedRows: ImportRowDto[]) => {
      const res = await employeesApi.validateImport(updatedRows)
      setValidationResult(res)
      return res
    },
    [],
  )

  const handleCommitImport = useCallback(
    async (selectedRows: ImportRowDto[]) => {
      setSubmitting(true)
      try {
        const res = await employeesApi.commitImportEmployees(selectedRows)
        setImportResultDto(res)
        setCurrent(4)
        onImportSuccess()
        if (res.summary.errors === 0) {
          message.success(
            `Import terminé : ${res.summary.created} création(s), ${res.summary.updated} mise(s) à jour.`,
          )
        } else {
          message.warning(
            `Import partiel : ${res.summary.created} création(s), ${res.summary.updated} mise(s) à jour, ${res.summary.errors} erreur(s).`,
          )
        }
      } catch (e) {
        message.error(getApiErrorMessage(e, "L'import a échoué"))
        throw e
      } finally {
        setSubmitting(false)
      }
    },
    [message, onImportSuccess],
  )

  const showResult = importResultDto != null
  const mappingOk = mappingStepIsComplete(mapping, useFullNameSplit)
  const fileLabel =
    parsedFile?.name ?? fileList[0]?.name ?? fileList[0]?.fileName ?? ''

  const errorDetails = useMemo(
    () =>
      importResultDto?.details.filter((d) => d.status === 'error') ?? [],
    [importResultDto],
  )

  const importedUserIdsForActivation = useMemo(() => {
    if (!importResultDto) {
      return []
    }
    const s = new Set<string>()
    for (const d of importResultDto.details) {
      if (
        (d.status === 'created' || d.status === 'updated') &&
        d.userId != null &&
        d.userId !== ''
      ) {
        s.add(d.userId)
      }
    }
    return [...s]
  }, [importResultDto])

  const footer =
    showResult ? (
      <Space wrap>
        <Button
          onClick={() => {
            setImportResultDto(null)
            resetState()
          }}
        >
          Nouvelle importation
        </Button>
        {importResultDto ? (
          <Button
            variant="outlined"
            onClick={() =>
              employeesApi.exportImportReportCsv(importResultDto)
            }
          >
            Télécharger le rapport
          </Button>
        ) : null}
        {errorDetails.length > 0 ? (
          <Button
            variant="outlined"
            onClick={() => employeesApi.exportErrorsCsv(errorDetails)}
          >
            Exporter les erreurs
          </Button>
        ) : null}
        <Button type="primary" onClick={handleClose} className="import-btn-teal">
          Fermer
        </Button>
      </Space>
    ) : current === 3 ? null : (
      <Space wrap>
        <Button onClick={handleClose}>Annuler</Button>
        {current > 0 && current !== 2 && current !== 3 ? (
          <Button
            variant="outlined"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          >
            Retour
          </Button>
        ) : null}
        {current === 0 ? (
          <Button
            type="primary"
            loading={parsing}
            disabled={headers.length === 0 || parsing}
            onClick={() => setCurrent(1)}
            className="import-btn-teal"
          >
            Suivant
          </Button>
        ) : null}
        {current === 1 ? (
          <Button
            type="primary"
            loading={validationLoading}
            disabled={
              !mappingOk || (rawRows.length > 0 && orgFlat === null)
            }
            onClick={() => {
              if (needOrgStep) {
                setOrgStepShown(true)
                setCurrent(2)
              } else {
                setOrgStepShown(false)
                void runValidationWithOrg(null, 1)
              }
            }}
            className="import-btn-teal"
          >
            Suivant
          </Button>
        ) : null}
      </Space>
    )

  const stepperCurrent = showResult ? 4 : current

  const mainInner = (
    <>
      {!showResult ? (
        <>
          <ImportStepper current={stepperCurrent} needOrgStep={needOrgStep} />
          {current === 0 ? (
            <Card className="import-file-card" variant="outlined">
              <div ref={dropZoneRef} className="import-drop-zone">
                <Dragger
                  accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  maxCount={1}
                  fileList={fileList}
                  showUploadList={false}
                  beforeUpload={(file) => {
                    if (file.size > IMPORT_MAX_BYTES) {
                      message.error('Fichier trop volumineux (max 5 Mo)')
                      return Upload.LIST_IGNORE
                    }
                    return false
                  }}
                  onChange={({ fileList: fl }) => {
                    setFileList(fl)
                    const f = fl[0]?.originFileObj
                    if (f) {
                      void parseDroppedFile(f)
                    } else if (fl.length === 0) {
                      setParsedFile(null)
                      setHeaders([])
                      setRawRows([])
                      setMapping(emptyMapping())
                      setSuggestedSnapshot(emptyMapping())
                      setUseFullNameSplit(false)
                    }
                  }}
                  onRemove={() => {
                    setFileList([])
                    setParsedFile(null)
                    setHeaders([])
                    setRawRows([])
                    setMapping(emptyMapping())
                    setSuggestedSnapshot(emptyMapping())
                    setUseFullNameSplit(false)
                  }}
                >
                  <div className="import-drop-inner">
                    <div className="import-drop-icon-wrap">
                      <CloudUploadOutlined />
                    </div>
                    <div className="import-drop-title">
                      Déposez votre fichier ici
                    </div>
                    <div className="import-drop-sub">
                      CSV, Excel (.xlsx, .xls) — 5 Mo max
                    </div>
                    <div className="import-drop-note">
                      Le système s&apos;adapte automatiquement à vos colonnes
                    </div>
                    <Button
                      type="primary"
                      className="import-btn-teal"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        const input = dropZoneRef.current?.querySelector(
                          'input[type="file"]',
                        ) as HTMLInputElement | null
                        input?.click()
                      }}
                    >
                      Parcourir les fichiers
                    </Button>
                  </div>
                </Dragger>
              </div>
              {headers.length > 0 && fileLabel !== '' ? (
                <div className="import-file-success">
                  <CheckCircleOutlined className="import-file-success__icon" />
                  <span className="import-file-success__name">{fileLabel}</span>
                </div>
              ) : null}
            </Card>
          ) : null}
          {current === 1 ? (
            <ColumnMappingStep
              headers={headers}
              sampleRows={sampleRows}
              value={mapping}
              onChange={setMapping}
              suggestedSnapshot={suggestedSnapshot}
              useFullNameSplit={useFullNameSplit}
              onUseFullNameSplitChange={setUseFullNameSplit}
              fullNameSeparator={fullNameSeparator}
              onFullNameSeparatorChange={setFullNameSeparator}
            />
          ) : null}
          {current === 2 && orgFlat ? (
            <OrgResolutionStep
              key={[
                fileLabel,
                String(rawRows.length),
                mapping.direction ?? '',
                mapping.departement ?? '',
                mapping.service ?? '',
              ].join('|')}
              rows={canonicalImportRows}
              hasDirectionColumn={Boolean(mapping.direction)}
              hasDepartmentColumn={Boolean(mapping.departement)}
              hasServiceColumn={Boolean(mapping.service)}
              existingDirections={orgFlat.directions}
              existingDepartments={orgFlat.departments}
              existingServices={orgFlat.services}
              onComplete={(r) => {
                void runValidationWithOrg(r, 2)
              }}
              onBack={() => setCurrent(1)}
            />
          ) : null}
          {current === 3 ? (
            validationLoading || !validationResult ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <Spin size="large" />
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">Validation des lignes…</Text>
                </div>
              </div>
            ) : (
              <ValidationStep
                key={`${fileLabel}-${validationResult.summary.total}`}
                validationResult={validationResult}
                onConfirm={(rows) => handleCommitImport(rows)}
                onBack={() => {
                  setValidationResult(null)
                  setCurrent(orgStepShown ? 2 : 1)
                }}
                onRevalidate={handleRevalidate}
                commitLoading={submitting}
              />
            )
          ) : null}
        </>
      ) : (
        <>
          <ImportStepper current={4} needOrgStep={needOrgStep} />
          <Result
            status={importResultDto!.summary.errors > 0 ? 'warning' : 'success'}
            title="Rapport d'import"
            subTitle={
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <Text>
                  {importResultDto!.summary.created} créé(s),{' '}
                  {importResultDto!.summary.updated} mis à jour,{' '}
                  {importResultDto!.summary.skipped} ignoré(s),{' '}
                  {importResultDto!.summary.errors > 0 ? (
                    <Text strong type="danger">
                      {importResultDto!.summary.errors}
                    </Text>
                  ) : (
                    <Text strong>{importResultDto!.summary.errors}</Text>
                  )}{' '}
                  erreur(s) — {importResultDto!.summary.total} ligne(s) envoyée(s).
                </Text>
              </Space>
            }
          >
            {errorDetails.length > 0 ? (
              <Table
                size="small"
                pagination={{ pageSize: 20 }}
                rowKey={(r) => `${r.rowIndex}-${r.email}-${r.errorMessage}`}
                dataSource={errorDetails}
                columns={[
                  { title: 'Ligne', dataIndex: 'rowIndex', width: 72, render: (i: number) => i + 2 },
                  { title: 'E-mail', dataIndex: 'email', width: 200 },
                  { title: 'Matricule', dataIndex: 'employeeId', width: 120 },
                  { title: 'Message', dataIndex: 'errorMessage' },
                ]}
              />
            ) : null}
            {importedUserIdsForActivation.length > 0 ? (
              <ActivationStep
                userIds={importedUserIdsForActivation}
                onFinished={handleClose}
              />
            ) : (
              <Paragraph type="secondary" style={{ marginTop: 16 }}>
                L’activation groupée nécessite les identifiants renvoyés par le
                serveur pour chaque ligne créée ou mise à jour. Sinon, activez
                les comptes depuis la page Collaborateurs.
              </Paragraph>
            )}
          </Result>
        </>
      )}
    </>
  )

  if (variant === 'page') {
    return (
      <div className="import-flow-page">
        {mainInner}
        {footer ? <div className="import-flow-footer">{footer}</div> : null}
      </div>
    )
  }

  if (!open) {
    return null
  }

  return (
    <Modal
      title="Importer des collaborateurs"
      open={open}
      onCancel={handleClose}
      footer={footer}
      width={
        current === 2 || current === 3 || showResult ? 1040 : 720
      }
      destroyOnHidden
      afterClose={resetState}
    >
      {mainInner}
    </Modal>
  )
}
