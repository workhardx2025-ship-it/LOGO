# Решение проблем с HTTPS

## Ошибка "socket hang up" в Vite proxy

Эта ошибка возникает, когда:
- Vite работает по HTTPS, а сервер по HTTP (или наоборот)
- Прокси пытается подключиться по неправильному протоколу

### Решение:

1. **Убедитесь, что протоколы совпадают:**

   **Вариант 1: Оба используют HTTPS**
   - В `server/.env`: `HTTPS_ENABLED=true`
   - В `client/.env`: `VITE_HTTPS_ENABLED=true`
   - В `client/.env`: `VITE_SERVER_HTTPS=true` (чтобы прокси использовал HTTPS)

   **Вариант 2: Оба используют HTTP**
   - В `server/.env`: `HTTPS_ENABLED=false` или удалите эту строку
   - В `client/.env`: `VITE_HTTPS_ENABLED=false` или удалите эту строку

2. **Проверьте пути к сертификатам в server/.env:**
   ```env
   HTTPS_CERT_PATH=.\certs\localhost+3.pem
   HTTPS_KEY_PATH=.\certs\localhost+3-key.pem
   ```

3. **Убедитесь, что сертификаты существуют:**
   ```powershell
   Test-Path "D:\CursorProjects\server\certs\localhost+3.pem"
   Test-Path "D:\CursorProjects\server\certs\localhost+3-key.pem"
   ```

4. **Перезапустите оба сервера:**
   ```bash
   # Остановите текущие процессы (Ctrl+C)
   npm run dev
   ```

## Другие распространенные проблемы

### Ошибка "ERR_CERT_AUTHORITY_INVALID"

Это нормально для самоподписанных сертификатов. Решение:
- Используйте mkcert для создания доверенных сертификатов (см. HTTPS_SETUP.md)
- Или примите предупреждение в браузере

### Порт занят

Если порты 3001 или 5173 заняты:
- Измените порты в `server/.env` и `client/vite.config.js`
- Или остановите другие приложения, использующие эти порты

### CORS ошибки

Убедитесь, что в `server/index.js` включен CORS:
```javascript
app.use(cors());
```

### Микрофон не работает на Safari iOS

Safari на iOS требует HTTPS для доступа к микрофону. Убедитесь, что:
- Сервер работает по HTTPS (`HTTPS_ENABLED=true`)
- Vite работает по HTTPS (`VITE_HTTPS_ENABLED=true`)
- Используете правильный URL: `https://192.168.x.x:5173` (не `http://`)

