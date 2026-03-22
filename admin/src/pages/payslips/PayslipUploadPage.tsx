import { InboxOutlined, UploadOutlined } from '@ant-design/icons'
import { Tabs } from 'antd'
import { BulkUploadTab } from './BulkUploadTab'
import './payslip-upload.css'
import { SingleUploadTab } from './SingleUploadTab'

export function PayslipUploadPage() {
  return (
    <div className="payslip-upload-page">
      <p className="payslip-upload-lead">
        Envoyez un bulletin pour un collaborateur donné, ou déposez jusqu’à 500 PDF
        pour une analyse automatique, une vérification puis la distribution.
      </p>

      <Tabs
        className="payslip-upload-tabs"
        size="large"
        items={[
          {
            key: 'single',
            label: (
              <span className="payslip-upload-tab-label">
                <UploadOutlined />
                Upload individuel
              </span>
            ),
            children: <SingleUploadTab />,
          },
          {
            key: 'bulk',
            label: (
              <span className="payslip-upload-tab-label">
                <InboxOutlined />
                Upload en masse
              </span>
            ),
            children: <BulkUploadTab />,
          },
        ]}
      />
    </div>
  )
}
