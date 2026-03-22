import { FilePdfOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Select, Spin, Upload } from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import * as employeesApi from '../../services/employees.service'
import * as payslipsApi from '../../services/payslips.service'
import type { EmployeeUser } from '../../types/employees'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { EmployeeSelectOptionLabel } from './EmployeeSelectOptionLabel'
import {
  MAX_PDF_BYTES,
  MONTHS_FR,
  formatEmployeeOption,
  yearOptions,
} from './payslipUploadConstants'
import './payslip-upload.css'

type SingleFormValues = {
  userId: string
  periodMonth: number
  periodYear: number
}

type EmployeeSelectOption = {
  value: string
  label: ReactNode
  title: string
}

export function SingleUploadTab() {
  const { message } = App.useApp()
  const [form] = Form.useForm<SingleFormValues>()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [options, setOptions] = useState<EmployeeSelectOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const loadOptions = useCallback(async (search: string) => {
    setOptionsLoading(true)
    try {
      const res = await employeesApi.getEmployees({
        search: search === '' ? undefined : search,
        limit: 50,
        page: 1,
      })
      setOptions(
        res.data.map((u: EmployeeUser) => ({
          value: u.id,
          label: <EmployeeSelectOptionLabel user={u} />,
          title: formatEmployeeOption(u),
        })),
      )
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger les collaborateurs'),
      )
      setOptions([])
    } finally {
      setOptionsLoading(false)
    }
  }, [message])

  useEffect(() => {
    void loadOptions(debouncedSearch)
  }, [debouncedSearch, loadOptions])

  async function onSubmit() {
    const values = await form.validateFields()
    const raw = fileList[0]
    const file = raw?.originFileObj
    if (!file) {
      message.warning('Ajoutez un fichier PDF')
      return
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      message.warning('Seuls les fichiers PDF sont acceptés')
      return
    }
    if (file.size > MAX_PDF_BYTES) {
      message.warning('Le fichier ne doit pas dépasser 10 Mo')
      return
    }
    setUploading(true)
    try {
      await payslipsApi.uploadSingle(
        file,
        values.userId,
        values.periodMonth,
        values.periodYear,
      )
      message.success('Bulletin téléversé avec succès')
      form.resetFields()
      setFileList([])
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Échec du téléversement'))
    } finally {
      setUploading(false)
    }
  }

  const years = yearOptions()

  return (
    <Card className="payslip-single-card" variant="outlined">
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className="payslip-single-form"
      >
        <div className="payslip-single-grid">
          <div>
            <Form.Item
              className="payslip-form-item"
              name="userId"
              label="Collaborateur"
              rules={[{ required: true, message: 'Sélectionnez un collaborateur' }]}
            >
              <Select
                showSearch
                filterOption={false}
                className="payslip-upload-select"
                placeholder="Rechercher par matricule, nom ou prénom…"
                options={options}
                loading={optionsLoading}
                onSearch={setSearchInput}
                notFoundContent={
                  optionsLoading ? <Spin size="small" /> : 'Aucun résultat'
                }
                popupMatchSelectWidth={false}
              />
            </Form.Item>
            <Form.Item
              className="payslip-form-item"
              name="periodMonth"
              label="Mois"
              rules={[{ required: true, message: 'Mois requis' }]}
            >
              <Select
                className="payslip-upload-select"
                placeholder="Mois"
                options={MONTHS_FR.map((label, i) => ({
                  value: i + 1,
                  label,
                }))}
              />
            </Form.Item>
            <Form.Item
              className="payslip-form-item"
              name="periodYear"
              label="Année"
              rules={[{ required: true, message: 'Année requise' }]}
            >
              <Select
                className="payslip-upload-select"
                placeholder="Année"
                options={years.map((y) => ({ value: y, label: String(y) }))}
              />
            </Form.Item>
          </div>
          <div>
            <Form.Item
              className="payslip-form-item"
              label="Fichier PDF"
              required
            >
              <div className="payslip-single-drop">
                <Upload.Dragger
                  accept=".pdf,application/pdf"
                  maxCount={1}
                  fileList={fileList}
                  beforeUpload={(file) => {
                    if (file.size > MAX_PDF_BYTES) {
                      message.warning('Le fichier ne doit pas dépasser 10 Mo')
                      return Upload.LIST_IGNORE
                    }
                    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                      message.warning('Seuls les fichiers PDF sont acceptés')
                      return Upload.LIST_IGNORE
                    }
                    return false
                  }}
                  onChange={({ fileList: fl }) => setFileList(fl)}
                  onRemove={() => setFileList([])}
                >
                  <div className="payslip-single-drop-inner">
                    <FilePdfOutlined className="payslip-single-pdf-icon" />
                    <div className="payslip-single-drop-title">
                      Déposez le bulletin PDF ici
                    </div>
                    <div className="payslip-single-drop-sub">10 Mo max</div>
                  </div>
                </Upload.Dragger>
              </div>
            </Form.Item>
          </div>
        </div>
        <Form.Item className="payslip-single-submit-wrap">
          <Button
            type="primary"
            block
            loading={uploading}
            onClick={() => void onSubmit()}
            className="payslip-btn-teal"
          >
            Uploader le bulletin
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}
