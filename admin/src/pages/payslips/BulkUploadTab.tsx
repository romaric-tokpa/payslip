import { InboxOutlined } from '@ant-design/icons'
import {
  Button,
  Progress,
  Result,
  Space,
  Table,
  Typography,
  Upload,
  message,
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useCallback, useRef, useState } from 'react'
import * as employeesApi from '../../services/employees.service'
import * as payslipsApi from '../../services/payslips.service'
import type { EmployeeUser } from '../../types/employees'
import type { BulkUploadReport } from '../../types/payslips'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { BulkPreviewTable } from './BulkPreviewTable'
import type { BulkPreviewRow } from './bulkPreviewTypes'
import {
  BULK_FILENAME_RE,
  MAX_PDF_BYTES,
} from './payslipUploadConstants'

const { Text } = Typography

function buildInitialRows(fileList: UploadFile[]): BulkPreviewRow[] {
  const out: BulkPreviewRow[] = []
  for (const uf of fileList) {
    const file = uf.originFileObj
    if (!file) {
      continue
    }
    const key = uf.uid
    const fileName = file.name
    if (file.size > MAX_PDF_BYTES) {
      out.push({
        key,
        file,
        fileName,
        matricule: null,
        month: null,
        year: null,
        user: null,
        collaboratorLabel: null,
        status: 'oversized',
      })
      continue
    }
    const match = fileName.match(BULK_FILENAME_RE)
    if (!match) {
      out.push({
        key,
        file,
        fileName,
        matricule: null,
        month: null,
        year: null,
        user: null,
        collaboratorLabel: null,
        status: 'invalid_format',
      })
      continue
    }
    const matricule = match[1].replace(/_+$/u, '').trim()
    const month = Number.parseInt(match[2], 10)
    const year = Number.parseInt(match[3], 10)
    if (month < 1 || month > 12) {
      out.push({
        key,
        file,
        fileName,
        matricule,
        month,
        year,
        user: null,
        collaboratorLabel: null,
        status: 'invalid_period',
      })
      continue
    }
    out.push({
      key,
      file,
      fileName,
      matricule,
      month,
      year,
      user: null,
      collaboratorLabel: null,
      status: 'checking',
    })
  }
  return out
}

async function resolveMatriculeMap(
  matricules: string[],
): Promise<Map<string, EmployeeUser | null>> {
  const unique = [...new Set(matricules.map((m) => m.trim()).filter(Boolean))]
  const map = new Map<string, EmployeeUser | null>()
  await Promise.all(
    unique.map(async (mat) => {
      try {
        const res = await employeesApi.getEmployees({
          search: mat,
          limit: 50,
          page: 1,
        })
        const exact = res.data.find(
          (u) =>
            u.employeeId != null &&
            u.employeeId.trim().toLowerCase() === mat.toLowerCase(),
        )
        map.set(mat, exact ?? null)
      } catch {
        map.set(mat, null)
      }
    }),
  )
  return map
}

function applyResolution(
  rows: BulkPreviewRow[],
  userByMatricule: Map<string, EmployeeUser | null>,
): BulkPreviewRow[] {
  return rows.map((row) => {
    if (
      row.status !== 'checking' ||
      row.matricule == null ||
      row.month == null ||
      row.year == null
    ) {
      return row
    }
    const user = userByMatricule.get(row.matricule) ?? null
    if (!user) {
      return {
        ...row,
        user: null,
        collaboratorLabel: null,
        status: 'not_found',
      }
    }
    return {
      ...row,
      user,
      collaboratorLabel: `${user.lastName} ${user.firstName}`.trim(),
      status: 'ready',
    }
  })
}

export function BulkUploadTab() {
  const [uploadKey, setUploadKey] = useState(0)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [rows, setRows] = useState<BulkPreviewRow[]>([])
  const [resolving, setResolving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [report, setReport] = useState<BulkUploadReport | null>(null)
  const resolveGenRef = useRef(0)

  const runResolve = useCallback(async (nextRows: BulkPreviewRow[], gen: number) => {
    const mats = nextRows
      .filter((r) => r.status === 'checking' && r.matricule != null)
      .map((r) => r.matricule as string)
    if (mats.length === 0) {
      if (gen === resolveGenRef.current) {
        setResolving(false)
      }
      return
    }
    setResolving(true)
    try {
      const map = await resolveMatriculeMap(mats)
      if (gen !== resolveGenRef.current) {
        return
      }
      setRows((prev) => applyResolution(prev, map))
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de résoudre les matricules'),
      )
      if (gen !== resolveGenRef.current) {
        return
      }
      setRows((prev) =>
        prev.map((r) =>
          r.status === 'checking'
            ? { ...r, user: null, collaboratorLabel: null, status: 'not_found' }
            : r,
        ),
      )
    } finally {
      if (gen === resolveGenRef.current) {
        setResolving(false)
      }
    }
  }, [])

  function handleUploadChange(info: { fileList: UploadFile[] }) {
    resolveGenRef.current += 1
    const gen = resolveGenRef.current
    setFileList(info.fileList)
    setReport(null)
    const initial = buildInitialRows(info.fileList)
    setRows(initial)
    void runResolve(initial, gen)
  }

  function handleRemoveRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key))
    setFileList((prev) => {
      const next = prev.filter((f) => f.uid !== key)
      if (next.length === 0) {
        setReport(null)
      }
      return next
    })
  }

  async function handleValidateUpload() {
    const ready = rows.filter((r) => r.status === 'ready')
    if (ready.length === 0) {
      message.warning('Aucun fichier prêt à envoyer')
      return
    }
    setUploading(true)
    setProgress(0)
    setReport(null)
    try {
      const rep = await payslipsApi.uploadBulk(
        ready.map((r) => r.file),
        (pct) => setProgress(pct),
      )
      setReport(rep)
      if (rep.failed === 0) {
        message.success(`${rep.success} bulletin(s) téléversé(s)`)
      } else {
        message.warning(
          `${rep.success} réussite(s), ${rep.failed} échec(s)`,
        )
      }
    } catch (e) {
      message.error(getApiErrorMessage(e, "L'upload en masse a échoué"))
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  function resetAll() {
    resolveGenRef.current += 1
    setUploadKey((k) => k + 1)
    setFileList([])
    setRows([])
    setReport(null)
    setProgress(0)
  }

  const errorDetails =
    report?.details.filter((d) => d.status === 'ERROR') ?? []

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Upload.Dragger
        key={uploadKey}
        multiple
        accept=".pdf,application/pdf"
        fileList={fileList}
        beforeUpload={(file) => {
          if (
            file.type !== 'application/pdf' &&
            !file.name.toLowerCase().endsWith('.pdf')
          ) {
            message.warning('Seuls les fichiers PDF sont acceptés')
            return Upload.LIST_IGNORE
          }
          if (file.size > MAX_PDF_BYTES) {
            message.warning(`${file.name} : fichier trop volumineux (10 Mo max)`)
            return Upload.LIST_IGNORE
          }
          return false
        }}
        onChange={({ fileList: fl }) => handleUploadChange({ fileList: fl })}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Sélectionnez un ou plusieurs PDF (noms du type{' '}
          <Text code>MATRICULE032024.pdf</Text>)
        </p>
        <p className="ant-upload-hint">10 Mo max par fichier, jusqu’à 500 fichiers</p>
      </Upload.Dragger>

      {rows.length > 0 ? (
        <>
          <BulkPreviewTable
            rows={rows}
            resolving={resolving}
            onRemove={handleRemoveRow}
          />
          {uploading ? (
            <Progress percent={progress} status="active" />
          ) : null}
          <Button
            type="primary"
            loading={uploading}
            disabled={resolving || rows.every((r) => r.status !== 'ready')}
            onClick={() => void handleValidateUpload()}
          >
            Valider et uploader
          </Button>
        </>
      ) : null}

      {report != null ? (
        <Result
          status={report.failed > 0 ? 'warning' : 'success'}
          title="Résultat du téléversement"
          subTitle={
            <Space direction="vertical">
              <Text>
                <Text strong style={{ color: '#52c41a' }}>
                  {report.success}
                </Text>{' '}
                réussite(s),{' '}
                <Text strong type="danger">
                  {report.failed}
                </Text>{' '}
                échec(s) sur {report.total} fichier(s)
              </Text>
            </Space>
          }
          extra={
            <Button onClick={resetAll}>Nouvel import</Button>
          }
        >
          {errorDetails.length > 0 ? (
            <Table
              size="small"
              pagination={false}
              rowKey={(_, index) => `err-${String(index)}`}
              dataSource={errorDetails}
              columns={[
                { title: 'Fichier', dataIndex: 'filename' },
                { title: 'Matricule', dataIndex: 'matricule', width: 120 },
                { title: 'Raison', dataIndex: 'reason' },
              ]}
            />
          ) : null}
        </Result>
      ) : null}
    </Space>
  )
}
