# Хостинг приложения на виртуальном сервере Reg.ru

## ✅ Возможность хостинга

**Да, приложение можно захостить на виртуальном сервере Reg.ru**, но есть несколько важных моментов, которые нужно учесть.

## 📋 Требования к серверу

### Минимальные требования:
- **ОС**: Linux (Ubuntu 20.04+ или Debian 11+ рекомендуется)
- **RAM**: минимум 2 GB (рекомендуется 4 GB)
- **CPU**: минимум 2 ядра
- **Диск**: минимум 20 GB свободного места
- **Node.js**: версия 18.x или выше
- **npm**: версия 9.x или выше

### Дополнительные требования:
- **FFmpeg**: для обработки аудио (устанавливается через пакетный менеджер)
- **Build tools**: для компиляции нативных модулей (gcc, g++, make, python3)
- **Доступ к интернету**: для установки зависимостей и работы с OpenAI API (если используется)

## ⚠️ Потенциальные проблемы и решения

### 1. Установка нативных модулей (vosk)

**Проблема**: Пакет `vosk` требует компиляции нативных модулей, что может быть проблематично на некоторых VPS.

**Решения**:
- **Вариант 1**: Использовать OpenAI API (рекомендуется для продакшена)
  ```env
  SPEECH_RECOGNITION_SYSTEM=openai
  OPENAI_API_KEY=your_api_key_here
  ```
  
- **Вариант 2**: Использовать локальный Whisper (не требует компиляции)
  ```env
  SPEECH_RECOGNITION_SYSTEM=local
  ```

- **Вариант 3**: Установить build tools на сервере
  ```bash
  # Ubuntu/Debian
  sudo apt-get update
  sudo apt-get install -y build-essential python3
  ```

### 2. Установка FFmpeg

FFmpeg необходим для обработки аудио. Установка на Linux:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y ffmpeg

# Проверка установки
ffmpeg -version
```

### 3. Управление процессами (PM2)

Для продакшена рекомендуется использовать PM2 для управления Node.js процессами:

```bash
# Установка PM2
npm install -g pm2

# Запуск backend
cd server
pm2 start index.js --name "speech-therapist-api"

# Запуск frontend (после сборки)
cd client
npm run build
pm2 serve dist 5173 --name "speech-therapist-frontend"

# Сохранение конфигурации
pm2 save
pm2 startup
```

### 4. Настройка обратного прокси (Nginx)

Для продакшена рекомендуется использовать Nginx как обратный прокси:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. HTTPS сертификаты

Для работы микрофона в браузере (особенно Safari iOS) требуется HTTPS:

- Используйте Let's Encrypt (бесплатно):
  ```bash
  sudo apt-get install certbot python3-certbot-nginx
  sudo certbot --nginx -d your-domain.com
  ```

- Или настройте в `.env`:
  ```env
  HTTPS_ENABLED=true
  HTTPS_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
  HTTPS_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
  ```

## 📦 Инструкция по развертыванию

### Шаг 1: Подготовка сервера

```bash
# Обновление системы
sudo apt-get update && sudo apt-get upgrade -y

# Установка Node.js (через NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка build tools
sudo apt-get install -y build-essential python3

# Установка FFmpeg
sudo apt-get install -y ffmpeg

# Установка PM2
sudo npm install -g pm2

# Установка Nginx (опционально)
sudo apt-get install -y nginx
```

### Шаг 2: Клонирование и установка приложения

```bash
# Клонирование репозитория (или загрузка файлов)
git clone your-repo-url
cd LOGO_Cursor

# Установка зависимостей
npm run install-all

# Или по отдельности:
cd server && npm install
cd ../client && npm install
```

### Шаг 3: Настройка переменных окружения

```bash
cd server
cp .env.example .env
nano .env
```

Настройте `.env`:
```env
# Для продакшена рекомендуется использовать OpenAI API
SPEECH_RECOGNITION_SYSTEM=openai
OPENAI_API_KEY=your_api_key_here
AUTO_FALLBACK_TO_LOCAL=false

# Или локальный Whisper (не требует API ключ)
# SPEECH_RECOGNITION_SYSTEM=local

# Настройки сервера
PORT=3001
HOST=0.0.0.0
HTTPS_ENABLED=false  # Используйте Nginx для HTTPS

# База данных (SQLite, создается автоматически)
# DATABASE_PATH=./database.sqlite
```

### Шаг 4: Сборка frontend

```bash
cd client
npm run build
```

### Шаг 5: Запуск приложения

**Вариант 1: С PM2 (рекомендуется)**

```bash
# Backend
cd server
pm2 start index.js --name "speech-api" --env production

# Frontend (статический сервер)
cd ../client
pm2 serve dist 5173 --name "speech-frontend" --spa

# Проверка статуса
pm2 status

# Логи
pm2 logs
```

**Вариант 2: С Nginx для frontend**

```bash
# Сборка frontend
cd client
npm run build

# Копирование в Nginx
sudo cp -r dist/* /var/www/html/

# Настройка Nginx (см. выше)
# Запуск только backend
cd server
pm2 start index.js --name "speech-api"
```

### Шаг 6: Настройка автозапуска

```bash
# Сохранение конфигурации PM2
pm2 save

# Настройка автозапуска при перезагрузке
pm2 startup
# Выполните команду, которую выведет PM2
```

## 🔒 Безопасность

1. **Firewall**: Настройте firewall для ограничения доступа:
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw enable
   ```

2. **Переменные окружения**: Не коммитьте `.env` файлы в репозиторий

3. **HTTPS**: Обязательно используйте HTTPS для продакшена

4. **Ограничение доступа**: Рассмотрите возможность ограничения доступа к API по IP

## 📊 Мониторинг

```bash
# Мониторинг процессов PM2
pm2 monit

# Логи в реальном времени
pm2 logs

# Статистика
pm2 status
```

## 🐛 Решение проблем

### Проблема: Ошибка при установке vosk

**Решение**: Используйте OpenAI API или локальный Whisper вместо Vosk:
```env
SPEECH_RECOGNITION_SYSTEM=openai
# или
SPEECH_RECOGNITION_SYSTEM=local
```

### Проблема: Недостаточно памяти

**Решение**: 
- Увеличьте RAM на сервере
- Используйте swap файл:
  ```bash
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  ```

### Проблема: Приложение не запускается после перезагрузки

**Решение**: Проверьте настройку автозапуска PM2:
```bash
pm2 startup
pm2 save
```

## 💰 Рекомендации по тарифу Reg.ru

Для комфортной работы приложения рекомендуется:
- **VPS с 4 GB RAM** (минимум 2 GB)
- **2+ CPU ядра**
- **SSD диск 40+ GB**
- **Ubuntu 20.04 LTS или 22.04 LTS**

## 📝 Чеклист развертывания

- [ ] Установлен Node.js 18+
- [ ] Установлен FFmpeg
- [ ] Установлены build tools (если нужен vosk)
- [ ] Установлен PM2
- [ ] Настроен `.env` файл
- [ ] Собран frontend (`npm run build`)
- [ ] Запущены процессы через PM2
- [ ] Настроен автозапуск PM2
- [ ] Настроен Nginx (опционально)
- [ ] Настроен HTTPS (Let's Encrypt)
- [ ] Настроен firewall
- [ ] Протестировано приложение

## 🔗 Полезные ссылки

- [Документация PM2](https://pm2.keymetrics.io/)
- [Документация Nginx](https://nginx.org/ru/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Reg.ru VPS](https://www.reg.ru/vps/)

