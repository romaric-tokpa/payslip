import { FilePdfOutlined } from '@ant-design/icons'
import { Alert, Card, Progress, Spin, Typography, Upload } from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useEffect, useRef, useState } from 'react'
import { MAX_PDF_BYTES } from '../payslipUploadConstants'
import '../payslip-upload.css'

const { Text, Title } = Typography

function isPdfFile(file: File): boolean {
  if (
    file.type === 'application/pdf' ||
    file.type === 'application/x-pdf'
  ) {
    return true
  }
  return file.name.toLowerCase().endsWith('.pdf')
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function annotateUploadList(fileList: UploadFile[]): UploadFile[] {
  return fileList.map((f) => {
    const raw = f.originFileObj
    if (!(raw instanceof File)) {
      return f
    }
    const errors: string[] = []
    if (!isPdfFile(raw)) {
      errors.push(
        'Format non supporté — seuls les fichiers PDF sont acceptés',
      )
    }
    if (raw.size > MAX_PDF_BYTES) {
      errors.push(
        `Fichier trop volumineux (${formatMb(raw.size)} Mo) — maximum 10 Mo`,
      )
    }
    if (errors.length > 0) {
      return {
        ...f,
        status: 'error' as const,
        response: errors.join(' '),
      }
    }
    return {
      ...f,
      status: 'done' as const,
    }
  })
}

type BulkAnalysisStepProps = {
  analyzing: boolean
  progress: number
  onAnalyze: (files: File[]) => void
  uploadKey: number
}

export function BulkAnalysisStep({
  analyzing,
  progress,
  onAnalyze,
  uploadKey,
}: BulkAnalysisStepProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const lastSigRef = useRef('')

  useEffect(() => {
    lastSigRef.current = ''
    queueMicrotask(() => {
      setFileList([])
    })
  }, [uploadKey])

  useEffect(() => {
    if (analyzing) {
      return
    }
    const valid: File[] = []
    for (const uf of fileList) {
      if (uf.status === 'error') {
        continue
      }
      const raw = uf.originFileObj
      if (
        raw instanceof File &&
        isPdfFile(raw) &&
        raw.size <= MAX_PDF_BYTES
      ) {
        valid.push(raw)
      }
    }
    if (valid.length === 0) {
      return
    }
    const sig = [...valid]
      .map((f) => `${f.name}:${String(f.size)}`)
      .sort()
      .join('|')
    if (sig === lastSigRef.current) {
      return
    }
    lastSigRef.current = sig
    onAnalyze(valid)
  }, [fileList, analyzing, onAnalyze])

  const errorItems = fileList.filter((f) => f.status === 'error')

  return (
    <Card className="bulk-analysis-card" variant="outlined">
      <div className="bulk-analysis-drop">
        <Upload.Dragger
          key={uploadKey}
          multiple
          disabled={analyzing}
          accept=".pdf,application/pdf"
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: fl }) => setFileList(annotateUploadList(fl))}
        >
          <div className="bulk-analysis-drop-inner">
            <div className="bulk-analysis-icon-wrap">
              <FilePdfOutlined />
            </div>
            <Title level={5} className="bulk-analysis-title">
              Déposez vos bulletins de paie ici
            </Title>
            <p className="bulk-analysis-sub">
              Le système identifie automatiquement chaque collaborateur
            </p>
            <Text className="bulk-analysis-hint">
              PDF uniquement, 10 Mo max, jusqu’à 500 fichiers. Les fichiers non
              valides restent listés en rouge : retirez-les avant de poursuivre.
            </Text>
          </div>
        </Upload.Dragger>
      </div>

      {errorItems.length > 0 ? (
        <div className="payslip-bulk-errors">
          {errorItems.map((f) => (
            <Alert
              key={f.uid}
              type="error"
              showIcon
              closable={false}
              className="payslip-bulk-error-alert"
              message={
                <Text strong ellipsis={{ tooltip: f.name }}>
                  {f.name}
                </Text>
              }
              description={
                typeof f.response === 'string'
                  ? f.response
                  : 'Fichier non valide'
              }
            />
          ))}
        </div>
      ) : null}

      {analyzing ? (
        <div className="bulk-analysis-progress-wrap">
          <Spin
            size="large"
            description="Analyse des bulletins en cours..."
          />
          <Progress
            className="payslip-bulk-progress"
            percent={progress}
            status="active"
            strokeColor="#0F5C5E"
          />
        </div>
      ) : null}
    </Card>
  )
}
