import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Проверяем, включен ли HTTPS
const HTTPS_ENABLED = process.env.VITE_HTTPS_ENABLED === 'true'
const httpsOptions = {}

if (HTTPS_ENABLED) {
  const certPath = process.env.VITE_HTTPS_CERT_PATH || path.resolve(__dirname, '../server/certs/localhost+3.pem')
  const keyPath = process.env.VITE_HTTPS_KEY_PATH || path.resolve(__dirname, '../server/certs/localhost+3-key.pem')
  
  try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      httpsOptions.cert = fs.readFileSync(certPath)
      httpsOptions.key = fs.readFileSync(keyPath)
      console.log('✅ Vite HTTPS сертификаты загружены')
    } else {
      console.warn('⚠️  HTTPS включен для Vite, но сертификаты не найдены')
      console.warn(`   Cert: ${certPath}`)
      console.warn(`   Key: ${keyPath}`)
      console.warn('   Установите VITE_HTTPS_ENABLED=false или создайте сертификаты (см. HTTPS_SETUP.md)')
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки HTTPS сертификатов для Vite:', error.message)
  }
}

// Определяем протокол для прокси
// Если Vite использует HTTPS, но сервер использует HTTP, используем HTTP для прокси
// Проверяем, включен ли HTTPS на сервере через переменную окружения
const serverHTTPS = process.env.VITE_SERVER_HTTPS === 'true'
const apiProtocol = serverHTTPS ? 'https' : 'http'
const apiTarget = process.env.VITE_API_TARGET || `${apiProtocol}://127.0.0.1:3001`

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Используем 0.0.0.0 для доступа из локальной сети, или 127.0.0.1 только для локального доступа
    // Для доступа с мобильного устройства в той же WiFi сети используйте 0.0.0.0
    host: process.env.VITE_HOST || '0.0.0.0',
    https: HTTPS_ENABLED && Object.keys(httpsOptions).length > 0 ? httpsOptions : false,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: serverHTTPS ? false : true, // Для самоподписанных сертификатов отключаем проверку
        ws: true // Для WebSocket поддержки
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
        secure: serverHTTPS ? false : true,
        ws: true
      }
    }
  }
})

