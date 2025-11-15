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

Для продакшена **обязательно** используйте Nginx как обратный прокси. PM2 serve не может проксировать API запросы!

**Вариант 1: Обслуживание статических файлов (рекомендуется для продакшена)**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Корневая директория для статических файлов frontend
    root /root/LOGO/client/dist;
    index index.html;

    # Backend API - проксирование на Node.js сервер
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

    # Загрузки (изображения, файлы)
    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Статические файлы (JS, CSS, изображения из сборки)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA роутинг - все остальные запросы на index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Вариант 2: Проксирование на PM2 serve (не рекомендуется, только для тестирования)**

Если вы все же хотите использовать PM2 serve, настройте Nginx для проксирования:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend через PM2 serve
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

    # Загрузки
    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
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

# Установка build tools (ОБЯЗАТЕЛЬНО для компиляции нативных модулей!)
sudo apt-get install -y build-essential python3 make gcc g++

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
git clone https://github.com/workhardx2025-ship-it/LOGO
cd LOGO

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

## 🏗️ АРХИТЕКТУРА ПРИЛОЖЕНИЯ

**Важно понимать:**

- **Frontend** (React приложение) = статические файлы → обслуживается через **Nginx** на порту **80**
- **Backend** (Node.js API) = сервер приложения → запускается через **PM2** на порту **3001**
- **Nginx** проксирует запросы `/api/*` на backend (порт 3001)
- **PM2 serve НЕ используется** для frontend в продакшене (только для тестирования)

**Как это работает:**
1. Пользователь открывает `http://89.104.66.105` → Nginx отдает статические файлы из `/root/LOGO/client/dist`
2. Frontend делает запрос к `/api/students` → Nginx проксирует на `http://localhost:3001/api/students`
3. Backend обрабатывает запрос и возвращает данные

**Поэтому:**
- ✅ Frontend запускается через **Nginx** (не PM2)
- ✅ Backend запускается через **PM2** (не Nginx)
- ❌ PM2 serve для frontend НЕ работает правильно с API

## 📋 ПРОСТАЯ ИНСТРУКЦИЯ ПО ЗАПУСКУ

### ✅ Вариант 1: С Nginx (РЕКОМЕНДУЕТСЯ для продакшена)

**Последовательность действий:**

1. **Настройте .env файл:**
```bash
cd /root/LOGO/server
cp .env.example .env
nano .env
```
   - Установите `SPEECH_RECOGNITION_SYSTEM=openai` или `SPEECH_RECOGNITION_SYSTEM=local`
   - Если используете OpenAI, укажите `OPENAI_API_KEY=ваш_ключ`
   - Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

2. **Соберите frontend:**
```bash
cd /root/LOGO/client
npm run build
```

3. **Создайте конфигурацию Nginx:**
```bash
sudo nano /etc/nginx/sites-available/speech-therapist
```

4. **Вставьте конфигурацию (замените `your-domain.com` на ваш домен/IP):**
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Или IP адрес, например: 123.45.67.89

    # Увеличенный лимит для загрузки файлов (фото со смартфонов)
    client_max_body_size 50M;

    root /root/LOGO/client/dist;
    index index.html;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # Увеличенный лимит для загрузки через прокси
        client_max_body_size 50M;
    }

    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
   - Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

5. **Активируйте конфигурацию:**
```bash
sudo ln -s /etc/nginx/sites-available/speech-therapist /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

6. **Запустите backend через PM2:**
```bash
cd /root/LOGO/server
pm2 start index.js --name "speech-api" --env production
pm2 save
```

7. **Проверьте статус:**
```bash
pm2 status
```

**Готово!** Откройте в браузере: `http://your-domain.com` или `http://your-ip-address`

---

### ⚠️ Вариант 2: Без Nginx (только для тестирования)

**Последовательность действий:**

1. **Настройте .env файл:**
```bash
cd /root/LOGO/server
cp .env.example .env
nano .env
```
   - Установите `SPEECH_RECOGNITION_SYSTEM=openai` или `SPEECH_RECOGNITION_SYSTEM=local`
   - Если используете OpenAI, укажите `OPENAI_API_KEY=ваш_ключ`
   - Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

2. **Соберите frontend:**
```bash
cd /root/LOGO/client
npm run build
```

3. **Запустите backend:**
```bash
cd /root/LOGO/server
pm2 start index.js --name "speech-api" --env production
```

4. **Запустите frontend через PM2 serve:**
```bash
cd /root/LOGO/client
pm2 serve dist 5173 --name "speech-frontend" --spa
```

5. **Проверьте статус:**
```bash
pm2 status
pm2 save
```

**⚠️ ВАЖНО:** Этот вариант НЕ работает правильно! PM2 serve не проксирует API запросы. Используйте Вариант 1 с Nginx.

---

## 📝 Детальные инструкции (если нужны подробности)

**Вариант 1: С Nginx для frontend (рекомендуется для продакшена)**

```bash
# Сборка frontend
cd /root/LOGO/client
npm run build

# Создание конфигурации Nginx
sudo nano /etc/nginx/sites-available/speech-therapist

# Скопируйте конфигурацию из раздела "Настройка обратного прокси" выше
# Замените your-domain.com на ваш домен или IP

# Активация конфигурации
sudo ln -s /etc/nginx/sites-available/speech-therapist /etc/nginx/sites-enabled/
sudo nginx -t  # Проверка конфигурации
sudo systemctl reload nginx

# Запуск только backend через PM2
cd /root/LOGO/server
pm2 start index.js --name "speech-api" --env production

# Проверка статуса
pm2 status
```

**Вариант 2: С PM2 serve (только для тестирования, не рекомендуется)**

⚠️ **Внимание**: PM2 serve не может проксировать API запросы! Используйте Nginx для продакшена.

```bash
# Backend
cd /root/LOGO/server
pm2 start index.js --name "speech-api" --env production

# Frontend (статический сервер) - НЕ ПРОКСИРУЕТ API!
cd /root/LOGO/client
npm run build
pm2 serve dist 5173 --name "speech-frontend" --spa

# Проверка статуса
pm2 status

# Логи
pm2 logs
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

### Проблема: Ошибка "not found: make" при установке зависимостей

**Симптомы**: 
```
npm ERR! gyp ERR! stack Error: not found: make
npm ERR! gyp ERR! stack Error: not found: gcc
```

**Решение**: Установите build tools (если пропустили Шаг 1):
```bash
sudo apt-get update
sudo apt-get install -y build-essential python3 make gcc g++
```

После установки попробуйте снова:
```bash
cd server
rm -rf node_modules package-lock.json
npm install
```

**Альтернативное решение**: Если не хотите устанавливать build tools, используйте OpenAI API или локальный Whisper вместо Vosk (они не требуют компиляции):
```env
SPEECH_RECOGNITION_SYSTEM=openai
# или
SPEECH_RECOGNITION_SYSTEM=local
```

### Проблема: Ошибка "vite: not found" или "command not found"

**Симптомы**: 
```
sh: 1: vite: not found
```

**Решение**: Установите зависимости клиента:
```bash
cd /root/LOGO/client
npm install
```

Если вы находитесь в корневой директории проекта, можно установить все зависимости сразу:
```bash
cd /root/LOGO
npm run install-all
```

Это установит зависимости для корня, server и client.

### Проблема: Ошибки "ENOENT: no such file or directory" при использовании PM2 serve

**Симптомы**: 
```
Error while serving /root/LOGO/client/dist/api/students : ENOENT: no such file or directory
Error while serving /root/LOGO/client/dist/students : ENOENT: no such file or directory
```

**Причина**: PM2 serve - это простой статический файловый сервер. Он **не может проксировать API запросы** на backend. Когда браузер запрашивает `/api/students`, PM2 serve пытается найти файл `/root/LOGO/client/dist/api/students`, которого не существует.

**Решение**: Используйте Nginx для правильного проксирования API и обслуживания SPA:

1. Остановите PM2 serve для frontend:
```bash
pm2 stop speech-frontend
pm2 delete speech-frontend
```

2. Убедитесь, что frontend собран:
```bash
cd /root/LOGO/client
npm run build
```

3. Создайте конфигурацию Nginx:
```bash
sudo nano /etc/nginx/sites-available/speech-therapist
```

4. Вставьте конфигурацию (см. раздел "Настройка обратного прокси" выше):
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Замените на ваш домен или IP

    root /root/LOGO/client/dist;
    index index.html;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

5. Активируйте конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/speech-therapist /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

6. Убедитесь, что backend запущен через PM2:
```bash
pm2 start /root/LOGO/server/index.js --name "speech-api" --env production
pm2 status
```

### Проблема: Ошибка при установке vosk

**Решение**: Используйте OpenAI API или локальный Whisper вместо Vosk:
```env
SPEECH_RECOGNITION_SYSTEM=openai
# или
SPEECH_RECOGNITION_SYSTEM=local
```

### Проблема: Неправильный URL для доступа к приложению

**Важно:** При использовании Nginx приложение доступно на порту 80, а не 5173!

- ✅ **Правильно:** `http://89.104.66.105` или `http://89.104.66.105:80`
- ❌ **Неправильно:** `http://89.104.66.105:5173`

Порт 5173 используется только если:
- Запущен PM2 serve напрямую (без Nginx)
- Запущен Vite dev server для разработки

**Если используете Nginx (рекомендуется):**
- Откройте: `http://89.104.66.105` (без указания порта)
- Nginx слушает порт 80 и обслуживает статические файлы из `/root/LOGO/client/dist`

**Если используете PM2 serve (не рекомендуется):**
- Откройте: `http://89.104.66.105:5173`
- Но это не будет работать правильно с API!

### Проблема: "Не удается получить доступ к сайту" или "Сайт не позволяет установить соединение"

**Симптомы**: 
- Браузер показывает ошибку "Не удается получить доступ к сайту"
- "Сайт не позволяет установить соединение"
- Таймаут при попытке подключения

**Пошаговая диагностика и решение:**

1. **Проверьте, запущен ли Nginx:**
```bash
sudo systemctl status nginx
```
Если не запущен:
```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

2. **Проверьте, что порт 80 открыт в firewall:**
```bash
# Проверка статуса firewall
sudo ufw status

# Если firewall активен, откройте порты:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw reload
```

3. **Проверьте, что Nginx слушает порт 80:**
```bash
sudo netstat -tlnp | grep :80
# Или
sudo ss -tlnp | grep :80
```
Должна быть строка с `nginx` и портом `80`.

4. **Проверьте конфигурацию Nginx:**
```bash
# Проверка синтаксиса
sudo nginx -t

# Проверка активных конфигураций
ls -la /etc/nginx/sites-enabled/

# Если конфигурация не активна:
sudo ln -s /etc/nginx/sites-available/speech-therapist /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

5. **Проверьте, что frontend собран:**
```bash
ls -la /root/LOGO/client/dist/
```
Должен быть файл `index.html`. Если нет:
```bash
cd /root/LOGO/client
npm run build
```

6. **Проверьте права доступа к файлам:**
```bash
# Nginx должен иметь доступ к файлам
sudo chown -R www-data:www-data /root/LOGO/client/dist
# Или если используете root:
sudo chmod -R 755 /root/LOGO/client/dist
```

7. **Проверьте, что backend запущен:**
```bash
pm2 status
```
Если backend не запущен:
```bash
cd /root/LOGO/server
pm2 start index.js --name "speech-api" --env production
pm2 save
```

8. **Проверьте логи Nginx:**
```bash
# Логи ошибок
sudo tail -f /var/log/nginx/error.log

# Логи доступа
sudo tail -f /var/log/nginx/access.log
```

9. **Проверьте, что backend отвечает на localhost:**
```bash
curl http://localhost:3001/api/students
# Должен вернуть JSON или ошибку (но не "connection refused")
```

10. **Проверьте конфигурацию Nginx (server_name):**
```bash
sudo cat /etc/nginx/sites-available/speech-therapist | grep server_name
```
Если используете IP адрес, убедитесь что в конфигурации:
```nginx
server_name 89.104.66.105;  # Ваш IP
# Или для любого домена:
server_name _;
```

11. **Проверьте, что порт 80 не занят другим процессом:**
```bash
sudo lsof -i :80
# Или
sudo netstat -tlnp | grep :80
```

12. **Если используете Reg.ru VPS, проверьте настройки firewall в панели управления:**
- Зайдите в панель управления Reg.ru
- Проверьте настройки firewall/VPS
- Убедитесь, что порт 80 открыт для входящих соединений

**Быстрое решение (если ничего не помогло):**

```bash
# 1. Перезапустите Nginx
sudo systemctl restart nginx

# 2. Проверьте статус
sudo systemctl status nginx

# 3. Проверьте логи
sudo tail -20 /var/log/nginx/error.log

# 4. Убедитесь что backend запущен
pm2 restart speech-api
pm2 status
```

### Проблема: Ошибка 500 Internal Server Error

**Симптомы**: 
- Браузер показывает "500 Internal Server Error"
- Nginx работает, но не может обработать запрос

**Пошаговая диагностика:**

1. **Проверьте логи Nginx (самое важное!):**
```bash
sudo tail -50 /var/log/nginx/error.log
```
Ищите конкретные ошибки - они покажут причину проблемы.

2. **Проверьте, что frontend собран и файлы существуют:**
```bash
ls -la /root/LOGO/client/dist/index.html
```
Если файла нет:
```bash
cd /root/LOGO/client
npm run build
```

3. **Проверьте права доступа:**
```bash
ls -la /root/LOGO/client/dist/
```
Если права неправильные:
```bash
sudo chown -R www-data:www-data /root/LOGO/client/dist
sudo chmod -R 755 /root/LOGO/client/dist
```

4. **Проверьте конфигурацию Nginx:**
```bash
sudo nginx -t
```
Если есть ошибки - исправьте их.

5. **Проверьте, что backend запущен:**
```bash
pm2 status
pm2 logs speech-api --lines 20
```

6. **Проверьте работу API напрямую:**
```bash
curl http://localhost:3001/api/students
```
Если не работает - проблема в backend.

7. **Проверьте конфигурацию Nginx (путь к файлам):**
```bash
sudo cat /etc/nginx/sites-available/speech-therapist
```
Убедитесь, что `root` указывает на правильный путь.

**Быстрое решение:**

```bash
# 1. Проверьте логи
sudo tail -50 /var/log/nginx/error.log

# 2. Исправьте права
sudo chown -R www-data:www-data /root/LOGO/client/dist
sudo chmod -R 755 /root/LOGO/client/dist

# 3. Убедитесь что frontend собран
cd /root/LOGO/client
npm run build
sudo chown -R www-data:www-data /root/LOGO/client/dist

# 4. Проверьте backend
pm2 restart speech-api
pm2 logs speech-api --lines 20

# 5. Перезагрузите Nginx
sudo nginx -t
sudo systemctl reload nginx

# 6. Проверьте снова
curl http://localhost:3001/api/students
```

**Частые причины ошибки 500:**
1. Нет прав доступа к файлам (Permission denied)
2. Файлы не существуют (404 внутри 500)
3. Backend не запущен или упал
4. Ошибка в конфигурации Nginx
5. Проблемы с базой данных

### Проблема: Ошибка 413 (Payload Too Large) при загрузке картинок

**Симптомы**: 
- При загрузке картинки со смартфона получаете ошибку `413 Request Entity Too Large`
- Загрузка небольших файлов работает, но большие фото не загружаются

**Причина**: Nginx по умолчанию имеет лимит 1MB для загрузки файлов. Фото со смартфонов часто больше этого лимита.

**Решение:**

1. **Обновите конфигурацию Nginx:**
```bash
sudo nano /etc/nginx/sites-available/speech-therapist
```

Добавьте в секцию `server`:
```nginx
# Увеличенный лимит для загрузки файлов (фото со смартфонов)
client_max_body_size 50M;
```

И в секцию `location /api`:
```nginx
location /api {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    # Увеличенный лимит для загрузки через прокси
    client_max_body_size 50M;
}
```

2. **Проверьте и перезагрузите Nginx:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

3. **Убедитесь, что лимит в Express тоже увеличен:**
Лимит в `server/routes/images.js` уже увеличен до 50MB. Если нужно больше, измените:
```javascript
limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
```

4. **Перезапустите backend:**
```bash
pm2 restart speech-api
```

**Проверка:**
После изменений попробуйте загрузить картинку снова. Если ошибка сохраняется, проверьте логи:
```bash
sudo tail -f /var/log/nginx/error.log
pm2 logs speech-api
```

**Примечание:** Если нужно увеличить лимит еще больше (например, до 100MB), измените `50M` на `100M` в обоих местах конфигурации Nginx.

### Проблема: Frontend загружается, но данные не отображаются (пустой список студентов)

**Симптомы**: 
- Страница загружается, но список студентов пустой
- В консоли браузера ошибки типа "Failed to fetch" или "Network error"
- Код показывает `e.map` (пустой массив)

**Пошаговая диагностика:**

1. **Проверьте, что backend запущен:**
```bash
pm2 status
```
Должен быть процесс `speech-api` в статусе `online`. Если нет:
```bash
cd /root/LOGO/server
pm2 start index.js --name "speech-api" --env production
pm2 logs speech-api
```

2. **Проверьте логи backend:**
```bash
pm2 logs speech-api --lines 50
```
Ищите сообщения:
- `Connected to SQLite database` - БД подключена
- `Students table ready` - таблицы созданы
- Ошибки подключения к БД

3. **Проверьте, что база данных создана:**
```bash
ls -la /root/LOGO/server/database.sqlite
```
Если файла нет, проверьте права доступа:
```bash
cd /root/LOGO/server
touch database.sqlite
chmod 666 database.sqlite
# Перезапустите backend
pm2 restart speech-api
```

4. **Проверьте работу API напрямую:**
```bash
# С сервера
curl http://localhost:3001/api/students

# Должен вернуть JSON массив (может быть пустым [])
# Если ошибка - проверьте логи PM2
```

5. **Проверьте, что Nginx проксирует API запросы:**
```bash
# Проверьте конфигурацию
sudo cat /etc/nginx/sites-available/speech-therapist | grep -A 5 "location /api"
```
Должно быть:
```nginx
location /api {
    proxy_pass http://localhost:3001;
    ...
}
```

6. **Проверьте API через браузер:**
Откройте в браузере: `http://89.104.66.105/api/students`
- Должен вернуться JSON (может быть пустой массив `[]`)
- Если ошибка 502/503 - backend не работает
- Если 404 - проблема с Nginx конфигурацией

7. **Проверьте консоль браузера:**
- Откройте DevTools (F12)
- Вкладка Console - ищите ошибки
- Вкладка Network - проверьте запросы к `/api/students`
  - Статус должен быть 200
  - Если CORS ошибка - проверьте настройки CORS в backend

8. **Проверьте права на директорию server:**
```bash
ls -la /root/LOGO/server/
# Убедитесь что есть права на запись
chmod 755 /root/LOGO/server
```

9. **Если база данных пустая, создайте тестового студента:**
```bash
curl -X POST http://localhost:3001/api/students \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Тест","last_name":"Студент"}'
```

**Быстрое решение:**

```bash
# 1. Проверьте и перезапустите backend
pm2 restart speech-api
pm2 logs speech-api --lines 20

# 2. Проверьте API
curl http://localhost:3001/api/students

# 3. Если БД не создалась, создайте вручную
cd /root/LOGO/server
rm -f database.sqlite  # Удалите если есть проблемы
pm2 restart speech-api
sleep 2
ls -la database.sqlite  # Должен появиться

# 4. Проверьте через браузер
# Откройте: http://89.104.66.105/api/students
```

**Частые причины:**
1. Backend не запущен или упал
2. База данных не создалась (нет прав на запись)
3. Nginx не проксирует `/api` запросы
4. Firewall блокирует внутренние соединения
5. Backend слушает только 127.0.0.1 вместо 0.0.0.0

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

