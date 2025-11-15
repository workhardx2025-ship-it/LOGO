import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { studentsAPI } from '../api'
import './CreateStudent.css'

function CreateStudent() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
      setLoading(true)
      const response = await studentsAPI.create(formData)
      navigate(`/students/${response.data.id}`)
    } catch (err) {
      setError('Ошибка при создании ученика')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Добавить нового ученика</h2>
      
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
            disabled={loading}
          >
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => navigate('/students')}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateStudent

