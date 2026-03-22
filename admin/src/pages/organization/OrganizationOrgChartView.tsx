import { ReloadOutlined } from '@ant-design/icons'
import { App, Button, Spin, Typography } from 'antd'
import dagre from 'dagre'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import * as orgApi from '../../services/organization.service'
import type { OrgChartDepartmentNode, OrgChartResponse } from '../../types/organization'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import './organization-org-chart.css'

const SLATE = '#64748b'

type EmpData = {
  label: string
  firstName: string
  lastName: string
  position: string | null
  serviceName: string | null
}

function ChartRootNode({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div className="org-node org-node--root">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function DirectionNode({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div className="org-node org-node--direction">
      <Handle type="target" position={Position.Top} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function VirtualGroupNode({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div className="org-node org-node--virtual">
      <Handle type="target" position={Position.Top} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function DepartmentNode({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div className="org-node org-node--department">
      <Handle type="target" position={Position.Top} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function ServiceNode({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div className="org-node org-node--service">
      <Handle type="target" position={Position.Top} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function EmployeeNode({ data }: NodeProps<Node<EmpData>>) {
  return (
    <div className="org-node org-node--employee">
      <Handle type="target" position={Position.Top} />
      <div className="org-node__name">{data.label}</div>
      <div className="org-node__role">
        {data.position?.trim() ? data.position : '—'}
      </div>
      {data.serviceName ? (
        <div className="org-node__svc">{data.serviceName}</div>
      ) : null}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  chartRoot: ChartRootNode,
  direction: DirectionNode,
  virtualGroup: VirtualGroupNode,
  department: DepartmentNode,
  service: ServiceNode,
  employee: EmployeeNode,
}

function nodeSize(node: Node): { width: number; height: number } {
  switch (node.type) {
    case 'employee':
      return { width: 200, height: 72 }
    case 'service':
      return { width: 196, height: 40 }
    case 'department':
      return { width: 210, height: 44 }
    case 'direction':
      return { width: 210, height: 44 }
    case 'chartRoot':
      return { width: 280, height: 52 }
    case 'virtualGroup':
      return { width: 240, height: 40 }
    default:
      return { width: 200, height: 44 }
  }
}

function layoutWithDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    nodesep: 48,
    ranksep: 72,
    marginx: 24,
    marginy: 24,
  })

  for (const node of nodes) {
    const { width, height } = nodeSize(node)
    g.setNode(node.id, { width, height })
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target)
  }
  dagre.layout(g)

  return nodes.map((node) => {
    const n = g.node(node.id)
    if (!n) {
      return node
    }
    const { width, height } = nodeSize(node)
    return {
      ...node,
      position: {
        x: n.x - width / 2,
        y: n.y - height / 2,
      },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    }
  })
}

function buildGraph(chart: OrgChartResponse): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const ROOT = 'root'

  nodes.push({
    id: ROOT,
    type: 'chartRoot',
    position: { x: 0, y: 0 },
    data: { label: chart.companyName },
  })

  const link = (source: string, target: string) => {
    edges.push({
      id: `${source}|${target}`,
      source,
      target,
      type: 'smoothstep',
      style: { stroke: SLATE, strokeWidth: 1.5 },
    })
  }

  const addDeptSubtree = (dept: OrgChartDepartmentNode, parentId: string) => {
    const did = `dept-${dept.id}`
    nodes.push({
      id: did,
      type: 'department',
      position: { x: 0, y: 0 },
      data: { label: dept.name },
    })
    link(parentId, did)

    for (const svc of dept.services) {
      const sid = `svc-${svc.id}`
      nodes.push({
        id: sid,
        type: 'service',
        position: { x: 0, y: 0 },
        data: { label: svc.name },
      })
      link(did, sid)
      for (const emp of svc.employees) {
        const eid = `emp-${emp.id}`
        nodes.push({
          id: eid,
          type: 'employee',
          position: { x: 0, y: 0 },
          data: {
            ...emp,
            serviceName: null,
            label: `${emp.firstName} ${emp.lastName}`.trim(),
          },
        })
        link(sid, eid)
      }
    }

    for (const emp of dept.employees) {
      const eid = `emp-d-${dept.id}-${emp.id}`
      nodes.push({
        id: eid,
        type: 'employee',
        position: { x: 0, y: 0 },
        data: {
          ...emp,
          label: `${emp.firstName} ${emp.lastName}`.trim(),
        },
      })
      link(did, eid)
    }
  }

  for (const dir of chart.directions) {
    const dirId = `dir-${dir.id}`
    nodes.push({
      id: dirId,
      type: 'direction',
      position: { x: 0, y: 0 },
      data: { label: dir.name },
    })
    link(ROOT, dirId)
    for (const dept of dir.departments) {
      addDeptSubtree(dept, dirId)
    }
  }

  if (chart.departmentsWithoutDirection.length > 0) {
    const vid = 'virt-no-dir'
    nodes.push({
      id: vid,
      type: 'virtualGroup',
      position: { x: 0, y: 0 },
      data: { label: 'Départements sans direction' },
    })
    link(ROOT, vid)
    for (const dept of chart.departmentsWithoutDirection) {
      addDeptSubtree(dept, vid)
    }
  }

  if (chart.orphanServices.length > 0) {
    const vid = 'virt-orphan-svc'
    nodes.push({
      id: vid,
      type: 'virtualGroup',
      position: { x: 0, y: 0 },
      data: { label: 'Services sans département' },
    })
    link(ROOT, vid)
    for (const svc of chart.orphanServices) {
      const sid = `osvc-${svc.id}`
      nodes.push({
        id: sid,
        type: 'service',
        position: { x: 0, y: 0 },
        data: { label: svc.name },
      })
      link(vid, sid)
      for (const emp of svc.employees) {
        const eid = `emp-o-${svc.id}-${emp.id}`
        nodes.push({
          id: eid,
          type: 'employee',
          position: { x: 0, y: 0 },
          data: {
            ...emp,
            serviceName: null,
            label: `${emp.firstName} ${emp.lastName}`.trim(),
          },
        })
        link(sid, eid)
      }
    }
  }

  return { nodes, edges }
}

function FlowContent({
  laidOutNodes,
  edges,
}: {
  laidOutNodes: Node[]
  edges: Edge[]
}) {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState(laidOutNodes)
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState(edges)

  useEffect(() => {
    setNodes(laidOutNodes)
    setEdges(edges)
  }, [laidOutNodes, edges, setNodes, setEdges])

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      void fitView({ padding: 0.15, duration: 280 })
    })
    return () => cancelAnimationFrame(t)
  }, [laidOutNodes, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      fitView
      minZoom={0.08}
      maxZoom={1.25}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} color="#e2e8f0" />
      <Controls showInteractive={false} />
      <MiniMap
        nodeStrokeWidth={2}
        zoomable
        pannable
        maskColor="rgba(15, 92, 94, 0.08)"
      />
    </ReactFlow>
  )
}

export function OrganizationOrgChartView() {
  const { message } = App.useApp()
  const [chart, setChart] = useState<OrgChartResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await orgApi.getOrgChart()
      setChart(data)
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger l’organigramme'),
      )
      setChart(null)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const { nodes: rawNodes, edges } = useMemo(() => {
    if (!chart) {
      return { nodes: [] as Node[], edges: [] as Edge[] }
    }
    return buildGraph(chart)
  }, [chart])

  const laidOutNodes = useMemo(
    () => layoutWithDagre(rawNodes, edges),
    [rawNodes, edges],
  )

  if (loading && !chart) {
    return (
      <div className="org-chart-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!chart) {
    return (
      <Typography.Text type="secondary">
        Aucune donnée à afficher.
      </Typography.Text>
    )
  }

  return (
    <div className="org-chart-wrap">
      <div className="org-chart-toolbar">
        <Typography.Text type="secondary">
          Collaborateurs actifs (EMPLOYEE). Glisser le fond pour déplacer, molette
          pour zoomer.
        </Typography.Text>
        <Button icon={<ReloadOutlined />} onClick={() => void load()}>
          Actualiser
        </Button>
      </div>
      <div className="org-chart-canvas">
        <ReactFlowProvider>
          <FlowContent laidOutNodes={laidOutNodes} edges={edges} />
        </ReactFlowProvider>
      </div>
    </div>
  )
}
