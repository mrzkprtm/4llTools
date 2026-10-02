import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Formula {
  id: number
  category: string
  name: string
  latex: string
  description: string
  variables: string
  tags: string[]
}

const FORMULAS: Formula[] = [
  // Algebra
  { id: 1, category: 'Algebra', name: 'Quadratic Formula', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', description: 'Solutions for ax^2 + bx + c = 0', variables: 'a, b, c: coefficients', tags: ['quadratic', 'roots'] },
  { id: 2, category: 'Algebra', name: 'Difference of Squares', latex: 'a^2 - b^2 = (a - b)(a + b)', description: 'Factorization identity', variables: 'a, b: any expressions', tags: ['factorization'] },
  { id: 3, category: 'Algebra', name: 'Binomial Theorem', latex: '(a + b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k', description: 'Expansion of binomial powers', variables: 'n: positive integer', tags: ['expansion', 'combinatorics'] },
  { id: 4, category: 'Algebra', name: 'Sum of Arithmetic Series', latex: 'S_n = \\frac{n}{2}(2a + (n-1)d) = \\frac{n}{2}(a + l)', description: 'Sum of first n terms', variables: 'a: first term, d: difference, l: last term', tags: ['series', 'sequence'] },
  { id: 5, category: 'Algebra', name: 'Sum of Geometric Series', latex: 'S_n = a\\frac{1 - r^n}{1 - r} \\quad (r \\neq 1)', description: 'Sum of first n terms', variables: 'a: first term, r: ratio', tags: ['series', 'sequence'] },
  { id: 6, category: 'Algebra', name: 'Logarithm Properties', latex: '\\log_b(xy) = \\log_b x + \\log_b y \\quad \\log_b(x/y) = \\log_b x - \\log_b y \\quad \\log_b(x^n) = n\\log_b x', description: 'Basic log rules', variables: 'b: base, x,y: positive', tags: ['logarithm'] },

  // Calculus
  { id: 7, category: 'Calculus', name: 'Power Rule', latex: '\\frac{d}{dx} x^n = nx^{n-1}', description: 'Derivative of power function', variables: 'n: real number', tags: ['derivative'] },
  { id: 8, category: 'Calculus', name: 'Product Rule', latex: "\\frac{d}{dx}[f(x)g(x)] = f'(x)g(x) + f(x)g'(x)", description: 'Derivative of product', variables: 'f,g: differentiable functions', tags: ['derivative'] },
  { id: 9, category: 'Calculus', name: 'Quotient Rule', latex: '\\frac{d}{dx}[\\frac{f(x)}{g(x)}] = \\frac{f\'(x)g(x) - f(x)g\'(x)}{[g(x)]^2}', description: 'Derivative of quotient', variables: 'f,g: differentiable, g\\neq0', tags: ['derivative'] },
  { id: 10, category: 'Calculus', name: 'Chain Rule', latex: "\\frac{d}{dx}f(g(x)) = f'(g(x)) \\cdot g'(x)", description: 'Derivative of composition', variables: 'f,g: differentiable', tags: ['derivative'] },
  { id: 11, category: 'Calculus', name: 'Integration by Parts', latex: '\\int u \\, dv = uv - \\int v \\, du', description: 'Integral of product', variables: 'u,v: functions of x', tags: ['integral'] },
  { id: 12, category: 'Calculus', name: 'Fundamental Theorem', latex: "\\int_a^b f(x) \\, dx = F(b) - F(a) \\quad \\text{where } F' = f", description: 'Definite integral via antiderivative', variables: 'F: antiderivative of f', tags: ['integral'] },
  { id: 13, category: 'Calculus', name: 'Taylor Series', latex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n', description: 'Function as infinite series', variables: 'a: center point', tags: ['series', 'approximation'] },
  { id: 14, category: 'Calculus', name: "L'Hopital's Rule", latex: '\\lim_{x\\to c} \\frac{f(x)}{g(x)} = \\lim_{x\\to c} \\frac{f\'(x)}{g\'(x)}', description: 'Indeterminate forms 0/0, infinity/infinity', variables: 'f,g: differentiable', tags: ['limit'] },

  // Trigonometry
  { id: 15, category: 'Trigonometry', name: 'Pythagorean Identity', latex: '\\sin^2\\theta + \\cos^2\\theta = 1', description: 'Fundamental identity', variables: 'theta: angle', tags: ['identity'] },
  { id: 16, category: 'Trigonometry', name: 'Angle Sum/Difference', latex: '\\sin(a\\pm b) = \\sin a\\cos b \\pm \\cos a\\sin b \\quad \\cos(a\\pm b) = \\cos a\\cos b \\mp \\sin a\\sin b', description: 'Sum/difference formulas', variables: 'a,b: angles', tags: ['identity'] },
  { id: 17, category: 'Trigonometry', name: 'Double Angle', latex: '\\sin 2\\theta = 2\\sin\\theta\\cos\\theta \\quad \\cos 2\\theta = \\cos^2\\theta - \\sin^2\\theta', description: 'Double angle formulas', variables: 'theta: angle', tags: ['identity'] },
  { id: 18, category: 'Trigonometry', name: 'Law of Sines', latex: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C} = 2R', description: 'Triangle side-angle relation', variables: 'a,b,c: sides, A,B,C: angles, R: circumradius', tags: ['triangle'] },
  { id: 19, category: 'Trigonometry', name: 'Law of Cosines', latex: 'c^2 = a^2 + b^2 - 2ab\\cos C', description: 'Generalized Pythagorean', variables: 'a,b,c: sides, C: included angle', tags: ['triangle'] },

  // Geometry
  { id: 20, category: 'Geometry', name: 'Circle Area/Circumference', latex: 'A = \\pi r^2 \\quad C = 2\\pi r', description: 'Circle measurements', variables: 'r: radius', tags: ['circle'] },
  { id: 21, category: 'Geometry', name: 'Sphere Volume/Surface', latex: 'V = \\frac{4}{3}\\pi r^3 \\quad A = 4\\pi r^2', description: 'Sphere measurements', variables: 'r: radius', tags: ['sphere'] },
  { id: 22, category: 'Geometry', name: 'Cylinder Volume/Surface', latex: 'V = \\pi r^2 h \\quad A = 2\\pi r(r + h)', description: 'Cylinder measurements', variables: 'r: radius, h: height', tags: ['cylinder'] },
  { id: 23, category: 'Geometry', name: 'Triangle Area (Heron)', latex: 'A = \\sqrt{s(s-a)(s-b)(s-c)} \\quad s = \\frac{a+b+c}{2}', description: 'Area from three sides', variables: 'a,b,c: sides, s: semiperimeter', tags: ['triangle'] },

  // Physics - Mechanics
  { id: 24, category: 'Physics: Mechanics', name: "Newton's Second Law", latex: '\\vec{F} = m\\vec{a}', description: 'Force equals mass times acceleration', variables: 'F: force, m: mass, a: acceleration', tags: ['force', 'motion'] },
  { id: 25, category: 'Physics: Mechanics', name: 'Kinematic Equations', latex: 'v = u + at \\quad s = ut + \\frac{1}{2}at^2 \\quad v^2 = u^2 + 2as', description: 'Constant acceleration motion', variables: 'u: initial v, v: final v, a: accel, t: time, s: displacement', tags: ['kinematics'] },
  { id: 25, category: 'Physics: Mechanics', name: 'Work-Energy Theorem', latex: 'W = \\Delta K = \\frac{1}{2}mv_f^2 - \\frac{1}{2}mv_i^2', description: 'Work equals change in kinetic energy', variables: 'W: work, K: kinetic energy', tags: ['energy', 'work'] },
  { id: 26, category: 'Physics: Mechanics', name: 'Conservation of Energy', latex: 'K_i + U_i = K_f + U_f', description: 'Total mechanical energy conserved', variables: 'K: kinetic, U: potential', tags: ['energy'] },
  { id: 27, category: 'Physics: Mechanics', name: 'Momentum', latex: '\\vec{p} = m\\vec{v} \\quad \\Delta\\vec{p} = \\vec{J} = \\int \\vec{F} \\, dt', description: 'Momentum and impulse', variables: 'p: momentum, J: impulse', tags: ['momentum'] },
  { id: 28, category: 'Physics: Mechanics', name: 'Circular Motion', latex: 'a_c = \\frac{v^2}{r} = \\omega^2 r \\quad F_c = \\frac{mv^2}{r}', description: 'Centripetal acceleration/force', variables: 'v: speed, r: radius, omega: angular velocity', tags: ['circular'] },
  { id: 29, category: 'Physics: Mechanics', name: 'Gravitational Force', latex: 'F = G\\frac{m_1 m_2}{r^2} \\quad G = 6.674\\times 10^{-11} \\, \\text{N m}^2/\\text{kg}^2', description: "Newton's law of gravitation", variables: 'm: masses, r: distance', tags: ['gravity'] },
  { id: 30, category: 'Physics: Mechanics', name: 'Simple Harmonic Motion', latex: 'x(t) = A\\cos(\\omega t + \\phi) \\quad \\omega = \\sqrt{\\frac{k}{m}}', description: 'Mass-spring system', variables: 'A: amplitude, omega: angular freq, k: spring const, phi: phase', tags: ['oscillation'] },

  // Physics - Thermodynamics
  { id: 31, category: 'Physics: Thermodynamics', name: 'Ideal Gas Law', latex: 'PV = nRT', description: 'State equation for ideal gas', variables: 'P: pressure, V: volume, n: moles, R: 8.314 J/mol K, T: temp', tags: ['gas'] },
  { id: 32, category: 'Physics: Thermodynamics', name: 'First Law', latex: '\\Delta U = Q - W', description: 'Energy conservation', variables: 'U: internal energy, Q: heat added, W: work done by system', tags: ['energy'] },
  { id: 33, category: 'Physics: Thermodynamics', name: 'Carnot Efficiency', latex: '\\eta = 1 - \\frac{T_c}{T_h}', description: 'Maximum heat engine efficiency', variables: 'T_c: cold temp, T_h: hot temp (Kelvin)', tags: ['engine', 'efficiency'] },

  // Physics - Electromagnetism
  { id: 34, category: 'Physics: Electromagnetism', name: "Coulomb's Law", latex: 'F = k\\frac{|q_1 q_2|}{r^2} \\quad k = 8.99\\times 10^9 \\, \\text{N m}^2/\\text{C}^2', description: 'Electrostatic force', variables: 'q: charges, r: distance', tags: ['electric'] },
  { id: 35, category: 'Physics: Electromagnetism', name: "Ohm's Law", latex: 'V = IR \\quad P = VI = I^2R = \\frac{V^2}{R}', description: 'Voltage, current, resistance, power', variables: 'V: voltage, I: current, R: resistance, P: power', tags: ['circuit'] },
  { id: 36, category: 'Physics: Electromagnetism', name: "Maxwell's Equations", latex: '\\nabla\\cdot\\vec{E} = \\frac{\\rho}{\\epsilon_0} \\quad \\nabla\\cdot\\vec{B} = 0 \\quad \\nabla\\times\\vec{E} = -\\frac{\\partial\\vec{B}}{\\partial t} \\quad \\nabla\\times\\vec{B} = \\mu_0\\vec{J} + \\mu_0\\epsilon_0\\frac{\\partial\\vec{E}}{\\partial t}', description: 'Foundation of electromagnetism', variables: 'E: electric field, B: magnetic field, rho: charge density, J: current density', tags: ['field'] },
  { id: 37, category: 'Physics: Electromagnetism', name: "Faraday's Law", latex: '\\mathcal{E} = -\\frac{d\\Phi_B}{dt}', description: 'Induced EMF from changing flux', variables: 'EMF: EMF, Phi_B: magnetic flux', tags: ['induction'] },

  // Chemistry
  { id: 38, category: 'Chemistry', name: 'Molarity', latex: 'M = \\frac{n}{V} \\quad n = \\frac{m}{M_m}', description: 'Concentration of solution', variables: 'M: molarity, n: moles, V: volume(L), m: mass, M_m: molar mass', tags: ['solution'] },
  { id: 39, category: 'Chemistry', name: 'Ideal Gas (Chem)', latex: 'PV = nRT', description: 'Same as physics', variables: 'P: atm, V: L, n: mol, R: 0.0821 L atm/mol K, T: K', tags: ['gas'] },
  { id: 40, category: 'Chemistry', name: 'pH/pOH', latex: '\\text{pH} = -\\log_{10}[H^+] \\quad \\text{pOH} = -\\log_{10}[OH^-] \\quad \\text{pH} + \\text{pOH} = 14', description: 'Acidity/basicity', variables: '[H+]: H+ concentration, [OH-]: OH- concentration', tags: ['acid', 'base'] },
  { id: 41, category: 'Chemistry', name: 'Nernst Equation', latex: 'E = E^\\circ - \\frac{RT}{nF}\\ln Q', description: 'Cell potential at non-standard conditions', variables: 'E0: standard potential, n: electrons, F: 96485 C/mol, Q: reaction quotient', tags: ['electrochemistry'] },
  { id: 42, category: 'Chemistry', name: 'Rate Law', latex: 'rate = k[A]^m[B]^n', description: 'Reaction rate', variables: 'k: rate constant, m,n: orders, [A],[B]: concentrations', tags: ['kinetics'] },
  { id: 43, category: 'Chemistry', name: 'Arrhenius Equation', latex: 'k = Ae^{-E_a/RT}', description: 'Temperature dependence of rate', variables: 'A: pre-exponential, E_a: activation energy, R: 8.314 J/mol K', tags: ['kinetics'] },
  { id: 44, category: 'Chemistry', name: 'Henderson-Hasselbalch', latex: '\\text{pH} = \\text{p}K_a + \\log_{10}\\frac{[A^-]}{[HA]}', description: 'Buffer pH', variables: 'pKa: -log Ka, [A-]: conjugate base, [HA]: weak acid', tags: ['buffer', 'acid-base'] },

  // Statistics
  { id: 45, category: 'Statistics', name: 'Mean (Arithmetic)', latex: '\\bar{x} = \\frac{1}{n}\\sum_{i=1}^n x_i', description: 'Average', variables: 'x_i: data points, n: count', tags: ['central tendency'] },
  { id: 46, category: 'Statistics', name: 'Standard Deviation', latex: '\\sigma = \\sqrt{\\frac{1}{N}\\sum(x_i - \\mu)^2} \\quad s = \\sqrt{\\frac{1}{n-1}\\sum(x_i - \\bar{x})^2}', description: 'Spread of data (population vs sample)', variables: 'mu: population mean, xbar: sample mean', tags: ['dispersion'] },
  { id: 47, category: 'Statistics', name: 'Variance', latex: '\\sigma^2 = \\frac{1}{N}\\sum(x_i - \\mu)^2', description: 'Average squared deviation', variables: 'sigma^2: variance', tags: ['dispersion'] },
  { id: 48, category: 'Statistics', name: 'Z-Score', latex: 'z = \\frac{x - \\mu}{\\sigma}', description: 'Standardized score', variables: 'x: value, mu: mean, sigma: std dev', tags: ['normalization'] },
  { id: 49, category: 'Statistics', name: 'Binomial Distribution', latex: 'P(X = k) = \\binom{n}{k} p^k (1-p)^{n-k}', description: 'k successes in n trials', variables: 'n: trials, p: success prob, k: successes', tags: ['probability'] },
  { id: 50, category: 'Statistics', name: 'Normal Distribution', latex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}', description: 'Gaussian bell curve', variables: 'mu: mean, sigma: std dev', tags: ['probability'] },
  { id: 51, category: 'Statistics', name: 'Correlation Coefficient', latex: 'r = \\frac{\\sum(x_i - \\bar{x})(y_i - \\bar{y})}{\\sqrt{\\sum(x_i - \\bar{x})^2\\sum(y_i - \\bar{y})^2}}', description: 'Linear relationship strength', variables: 'x,y: paired data', tags: ['correlation'] },
  { id: 52, category: 'Statistics', name: 'Linear Regression', latex: '\\hat{y} = a + bx \\quad b = \\frac{\\sum(x_i - \\bar{x})(y_i - \\bar{y})}{\\sum(x_i - \\bar{x})^2} \\quad a = \\bar{y} - b\\bar{x}', description: 'Best fit line', variables: 'a: intercept, b: slope', tags: ['regression'] },
]

const CATEGORIES = [...new Set(FORMULAS.map(f => f.category))].sort()

export default function FormulaSheet() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [favorites, setFavorites] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:formula-sheet-favs')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try { localStorage.setItem('4lltools:formula-sheet-favs', JSON.stringify(favorites)) } catch {}
  }, [favorites])

  const filtered = useMemo(() => {
    return FORMULAS.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.description.toLowerCase().includes(search.toLowerCase()) ||
        f.latex.toLowerCase().includes(search.toLowerCase()) ||
        f.variables.toLowerCase().includes(search.toLowerCase()) ||
        f.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
      const matchesCat = selectedCategory === 'All' || f.category === selectedCategory
      return matchesSearch && matchesCat
    })
  }, [search, selectedCategory])

  const toggleFav = (id: number) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  const copyLatex = (latex: string) => {
    navigator.clipboard.writeText(latex)
  }

  const grouped = useMemo(() => {
    const groups: Record<string, Formula[]> = {}
    filtered.forEach(f => {
      if (!groups[f.category]) groups[f.category] = []
      groups[f.category].push(f)
    })
    return groups
  }, [filtered])

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Formula Sheet</h3>
        <div className="row" style={{ gap: 8 }}>
          <input type="text" placeholder="Search formulas..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 250 }} />
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={{ minWidth: 180 }}>
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll value={FORMULAS.length} /></b><span className="muted">Total Formulas</span></div>
        <div className="stat"><b><Roll value={filtered.length} /></b><span className="muted">Showing</span></div>
        <div className="stat"><b><Roll value={favorites.length} /></b><span className="muted">Favorites</span></div>
        <div className="stat"><b><Roll value={CATEGORIES.length} /></b><span className="muted">Categories</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {CATEGORIES.filter(c => grouped[c] && grouped[c].length > 0).map((category, ci) => (
          <details key={category} defaultOpen style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <summary style={{ padding: 12, background: 'var(--accent)20', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{category}</span>
              <span className="muted">{grouped[category]?.length || 0} formulas</span>
            </summary>
            <div style={{ padding: 12, display: 'grid', gap: 12 }}>
              {grouped[category]?.map((formula, fi) => (
                <div key={formula.id} className="pop-row" style={{
                  display: 'grid', gap: 8, padding: 12,
                  background: favorites.includes(formula.id) ? 'var(--accent)10' : 'var(--bg)',
                  border: favorites.includes(formula.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${fi * 30}ms`,
                }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1rem' }}>{formula.name}</div>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>{formula.description}</div>
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn" onClick={() => toggleFav(formula.id)} style={{ padding: '4px 8px', fontSize: '0.75rem', background: favorites.includes(formula.id) ? 'var(--accent)' : 'var(--bg)', color: favorites.includes(formula.id) ? 'white' : 'var(--text)' }}>
                        {favorites.includes(formula.id) ? '★' : '☆'}
                      </button>
                      <button className="btn" onClick={() => copyLatex(formula.latex)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Copy LaTeX</button>
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 4,
                    padding: 12, overflowX: 'auto', fontFamily: 'var(--mono)', fontSize: '0.9rem'
                  }}>
                    ${formula.latex}$
                  </div>

                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    <b>Variables:</b> {formula.variables}
                  </div>

                  {formula.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {formula.tags.map(tag => (
                        <span key={tag} style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--accent)20', color: 'var(--accent)', borderRadius: 12 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        50+ formulas across math, physics, chemistry, statistics. Click star to favorite. Copy LaTeX for use in editors. Search by name, description, or tags.
      </p>
    </div>
  )
}