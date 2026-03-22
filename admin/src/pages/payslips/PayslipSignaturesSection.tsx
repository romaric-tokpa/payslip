import {
  CheckCircleOutlined,
  DownloadOutlined,
  SendOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { Key, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as payslipsApi from '../../services/payslips.service'
import type {
  PayslipSignatureRecentRow,
  PayslipUnsignedRow,
} from '../../types/payslip-signatures'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import {
  MONTHS_FR,
  yearOptions,
} from './payslipUploadConstants'

const MONTH_OPTIONS = MONTHS_FR.map((label, i) => ({
  value: i + 1,
  label,
}))

function deptLabel(row: PayslipUnsignedRow): string {
  return row.user.orgDepartment?.name?.trim() || '—'
}

export function PayslipSignaturesSection() {
  const { message, modal } = App.useApp()
  const defaultYm = useMemo(() => {
    const d = new Date()
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }
  }, [])
  const [year, setYear] = useState(defaultYm.y)
  const [month, setMonth] = useState(defaultYm.m)

  const [statsLoading, setStatsLoading] = useState(true)
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof payslipsApi.getPayslipSignatureStats>
  > | null>(null)

  const [unsignedLoading, setUnsignedLoading] = useState(true)
  const [unsignedRows, setUnsignedRows] = useState<PayslipUnsignedRow[]>([])

  const [selectedUnsignedKeys, setSelectedUnsignedKeys] = useState<Key[]>([])
  const [remindLoading, setRemindLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await payslipsApi.getPayslipSignatureStats(month, year)
      setStats(data)
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger les statistiques'),
      )
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [month, year, message])

  const loadUnsigned = useCallback(async () => {
    setUnsignedLoading(true)
    try {
      const data = await payslipsApi.getUnsignedPayslipsForPeriod(month, year)
      setUnsignedRows(data)
      setSelectedUnsignedKeys([])
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger les bulletins non signés'),
      )
      setUnsignedRows([])
    } finally {
      setUnsignedLoading(false)
    }
  }, [month, year, message])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    void loadUnsigned()
  }, [loadUnsigned])

  const unsignedColumns: ColumnsType<PayslipUnsignedRow> = useMemo(
    () => [
      {
        title: 'Collaborateur',
        key: 'name',
        render: (_, row) =>
          `${row.user.lastName} ${row.user.firstName}`.trim(),
      },
      {
        title: 'Matricule',
        key: 'mat',
        width: 110,
        render: (_, row) => row.user.employeeId?.trim() || '—',
      },
      {
        title: 'Département',
        key: 'dept',
        ellipsis: true,
        render: (_, row) => deptLabel(row),
      },
      {
        title: 'Distribué le',
        key: 'up',
        width: 150,
        render: (_, row) =>
          dayjs(row.uploadedAt).format('DD/MM/YYYY HH:mm'),
      },
      {
        title: 'Statut',
        key: 'st',
        width: 110,
        render: () => <Tag color="orange">En attente</Tag>,
      },
    ],
    [],
  )

  const recentColumns: ColumnsType<PayslipSignatureRecentRow> = useMemo(
    () => [
      {
        title: 'Collaborateur',
        key: 'name',
        render: (_, row) =>
          `${row.user.lastName} ${row.user.firstName}`.trim(),
      },
      {
        title: 'Matricule',
        key: 'mat',
        width: 110,
        render: (_, row) => row.user.employeeId?.trim() || '—',
      },
      {
        title: 'Période',
        key: 'per',
        width: 90,
        render: () =>
          `${String(month).padStart(2, '0')}/${year}`,
      },
      {
        title: 'Signé le',
        key: 'sig',
        width: 160,
        render: (_, row) =>
          dayjs(row.signedAt).format('DD/MM/YYYY HH:mm'),
      },
      {
        title: 'Code',
        key: 'code',
        width: 130,
        render: (_, row) => (
          <Typography.Text copyable>{row.verificationCode}</Typography.Text>
        ),
      },
      {
        title: 'Actions',
        key: 'act',
        width: 140,
        render: (_, row) => (
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() =>
              void (async () => {
                try {
                  await payslipsApi.downloadSignatureCertificate(row.id)
                } catch (e) {
                  message.error(
                    getApiErrorMessage(e, 'Téléchargement impossible'),
                  )
                }
              })()
            }
          >
            Certificat
          </Button>
        ),
      },
    ],
    [month, year, message],
  )

  function selectedUserIds(): string[] {
    const set = new Set<string>()
    for (const key of selectedUnsignedKeys) {
      const row = unsignedRows.find((r) => r.id === key)
      if (row) {
        set.add(row.userId)
      }
    }
    return [...set]
  }

  async function onRemind(userIds?: string[]) {
    modal.confirm({
      title: userIds?.length
        ? `Relancer ${userIds.length} collaborateur(s) ?`
        : 'Relancer tous les non-signataires ?',
      content:
        'Une notification in-app sera créée pour chaque collaborateur ciblé.',
      okText: 'Envoyer',
      cancelText: 'Annuler',
      onOk: async () => {
        setRemindLoading(true)
        try {
          const res = await payslipsApi.remindPayslipSignatures({
            month,
            year,
            userIds,
          })
          message.success(`${res.reminded} notification(s) envoyée(s)`)
          void loadUnsigned()
        } catch (e) {
          message.error(getApiErrorMessage(e, 'Échec de la relance'))
          throw e
        } finally {
          setRemindLoading(false)
        }
      },
    })
  }

  async function onExport() {
    setExportLoading(true)
    try {
      await payslipsApi.downloadSignatureComplianceReport(month, year)
      message.success('Export téléchargé')
    } catch (e) {
      message.error(getApiErrorMessage(e, "Impossible d'exporter le rapport"))
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="payslip-signatures-section">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Historique par collaborateur et par mois"
        description={
          <>
            Chaque signature est liée à <strong>un bulletin</strong> (donc à un
            mois de paie pour une personne) et possède un{' '}
            <strong>code unique</strong>. Pour voir tous les mois d’un
            collaborateur, les codes et la vérification : onglet{' '}
            <strong>Bulletins</strong> → filtre <strong>Collaborateur</strong>, ou
            menu <strong>Bulletins et signatures (par mois)</strong> depuis la
            liste des collaborateurs.
          </>
        }
      />
      <section
        className="payslips-toolbar payslip-signatures-toolbar"
        aria-label="Période signatures"
      >
        <div className="payslips-toolbar__filters">
          <Select
            className="employees-filter-select payslips-filter-year"
            value={year}
            onChange={(v) => setYear(v)}
            options={yearOptions().map((y) => ({ value: y, label: String(y) }))}
          />
          <Select
            className="employees-filter-select payslips-filter-month"
            value={month}
            onChange={(v) => setMonth(v)}
            options={MONTH_OPTIONS}
          />
          <Button
            icon={<DownloadOutlined />}
            loading={exportLoading}
            onClick={() => void onExport()}
          >
            Exporter le rapport
          </Button>
        </div>
      </section>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={statsLoading} size="small">
            <StatisticTeal
              icon={<TeamOutlined />}
              label="Total bulletins"
              value={stats?.total ?? 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={statsLoading} size="small">
            <StatisticTeal
              icon={<CheckCircleOutlined />}
              label="Signés"
              value={stats != null ? `${stats.signed} (${stats.signatureRate}%)` : '—'}
              valueColor="#389e0d"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={statsLoading} size="small">
            <StatisticTeal
              icon={<SendOutlined />}
              label="En attente"
              value={stats?.unsigned ?? 0}
              valueColor="#d46b08"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={statsLoading} size="small">
            <div className="payslip-signatures-gauge">
              <div className="payslip-signatures-gauge__label">Taux de signature</div>
              <Progress
                type="dashboard"
                percent={stats?.signatureRate ?? 0}
                strokeColor={{ '0%': '#0F5C5E', '100%': '#F28C28' }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title="Bulletins non signés"
        style={{ marginBottom: 24 }}
        extra={
          <Space wrap>
            <Button
              disabled={unsignedRows.length === 0}
              loading={remindLoading}
              onClick={() => void onRemind()}
            >
              Relancer tous
            </Button>
            <Button
              type="primary"
              className="employees-btn-primary-teal"
              disabled={selectedUnsignedKeys.length === 0}
              loading={remindLoading}
              onClick={() => void onRemind(selectedUserIds())}
            >
              Relancer les {selectedUnsignedKeys.length} sélectionné
              {selectedUnsignedKeys.length > 1 ? 's' : ''}
            </Button>
          </Space>
        }
      >
        <Table<PayslipUnsignedRow>
          rowKey="id"
          loading={unsignedLoading}
          columns={unsignedColumns}
          dataSource={unsignedRows}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedUnsignedKeys,
            onChange: (keys) => setSelectedUnsignedKeys(keys),
          }}
          scroll={{ x: 720 }}
          locale={{ emptyText: 'Aucun bulletin en attente pour cette période.' }}
        />
      </Card>

      <Card title="Signatures récentes (10 dernières)">
        <Table<PayslipSignatureRecentRow>
          rowKey="id"
          loading={statsLoading}
          columns={recentColumns}
          dataSource={stats?.recentSignatures ?? []}
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'Aucune signature sur cette période.' }}
        />
      </Card>
    </div>
  )
}

function StatisticTeal(props: {
  icon: ReactNode
  label: string
  value: string | number
  valueColor?: string
}) {
  return (
    <div className="payslip-sig-stat">
      <span className="payslip-sig-stat__icon">{props.icon}</span>
      <div>
        <div className="payslip-sig-stat__label">{props.label}</div>
        <div
          className="payslip-sig-stat__value"
          style={props.valueColor ? { color: props.valueColor } : undefined}
        >
          {props.value}
        </div>
      </div>
    </div>
  )
}
