import { Tabs } from 'antd'
import { BulkUploadTab } from './BulkUploadTab'
import './payslip-upload.css'
import { SingleUploadTab } from './SingleUploadTab'

export function PayslipUploadPage() {
  return (
    <div className="payslip-upload-page">
      <Tabs
        items={[
          {
            key: 'single',
            label: 'Upload individuel',
            children: <SingleUploadTab />,
          },
          {
            key: 'bulk',
            label: 'Upload en masse',
            children: <BulkUploadTab />,
          },
        ]}
      />
    </div>
  )
}
