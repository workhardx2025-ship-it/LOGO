# Установка Vosk на Windows - Решение проблем

## Проблема: "missing any VC++ toolset"

Если при установке `vosk` вы видите ошибку:
```
gyp ERR! find VS - found "Visual Studio C++ core features"
gyp ERR! find VS - missing any VC++ toolset
```

Это означает, что Visual Studio установлен, но отсутствуют необходимые компоненты C++.

## Решение

### Шаг 1: Установка Visual Studio с компонентами C++

1. **Скачайте Visual Studio Community** (бесплатно):
   - Перейдите на https://visualstudio.microsoft.com/downloads/
   - Скачайте "Visual Studio Community 2022"

2. **Запустите установщик** и выберите:
   - ✅ **"Desktop development with C++"** (рабочая нагрузка)
   
3. **В разделе "Installation details"** убедитесь, что установлены:
   - ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools (Latest)
   - ✅ Windows 10 SDK или Windows 11 SDK
   - ✅ C++ CMake tools for Windows
   - ✅ Testing tools core features - Build Tools (опционально)

4. **Нажмите "Install"** и дождитесь завершения установки (может занять 10-20 минут)

5. **Перезапустите компьютер** после установки

### Шаг 2: Установка vosk

После перезапуска откройте терминал и выполните:

```bash
cd server
npm install vosk
```

### Альтернатива: Windows Build Tools (минимальная установка)

Если не хотите устанавливать полный Visual Studio:

1. Установите Windows Build Tools:
   ```bash
   npm install --global windows-build-tools
   ```
   
   **Примечание:** Эта команда может занять много времени и требует прав администратора.

2. После установки перезапустите терминал и попробуйте:
   ```bash
   npm install vosk
   ```

## Если установка все еще не работает

### Вариант 1: Использовать альтернативные методы распознавания

Приложение поддерживает три метода распознавания. Если Vosk не устанавливается, используйте другие:

**OpenAI API** (рекомендуется, если есть API ключ):
```env
SPEECH_RECOGNITION_SYSTEM=openai
OPENAI_API_KEY=your_key_here
```

**Преимущества:**
- Не требует установки дополнительного ПО
- Высокое качество распознавания
- Работает сразу после настройки API ключа

**Локальный Whisper** (не требует компиляции):
```env
SPEECH_RECOGNITION_SYSTEM=local
```

**Преимущества:**
- Не требует компиляции нативных модулей
- Работает полностью офлайн
- Автоматически загружает модель при первом использовании

### Вариант 2: Использовать WSL (Windows Subsystem for Linux)

Если у вас установлен WSL, вы можете установить vosk там:

```bash
wsl
cd /mnt/d/CursorProjects/server
npm install vosk
```

Затем запускайте сервер из WSL.

## Проверка установки

После успешной установки vosk, проверьте:

```bash
cd server
node -e "const vosk = require('vosk'); console.log('Vosk installed successfully!');"
```

Если команда выполнилась без ошибок, vosk установлен правильно.

## Следующие шаги

После установки vosk:

1. Скачайте модель с https://alphacephei.com/vosk/models
2. Распакуйте в `server/models/`
3. Настройте `.env`:
   ```
   SPEECH_RECOGNITION_SYSTEM=vosk
   VOSK_MODEL_PATH=./models/vosk-model-ru-0.22
   ```
4. Перезапустите сервер

## Важно

**Приложение будет работать нормально даже без Vosk!** 

Если установка vosk вызывает проблемы, просто используйте другие методы распознавания (OpenAI API или локальный Whisper). Все три метода интегрированы в приложение и работают одинаково хорошо.

