import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer'

interface Question {
  id: number
  type: QuestionType
  text: string
  options: string[]
  correctAnswer: number | number[] | string
  explanation: string
  points: number
}

interface Quiz {
  id: number
  title: string
  questions: Question[]
  timeLimit: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  showExplanations: boolean
}

const SAMPLE_QUIZ: Quiz = {
  id: 1,
  title: 'General Knowledge Quiz',
  timeLimit: 10,
  shuffleQuestions: true,
  shuffleOptions: true,
  showExplanations: true,
  questions: [
    { id: 1, type: 'multiple-choice', text: 'What is the capital of France?', options: ['London', 'Berlin', 'Paris', 'Madrid'], correctAnswer: 2, explanation: 'Paris has been the capital of France since 508 AD.', points: 1 },
    { id: 2, type: 'multiple-choice', text: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctAnswer: 1, explanation: 'Mars appears red due to iron oxide on its surface.', points: 1 },
    { id: 3, type: 'true-false', text: 'The Great Wall of China is visible from space with the naked eye.', options: [], correctAnswer: 0, explanation: 'This is a myth. The Great Wall is not visible from space with the naked eye.', points: 1 },
    { id: 4, type: 'short-answer', text: 'What is the chemical symbol for gold?', options: [], correctAnswer: 'Au', explanation: 'Au comes from the Latin word "aurum" meaning gold.', points: 1 },
  ],
}

export default function QuizGenerator() {
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => {
    try { const saved = localStorage.getItem('4lltools:quiz-generator'); return saved ? JSON.parse(saved) : [SAMPLE_QUIZ] } catch { return [SAMPLE_QUIZ] }
  })
  const [activeQuizId, setActiveQuizId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'take'>('list')
  const [newQuizTitle, setNewQuizTitle] = useState('')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number | number[] | string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('4lltools:quiz-generator', JSON.stringify(quizzes)) } catch {}
  }, [quizzes])

  const activeQuiz = quizzes.find(q => q.id === activeQuizId)

  const shuffledQuestions = useMemo(() => {
    if (!activeQuiz) return []
    const qs = [...activeQuiz.questions]
    if (activeQuiz.shuffleQuestions) {
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[qs[i], qs[j]] = [qs[j], qs[i]]
      }
    }
    return qs.map(q => {
      if (activeQuiz.shuffleOptions && q.type === 'multiple-choice' && q.options.length > 1) {
        const options = [...q.options]
        const correct = q.options[q.correctAnswer as number]
        for (let i = options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[options[i], options[j]] = [options[j], options[i]]
        }
        const newCorrect = options.indexOf(correct)
        return { ...q, options, correctAnswer: newCorrect }
      }
      return q
    })
  }, [activeQuiz])

  const currentQuestion = shuffledQuestions[currentQuestionIndex]

  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      const interval = setInterval(() => setTimeLeft(t => t - 1), 1000)
      return () => clearInterval(interval)
    }
    if (timeLeft === 0 && timerRunning) {
      handleSubmit()
    }
  }, [timerRunning, timeLeft])

  const createQuiz = () => {
    if (!newQuizTitle.trim()) return
    const quiz: Quiz = {
      id: Date.now(),
      title: newQuizTitle,
      questions: [],
      timeLimit: 10,
      shuffleQuestions: true,
      shuffleOptions: true,
      showExplanations: true,
    }
    setQuizzes([...quizzes, quiz])
    setActiveQuizId(quiz.id)
    setViewMode('editor')
    setNewQuizTitle('')
  }

  const deleteQuiz = (id: number) => {
    setQuizzes(quizzes.filter(q => q.id !== id))
    if (activeQuizId === id) setActiveQuizId(null)
  }

  const addQuestion = (type: QuestionType) => {
    if (!activeQuiz) return
    const newQ: Question = {
      id: Date.now(),
      type,
      text: 'New Question',
      options: type === 'multiple-choice' ? ['Option A', 'Option B', 'Option C', 'Option D'] : [],
      correctAnswer: type === 'multiple-choice' ? 0 : type === 'true-false' ? 0 : '',
      explanation: '',
      points: 1,
    }
    setQuizzes(quizzes.map(q => q.id === activeQuizId ? { ...q, questions: [...q.questions, newQ] } : q))
  }

  const removeQuestion = (quizId: number, qId: number) => {
    setQuizzes(quizzes.map(q => q.id === quizId ? { ...q, questions: q.questions.filter(qn => qn.id !== qId) } : q))
  }

  const updateQuestion = (quizId: number, qId: number, field: string, value: any) => {
    setQuizzes(quizzes.map(q => q.id === quizId ? {
      ...q, questions: q.questions.map(qn => qn.id === qId ? { ...qn, [field]: value } : qn)
    } : q))
  }

  const startQuiz = (quizId: number) => {
    setActiveQuizId(quizId)
    setCurrentQuestionIndex(0)
    setAnswers({})
    setSubmitted(false)
    const quiz = quizzes.find(q => q.id === quizId)!
    setTimeLeft(quiz.timeLimit * 60)
    setTimerRunning(true)
    setViewMode('take')
  }

  const handleAnswer = (questionId: number, answer: number | number[] | string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  const nextQuestion = () => {
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      setCurrentQuestionIndex(i => i + 1)
    }
  }

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(i => i - 1)
    }
  }

  const handleSubmit = () => {
    setSubmitted(true)
    setTimerRunning(false)
  }

  const calculateScore = () => {
    if (!activeQuiz) return { score: 0, total: 0, percent: 0 }
    let score = 0
    let total = 0
    activeQuiz.questions.forEach(q => {
      total += q.points
      const userAnswer = answers[q.id]
      if (userAnswer !== undefined) {
        if (q.type === 'multiple-choice' || q.type === 'true-false') {
          if (userAnswer === q.correctAnswer) score += q.points
        } else if (q.type === 'short-answer') {
          if (typeof userAnswer === 'string' && userAnswer.toLowerCase().trim() === (q.correctAnswer as string).toLowerCase().trim()) {
            score += q.points
          }
        }
      }
    })
    return { score, total, percent: total > 0 ? Math.round((score / total) * 100) : 0 }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (viewMode === 'list') {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Quiz Generator</h3>
          <div className="row" style={{ gap: 8 }}>
            <input type="text" placeholder="New quiz title" value={newQuizTitle} onChange={e => setNewQuizTitle(e.target.value)} style={{ width: 200 }} />
            <button className="btn" onClick={createQuiz}>Create Quiz</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {quizzes.map((quiz, i) => (
            <div key={quiz.id} className="pop-row" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 60}ms`,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{quiz.title}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {quiz.questions.length} questions · {quiz.timeLimit} min limit
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={() => startQuiz(quiz.id)}>Take Quiz</button>
                <button className="btn" onClick={() => { setActiveQuizId(quiz.id); setViewMode('editor') }}>Edit</button>
                <button className="btn" onClick={() => deleteQuiz(quiz.id)} style={{ color: 'var(--danger)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Create quizzes with multiple choice, true/false, and short answer questions. Timer, shuffle, and auto-scoring included.
        </p>
      </div>
    )
  }

  if (viewMode === 'editor') {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <button className="btn" onClick={() => setViewMode('list')}>← Back to Quizzes</button>
          <h3 style={{ margin: 0 }}>{activeQuiz?.title}</h3>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => startQuiz(activeQuiz!.id)}>Preview / Take</button>
          </div>
        </div>

        <div style={{ marginBottom: 16, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Quiz Settings</h4>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Time Limit (minutes, 0 = no limit)</span>
              <input type="number" min={0} max={120} value={activeQuiz?.timeLimit || 10} onChange={e => updateQuestion(activeQuiz!.id, 0, 'timeLimit', Number(e.target.value))} style={{ width: 100 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={activeQuiz?.shuffleQuestions} onChange={e => updateQuestion(activeQuiz!.id, 0, 'shuffleQuestions', e.target.checked)} />
              <span>Shuffle Questions</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={activeQuiz?.shuffleOptions} onChange={e => updateQuestion(activeQuiz!.id, 0, 'shuffleOptions', e.target.checked)} />
              <span>Shuffle Options</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={activeQuiz?.showExplanations} onChange={e => updateQuestion(activeQuiz!.id, 0, 'showExplanations', e.target.checked)} />
              <span>Show Explanations After</span>
            </label>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {activeQuiz?.questions.map((question, qi) => (
            <details key={question.id} defaultOpen style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <summary style={{ padding: 12, background: 'var(--accent)20', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>Q{qi + 1}</span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--accent)20', color: 'var(--accent)', borderRadius: 4 }}>
                    {question.type === 'multiple-choice' ? 'Multiple Choice' : question.type === 'true-false' ? 'True/False' : 'Short Answer'}
                  </span>
                  <span className="muted">{question.points} pts</span>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn" onClick={() => addQuestion('multiple-choice')} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>+ MC</button>
                  <button className="btn" onClick={() => addQuestion('true-false')} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>+ T/F</button>
                  <button className="btn" onClick={() => addQuestion('short-answer')} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>+ SA</button>
                  <button className="btn" onClick={() => removeQuestion(activeQuiz!.id, question.id)} style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--danger)' }}>Delete</button>
                </div>
              </summary>
              <div style={{ padding: 12, display: 'grid', gap: 12 }}>
                <textarea value={question.text} onChange={e => updateQuestion(activeQuiz!.id, question.id, 'text', e.target.value)} placeholder="Question text" rows={2} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'inherit', resize: 'vertical', width: '100%' }} />
                <input type="number" min={1} max={10} value={question.points} onChange={e => updateQuestion(activeQuiz!.id, question.id, 'points', Number(e.target.value))} placeholder="Points" style={{ width: 80 }} />

                {question.type === 'multiple-choice' && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {question.options.map((opt, oi) => (
                      <div key={oi} className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                          <input type="radio" name={`mc-${question.id}`} checked={question.correctAnswer === oi} onChange={() => updateQuestion(activeQuiz!.id, question.id, 'correctAnswer', oi)} />
                          <input type="text" value={opt} onChange={e => updateQuestion(activeQuiz!.id, question.id, 'options', question.options.map((o, i) => i === oi ? e.target.value : o))} style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)' }} />
                        </label>
                        <button className="btn" onClick={() => updateQuestion(activeQuiz!.id, question.id, 'options', question.options.filter((_, i) => i !== oi))} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>Remove</button>
                      </div>
                    ))}
                    <button className="btn" onClick={() => updateQuestion(activeQuiz!.id, question.id, 'options', [...question.options, `Option ${question.options.length + 1}`])} style={{ justifySelf: 'start', padding: '4px 12px', fontSize: '0.8rem' }}>+ Add Option</button>
                  </div>
                )}

                {question.type === 'true-false' && (
                  <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="radio" name={`tf-${question.id}`} value={1} checked={question.correctAnswer === 1} onChange={() => updateQuestion(activeQuiz!.id, question.id, 'correctAnswer', 1)} />
                      <span>True</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="radio" name={`tf-${question.id}`} value={0} checked={question.correctAnswer === 0} onChange={() => updateQuestion(activeQuiz!.id, question.id, 'correctAnswer', 0)} />
                      <span>False</span>
                    </label>
                  </div>
                )}

                {question.type === 'short-answer' && (
                  <input type="text" value={question.correctAnswer as string} onChange={e => updateQuestion(activeQuiz!.id, question.id, 'correctAnswer', e.target.value)} placeholder="Correct answer (case-insensitive)" style={{ width: '100%' }} />
                )}

                <textarea value={question.explanation} onChange={e => updateQuestion(activeQuiz!.id, question.id, 'explanation', e.target.value)} placeholder="Explanation (shown after answer if enabled)" rows={2} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'inherit', resize: 'vertical', width: '100%' }} />
              </div>
            </details>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Add questions of different types. Set correct answers. Explanations shown after submission if enabled. Timer optional.
        </p>
      </div>
    )
  }

  if (viewMode === 'take') {
    const result = calculateScore()

    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
          <button className="btn" onClick={() => { setViewMode('list'); setTimerRunning(false) }} disabled={!submitted && timerRunning}>← Back</button>
          <h3 style={{ margin: 0 }}>{activeQuiz?.title}</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: timeLeft < 60 ? 'var(--danger)' : 'var(--text)' }}>
            {timeLeft > 0 ? formatTime(timeLeft) : 'Submitted'}
          </div>
        </div>

        {submitted ? (
          <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: result.percent >= 70 ? 'var(--ok)' : 'var(--danger)', marginBottom: 8 }}>
              <Roll value={result.percent} />%
            </div>
            <div style={{ fontSize: '1.2rem', marginBottom: 16 }}>
              <b><Roll value={result.score} /></b> / <b><Roll value={result.total} /></b> points
            </div>
            <div className="muted" style={{ marginBottom: 16 }}>
              {result.percent >= 90 ? 'Excellent!' : result.percent >= 70 ? 'Good job!' : result.percent >= 50 ? 'Keep practicing!' : 'Need more study'}
            </div>
            <button className="btn" onClick={() => { setViewMode('list'); setTimerRunning(false) }}>Back to Quizzes</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>Question {currentQuestionIndex + 1} / {shuffledQuestions.length}</span>
                  <span className="muted">{currentQuestion?.points} pts</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" onClick={prevQuestion} disabled={currentQuestionIndex === 0}>Previous</button>
                  <button className="btn" onClick={nextQuestion} disabled={currentQuestionIndex === shuffledQuestions.length - 1}>Next</button>
                  <button className="btn" onClick={handleSubmit} style={{ background: 'var(--ok)' }}>Submit</button>
                </div>
              </div>

              {currentQuestion && (
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: 16 }}>
                    {currentQuestion.text}
                  </div>

                  {currentQuestion.type === 'multiple-choice' && (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {currentQuestion.options.map((opt, oi) => (
                        <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                          <input type="radio" name="answer" checked={answers[currentQuestion.id] === oi} onChange={() => handleAnswer(currentQuestion.id, oi)} />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === 'true-false' && (
                    <div className="row" style={{ gap: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <input type="radio" name="tf" value={1} checked={answers[currentQuestion.id] === 1} onChange={() => handleAnswer(currentQuestion.id, 1)} />
                        <span>True</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <input type="radio" name="tf" value={0} checked={answers[currentQuestion.id] === 0} onChange={() => handleAnswer(currentQuestion.id, 0)} />
                        <span>False</span>
                      </label>
                    </div>
                  )}

                  {currentQuestion.type === 'short-answer' && (
                    <input type="text" value={(answers[currentQuestion.id] as string) || ''} onChange={e => handleAnswer(currentQuestion.id, e.target.value)} placeholder="Type your answer..." style={{ width: '100%', padding: 12, fontSize: '1rem' }} />
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {shuffledQuestions.map((q, i) => (
                <button key={q.id} className="btn" onClick={() => setCurrentQuestionIndex(i)} style={{
                  padding: '8px 12px', minWidth: 40,
                  background: i === currentQuestionIndex ? 'var(--accent)' : answers[q.id] !== undefined ? 'var(--ok)' : 'var(--bg)',
                  color: i === currentQuestionIndex ? 'white' : answers[q.id] !== undefined ? 'white' : 'var(--text)',
                  border: i === currentQuestionIndex ? '2px solid var(--accent)' : '1px solid var(--border)',
                }}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}