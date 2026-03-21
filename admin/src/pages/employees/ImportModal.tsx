import { InboxOutlined } from '@ant-design/icons'
import {
  Button,
  Modal,
  Result,
  Space,
  Table,
  Typography,
  Upload,
  message,
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useState } from 'react'
import type { ImportEmployeesReport } from '../../types/employees'
import * as employeesApi from '../../services/employees.service'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'

const { Dragger } = Upload
const { Text } = Typography

type ImportModalProps = {
  open: boolean
  onClose: () => void
  onImportSuccess: () => void
}

export function ImportModal({ open, onClose, onImportSuccess }: ImportModalProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [report, setReport] = useState<ImportEmployeesReport | null>(null)

  function resetState() {
    setFileList([])
    setReport(null)
    setSubmitting(false)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  async function handleImport() {
    const raw = fileList[0]
    const file = raw?.originFileObj
    if (!file) {
      message.warning('Sélectionnez un fichier CSV ou Excel')
      return
    }
    setSubmitting(true)
    try {
      const res = await employeesApi.importEmployees(file)
      setReport(res)
      onImportSuccess()
      if (res.errors === 0) {
        message.success(`Import terminé : ${res.created} collaborateur(s) créé(s).`)
      }
    } catch (e) {
      message.error(getApiErrorMessage(e, "L'import a échoué"))
    } finally {
      setSubmitting(false)
    }
  }

  const showResult = report != null

  return (
    <Modal
      title="Importer des collaborateurs"
      open={open}
      onCancel={handleClose}
      footer={
        showResult ? (
          <Space>
            <Button
              onClick={() => {
                setReport(null)
                setFileList([])
              }}
            >
              Importer un autre fichier
            </Button>
            <Button type="primary" onClick={handleClose}>
              Fermer
            </Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={handleClose}>Annuler</Button>
            <Button
              type="primary"
              loading={submitting}
              onClick={() => void handleImport()}
            >
              Lancer l&apos;import
            </Button>
          </Space>
        )
      }
      width={640}
      destroyOnHidden
      afterClose={resetState}
    >
      {!showResult ? (
        <>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Formats acceptés : .csv, .xlsx, .xls (max. 5 Mo). Colonnes attendues
            : matricule, prenom, nom, email, departement, poste.
          </Text>
          <Dragger
            accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            maxCount={1}
            fileList={fileList}
            beforeUpload={() => false}
            onChange={({ fileList: fl }) => setFileList(fl)}
            onRemove={() => setFileList([])}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Cliquez ou glissez un fichier ici
            </p>
          </Dragger>
        </>
      ) : (
        <Result
          status={report.errors > 0 ? 'warning' : 'success'}
          title="Rapport d'import"
          subTitle={
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text>
                <Text strong style={{ color: '#52c41a' }}>
                  {report.created}
                </Text>{' '}
                ligne(s) créée(s) sur {report.total}
              </Text>
              {report.errors > 0 ? (
                <Text>
                  <Text strong type="danger">
                    {report.errors}
                  </Text>{' '}
                  erreur(s)
                </Text>
              ) : null}
            </Space>
          }
        >
          {report.errorDetails.length > 0 ? (
            <Table
              size="small"
              pagination={false}
              rowKey={(r) => `${r.line}-${r.matricule}-${r.reason}`}
              dataSource={report.errorDetails}
              columns={[
                { title: 'Ligne', dataIndex: 'line', width: 72 },
                { title: 'Matricule', dataIndex: 'matricule', width: 120 },
                { title: 'Raison', dataIndex: 'reason' },
              ]}
            />
          ) : null}
        </Result>
      )}
    </Modal>
  )
}
