import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { lessonsAPI, speechAPI } from '../api'
import './LessonView.css'

function LessonView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState(null)
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [sessionId, setSessionId] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [attempts, setAttempts] = useState({})
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [microphoneError, setMicrophoneError] = useState(null)
  const [microphonePermission, setMicrophonePermission] = useState(null) // null = неизвестно, 'granted' = разрешено, 'denied' = отклонено, 'prompt' = нужно запросить
  const recordingTimeoutRef = useRef(null)
  
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioRef = useRef(null)
  const audioPlayerRef = useRef(null)

  // Добавляем класс к body при монтировании компонента урока
  useEffect(() => {
    document.body.classList.add('lesson-mode')
    return () => {
      document.body.classList.remove('lesson-mode')
    }
  }, [])

  // Проверяем статус доступа к микрофону при загрузке
  useEffect(() => {
    checkMicrophonePermission()
  }, [])

  // Функция для проверки статуса доступа к микрофону
  const checkMicrophonePermission = async () => {
    if (!navigator.permissions || !navigator.permissions.query) {
      // Браузер не поддерживает API permissions, пробуем запросить доступ
      setMicrophonePermission('prompt')
      return
    }

    try {
      const result = await navigator.permissions.query({ name: 'microphone' })
      setMicrophonePermission(result.state)
      
      // Слушаем изменения статуса
      result.onchange = () => {
        setMicrophonePermission(result.state)
      }
    } catch (error) {
      // Если не поддерживается, устанавливаем как 'prompt'
      setMicrophonePermission('prompt')
    }
  }

  // Функция для запроса доступа к микрофону
  const requestMicrophoneAccess = async () => {
    try {
      setMicrophoneError(null)
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const error = new Error('Ваш браузер не поддерживает запись с микрофона')
        error.name = 'NotSupportedError'
        throw error
      }

      // Запрашиваем доступ к микрофону
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      // Если доступ получен, останавливаем поток и обновляем статус
      stream.getTracks().forEach(track => track.stop())
      setMicrophonePermission('granted')
      
      // Обновляем статус через API permissions если доступно
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' })
        setMicrophonePermission(result.state)
      }
    } catch (err) {
      console.error('Ошибка доступа к микрофону:', err)
      const errorInfo = getMicrophoneErrorMessage(err)
      setMicrophoneError(errorInfo)
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicrophonePermission('denied')
      } else {
        setMicrophonePermission('prompt')
      }
    }
  }

  useEffect(() => {
    loadLesson()
    return () => {
      // Очистка при размонтировании
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      // Освобождаем URL объекта при размонтировании
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl)
      }
      // Останавливаем воспроизведение
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
        audioPlayerRef.current.src = ''
      }
    }
  }, [id, recordedAudioUrl])

  const loadLesson = async () => {
    try {
      const response = await lessonsAPI.getById(id)
      setLesson(response.data)
      
      // Начать сессию
      const sessionResponse = await lessonsAPI.startSession(id)
      setSessionId(sessionResponse.data.session_id)
    } catch (err) {
      console.error('Ошибка загрузки урока:', err)
      alert('Ошибка загрузки урока')
    }
  }

  const getMicrophoneErrorMessage = (error) => {
    if (!error) return 'Неизвестная ошибка'
    
    const errorName = error.name || ''
    const isHTTPS = window.location.protocol === 'https:'
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname)
    
    switch (errorName) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return {
            title: 'Разрешение на микрофон отклонено',
            message: 'Пожалуйста, разрешите доступ к микрофону в настройках браузера.',
            instructions: [
              'Нажмите на иконку замка или информации в адресной строке',
              'Выберите "Разрешения" или "Разрешить доступ к микрофону"',
              'Обновите страницу и попробуйте снова'
            ]
          }
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return {
            title: 'Микрофон не найден',
            message: 'На вашем устройстве не обнаружен микрофон.',
            instructions: [
              'Убедитесь, что микрофон подключен',
              'Проверьте настройки устройства',
              'Попробуйте другое устройство'
            ]
          }
      case 'NotReadableError':
      case 'TrackStartError':
        return {
            title: 'Микрофон занят',
            message: 'Микрофон используется другим приложением.',
            instructions: [
              'Закройте другие приложения, использующие микрофон',
              'Обновите страницу и попробуйте снова'
            ]
          }
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return {
            title: 'Неподдерживаемые настройки',
            message: 'Ваш микрофон не поддерживает требуемые настройки.',
            instructions: [
              'Попробуйте другое устройство',
              'Обновите драйверы микрофона'
            ]
          }
      default:
        // Проверяем, не связана ли ошибка с HTTPS
        if (!isHTTPS && isLocalhost) {
          // Safari на iOS требует HTTPS
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
          if (isIOS) {
            return {
                title: 'Требуется безопасное соединение',
                message: 'Safari на iOS требует HTTPS для доступа к микрофону.',
                instructions: [
                  'Для локального тестирования используйте Chrome или Firefox',
                  'Или настройте HTTPS сертификат для локального сервера'
                ]
              }
          }
        }
        
        return {
            title: 'Ошибка доступа к микрофону',
            message: error.message || 'Не удалось получить доступ к микрофону.',
            instructions: [
              'Проверьте разрешения браузера',
              'Убедитесь, что микрофон подключен и работает',
              'Попробуйте обновить страницу',
              'Попробуйте другой браузер (Chrome, Firefox)'
            ]
          }
    }
  }

  const startRecording = async () => {
    try {
      // Очищаем предыдущую ошибку
      setMicrophoneError(null)
      
      // Проверяем поддержку API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const error = new Error('Ваш браузер не поддерживает запись с микрофона')
        error.name = 'NotSupportedError'
        throw error
      }
      
      // Проверяем поддержку MediaRecorder
      if (!window.MediaRecorder) {
        const error = new Error('Ваш браузер не поддерживает запись аудио')
        error.name = 'NotSupportedError'
        throw error
      }
      
      // Очищаем предыдущее записанное аудио перед новой записью
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl)
        setRecordedAudioUrl(null)
      }
      
      // Очищаем предыдущий таймаут, если есть
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        
        // Создаем URL для воспроизведения
        const audioUrl = URL.createObjectURL(audioBlob)
        setRecordedAudioUrl(audioUrl)
        
        // Воспроизводим записанное аудио перед распознаванием
        await playRecordedAudio(audioUrl)
        
        // После воспроизведения обрабатываем аудио
        await processAudio(audioBlob)
        
        // Остановить все треки потока
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      
      // Автоматически останавливаем запись через 3 секунды
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording()
      }, 3000)
    } catch (err) {
      console.error('Ошибка доступа к микрофону:', err)
      const errorInfo = getMicrophoneErrorMessage(err)
      setMicrophoneError(errorInfo)
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }
  
  const handleImageClick = () => {
    // Если уже идет запись или обработка, не начинаем новую
    if (isRecording || isProcessing || isPlaying) {
      return
    }
    
    // Начинаем запись при клике на картинку
    startRecording()
  }

  const playRecordedAudio = (audioUrl) => {
    return new Promise((resolve, reject) => {
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio()
      }
      
      const audio = audioPlayerRef.current
      audio.src = audioUrl
      setIsPlaying(true)
      
      audio.onended = () => {
        setIsPlaying(false)
        resolve()
      }
      
      audio.onerror = (error) => {
        console.error('Ошибка воспроизведения аудио:', error)
        setIsPlaying(false)
        resolve() // Продолжаем даже при ошибке воспроизведения
      }
      
      audio.play().catch(error => {
        console.error('Не удалось воспроизвести аудио:', error)
        setIsPlaying(false)
        resolve() // Продолжаем даже при ошибке воспроизведения
      })
    })
  }


  const processAudio = async (audioBlob) => {
    setIsProcessing(true)
    
    try {
      // Распознавание речи
      const recognizeResponse = await speechAPI.recognize(audioBlob)
      const recognizedText = recognizeResponse.data.text
      
      if (!recognizedText) {
        throw new Error('Распознанный текст пуст')
      }

      // Проверка правильности
      const currentWord = lesson.words[currentWordIndex]
      const checkResponse = await speechAPI.check(recognizedText, currentWord.word)
      const isCorrect = checkResponse.data.isCorrect

      // Сохранить попытку
      if (sessionId) {
        await lessonsAPI.saveAttempt({
          session_id: sessionId,
          word_id: currentWord.id,
          is_correct: isCorrect,
          recognized_text: recognizedText
        })
      }

      // Обновить статистику
      const newStats = {
        correct: stats.correct + (isCorrect ? 1 : 0),
        total: stats.total + 1
      }
      setStats(newStats)

      // Обновить попытки для текущего слова
      const wordId = currentWord.id
      setAttempts(prev => ({
        ...prev,
        [wordId]: (prev[wordId] || 0) + 1
      }))

      if (isCorrect) {
        // Правильный ответ
        setShowSuccess(true)
        playSuccessSound()
        
        // Очищаем URL после успешного распознавания
        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl)
          setRecordedAudioUrl(null)
        }
        
        setTimeout(() => {
          setShowSuccess(false)
          nextWord()
        }, 2000)
      } else {
        // Неправильный ответ - можно попробовать еще раз
        alert(`Не совсем правильно. Вы сказали: "${recognizedText}". Попробуйте еще раз!`)
      }
    } catch (err) {
      console.error('Ошибка обработки аудио:', err)
      
      // Показываем детальную информацию об ошибке
      let errorMessage = 'Ошибка распознавания речи. Попробуйте еще раз.'
      
      if (err.response && err.response.data) {
        const errorData = err.response.data
        console.error('Детали ошибки от сервера:', errorData)
        
        if (errorData.details) {
          errorMessage = `Ошибка: ${errorData.details}`
        } else if (errorData.error) {
          errorMessage = `Ошибка: ${errorData.error}`
        }
        
        if (errorData.hint) {
          errorMessage += `\n\nПодсказка: ${errorData.hint}`
        }
      } else if (err.message) {
        errorMessage = `Ошибка: ${err.message}`
      }
      
      alert(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const playSuccessSound = () => {
    // Создаем простой звук успеха
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 523.25 // C5
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  }

  const nextWord = () => {
    // Очищаем записанное аудио при переходе к следующему слову
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl)
      setRecordedAudioUrl(null)
    }
    
    if (currentWordIndex < lesson.words.length - 1) {
      setCurrentWordIndex(currentWordIndex + 1)
    } else {
      // Урок завершен
      completeLesson()
    }
  }

  const completeLesson = async () => {
    try {
      if (sessionId) {
        await lessonsAPI.completeSession(sessionId)
      }
      alert(`Урок завершен! Правильных ответов: ${stats.correct} из ${stats.total}`)
      navigate(-1) // Вернуться назад
    } catch (err) {
      console.error('Ошибка завершения урока:', err)
    }
  }

  if (!lesson) {
    return <div className="card">Загрузка урока...</div>
  }

  const currentWord = lesson.words[currentWordIndex]
  const progress = ((currentWordIndex + 1) / lesson.words.length) * 100

  // Функция для получения правильного URL картинки
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null
    if (imagePath.startsWith('http')) {
      return imagePath
    }
    // Используем относительный путь через прокси Vite
    // Vite проксирует /uploads на сервер, поэтому используем относительный путь
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
    <div className="lesson-view">
      {showSuccess && (
        <div className="success-overlay">
          <div className="success-message">
            <div className="success-icon">🎉</div>
            <h2>Отлично!</h2>
            <p>Вы правильно произнесли слово!</p>
          </div>
        </div>
      )}

      <div className="card lesson-card">
        <div className="lesson-header">
          <button 
            className="btn btn-secondary"
            onClick={() => {
              if (window.confirm('Вы уверены, что хотите выйти? Прогресс будет сохранен.')) {
                navigate(-1)
              }
            }}
          >
            ← Назад
          </button>
          <h2>{lesson.name}</h2>
          <div className="lesson-stats">
            Правильно: {stats.correct} / {stats.total}
          </div>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          <span className="progress-text">
            Слово {currentWordIndex + 1} из {lesson.words.length}
          </span>
        </div>

        <div className="word-display">
          <div 
            className="word-image-container"
            onClick={handleImageClick}
            style={{ cursor: (isRecording || isProcessing || isPlaying) ? 'not-allowed' : 'pointer' }}
          >
            {currentWord.image_path ? (
              <img 
                src={getImageUrl(currentWord.image_path)} 
                alt={currentWord.word}
                className="word-image"
                style={{ 
                  opacity: (isRecording || isProcessing || isPlaying) ? 0.6 : 1,
                  transition: 'opacity 0.2s'
                }}
                onError={(e) => {
                  console.error('Ошибка загрузки картинки:', currentWord.image_path)
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'block'
                }}
              />
            ) : null}
            <div 
              className="word-placeholder"
              style={{ 
                display: currentWord.image_path ? 'none' : 'block',
                cursor: (isRecording || isProcessing || isPlaying) ? 'not-allowed' : 'pointer'
              }}
            >
              <div className="placeholder-icon">🖼️</div>
              <p>Нажмите для записи</p>
            </div>
            {isProcessing && (
              <div className="recording-indicator-no-overlay">⏳ Обработка...</div>
            )}
            {isPlaying && (
              <div className="recording-overlay">
                <div className="recording-indicator">🔊 Воспроизведение...</div>
              </div>
            )}
          </div>

          <div className="word-text">
            <h3>Произнесите слово:</h3>
            <div className="word-to-say">{currentWord.word}</div>
          </div>
        </div>

        {microphoneError && (
          <div className="microphone-error">
            <div className="error-content">
              <div className="error-icon">⚠️</div>
              <h3>{microphoneError.title}</h3>
              <p>{microphoneError.message}</p>
              {microphoneError.instructions && (
                <div className="error-instructions">
                  <p><strong>Что делать:</strong></p>
                  <ul>
                    {microphoneError.instructions.map((instruction, idx) => (
                      <li key={idx}>{instruction}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setMicrophoneError(null)
                  startRecording()
                }}
              >
                Попробовать снова
              </button>
            </div>
          </div>
        )}
        
        {!microphoneError && microphonePermission !== 'granted' && (
          <div className="microphone-permission-request">
            <div className="permission-content">
              <div className="permission-icon">🎤</div>
              <h3>Требуется доступ к микрофону</h3>
              <p>Для работы приложения необходимо разрешить доступ к микрофону</p>
              <button 
                className="btn btn-primary btn-large"
                onClick={requestMicrophoneAccess}
                disabled={microphonePermission === 'denied'}
              >
                {microphonePermission === 'denied' ? 'Доступ отклонен' : 'Разрешить доступ к микрофону'}
              </button>
              {microphonePermission === 'denied' && (
                <p className="permission-hint">
                  Разрешение было отклонено. Пожалуйста, разрешите доступ к микрофону в настройках браузера и обновите страницу.
                </p>
              )}
            </div>
          </div>
        )}

        {!microphoneError && microphonePermission === 'granted' && (
          <div className="recording-hint">
            {!isRecording && !isProcessing && !isPlaying && (
              <p className="hint-text">Нажмите на картинку, чтобы начать запись (3 секунды)</p>
            )}
          </div>
        )}

        {attempts[currentWord.id] > 0 && (
          <div className="attempts-info">
            Попыток для этого слова: {attempts[currentWord.id]}
          </div>
        )}
      </div>
    </div>
  )
}

export default LessonView

