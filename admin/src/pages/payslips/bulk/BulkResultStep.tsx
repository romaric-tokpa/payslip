import { Button, Card, Col, Result, Row, Space, Table, Typography } from 'antd'
import type { BulkUploadReport } from '../../../types/payslips'
import '../payslip-upload.css'

const { Text } = Typography

type BulkResultStepProps = {
  report: BulkUploadReport
  onNewDistribution: () => void
  onRetryTechnicalFailures: () => void
}

export function BulkResultStep({
  report,
  onNewDistribution,
  onRetryTechnicalFailures,
}: BulkResultStepProps) {
  const errorDetails = report.details.filter((d) => d.status === 'ERROR')
  const ignored = report.ignored ?? 0
  const hasRetryableTechnical = errorDetails.some(
    (d) => d.retryable === true,
  )

  const resultStatus =
    report.failed === 0
      ? 'success'
      : report.success === 0
        ? 'error'
        : 'warning'

  return (
    <Result
      status={resultStatus}
      title="Résultat de la distribution"
      subTitle={
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={[8, 8]}>
            <Col xs={24} sm={8}>
              <Card
                size="small"
                className="payslip-result-stat-card payslip-result-stat-card--success"
              >
                <Text className="payslip-result-stat-card__label">Succès</Text>
                <div className="payslip-result-stat-card__value">
                  {report.success}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card
                size="small"
                className="payslip-result-stat-card payslip-result-stat-card--failed"
              >
                <Text className="payslip-result-stat-card__label">Échecs</Text>
                <div className="payslip-result-stat-card__value">
                  {report.failed}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card
                size="small"
                className="payslip-result-stat-card payslip-result-stat-card--ignored"
              >
                <Text className="payslip-result-stat-card__label">Ignorés</Text>
                <div className="payslip-result-stat-card__value">
                  {ignored}
                </div>
              </Card>
            </Col>
          </Row>
          <Text type="secondary" className="payslip-result-subline">
            Traitement de {report.total} fichier(s) dans cette confirmation.
          </Text>
        </Space>
      }
      extra={
        <Space wrap>
          <Button
            type="primary"
            onClick={onNewDistribution}
            className="payslip-btn-teal"
          >
            Nouvelle distribution
          </Button>
          {hasRetryableTechnical ? (
            <Button variant="outlined" onClick={onRetryTechnicalFailures}>
              Réessayer les échecs
            </Button>
          ) : null}
        </Space>
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
            {
              title: 'Raison',
              dataIndex: 'reason',
              render: (t: string | undefined, row) => (
                <Space orientation="vertical" size={0}>
                  <Text>{t}</Text>
                  {row.retryable ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Échec technique — peut être rejoué
                    </Text>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      ) : null}
    </Result>
  )
}
