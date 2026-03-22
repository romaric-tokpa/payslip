import { App } from 'antd'
import { useCallback, useRef, useState } from 'react'
import * as payslipsApi from '../../../services/payslips.service'
import type { BulkAnalyzeRow, BulkUploadReport } from '../../../types/payslips'
import { getApiErrorMessage } from '../../../utils/apiErrorMessage'
import '../payslip-upload.css'
import { BulkAnalysisStep } from './BulkAnalysisStep'
import { BulkResultStep } from './BulkResultStep'
import { BulkReviewTable } from './BulkReviewTable'
import { BulkUploadStepper } from './BulkUploadStepper'

export function BulkUploadFlow() {
  const { message } = App.useApp()
  const [step, setStep] = useState(0)
  const [uploadKey, setUploadKey] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [batchId, setBatchId] = useState('')
  const [analyses, setAnalyses] = useState<BulkAnalyzeRow[]>([])
  const [report, setReport] = useState<BulkUploadReport | null>(null)

  const filesSentRef = useRef<File[]>([])
  const removedDuringReviewRef = useRef(0)

  const runAnalyze = useCallback(
    async (files: File[]) => {
      filesSentRef.current = files
      removedDuringReviewRef.current = 0
      setAnalyzing(true)
      setProgress(0)
      try {
        const res = await payslipsApi.analyzeBulkPayslips(files, (p) =>
          setProgress(p),
        )
        setBatchId(res.batchId)
        setAnalyses(res.analyses)
        setStep(1)
      } catch (e) {
        message.error(
          getApiErrorMessage(e, "L'analyse des bulletins a échoué"),
        )
      } finally {
        setAnalyzing(false)
        setProgress(0)
      }
    },
    [message],
  )

  const handleRetryTechnicalFailures = useCallback(() => {
    if (report == null) {
      return
    }
    const idx = new Set(
      report.details
        .filter((d) => d.status === 'ERROR' && d.retryable === true)
        .map((d) => d.fileIndex)
        .filter((i): i is number => typeof i === 'number'),
    )
    if (idx.size === 0) {
      message.warning('Aucun échec technique à rejouer')
      return
    }
    const files = filesSentRef.current.filter((_f, i) => idx.has(i))
    if (files.length === 0) {
      message.warning(
        'Les fichiers en échec ne sont plus disponibles. Relancez un dépôt complet.',
      )
      return
    }
    setReport(null)
    void runAnalyze(files)
  }, [message, report, runAnalyze])

  function resetFlow() {
    setStep(0)
    setUploadKey((k) => k + 1)
    setBatchId('')
    setAnalyses([])
    setReport(null)
    setProgress(0)
    filesSentRef.current = []
    removedDuringReviewRef.current = 0
  }

  function handleBackFromReview() {
    setStep(0)
    setUploadKey((k) => k + 1)
    setBatchId('')
    setAnalyses([])
    removedDuringReviewRef.current = 0
  }

  return (
    <div className="payslip-bulk-flow">
      <BulkUploadStepper current={step} />

      {step === 0 ? (
        <BulkAnalysisStep
          uploadKey={uploadKey}
          analyzing={analyzing}
          progress={progress}
          onAnalyze={(files) => void runAnalyze(files)}
        />
      ) : null}

      {step === 1 && batchId ? (
        <BulkReviewTable
          key={batchId}
          batchId={batchId}
          analyses={analyses}
          onAnalysesChange={setAnalyses}
          onRowRemoved={() => {
            removedDuringReviewRef.current += 1
          }}
          onBack={handleBackFromReview}
          onDistributed={(rep) => {
            setReport({
              ...rep,
              ignored: removedDuringReviewRef.current,
            })
            setStep(2)
          }}
        />
      ) : null}

      {step === 2 && report != null ? (
        <BulkResultStep
          report={report}
          onNewDistribution={resetFlow}
          onRetryTechnicalFailures={handleRetryTechnicalFailures}
        />
      ) : null}
    </div>
  )
}
