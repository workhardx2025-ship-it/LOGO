import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { studentsAPI } from '../api'
import './CreateStudent.css'

function EditStudent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStudent()
  }, [id])

  const loadStudent = async () => {
    try {
      setLoading(true)
      const response = await studentsAPI.getById(id)
      setFormData({
        first_name: response.data.first_name,
        last_name: response.data.last_name,
        middle_name: response.data.middle_name || ''
      })
      setError(null)
    } catch (err) {
      setError('Ошибка загрузки данных ученика')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!formData.first_name || !formData.last_name) {
      setError('Имя и фамилия обязательны для заполнения')
      return
    }

    try {
      setSaving(true)
      await studentsAPI.update(id, formData)
      navigate(`/students/${id}`)
    } catch (err) {
      setError('Ошибка при обновлении ученика')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="card">Загрузка...</div>
  }

  return (
    <div className="card">
      <h2>Редактировать ученика</h2>
      
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="last_name">Фамилия *</label>
          <input
            type="text"
            id="last_name"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            required
            placeholder="Иванов"
          />
        </div>

        <div className="form-group">
          <label htmlFor="first_name">Имя *</label>
          <input
            type="text"
            id="first_name"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
            placeholder="Иван"
          />
        </div>

        <div className="form-group">
          <label htmlFor="middle_name">Отчество</label>
          <input
            type="text"
            id="middle_name"
            name="middle_name"
            value={formData.middle_name}
            onChange={handleChange}
            placeholder="Иванович"
          />
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => navigate(`/students/${id}`)}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditStudent

