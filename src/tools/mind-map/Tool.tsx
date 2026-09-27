import { useState, useEffect, useRef, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Node {
  id: number
  text: string
  x: number
  y: number
  color: string
  parentId: number | null
  children: number[]
  collapsed: boolean
}

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#db2777', '#ea580c', '#64748b', '#000000']

export default function MindMap() {
  const [nodes, setNodes] = useState<Node[]>(() => {
    const saved = localStorage.getItem('mind-map')
    return saved ? JSON.parse(saved) : [
      { id: 1, text: 'Central Idea', x: 400, y: 300, color: COLORS[0], parentId: null, children: [2, 3, 4], collapsed: false },
      { id: 2, text: 'Branch 1', x: 150, y: 150, color: COLORS[1], parentId: 1, children: [], collapsed: false },
      { id: 3, text: 'Branch 2', x: 400, y: 100, color: COLORS[2], parentId: 1, children: [5], collapsed: false },
      { id: 4, text: 'Branch 3', x: 650, y: 150, color: COLORS[3], parentId: 1, children: [], collapsed: false },
      { id: 5, text: 'Sub-branch', x: 400, y: 50, color: COLORS[4], parentId: 3, children: [], collapsed: false },
    ]
  })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [draggingNode, setDraggingNode] = useState<number | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    try { localStorage.setItem('mind-map', JSON.stringify(nodes)) } catch {}
  }, [nodes])

  const getNode = (id: number) => nodes.find(n => n.id === id)
  const getChildren = (id: number) => nodes.filter(n => n.parentId === id)

  const addChild = (parentId: number) => {
    const parent = getNode(parentId)!
    const newId = Date.now()
    const angle = (parent.children.length * 60) * Math.PI / 180
    const radius = 200
    setNodes([...nodes, {
      id: newId,
      text: 'New Node',
      x: parent.x + Math.cos(angle) * radius,
      y: parent.y + Math.sin(angle) * radius,
      color: COLORS[parent.children.length % COLORS.length],
      parentId,
      children: [],
      collapsed: false,
    }])
    setNodes(nodes.map(n => n.id === parentId ? { ...n, children: [...n.children, newId] } : n))
    setSelectedId(newId)
    setTimeout(() => setEditingId(newId), 50)
  }

  const addSibling = (nodeId: number) => {
    const node = getNode(nodeId)!
    if (!node.parentId) return
    addChild(node.parentId)
  }

  const deleteNode = (nodeId: number) => {
    const node = getNode(nodeId)!
    const descendants = getAllDescendants(nodeId)
    const idsToDelete = [nodeId, ...descendants]
    setNodes(nodes.filter(n => !idsToDelete.includes(n.id)))
    if (node.parentId) {
      setNodes(nodes.map(n => n.id === node.parentId ? { ...n, children: n.children.filter(c => c !== nodeId) } : n))
    }
    if (selectedId === nodeId) setSelectedId(null)
  }

  const getAllDescendants = (nodeId: number): number[] => {
    const node = getNode(nodeId)!
    let result: number[] = []
    node.children.forEach(childId => {
      result.push(childId)
      result = result.concat(getAllDescendants(childId))
    })
    return result
  }

  const toggleCollapse = (nodeId: number) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n))
  }

  const updateNodeText = (id: number, text: string) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, text } : n))
  }

  const updateNodeColor = (id: number, color: string) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, color } : n))
  }

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: number) => {
    e.stopPropagation()
    setDraggingNode(nodeId)
    setDragStart({ x: e.clientX, y: e.clientY })
    setSelectedId(nodeId)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (draggingNode !== null) {
      const dx = (e.clientX - dragStart.x) / zoom
      const dy = (e.clientY - dragStart.y) / zoom
      setNodes(nodes.map(n => n.id === draggingNode ? { ...n, x: n.x + dx, y: n.y + dy } : n))
      setDragStart({ x: e.clientX, y: e.clientY })
    }
    if (panning) {
      setPan({ x: pan.x + (e.clientX - panStart.x), y: pan.y + (e.clientY - panStart.y) })
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    setDraggingNode(null)
    setPanning(false)
  }

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.min(3, Math.max(0.3, zoom * delta))
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect) {
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      setPan({
        x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
        y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
      })
    }
    setZoom(newZoom)
  }

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingNode, panning, dragStart, panStart, zoom, pan])

  const visibleNodes = useMemo(() => {
    const visible = new Set<number>()
    const addVisible = (id: number) => {
      visible.add(id)
      const node = getNode(id)
      if (node && !node.collapsed) {
        node.children.forEach(addVisible)
      }
    }
    // Find root nodes
    nodes.filter(n => n.parentId === null).forEach(n => addVisible(n.id))
    return nodes.filter(n => visible.has(n.id))
  }, [nodes])

  const connections = useMemo(() => {
    const conns: { from: Node; to: Node }[] = []
    visibleNodes.forEach(node => {
      if (node.parentId) {
        const parent = getNode(node.parentId)
        if (parent && visibleNodes.some(n => n.id === parent.id)) {
          conns.push({ from: parent, to: node })
        }
      }
    })
    return conns
  }, [visibleNodes])

  const exportImage = () => {
    const svg = svgRef.current
    if (!svg) return
    const serializer = new XMLSerializer()
    const source = serializer.serializeToString(svg)
    const blob = new Blob([source], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mind-map.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  const centerView = () => {
    if (visibleNodes.length === 0) return
    const xs = visibleNodes.map(n => n.x)
    const ys = visibleNodes.map(n => n.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const svg = svgRef.current
    if (svg) {
      const rect = svg.getBoundingClientRect()
      setPan({ x: rect.width / 2 - centerX * zoom, y: rect.height / 2 - centerY * zoom })
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ justifyContent: 'space-between', padding: '8px 16', background: 'var(--sunken)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Mind Map</h3>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="muted">Zoom: {Math.round(zoom * 100)}%</span>
          <button className="btn" onClick={() => setZoom(z => Math.min(3, z * 1.2))}>+</button>
          <button className="btn" onClick={() => setZoom(z => Math.max(0.3, z / 1.2))}>−</button>
          <button className="btn" onClick={centerView}>Center</button>
          <button className="btn" onClick={exportImage}>Export SVG</button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          onMouseDown={e => { if (e.target === e.currentTarget) { setPanning(true); setPanStart({ x: e.clientX, y: e.clientY }) }}}
          onWheel={handleWheel}
          style={{
            width: '100%', height: '100%', cursor: panning ? 'grabbing' : draggingNode !== null ? 'grabbing' : 'grab',
            transformOrigin: '0 0',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            background: 'var(--bg)',
          }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--border)" />
            </marker>
          </defs>
          {connections.map((conn, i) => (
            <line
              key={i}
              x1={conn.from.x} y1={conn.from.y}
              x2={conn.to.x} y2={conn.to.y}
              stroke="var(--border)"
              strokeWidth={2 / zoom}
              markerEnd="url(#arrowhead)"
              style={{ pointerEvents: 'none' }}
            />
          ))}
          {visibleNodes.map((node, i) => (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseDown={e => handleNodeMouseDown(e, node.id)}
              style={{ cursor: 'grab', userSelect: 'none' }}
            >
              <circle
                r={editingId === node.id ? 0 : 60}
                fill={node.color + '30'}
                stroke={node.color}
                strokeWidth={selectedId === node.id ? 3 / zoom : 2 / zoom}
                style={{ pointerEvents: 'none', transition: 'r 0.2s' }}
              />
              {editingId === node.id ? (
                <foreignObject x={-100} y={-20} width={200} height={40}>
                  <input
                    type="text"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onBlur={() => { updateNodeText(node.id, editText); setEditingId(null) }}
                    onKeyDown={e => e.key === 'Enter' && (updateNodeText(node.id, editText), setEditingId(null))}
                    autoFocus
                    style={{ width: '100%', padding: '8px', border: '2px solid var(--accent)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </foreignObject>
              ) : (
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={14 / zoom}
                  fontWeight={600}
                  fill="var(--text)"
                  style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onDoubleClick={() => { setEditingId(node.id); setEditText(node.text) }}
                >
                  {node.text}
                </text>
              )}
              {!node.collapsed && node.children.length > 0 && (
                <text
                  x={0} y={70 / zoom}
                  textAnchor="middle"
                  fontSize={10 / zoom}
                  fill="var(--muted)"
                  onClick={e => { e.stopPropagation(); toggleCollapse(node.id) }}
                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                >
                  ▼ {node.children.length}
                </text>
              )}
              {node.collapsed && node.children.length > 0 && (
                <text
                  x={0} y={70 / zoom}
                  textAnchor="middle"
                  fontSize={10 / zoom}
                  fill="var(--accent)"
                  onClick={e => { e.stopPropagation(); toggleCollapse(node.id) }}
                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                >
                  ▶ {node.children.length} hidden
                </text>
              )}
            </g>
          ))}
        </svg>

        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          padding: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem'
        }}>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => { const root = nodes.find(n => n.parentId === null); if (root) addChild(root.id) }}>Add to Center</button>
          </div>
          {selectedId && (
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => addChild(selectedId)}>Add Child</button>
              <button className="btn" onClick={() => addSibling(selectedId)}>Add Sibling</button>
              <button className="btn" onClick={() => setEditingId(selectedId)}>Edit Text</button>
              <input type="color" value={getNode(selectedId)?.color || COLORS[0]} onChange={e => updateNodeColor(selectedId, e.target.value)} style={{ width: 28, height: 28, border: 'none', borderRadius: '50%', cursor: 'pointer' }} />
              <button className="btn" onClick={() => deleteNode(selectedId)} style={{ color: 'var(--danger)' }}>Delete</button>
            </div>
          )}
        </div>
      </div>

      <p className="muted" style={{ padding: '8px 16', fontSize: '0.85rem', textAlign: 'center' }}>
        Double-click node to edit. Drag to move. Scroll to zoom. Right-click canvas to pan. Collapse/expand with ▼/▶. Export as SVG.
      </p>
    </div>
  )
}