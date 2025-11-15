import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { studentsAPI, lessonsAPI } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './StudentDetail.css'

function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [lessons, setLessons] = useState([])
  const [progress, setProgress] = useState([])
  const [loading, setLoading] = useState(true)
  const [studentMenuOpen, setStudentMenuOpen] = useState(false)
  const [lessonMenusOpen, setLessonMenusOpen] = useState({})

  useEffect(() => {
    loadData()
    // Закрываем меню при изменении id
    setStudentMenuOpen(false)
    setLessonMenusOpen({})
  }, [id])
  
  // Закрываем меню при клике вне его
  useEffect(() => {
    const handleClickOutside = () => {
      setStudentMenuOpen(false)
      setLessonMenusOpen({})
    }
    
    if (studentMenuOpen || Object.values(lessonMenusOpen).some(open => open)) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [studentMenuOpen, lessonMenusOpen])

  const loadData = async () => {
    try {
      setLoading(true)
      const [studentRes, lessonsRes, progressRes] = await Promise.all([
        studentsAPI.getById(id),
        lessonsAPI.getByStudent(id),
        lessonsAPI.getProgress(id)
      ])
      setStudent(studentRes.data)
      setLessons(lessonsRes.data)
      setProgress(progressRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLesson = async (lessonId, lessonName) => {
    if (!window.confirm(`Вы уверены, что хотите удалить урок "${lessonName}"?\n\nЭто действие удалит урок и всю связанную статистику.`)) {
      return
    }

    try {
      await lessonsAPI.delete(lessonId)
      // Перезагружаем данные
      loadData()
    } catch (err) {
      alert('Ошибка при удалении урока: ' + (err.response?.data?.error || err.message))
      console.error(err)
    }
  }

  if (loading) {
    return <div className="card">Загрузка...</div>
  }

  if (!student) {
    return <div className="card">Ученик не найден</div>
  }

  const studentName = `${student.last_name} ${student.first_name} ${student.middle_name || ''}`.trim()

  // Подготовка данных для графика
  const chartData = progress.map(session => ({
    date: new Date(session.started_at).toLocaleDateString('ru-RU'),
    correct: session.correct_attempts || 0,
    total: session.total_attempts || 0,
    accuracy: session.total_attempts > 0 
      ? Math.round((session.correct_attempts / session.total_attempts) * 100) 
      : 0
  }))

  return (
    <div>
      <div className="card">
        <div className="student-detail-header">
          <div>
            <Link to="/students" className="back-link">← Назад к списку</Link>
            <h2>{studentName}</h2>
            <p className="student-meta">
              Зарегистрирован: {new Date(student.created_at).toLocaleDateString('ru-RU')}
            </p>
          </div>
          <div className="header-actions">
            <div className="menu-container">
              <button 
                className="hamburger-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setStudentMenuOpen(!studentMenuOpen)
                }}
                aria-label="Меню"
              >
                ☰
              </button>
              {studentMenuOpen && (
                <div className="dropdown-menu">
                  <Link 
                    to={`/students/${id}/edit`} 
                    className="dropdown-item"
                    onClick={() => setStudentMenuOpen(false)}
                  >
                    ✏️ Редактировать
                  </Link>
                  <button
                    className="dropdown-item danger"
                    onClick={async () => {
                      if (window.confirm(`Вы уверены, что хотите удалить ученика "${studentName}"?\n\nЭто действие удалит ученика и все связанные уроки.`)) {
                        try {
                          await studentsAPI.delete(id)
                          navigate('/students')
                        } catch (err) {
                          alert('Ошибка при удалении ученика: ' + (err.response?.data?.error || err.message))
                        }
                      }
                      setStudentMenuOpen(false)
                    }}
                  >
                    🗑️ Удалить
                  </button>
                </div>
              )}
            </div>
            <Link 
              to={`/students/${id}/lessons/new`} 
              className="btn btn-primary"
            >
              + Создать урок
            </Link>
          </div>
        </div>
      </div>

      {lessons.length > 0 && (
        <div className="card">
          <h3>Уроки</h3>
          <div className="lessons-list">
            {lessons.map(lesson => (
              <div key={lesson.id} className="lesson-item">
                <div className="lesson-info">
                  <h4>{lesson.name}</h4>
                  {lesson.description && <p>{lesson.description}</p>}
                  {lesson.target_sounds && (
                    <p className="target-sounds">
                      <strong>Проблемные звуки:</strong> {lesson.target_sounds}
                    </p>
                  )}
                  <p className="lesson-date">
                    Создан: {new Date(lesson.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div className="lesson-actions">
                  <Link 
                    to={`/lessons/${lesson.id}`} 
                    className="btn btn-success"
                  >
                    Начать урок
                  </Link>
                  <div className="menu-container">
                    <button 
                      className="hamburger-btn btn-small"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setLessonMenusOpen(prev => ({
                          ...prev,
                          [lesson.id]: !prev[lesson.id]
                        }))
                      }}
                      aria-label="Меню урока"
                    >
                      ☰
                    </button>
                    {lessonMenusOpen[lesson.id] && (
                      <div className="dropdown-menu">
                        <Link 
                          to={`/lessons/${lesson.id}/edit`} 
                          className="dropdown-item"
                          onClick={() => setLessonMenusOpen(prev => ({ ...prev, [lesson.id]: false }))}
                        >
                          ✏️ Редактировать
                        </Link>
                        <button
                          className="dropdown-item danger"
                          onClick={(e) => {
                            e.preventDefault()
                            setLessonMenusOpen(prev => ({ ...prev, [lesson.id]: false }))
                            handleDeleteLesson(lesson.id, lesson.name)
                          }}
                        >
                          🗑️ Удалить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {progress.length > 0 && (
        <div className="card">
          <h3>Прогресс</h3>
          <div className="progress-chart">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="#FF6B9D" 
                  name="Точность %"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="correct" 
                  stroke="#4ECDC4" 
                  name="Правильных ответов"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="progress-stats">
            {progress.map((session, idx) => (
              <div key={session.session_id} className="progress-item">
                <div className="progress-date">
                  {new Date(session.started_at).toLocaleDateString('ru-RU')}
                </div>
                <div className="progress-details">
                  <span>Урок: {session.lesson_name}</span>
                  <span>
                    Правильно: {session.correct_attempts} / {session.total_attempts}
                  </span>
                  <span>
                    Точность: {session.total_attempts > 0 
                      ? Math.round((session.correct_attempts / session.total_attempts) * 100) 
                      : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lessons.length === 0 && (
        <div className="card">
          <p>У этого ученика пока нет уроков.</p>
          <Link 
            to={`/students/${id}/lessons/new`} 
            className="btn btn-primary"
          >
            Создать первый урок
          </Link>
        </div>
      )}
    </div>
  )
}

export default StudentDetail

