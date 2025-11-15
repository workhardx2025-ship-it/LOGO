import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import StudentsList from './components/StudentsList'
import StudentDetail from './components/StudentDetail'
import LessonView from './components/LessonView'
import CreateStudent from './components/CreateStudent'
import EditStudent from './components/EditStudent'
import CreateLesson from './components/CreateLesson'
import EditLesson from './components/EditLesson'
import ImageLibrary from './components/ImageLibrary'
import './App.css'

function AppContent() {
  const location = useLocation()
  const isLessonPage = location.pathname.startsWith('/lessons/') && !location.pathname.includes('/edit')

  return (
    <div className={`app ${isLessonPage ? 'lesson-mode' : ''}`}>
      {!isLessonPage && (
        <header className="app-header">
          <div className="header-content">
            <h1>😊 LOGO</h1>
            <div className="header-buttons">
              <Link 
                to="/students"
                className="btn btn-secondary btn-small header-btn"
                title="На главную"
              >
                🏠 Домой
              </Link>
              <button 
                className="btn btn-secondary btn-small header-btn"
                onClick={() => {
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                      console.error('Ошибка входа в полноэкранный режим:', err);
                    });
                  } else {
                    document.exitFullscreen();
                  }
                }}
                title="Полный экран"
              >
                ⛶ Полный экран
              </button>
            </div>
          </div>
        </header>
      )}
      <main className={`app-main ${isLessonPage ? 'lesson-mode' : ''}`}>
          <Routes>
            <Route path="/" element={<Navigate to="/students" replace />} />
            <Route path="/students" element={<StudentsList />} />
            <Route path="/students/new" element={<CreateStudent />} />
            <Route path="/students/:id" element={<StudentDetail />} />
            <Route path="/students/:id/edit" element={<EditStudent />} />
            <Route path="/students/:id/lessons/new" element={<CreateLesson />} />
            <Route path="/lessons/:id" element={<LessonView />} />
            <Route path="/lessons/:id/edit" element={<EditLesson />} />
            <Route path="/images" element={<ImageLibrary />} />
          </Routes>
        </main>
      </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App

