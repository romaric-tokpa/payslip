import { Tabs, Typography } from 'antd'
import { BulkUploadTab } from './BulkUploadTab'
import { SingleUploadTab } from './SingleUploadTab'

const { Title } = Typography

export function PayslipUploadPage() {
  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        Téléversement de bulletins
      </Title>
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
