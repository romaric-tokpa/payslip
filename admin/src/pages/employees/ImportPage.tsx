import { DownloadOutlined } from '@ant-design/icons'
import { App, Button, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ADMIN_BASE } from '../../constants/adminRoutes'
import { PageHeader } from '../../components/PageHeader'
import * as employeesApi from '../../services/employees.service'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import './import/import-flow.css'
import { ImportModal } from './ImportModal'

export function ImportPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()

  async function handleDownloadTemplate() {
    try {
      await employeesApi.downloadTemplate()
      message.success('Modèle téléchargé')
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Échec du téléchargement'))
    }
  }

  return (
    <div>
      <PageHeader
        actions={
          <Space>
            <Button
              variant="outlined"
              icon={<DownloadOutlined />}
              onClick={() => void handleDownloadTemplate()}
              className="import-btn-outline-teal"
            >
              Télécharger le template
            </Button>
          </Space>
        }
      />
      <ImportModal
        variant="page"
        open
        onClose={() => navigate(`${ADMIN_BASE}/employees`)}
        onImportSuccess={() => navigate(`${ADMIN_BASE}/employees`)}
      />
    </div>
  )
}
