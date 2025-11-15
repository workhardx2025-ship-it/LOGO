import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { studentsAPI } from '../api'
import './StudentsList.css'

function StudentsList() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [menusOpen, setMenusOpen] = useState({})

  useEffect(() => {
    loadStudents()
  }, [])
  
  // Закрываем меню при клике вне его
  useEffect(() => {
    const handleClickOutside = () => {
      setMenusOpen({})
    }
    
    if (Object.values(menusOpen).some(open => open)) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [menusOpen])

  const loadStudents = async () => {
    try {
      setLoading(true)
      const response = await studentsAPI.getAll()
      setStudents(response.data)
      setError(null)
    } catch (err) {
      setError('Ошибка загрузки учеников')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!window.confirm('Вы уверены, что хотите удалить этого ученика?')) {
      return
    }

    try {
      await studentsAPI.delete(id)
      loadStudents()
    } catch (err) {
      alert('Ошибка при удалении ученика')
      console.error(err)
    }
  }

  if (loading) {
    return <div className="card">Загрузка...</div>
  }

  if (error) {
    return <div className="card error">{error}</div>
  }

  return (
    <div className="card">
      <div className="students-header">
        <h2>Список учеников</h2>
        <div className="header-actions">
          <Link to="/images" className="btn btn-secondary">
            📚 База картинок
          </Link>
          <Link to="/students/new" className="btn btn-primary">
            + Добавить ученика
          </Link>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="empty-state">
          <p>Нет зарегистрированных учеников</p>
          <Link to="/students/new" className="btn btn-primary">
            Добавить первого ученика
          </Link>
        </div>
      ) : (
        <div className="students-grid">
          {students.map(student => (
            <div 
              key={student.id} 
              className="student-card"
            >
              <Link 
                to={`/students/${student.id}`}
                className="student-info-link"
              >
                <div className="student-info">
                  <h3>{student.last_name} {student.first_name} {student.middle_name || ''}</h3>
                  <p className="student-date">
                    Зарегистрирован: {new Date(student.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </Link>
              <div className="menu-container">
                <button 
                  className="hamburger-btn btn-small"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setMenusOpen(prev => ({
                      ...prev,
                      [student.id]: !prev[student.id]
                    }))
                  }}
                  aria-label="Меню"
                >
                  ☰
                </button>
                {menusOpen[student.id] && (
                  <div className="dropdown-menu">
                    <Link 
                      to={`/students/${student.id}/edit`} 
                      className="dropdown-item"
                      onClick={() => setMenusOpen(prev => ({ ...prev, [student.id]: false }))}
                    >
                      ✏️ Редактировать
                    </Link>
                    <button
                      className="dropdown-item danger"
                      onClick={(e) => {
                        e.preventDefault()
                        setMenusOpen(prev => ({ ...prev, [student.id]: false }))
                        handleDelete(student.id, e)
                      }}
                    >
                      🗑️ Удалить
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default StudentsList

