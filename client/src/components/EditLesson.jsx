import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { lessonsAPI } from '../api'
import ImageSelector from './ImageSelector'
import './CreateLesson.css'

function EditLesson() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_sounds: '',
    words: []
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadLesson()
  }, [id])

  const loadLesson = async () => {
    try {
      setLoading(true)
      const response = await lessonsAPI.getById(id)
      const lesson = response.data
      setFormData({
        name: lesson.name,
        description: lesson.description || '',
        target_sounds: lesson.target_sounds || '',
        words: lesson.words || []
      })
      setError(null)
    } catch (err) {
      setError('Ошибка загрузки урока')
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

  const handleWordChange = (index, field, value) => {
    const newWords = [...formData.words]
    newWords[index][field] = value
    setFormData({ ...formData, words: newWords })
  }

  const addWord = () => {
    setFormData({
      ...formData,
      words: [...formData.words, { word: '', image_path: '' }]
    })
  }

  const removeWord = (index) => {
    if (formData.words.length > 1) {
      const newWords = formData.words.filter((_, i) => i !== index)
      setFormData({ ...formData, words: newWords })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!formData.name) {
      setError('Название урока обязательно')
      return
    }

    const validWords = formData.words.filter(w => w.word.trim())
    if (validWords.length === 0) {
      setError('Добавьте хотя бы одно слово')
      return
    }

    try {
      setSaving(true)
      // Получаем student_id из урока
      const lessonResponse = await lessonsAPI.getById(id)
      const studentId = lessonResponse.data.student_id
      
      // Обновляем урок
      await lessonsAPI.update(id, {
        name: formData.name,
        description: formData.description,
        target_sounds: formData.target_sounds,
        words: validWords
      })
      navigate(`/students/${studentId}`)
    } catch (err) {
      setError('Ошибка при обновлении урока')
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
      <h2>Редактировать урок</h2>
      
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Название урока *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Например: Звук 'Р'"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Описание</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Описание урока и цели"
          />
        </div>

        <div className="form-group">
          <label htmlFor="target_sounds">Проблемные звуки</label>
          <input
            type="text"
            id="target_sounds"
            name="target_sounds"
            value={formData.target_sounds}
            onChange={handleChange}
            placeholder="Например: Р, Л, Ш"
          />
        </div>

        <div className="words-section">
          <div className="words-header">
            <label>Слова для урока *</label>
            <button 
              type="button" 
              className="btn btn-secondary btn-small"
              onClick={addWord}
            >
              + Добавить слово
            </button>
          </div>

          {formData.words.map((word, index) => (
            <div key={index} className="word-item">
              <input
                type="text"
                placeholder="Слово"
                value={word.word}
                onChange={(e) => handleWordChange(index, 'word', e.target.value)}
                required={index === 0}
                className="word-input"
              />
              <div className="image-selector-wrapper">
                <ImageSelector
                  onSelect={(imagePath) => handleWordChange(index, 'image_path', imagePath)}
                  currentImagePath={word.image_path}
                />
              </div>
              {formData.words.length > 1 && (
                <button
                  type="button"
                  className="btn btn-danger btn-small"
                  onClick={() => removeWord(index)}
                >
                  Удалить
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => {
              // Получаем student_id для возврата
              lessonsAPI.getById(id).then(response => {
                navigate(`/students/${response.data.student_id}`)
              }).catch(() => {
                navigate('/students')
              })
            }}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditLesson

