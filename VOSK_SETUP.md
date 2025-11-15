# Настройка Vosk для распознавания речи

Vosk - это офлайн-распознавание речи, которое работает локально и не требует подключения к интернету.

## Установка

### 1. Установка пакета vosk

```bash
cd server
npm install vosk
```

**⚠️ ВАЖНО для Windows:** Установка требует Visual Studio с компонентами C++ для компиляции нативных модулей.

#### Если установка не удалась (ошибка "missing any VC++ toolset"):

**Вариант 1: Установить Visual Studio (рекомендуется)**
1. Скачайте [Visual Studio Community](https://visualstudio.microsoft.com/downloads/) (бесплатно)
2. При установке выберите рабочую нагрузку **"Desktop development with C++"**
3. Убедитесь, что установлены компоненты:
   - MSVC v143 - VS 2022 C++ x64/x86 build tools
   - Windows 10/11 SDK
   - C++ CMake tools for Windows
4. После установки перезапустите компьютер
5. Попробуйте установить vosk снова:
   ```bash
   npm install vosk
   ```

**Вариант 2: Использовать альтернативные методы распознавания**
Если установка Visual Studio не подходит, используйте:
- **OpenAI API** (требует API ключ, но работает без установки дополнительного ПО):
  ```
  SPEECH_RECOGNITION_SYSTEM=openai
  OPENAI_API_KEY=your_key_here
  ```
- **Локальный Whisper** (не требует компиляции, работает через JavaScript):
  ```
  SPEECH_RECOGNITION_SYSTEM=local
  ```

**Вариант 3: Использовать Windows Build Tools (минимальная установка)**
```bash
npm install --global windows-build-tools
```
Затем попробуйте установить vosk снова.

**Примечание:** Приложение будет работать нормально даже без Vosk - просто используйте другие методы распознавания.

### 2. Скачивание модели

Перейдите на https://alphacephei.com/vosk/models и выберите подходящую модель для вашего языка.

**Для русского языка рекомендуется:**
- `vosk-model-ru-0.22` (около 1.5 GB) - хороший баланс между качеством и размером
- `vosk-model-small-ru-0.22` (около 45 MB) - компактная модель, быстрее работает
- `vosk-model-ru-0.42` (около 1.8 GB) - более новая и точная модель

**Скачивание модели:**

**Windows (PowerShell):**
```powershell
cd server
New-Item -ItemType Directory -Path "models" -Force
cd models
# Скачайте модель вручную с сайта или используйте curl/wget если установлены
# Например, для vosk-model-ru-0.22:
# curl -L -o vosk-model-ru-0.22.zip https://alphacephei.com/vosk/models/vosk-model-ru-0.22.zip
# Expand-Archive -Path vosk-model-ru-0.22.zip -DestinationPath .
```

**Linux/Mac:**
```bash
cd server
mkdir -p models
cd models
wget https://alphacephei.com/vosk/models/vosk-model-ru-0.22.zip
unzip vosk-model-ru-0.22.zip
```

### 3. Настройка пути к модели

Откройте `server/.env` и добавьте:

```
SPEECH_RECOGNITION_SYSTEM=vosk
VOSK_MODEL_PATH=./models/vosk-model-ru-0.22
```

Или используйте абсолютный путь:
```
VOSK_MODEL_PATH=D:\CursorProjects\server\models\vosk-model-ru-0.22
```

Если `VOSK_MODEL_PATH` не указан, по умолчанию используется `./models/vosk-model-ru-0.22`.

## Использование

После установки модели и настройки `.env` файла, перезапустите сервер:

```bash
npm run dev
```

При первом использовании Vosk модель будет загружена в память (может занять несколько секунд).

## Преимущества Vosk

- ✅ Работает полностью офлайн (не требует интернета)
- ✅ Быстрое распознавание после загрузки модели
- ✅ Низкое потребление ресурсов
- ✅ Поддержка множества языков

## Недостатки

- ❌ Требует скачивания модели (от 45 MB до 2+ GB)
- ❌ На Windows может потребоваться Visual Studio для установки
- ❌ Модель загружается в память при старте

## Troubleshooting

### Ошибка: "Модель Vosk не найдена"
- Убедитесь, что модель скачана и распакована
- Проверьте путь в `VOSK_MODEL_PATH`
- Убедитесь, что путь указывает на директорию с моделью (не на zip-файл)

### Ошибка при установке пакета vosk
- На Windows установите Visual Studio с компонентами C++
- Или используйте альтернативные методы распознавания

### Медленное распознавание
- Используйте более легкую модель (например, `vosk-model-small-ru-0.22`)
- Убедитесь, что модель загружена (проверьте логи при старте сервера)

