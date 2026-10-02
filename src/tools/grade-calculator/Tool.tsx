import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Category {
  id: number
  name: string
  weight: number
  assignments: Assignment[]
}

interface Assignment {
  id: number
  name: string
  score: number
  maxScore: number
  weight?: number
}

interface GradeBand {
  letter: string
  min: number
  gpa: number
}

const GRADE_SCALES: Record<string, { name: string; bands: GradeBand[] }> = {
  'us-4': {
    name: 'US 4.0',
    bands: [
      { letter: 'A', min: 93, gpa: 4.0 }, { letter: 'A-', min: 90, gpa: 3.7 }, { letter: 'B+', min: 87, gpa: 3.3 },
      { letter: 'B', min: 83, gpa: 3.0 }, { letter: 'B-', min: 80, gpa: 2.7 }, { letter: 'C+', min: 77, gpa: 2.3 },
      { letter: 'C', min: 73, gpa: 2.0 }, { letter: 'C-', min: 70, gpa: 1.7 }, { letter: 'D+', min: 67, gpa: 1.3 },
      { letter: 'D', min: 63, gpa: 1.0 }, { letter: 'D-', min: 60, gpa: 0.7 },
    ],
  },
  'us-4-simple': {
    name: 'US 4.0 (Simple)',
    bands: [
      { letter: 'A', min: 90, gpa: 4.0 }, { letter: 'B', min: 80, gpa: 3.0 }, { letter: 'C', min: 70, gpa: 2.0 }, { letter: 'D', min: 60, gpa: 1.0 },
    ],
  },
  'indonesia': {
    name: 'Indonesia (A-E)',
    bands: [
      { letter: 'A', min: 85, gpa: 4.0 }, { letter: 'B', min: 70, gpa: 3.0 }, { letter: 'C', min: 55, gpa: 2.0 }, { letter: 'D', min: 40, gpa: 1.0 },
    ],
  },
  'uk': {
    name: 'UK (First-Third)',
    bands: [
      { letter: 'First', min: 70, gpa: 4.0 }, { letter: '2:1', min: 60, gpa: 3.5 }, { letter: '2:2', min: 50, gpa: 3.0 }, { letter: 'Third', min: 40, gpa: 2.0 },
    ],
  },
  'percentage': { name: 'Percentage Only', bands: [] },
}

export default function GradeCalculator() {
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:grade-calculator')
      if (saved) return JSON.parse(saved) as Category[]
    } catch {}
    return [
      { id: 1, name: 'Homework', weight: 20, assignments: [{ id: 1, name: 'HW 1', score: 90, maxScore: 100 }, { id: 2, name: 'HW 2', score: 85, maxScore: 100 }] },
      { id: 3, name: 'Midterm', weight: 30, assignments: [{ id: 3, name: 'Midterm Exam', score: 78, maxScore: 100 }] },
      { id: 4, name: 'Final', weight: 35, assignments: [{ id: 4, name: 'Final Exam', score: 0, maxScore: 100 }] },
      { id: 5, name: 'Participation', weight: 15, assignments: [{ id: 5, name: 'Attendance', score: 95, maxScore: 100 }] },
    ]
  })
  const [scale, setScale] = useState('us-4')
  const [targetGrade, setTargetGrade] = useState('A')
  const [showWhatIf, setShowWhatIf] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('4lltools:grade-calculator', JSON.stringify(categories)) } catch {}
  }, [categories])

  const addCategory = () => {
    setCategories([...categories, { id: Date.now(), name: `Category ${categories.length + 1}`, weight: 10, assignments: [] }])
  }

  const removeCategory = (id: number) => {
    setCategories(categories.filter(c => c.id !== id))
  }

  const updateCategory = (id: number, field: string, value: string | number) => {
    setCategories(categories.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const addAssignment = (catId: number) => {
    setCategories(categories.map(c => c.id === catId ? {
      ...c, assignments: [...c.assignments, { id: Date.now(), name: `Assignment ${c.assignments.length + 1}`, score: 0, maxScore: 100 }]
    } : c))
  }

  const removeAssignment = (catId: number, assignId: number) => {
    setCategories(categories.map(c => c.id === catId ? { ...c, assignments: c.assignments.filter(a => a.id !== assignId) } : c))
  }

  const updateAssignment = (catId: number, assignId: number, field: string, value: string | number) => {
    setCategories(categories.map(c => c.id === catId ? {
      ...c, assignments: c.assignments.map(a => a.id === assignId ? { ...a, [field]: value } : a)
    } : c))
  }

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0)

  const categoryStats = useMemo(() => {
    return categories.map(cat => {
      const totalScore = cat.assignments.reduce((s, a) => s + a.score, 0)
      const totalMax = cat.assignments.reduce((s, a) => s + a.maxScore, 0)
      const avg = totalMax > 0 ? totalScore / totalMax * 100 : 0
      const weighted = avg * cat.weight / 100
      return { ...cat, avg, weighted, totalScore, totalMax }
    })
  }, [categories])

  const currentGrade = categoryStats.reduce((s, c) => s + c.weighted, 0)
  const earnedWeight = categoryStats.filter(c => c.totalMax > 0).reduce((s, c) => s + c.weight, 0)
  const currentGradeAdjusted = earnedWeight > 0 ? categoryStats.filter(c => c.totalMax > 0).reduce((s, c) => s + c.weighted, 0) / earnedWeight * 100 : 0

  const getLetterGrade = (percentage: number): GradeBand => {
    const bands = GRADE_SCALES[scale]?.bands
    if (!bands || bands.length === 0) return { letter: `${percentage.toFixed(1)}%`, min: 0, gpa: percentage / 25 }
    const band = bands.find(b => percentage >= b.min)
    if (band) return band
    return { letter: scale === 'indonesia' ? 'E' : 'F', min: 0, gpa: 0.0 }
  }

  const currentLetter = getLetterGrade(currentGradeAdjusted)

  const calculateNeeded = () => {
    const remainingWeight = totalWeight - earnedWeight
    if (remainingWeight <= 0) return null
    const band = GRADE_SCALES[scale]?.bands.find(b => b.letter === targetGrade)
    if (!band) return null
    const needed = (band.min * totalWeight - currentGrade * earnedWeight) / remainingWeight
    return Math.max(0, Math.min(100, needed))
  }

  const neededScore = calculateNeeded()

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Grade Calculator</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn" onClick={addCategory}>+ Category</button>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="muted">Scale:</span>
            <select value={scale} onChange={e => setScale(e.target.value)} style={{ minWidth: 200 }}>
              {Object.entries(GRADE_SCALES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b style={{ fontSize: '1.5rem', color: 'var(--accent)' }}><Roll value={currentGrade.toFixed(1)} />%</b><span className="muted">Current Grade</span></div>
        <div className="stat"><b style={{ fontSize: '1.5rem', color: 'var(--ok)' }}>{currentLetter.letter}</b><span className="muted">Letter Grade</span></div>
        <div className="stat"><b style={{ fontSize: '1.5rem' }}>{currentLetter.gpa.toFixed(2)}</b><span className="muted">GPA</span></div>
        <div className="stat"><b><Roll value={earnedWeight} />%</b><span className="muted">Weight Graded</span></div>
        <div className="stat"><b><Roll value={totalWeight} />%</b><span className="muted">Total Weight</span></div>
      </div>

      {totalWeight !== 100 && (
        <div style={{ padding: 12, background: 'var(--danger)10', border: '1px solid var(--danger)40', borderRadius: 'var(--radius)', marginBottom: 16, color: 'var(--danger)' }}>
          ⚠ Total weight is {totalWeight}%, should be 100%
        </div>
      )}

      <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
        {categories.map((cat, ci) => {
          const stats = categoryStats.find(s => s.id === cat.id)!
          return (
            <details key={cat.id} defaultOpen style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <summary style={{ padding: 12, background: 'var(--accent)20', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="text" value={cat.name} onChange={e => updateCategory(cat.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '1rem', minWidth: 150 }} />
                  <input type="number" min={0} max={100} step={0.5} value={cat.weight} onChange={e => updateCategory(cat.id, 'weight', Number(e.target.value))} style={{ width: 70 }} />
                  <span className="muted">% weight</span>
                </div>
                <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                  <span><b>Avg:</b> <Roll value={stats.avg.toFixed(1)} />%</span>
                  <span style={{ color: 'var(--accent)' }}><b>Weighted:</b> <Roll value={stats.weighted.toFixed(1)} />%</span>
                  <button className="btn" onClick={() => addAssignment(cat.id)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>+ Assignment</button>
                  <button className="btn" onClick={() => removeCategory(cat.id)} style={{ padding: '4px 10px', fontSize: '0.8rem', color: 'var(--danger)' }}>Remove</button>
                </div>
              </summary>
              <div style={{ padding: 12 }}>
                {cat.assignments.length === 0 ? (
                  <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No assignments yet</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {cat.assignments.map((assign, ai) => (
                      <div key={assign.id} className="pop-row" style={{
                        display: 'grid', gap: 8, padding: 10,
                        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        gridTemplateColumns: '1fr 80px 80px 80px auto',
                        animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                        animationDelay: `${ai * 30}ms`,
                      }}>
                        <input type="text" value={assign.name} onChange={e => updateAssignment(cat.id, assign.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500 }} />
                        <input type="number" min={0} step={0.1} value={assign.score} onChange={e => updateAssignment(cat.id, assign.id, 'score', Number(e.target.value))} style={{ textAlign: 'right' }} />
                        <span className="muted">/</span>
                        <input type="number" min={1} step={0.1} value={assign.maxScore} onChange={e => updateAssignment(cat.id, assign.id, 'maxScore', Number(e.target.value))} style={{ textAlign: 'right', width: 70 }} />
                        <span className="muted" style={{ textAlign: 'right', minWidth: 60 }}>
                          {assign.maxScore > 0 ? ((assign.score / assign.maxScore) * 100).toFixed(1) : 0}%
                        </span>
                        <button className="btn" onClick={() => removeAssignment(cat.id, assign.id)} style={{ color: 'var(--danger)', justifySelf: 'end', padding: '4px 8px', fontSize: '0.75rem' }}>Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )})}
      </div>

      {showWhatIf && neededScore !== null && (
        <div className="pop-row" style={{ padding: 20, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <h4 style={{ margin: '0 0 12px' }}>What-If Analysis</h4>
          <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="muted">Target Grade:</span>
              <select value={targetGrade} onChange={e => setTargetGrade(e.target.value)}>
                {scale === 'us-4' && <><option value="A">A</option><option value="A-">A-</option><option value="B+">B+</option><option value="B">B</option><option value="B-">B-</option><option value="C+">C+</option><option value="C">C</option><option value="C-">C-</option></>}
                {scale === 'us-4-simple' && <><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></>}
                {scale === 'indonesia' && <><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></>}
                {scale === 'uk' && <><option value="First">First</option><option value="2:1">2:1</option><option value="2:2">2:2</option><option value="Third">Third</option></>}
              </select>
            </label>
            <div style={{ fontSize: '1.2rem' }}>
              Need <b style={{ color: neededScore > 100 ? 'var(--danger)' : neededScore > 90 ? 'var(--accent)' : 'var(--ok)' }}>
                <Roll value={Math.min(100, neededScore).toFixed(1)} />%
              </b> average on remaining {totalWeight - earnedWeight}% of course
            </div>
            {neededScore > 100 && <span style={{ color: 'var(--danger)' }}>Impossible to reach target</span>}
            {neededScore < 0 && <span style={{ color: 'var(--ok)' }}>Target already secured!</span>}
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={showWhatIf} onChange={e => setShowWhatIf(e.target.checked)} />
          <span>Show What-If Calculator</span>
        </label>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Enter categories with weights and assignments. Current grade calculated from completed work. What-if shows needed score on remaining work.
      </p>
    </div>
  )
}