import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { imagesAPI } from '../api'
import './ImageLibrary.css'

function ImageLibrary() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [uploadForm, setUploadForm] = useState({
    word: '',
    image: null
  })

  useEffect(() => {
    loadImages()
  }, [])

  const loadImages = async () => {
    try {
      setLoading(true)
      const response = await imagesAPI.getAll()
      setImages(response.data)
      setError(null)
    } catch (err) {
      setError('Ошибка загрузки картинок')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setUploadForm({ ...uploadForm, image: file })
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    
    if (!uploadForm.word || !uploadForm.image) {
      alert('Заполните слово и выберите картинку')
      return
    }

    try {
      setUploading(true)
      await imagesAPI.upload(uploadForm.image, uploadForm.word)
      setUploadForm({ word: '', image: null })
      setShowUpload(false)
      loadImages()
      alert('Картинка успешно загружена!')
    } catch (err) {
      alert('Ошибка при загрузке картинки: ' + (err.response?.data?.error || err.message))
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (image) => {
    setEditingId(image.id)
    setUploadForm({ word: image.word, image: null })
    setShowUpload(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    
    if (!uploadForm.word) {
      alert('Заполните слово')
      return
    }

    try {
      setUploading(true)
      await imagesAPI.update(editingId, uploadForm.word)
      setUploadForm({ word: '', image: null })
      setEditingId(null)
      setShowUpload(false)
      loadImages()
      alert('Картинка успешно обновлена!')
    } catch (err) {
      alert('Ошибка при обновлении картинки: ' + (err.response?.data?.error || err.message))
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту картинку?')) {
      return
    }

    try {
      await imagesAPI.delete(id)
      loadImages()
    } catch (err) {
      alert('Ошибка при удалении картинки')
      console.error(err)
    }
  }

  const getImageUrl = (imagePath) => {
    if (imagePath.startsWith('http')) {
      return imagePath
    }
    // Используем относительный путь через прокси Vite
    // Это работает как локально, так и с мобильных устройств в той же сети
    if (imagePath.startsWith('/uploads')) {
      return imagePath
    }
    // Для других путей добавляем /uploads если нужно
    if (imagePath.startsWith('/')) {
      return imagePath
    }
    // Если путь не начинается с /, добавляем /uploads
    return `/uploads/${imagePath}`
  }

  if (loading) {
    return <div className="card">Загрузка...</div>
  }

  return (
    <div>
      <div className="card">
        <div className="images-header">
          <div>
            <Link to="/students" className="back-link">← Назад к ученикам</Link>
            <h2>База картинок</h2>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? 'Отмена' : '+ Загрузить картинку'}
          </button>
        </div>

        {showUpload && (
          <div className="upload-form">
            <h3>{editingId ? 'Редактировать картинку' : 'Загрузить новую картинку'}</h3>
            <form onSubmit={editingId ? handleUpdate : handleUpload}>
              <div className="form-group">
                <label htmlFor="word">Слово для произношения *</label>
                <input
                  type="text"
                  id="word"
                  value={uploadForm.word}
                  onChange={(e) => setUploadForm({ ...uploadForm, word: e.target.value })}
                  required
                  placeholder="Например: яблоко"
                />
              </div>
              {!editingId && (
                <div className="form-group">
                  <label htmlFor="image">Картинка *</label>
                  <input
                    type="file"
                    id="image"
                    accept="image/*"
                    onChange={handleFileChange}
                    required
                  />
                  {uploadForm.image && (
                    <p className="file-info">Выбрано: {uploadForm.image.name}</p>
                  )}
                </div>
              )}
              <div className="form-actions">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={uploading}
                >
                  {uploading ? (editingId ? 'Сохранение...' : 'Загрузка...') : (editingId ? 'Сохранить' : 'Загрузить')}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowUpload(false)
                    setEditingId(null)
                    setUploadForm({ word: '', image: null })
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {error && <div className="card error">{error}</div>}

      {images.length === 0 ? (
        <div className="card">
          <p>База картинок пуста. Загрузите первую картинку!</p>
        </div>
      ) : (
        <div className="images-grid">
          {images.map(image => (
            <div key={image.id} className="image-card">
              <div className="image-container">
                <img 
                  src={getImageUrl(image.image_path)} 
                  alt={image.word}
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
                <div className="image-placeholder" style={{ display: 'none' }}>
                  <span>🖼️</span>
                  <p>Ошибка загрузки</p>
                </div>
              </div>
              <div className="image-info">
                <h3>{image.word}</h3>
                <p className="image-date">
                  Добавлено: {new Date(image.created_at).toLocaleDateString('ru-RU')}
                </p>
                <div className="image-actions">
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => handleEdit(image)}
                  >
                    ✏️ Редактировать
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => handleDelete(image.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageLibrary

