# Диагностика ошибок распознавания речи

## Ошибка 500 (Internal Server Error)

Если вы получаете ошибку 500 при попытке распознавания речи, выполните следующие шаги:

### Шаг 1: Проверьте логи сервера

В консоли, где запущен сервер, должны быть детальные сообщения об ошибке. Ищите строки:
- `Speech recognition error:`
- `Error stack:`
- `Error details:`

### Шаг 2: Проверьте статус систем распознавания

Откройте в браузере: **http://localhost:3001/api/speech/status**

Должен вернуться JSON с информацией:
```json
{
  "recognitionSystem": "openai",
  "localWhisperAvailable": false,
  "openAIWhisperAvailable": true,
  "openAIKeyConfigured": true,
  "fallbackEnabled": true
}
```

### Шаг 3: Проверьте конфигурацию

Откройте файл `server/.env` и убедитесь, что:

**Для OpenAI API:**
```env
SPEECH_RECOGNITION_SYSTEM=openai
OPENAI_API_KEY=your_api_key_here
```

**Для локального Whisper:**
```env
SPEECH_RECOGNITION_SYSTEM=local
```

### Шаг 4: Распространенные проблемы

#### Проблема: "OpenAI API key not configured"

**Решение:**
1. Проверьте, что файл `server/.env` существует
2. Убедитесь, что в нем есть строка `OPENAI_API_KEY=...`
3. Перезапустите сервер после изменения `.env`

#### Проблема: "Speech recognition failed" с деталями об API

**Возможные причины:**
- Неправильный API ключ
- Нет кредитов на аккаунте OpenAI
- Проблемы с интернет-соединением
- Превышен лимит запросов

**Решение:**
1. Проверьте API ключ на https://platform.openai.com/api-keys
2. Проверьте баланс на https://platform.openai.com/account/billing
3. Попробуйте переключиться на локальный Whisper:
   ```env
   SPEECH_RECOGNITION_SYSTEM=local
   ```

#### Проблема: Локальный Whisper не работает

**Возможные причины:**
- Не установлен `@xenova/transformers`
- Недостаточно памяти (нужно минимум 4GB RAM)
- Ошибка при загрузке модели

**Решение:**
1. Установите зависимости:
   ```bash
   cd server
   npm install
   ```

2. Проверьте доступную память

3. Попробуйте использовать OpenAI API как fallback:
   ```env
   SPEECH_RECOGNITION_SYSTEM=local
   FALLBACK_TO_OPENAI=true
   OPENAI_API_KEY=your_api_key_here
   ```

#### Проблема: "No audio file provided"

**Причина:** Аудио файл не был передан на сервер

**Решение:**
1. Проверьте, что микрофон работает
2. Проверьте разрешения браузера на доступ к микрофону
3. Попробуйте записать аудио еще раз

### Шаг 5: Проверка в браузере

Откройте консоль разработчика (F12) и проверьте:
1. Вкладка **Network** - посмотрите на запрос к `/api/speech/recognize`
2. Вкладка **Console** - там могут быть дополнительные ошибки

### Шаг 6: Тестирование API напрямую

Попробуйте отправить тестовый запрос через curl или Postman:

```bash
curl -X POST http://localhost:3001/api/speech/recognize \
  -F "audio=@test_audio.webm"
```

### Получение детальной информации об ошибке

В консоли браузера (F12) после ошибки выполните:

```javascript
// Если ошибка сохранена в переменной err:
console.log('Полная ошибка:', err)
console.log('Ответ сервера:', err.response?.data)
console.log('Статус:', err.response?.status)
```

### Контакты для помощи

Если проблема не решена:
1. Скопируйте полные логи из консоли сервера
2. Скопируйте ответ от `/api/speech/status`
3. Укажите, какая система распознавания используется (openai/local)

