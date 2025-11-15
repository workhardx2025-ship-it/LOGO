import React, { useState, useEffect } from 'react'
import { imagesAPI } from '../api'
import './ImageSelector.css'

function ImageSelector({ onSelect, currentImagePath }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    if (showModal) {
      loadImages()
    }
  }, [showModal])

  const loadImages = async () => {
    try {
      setLoading(true)
      const response = await imagesAPI.getAll()
      setImages(response.data)
    } catch (err) {
      console.error('Ошибка загрузки картинок:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (image) => {
    setSelectedImage(image)
    onSelect(image.image_path)
    setShowModal(false)
  }

  const getImageUrl = (imagePath) => {
    if (!imagePath) return ''
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

  return (
    <div className="image-selector">
      <div className="image-selector-input">
        <input
          type="text"
          placeholder="Выберите картинку из базы или введите URL"
          value={currentImagePath || ''}
          readOnly
          onClick={() => setShowModal(true)}
        />
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => setShowModal(true)}
        >
          Выбрать из базы
        </button>
        {currentImagePath && (
          <button
            type="button"
            className="btn btn-danger btn-small"
            onClick={() => {
              onSelect('')
              setSelectedImage(null)
            }}
          >
            Очистить
          </button>
        )}
      </div>

      {currentImagePath && (
        <div className="image-preview">
          <img 
            src={getImageUrl(currentImagePath)} 
            alt="Preview"
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
        </div>
      )}

      {showModal && (
        <div className="image-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-modal-header">
              <h3>Выберите картинку из базы</h3>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setShowModal(false)}
              >
                ✕ Закрыть
              </button>
            </div>
            <div className="image-modal-content">
              {loading ? (
                <div className="loading">Загрузка...</div>
              ) : images.length === 0 ? (
                <div className="empty-state">
                  <p>База картинок пуста</p>
                  <p className="hint">Загрузите картинки в разделе "База картинок"</p>
                </div>
              ) : (
                <div className="image-modal-grid">
                  {images.map(image => (
                    <div
                      key={image.id}
                      className={`image-modal-item ${selectedImage?.id === image.id ? 'selected' : ''}`}
                      onClick={() => handleSelect(image)}
                    >
                      <img 
                        src={getImageUrl(image.image_path)} 
                        alt={image.word}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                      <div className="image-modal-word">{image.word}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageSelector

