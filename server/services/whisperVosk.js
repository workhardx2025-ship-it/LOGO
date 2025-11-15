const { Model, Recognizer } = require('vosk');
const fs = require('fs');
const path = require('path');
const { WaveFile } = require('wavefile');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// Устанавливаем путь к ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

let model = null;
let isInitializing = false;
let initPromise = null;

/**
 * Инициализация модели Vosk
 */
async function initializeModel() {
  if (model) {
    return model;
  }

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      const modelPath = process.env.VOSK_MODEL_PATH || path.join(__dirname, '..', 'models', 'vosk-model-ru-0.22');
      
      console.log('[Vosk] Инициализация модели Vosk...');
      console.log('[Vosk] Путь к модели:', modelPath);
      
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Модель Vosk не найдена по пути: ${modelPath}. Пожалуйста, скачайте модель с https://alphacephei.com/vosk/models и распакуйте в директорию models/`);
      }

      model = new Model(modelPath);
      console.log('[Vosk] Модель успешно загружена!');
      
      // Проверяем, что используется русская модель
      const modelName = path.basename(modelPath);
      const isRussianModel = modelName.includes('ru') || modelName.includes('russian');
      
      if (isRussianModel) {
        console.log('[Vosk] ✓ Используется русская модель:', modelName);
      } else {
        console.warn('[Vosk] ⚠️ Внимание: Модель может быть не для русского языка:', modelName);
        console.warn('[Vosk] Для русского языка рекомендуется использовать модель vosk-model-ru-0.22');
      }
      
      // Попытка получить информацию о модели (может быть недоступна в некоторых версиях)
      try {
        if (model.name) {
          console.log('[Vosk] Имя модели:', model.name);
        }
        if (model.lang) {
          console.log('[Vosk] Язык модели:', model.lang);
        }
      } catch (e) {
        // Игнорируем, если свойства недоступны
      }
      
      isInitializing = false;
      return model;
    } catch (error) {
      console.error('[Vosk] Ошибка инициализации модели:', error);
      isInitializing = false;
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Конвертация аудио файла в WAV формат с помощью ffmpeg
 * @param {string} inputPath - Путь к входному файлу
 * @param {string} outputPath - Путь к выходному WAV файлу
 * @returns {Promise<void>}
 */
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    console.log(`[Vosk FFmpeg] Начало конвертации: ${inputPath}`);
    
    ffmpeg(inputPath)
      .toFormat('wav')
      .audioFrequency(16000) // Vosk требует 16kHz
      .audioChannels(1) // Моно
      .audioCodec('pcm_s16le') // 16-bit PCM
      .on('end', () => {
        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`[Vosk FFmpeg] Конвертация завершена за ${duration} секунд`);
        resolve();
      })
      .on('error', (err) => {
        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.error(`[Vosk FFmpeg] Ошибка конвертации (${duration} сек):`, err);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Конвертация аудио буфера в WAV формат для Vosk
 * @param {Buffer} audioBuffer - Буфер с аудио данными
 * @param {string} mimetype - MIME тип аудио
 * @param {string} tempDir - Директория для временных файлов
 * @returns {Promise<Buffer>} - WAV буфер
 */
async function convertAudioToWav(audioBuffer, mimetype, tempDir) {
  const conversionStartTime = performance.now();
  
  try {
    // Если это уже WAV файл, проверяем формат
    if (mimetype.includes('wav') || mimetype.includes('wave')) {
      try {
        const wav = new WaveFile(audioBuffer);
        // Проверяем, соответствует ли формат требованиям Vosk (16kHz, mono, 16-bit)
        if (wav.fmt.sampleRate === 16000 && wav.fmt.numChannels === 1 && wav.fmt.bitsPerSample === 16) {
          console.log('[Vosk] Аудио уже в правильном формате (16kHz, mono, 16-bit)');
          return audioBuffer;
        } else {
          console.log('[Vosk] Конвертируем WAV в правильный формат...');
          wav.toSampleRate(16000);
          wav.toBitDepth('16');
          wav.toMono();
          return Buffer.from(wav.toBuffer());
        }
      } catch (wavError) {
        console.log('[Vosk] Не удалось обработать как WAV, используем ffmpeg...');
        // Продолжаем с ffmpeg
      }
    }
    
    // Для других форматов конвертируем в WAV с помощью ffmpeg
    console.log(`[Vosk] Конвертация ${mimetype} в WAV формат...`);
    console.log(`[Vosk] Размер входного файла: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
    
    const tempInputPath = path.join(tempDir, `vosk_input_${Date.now()}.${mimetype.includes('webm') ? 'webm' : mimetype.includes('mp3') ? 'mp3' : 'wav'}`);
    const tempOutputPath = path.join(tempDir, `vosk_output_${Date.now()}.wav`);
    
    try {
      // Сохраняем входной файл
      const writeStartTime = performance.now();
      fs.writeFileSync(tempInputPath, audioBuffer);
      const writeEndTime = performance.now();
      const writeDuration = ((writeEndTime - writeStartTime) / 1000).toFixed(3);
      console.log(`[Vosk] Запись временного файла: ${writeDuration} секунд`);
      
      // Конвертируем в WAV
      await convertToWav(tempInputPath, tempOutputPath);
      
      // Читаем конвертированный WAV файл
      const readStartTime = performance.now();
      const wavBuffer = fs.readFileSync(tempOutputPath);
      const readEndTime = performance.now();
      const readDuration = ((readEndTime - readStartTime) / 1000).toFixed(3);
      console.log(`[Vosk] Чтение WAV файла: ${readDuration} секунд`);
      
      // Удаляем временные файлы
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
      
      const conversionEndTime = performance.now();
      const totalDuration = ((conversionEndTime - conversionStartTime) / 1000).toFixed(2);
      console.log(`[Vosk] Общее время конвертации: ${totalDuration} секунд`);
      
      return wavBuffer;
    } catch (conversionError) {
      // Удаляем временные файлы в случае ошибки
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
      throw conversionError;
    }
  } catch (error) {
    const conversionEndTime = performance.now();
    const totalDuration = ((conversionEndTime - conversionStartTime) / 1000).toFixed(2);
    console.error(`[Vosk] Ошибка конвертации (${totalDuration} сек):`, error);
    throw error;
  }
}

/**
 * Распознавание речи из буфера с помощью Vosk
 * @param {Buffer} audioBuffer - Буфер с аудио данными
 * @param {string} tempDir - Директория для временных файлов
 * @param {string} mimetype - MIME тип аудио (по умолчанию 'audio/webm')
 * @param {string} language - Язык (по умолчанию 'ru')
 * @returns {Promise<string>} - Распознанный текст
 */
async function transcribeFromBuffer(audioBuffer, tempDir, mimetype = 'audio/webm', language = 'ru') {
  const transcriptionStartTime = performance.now();
  
  try {
    // Инициализируем модель если нужно
    if (!model) {
      await initializeModel();
    }

    console.log('[Vosk] Начало распознавания речи из буфера...');
    console.log('[Vosk] Размер буфера:', audioBuffer.length, 'байт', `(${(audioBuffer.length / 1024).toFixed(2)} KB)`);
    console.log('[Vosk] MIME тип:', mimetype);
    console.log('[Vosk] Язык распознавания: русский (определяется моделью)');
    
    // Проверяем, что используется русская модель
    const modelPath = process.env.VOSK_MODEL_PATH || path.join(__dirname, '..', 'models', 'vosk-model-ru-0.22');
    const modelName = path.basename(modelPath);
    if (!modelName.includes('ru') && !modelName.includes('russian')) {
      console.warn('[Vosk] ⚠️ Предупреждение: Модель может быть не для русского языка. Для русского языка используйте модель с "ru" в названии.');
    }

    // Конвертируем аудио в WAV формат (16kHz, mono, 16-bit PCM)
    const wavBuffer = await convertAudioToWav(audioBuffer, mimetype, tempDir);
    console.log(`[Vosk] Размер WAV буфера: ${(wavBuffer.length / 1024).toFixed(2)} KB`);

    // Извлекаем PCM данные из WAV файла
    const wav = new WaveFile(wavBuffer);
    
    // Проверяем параметры WAV файла
    console.log('[Vosk] Параметры WAV файла:', {
      sampleRate: wav.fmt.sampleRate,
      numChannels: wav.fmt.numChannels,
      bitsPerSample: wav.fmt.bitsPerSample,
      byteRate: wav.fmt.byteRate
    });
    
    // Убеждаемся, что формат правильный
    if (wav.fmt.sampleRate !== 16000) {
      console.log(`[Vosk] Конвертируем частоту дискретизации с ${wav.fmt.sampleRate} Hz на 16000 Hz`);
      wav.toSampleRate(16000);
    }
    if (wav.fmt.numChannels !== 1) {
      console.log(`[Vosk] Конвертируем в моно (было ${wav.fmt.numChannels} каналов)`);
      wav.toMono();
    }
    if (wav.fmt.bitsPerSample !== 16) {
      console.log(`[Vosk] Конвертируем в 16-bit (было ${wav.fmt.bitsPerSample} бит)`);
      wav.toBitDepth('16');
    }
    
    // Получаем сэмплы как массив чисел
    // getSamples(false) возвращает плоский массив для моно или массив массивов для стерео
    let pcmData = null;
    
    try {
      pcmData = wav.getSamples(false);
      console.log('[Vosk] Тип данных getSamples(false):', typeof pcmData, Array.isArray(pcmData) ? 'массив' : 'не массив');
      
      if (Array.isArray(pcmData)) {
        console.log('[Vosk] Длина массива:', pcmData.length);
        if (pcmData.length > 0) {
          console.log('[Vosk] Тип первого элемента:', typeof pcmData[0], Array.isArray(pcmData[0]) ? '(массив)' : '');
        }
      }
    } catch (e) {
      console.error('[Vosk] Ошибка при вызове getSamples(false):', e.message);
      // Пробуем без параметра
      try {
        pcmData = wav.getSamples();
        console.log('[Vosk] Использован getSamples() без параметров');
      } catch (e2) {
        console.error('[Vosk] Ошибка при вызове getSamples():', e2.message);
        throw new Error(`Не удалось извлечь PCM данные: ${e.message}`);
      }
    }
    
    // Если это массив массивов (стерео), берем первый канал или конвертируем в моно
    if (Array.isArray(pcmData) && pcmData.length > 0 && Array.isArray(pcmData[0])) {
      console.log('[Vosk] Обнаружены множественные каналы, конвертируем в моно...');
      // Берем первый канал или усредняем
      pcmData = pcmData[0];
    }
    
    // Если это не массив, пробуем другой способ
    if (!Array.isArray(pcmData)) {
      console.log('[Vosk] getSamples вернул не массив, пробуем альтернативный метод...');
      console.log('[Vosk] Тип pcmData:', typeof pcmData, pcmData.constructor?.name);
      
      // Пробуем получить данные напрямую из буфера WAV
      try {
        // Проверяем, может быть это TypedArray (Int16Array, Float32Array и т.д.)
        if (pcmData && typeof pcmData.length === 'number' && pcmData.length > 0) {
          console.log('[Vosk] Обнаружен объект с length, пробуем конвертировать в массив...');
          console.log('[Vosk] Length:', pcmData.length);
          // Конвертируем в обычный массив
          pcmData = Array.from(pcmData);
          console.log('[Vosk] Конвертировано в массив, размер:', pcmData.length);
        } else if (wav.data && wav.data.samples) {
          const samples = wav.data.samples;
          console.log('[Vosk] wav.data.samples тип:', typeof samples, samples.constructor?.name);
          console.log('[Vosk] wav.data.samples length:', samples.length);
          
          if (samples && typeof samples.length === 'number' && samples.length > 0) {
            // Конвертируем в массив
            pcmData = Array.from(samples);
            console.log('[Vosk] Использованы данные из wav.data.samples, конвертировано в массив');
          } else {
            throw new Error('wav.data.samples не является массивом или TypedArray');
          }
        } else {
          // Пробуем извлечь PCM данные напрямую из буфера (пропуская заголовок)
          console.log('[Vosk] Извлекаем PCM данные напрямую из буфера WAV...');
          
          // Находим начало данных в WAV файле
          // WAV файл имеет структуру: RIFF header -> fmt chunk -> data chunk
          // Ищем "data" chunk
          let dataOffset = 0;
          const dataChunkMarker = Buffer.from('data', 'ascii');
          
          for (let i = 0; i < wavBuffer.length - 4; i++) {
            if (wavBuffer.slice(i, i + 4).equals(dataChunkMarker)) {
              dataOffset = i + 8; // Пропускаем "data" (4 байта) + размер chunk (4 байта)
              console.log('[Vosk] Найден data chunk на позиции:', i, 'данные начинаются с:', dataOffset);
              break;
            }
          }
          
          if (dataOffset === 0) {
            // Если не нашли data chunk, используем стандартный размер заголовка
            dataOffset = 44;
            console.log('[Vosk] Data chunk не найден, используем стандартный offset 44');
          }
          
          const audioData = wavBuffer.slice(dataOffset);
          console.log('[Vosk] Размер аудио данных из буфера:', audioData.length, 'байт');
          
          // Конвертируем байты в float массив
          pcmData = [];
          for (let i = 0; i < audioData.length; i += 2) {
            if (i + 1 < audioData.length) {
              const int16Value = audioData.readInt16LE(i);
              // Конвертируем int16 (-32768 to 32767) в float (-1.0 to 1.0)
              pcmData.push(int16Value / 32768.0);
            }
          }
          console.log('[Vosk] Извлечены PCM данные напрямую из буфера, размер:', pcmData.length);
        }
      } catch (e) {
        console.error('[Vosk] Ошибка при альтернативном извлечении:', e.message);
        console.error('[Vosk] Stack:', e.stack);
        throw new Error(`Не удалось извлечь PCM данные из WAV файла: ${e.message}`);
      }
    }
    
    // Убеждаемся, что это массив чисел
    if (!Array.isArray(pcmData) || pcmData.length === 0) {
      console.error('[Vosk] pcmData после обработки:', typeof pcmData, Array.isArray(pcmData) ? `массив длиной ${pcmData.length}` : 'не массив');
      throw new Error(`Не удалось извлечь PCM данные из WAV файла: получен ${typeof pcmData}, длина: ${Array.isArray(pcmData) ? pcmData.length : 'N/A'}`);
    }
    
    console.log(`[Vosk] Количество сэмплов: ${pcmData.length}`);
    console.log(`[Vosk] Длительность аудио: ${(pcmData.length / 16000).toFixed(2)} секунд`);
    
    // Проверяем формат данных - могут быть float (-1.0 to 1.0) или int16 (-32768 to 32767)
    const maxValue = Math.max(...pcmData.map(Math.abs));
    const isInt16Format = maxValue > 1.0 && maxValue <= 32768;
    
    console.log(`[Vosk] Максимальное значение в данных: ${maxValue.toFixed(2)}`);
    console.log(`[Vosk] Формат данных: ${isInt16Format ? 'int16 (уже в правильном формате)' : 'float (-1.0 to 1.0)'}`);
    
    // Проверяем, есть ли звук (не все нули)
    const threshold = isInt16Format ? 100 : 0.001; // Для int16 используем больший порог
    const nonZeroSamples = pcmData.filter(sample => Math.abs(sample) > threshold);
    const hasAudio = nonZeroSamples.length > 0;
    const audioPercentage = (nonZeroSamples.length / pcmData.length * 100).toFixed(2);
    
    console.log(`[Vosk] Не-нулевых сэмплов: ${nonZeroSamples.length} из ${pcmData.length} (${audioPercentage}%)`);
    
    if (!hasAudio) {
      console.warn('[Vosk] ⚠️ Предупреждение: Аудио данные кажутся пустыми (все нули или очень тихие)');
    } else {
      // Находим первый и последний не-нулевые сэмплы
      const firstNonZero = pcmData.findIndex(sample => Math.abs(sample) > threshold);
      const lastNonZero = pcmData.length - 1 - [...pcmData].reverse().findIndex(sample => Math.abs(sample) > threshold);
      console.log(`[Vosk] Первый не-нулевой сэмпл: ${firstNonZero}, Последний: ${lastNonZero}`);
      console.log(`[Vosk] Значения первых 20 сэмплов:`, pcmData.slice(0, 20).map(s => isInt16Format ? s : s.toFixed(6)));
      console.log(`[Vosk] Максимальная амплитуда: ${maxValue.toFixed(2)}`);
    }
    
    // Конвертируем в Buffer с 16-bit PCM (little-endian)
    const pcmBuffer = Buffer.allocUnsafe(pcmData.length * 2);
    for (let i = 0; i < pcmData.length; i++) {
      let int16Sample;
      
      if (isInt16Format) {
        // Данные уже в формате int16, просто ограничиваем диапазон
        int16Sample = Math.max(-32768, Math.min(32767, Math.round(pcmData[i])));
      } else {
        // Конвертируем float (-1.0 to 1.0) в int16 (-32768 to 32767)
        const sample = Math.max(-1, Math.min(1, pcmData[i]));
        int16Sample = Math.round(sample * 32767);
      }
      
      // Записываем как little-endian (LE)
      pcmBuffer.writeInt16LE(int16Sample, i * 2);
    }
    
    console.log(`[Vosk] Размер PCM данных: ${(pcmBuffer.length / 1024).toFixed(2)} KB`);
    
    // Проверяем первые и средние сэмплы
    const firstSamples = [];
    const middleSamples = [];
    const lastSamples = [];
    for (let i = 0; i < Math.min(10, pcmData.length); i++) {
      firstSamples.push(pcmBuffer.readInt16LE(i * 2));
    }
    const middleStart = Math.floor(pcmData.length / 2);
    for (let i = 0; i < Math.min(10, pcmData.length - middleStart); i++) {
      middleSamples.push(pcmBuffer.readInt16LE((middleStart + i) * 2));
    }
    const lastStart = Math.max(0, pcmData.length - 10);
    for (let i = 0; i < Math.min(10, pcmData.length - lastStart); i++) {
      lastSamples.push(pcmBuffer.readInt16LE((lastStart + i) * 2));
    }
    console.log(`[Vosk] Первые 10 сэмплов PCM (int16):`, firstSamples);
    console.log(`[Vosk] Средние 10 сэмплов PCM (int16):`, middleSamples);
    console.log(`[Vosk] Последние 10 сэмплов PCM (int16):`, lastSamples);

    // Создаем распознаватель
    const recognizer = new Recognizer({ model: model, sampleRate: 16000 });
    recognizer.setWords(true); // Включаем распознавание слов

    // Обрабатываем аудио по частям (chunks)
    // Vosk рекомендует использовать чанки размером около 4000 байт (2000 сэмплов для 16-bit)
    // Но размер чанка должен быть кратным 2 (так как каждый сэмпл занимает 2 байта)
    const chunkSize = 4000; // Размер чанка в байтах (должен быть четным)
    const audioData = pcmBuffer;

    console.log('[Vosk] Начало обработки аудио данных...');
    console.log(`[Vosk] Размер аудио данных для обработки: ${audioData.length} байт (${audioData.length / 2} сэмплов)`);
    const recognitionStartTime = performance.now();

    // Обрабатываем аудио по частям
    let chunksProcessed = 0;
    let hasPartialResult = false;
    let lastPartialText = '';
    let intermediateResults = []; // Сохраняем все промежуточные результаты
    
    // Убеждаемся, что размер чанка четный
    const adjustedChunkSize = chunkSize - (chunkSize % 2);
    
    for (let i = 0; i < audioData.length; i += adjustedChunkSize) {
      const chunk = audioData.slice(i, Math.min(i + adjustedChunkSize, audioData.length));
      
      // Убеждаемся, что чанк имеет четный размер
      if (chunk.length % 2 !== 0 && i + chunk.length < audioData.length) {
        // Добавляем еще один байт, чтобы сделать четным
        const nextByte = audioData[i + chunk.length];
        const evenChunk = Buffer.concat([chunk, Buffer.from([nextByte])]);
        const accepted = recognizer.acceptWaveform(evenChunk);
        chunksProcessed++;
      } else if (chunk.length % 2 === 0) {
        const accepted = recognizer.acceptWaveform(chunk);
        chunksProcessed++;
      } else {
        // Последний нечетный чанк - пропускаем последний байт
        const evenChunk = chunk.slice(0, chunk.length - 1);
        if (evenChunk.length > 0) {
          const accepted = recognizer.acceptWaveform(evenChunk);
          chunksProcessed++;
        }
      }
      
      // Проверяем промежуточные результаты не на каждой итерации, а периодически
      if (chunksProcessed % 5 === 0 || i + adjustedChunkSize >= audioData.length) {
        const resultStr = recognizer.result();
        if (resultStr) {
          try {
            const result = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;
            if (result && result.text && result.text.trim().length > 0) {
              console.log('[Vosk] Промежуточный результат:', result.text);
              intermediateResults.push(result.text.trim());
              hasPartialResult = true;
            }
          } catch (e) {
            // Игнорируем ошибки парсинга промежуточных результатов
          }
        }
        
        // Проверяем частичный результат
        const partialStr = recognizer.partialResult();
        if (partialStr) {
          try {
            const partial = typeof partialStr === 'string' ? JSON.parse(partialStr) : partialStr;
            if (partial && partial.partial && partial.partial !== lastPartialText) {
              lastPartialText = partial.partial;
              console.log('[Vosk] Частичный результат:', partial.partial);
              hasPartialResult = true;
            }
          } catch (e) {
            // Игнорируем
          }
        }
      }
    }
    
    console.log(`[Vosk] Собрано промежуточных результатов: ${intermediateResults.length}`, intermediateResults);
    
    console.log(`[Vosk] Обработано чанков: ${chunksProcessed}, Размер последнего чанка: ${audioData.length % adjustedChunkSize} байт`);

    // Получаем финальный результат
    const finalResultStr = recognizer.finalResult();
    let recognizedText = '';
    
    console.log('[Vosk] Финальный результат (raw):', finalResultStr);
    
    if (finalResultStr) {
      try {
        const finalResult = typeof finalResultStr === 'string' ? JSON.parse(finalResultStr) : finalResultStr;
        recognizedText = finalResult.text || '';
        
        console.log('[Vosk] Распознанный текст из финального результата:', recognizedText);
        console.log('[Vosk] Полный результат:', JSON.stringify(finalResult, null, 2));
        
        if (!recognizedText && finalResult.alternatives && finalResult.alternatives.length > 0) {
          // Пробуем взять текст из альтернатив
          recognizedText = finalResult.alternatives[0].text || '';
          console.log('[Vosk] Использован текст из альтернатив:', recognizedText);
        }
      } catch (e) {
        console.error('[Vosk] Ошибка парсинга финального результата:', e.message);
        console.error('[Vosk] Сырой результат:', finalResultStr);
        recognizedText = '';
      }
    } else {
      console.warn('[Vosk] Финальный результат пуст');
    }
    
    // Если текст все еще пуст или очень короткий, пробуем получить частичный результат
    if ((!recognizedText || recognizedText.trim().length < 2) && hasPartialResult) {
      try {
        const partialStr = recognizer.partialResult();
        if (partialStr) {
          const partial = typeof partialStr === 'string' ? JSON.parse(partialStr) : partialStr;
          if (partial && partial.partial && partial.partial.trim().length > 0) {
            // Используем частичный результат, если финальный пуст или слишком короткий
            if (!recognizedText || recognizedText.trim().length < partial.partial.trim().length) {
              recognizedText = partial.partial;
              console.log('[Vosk] Использован частичный результат (лучше финального):', recognizedText);
            }
          }
        }
      } catch (e) {
        console.error('[Vosk] Ошибка получения частичного результата:', e.message);
      }
    }
    
    // Если все еще пусто, используем последний промежуточный результат
    if (!recognizedText || recognizedText.trim().length === 0) {
      if (intermediateResults.length > 0) {
        // Берем последний (самый полный) промежуточный результат
        recognizedText = intermediateResults[intermediateResults.length - 1];
        console.log('[Vosk] Использован последний промежуточный результат:', recognizedText);
        
        // Или объединяем все промежуточные результаты
        if (intermediateResults.length > 1) {
          const combined = intermediateResults.join(' ').trim();
          if (combined.length > recognizedText.length) {
            recognizedText = combined;
            console.log('[Vosk] Использован объединенный результат из промежуточных:', recognizedText);
          }
        }
      }
    }
    
    // Если все еще пусто, пробуем еще раз получить финальный результат
    if (!recognizedText || recognizedText.trim().length === 0) {
      try {
        // Иногда нужно вызвать finalResult() еще раз после обработки всех чанков
        const retryResult = recognizer.finalResult();
        if (retryResult) {
          const retry = typeof retryResult === 'string' ? JSON.parse(retryResult) : retryResult;
          if (retry && retry.text && retry.text.trim().length > 0) {
            recognizedText = retry.text;
            console.log('[Vosk] Использован результат после повторного вызова finalResult():', recognizedText);
          }
        }
      } catch (e) {
        console.error('[Vosk] Ошибка при повторном вызове finalResult():', e.message);
      }
    }

    const recognitionEndTime = performance.now();
    const recognitionDuration = ((recognitionEndTime - recognitionStartTime) / 1000).toFixed(2);
    console.log(`[Vosk] Модель обработала аудио за ${recognitionDuration} секунд`);

    // Освобождаем ресурсы recognizer
    recognizer.free();

    if (recognizedText) {
      console.log('[Vosk] Распознанный текст:', recognizedText);
    } else {
      console.warn('[Vosk] Текст не распознан (возможно, слишком короткое аудио или тишина)');
    }

    const transcriptionEndTime = performance.now();
    const totalDuration = ((transcriptionEndTime - transcriptionStartTime) / 1000).toFixed(2);
    console.log(`[Vosk] Общее время распознавания: ${totalDuration} секунд`);

    return recognizedText.trim().toLowerCase();
  } catch (error) {
    const transcriptionEndTime = performance.now();
    const totalDuration = ((transcriptionEndTime - transcriptionStartTime) / 1000).toFixed(2);
    console.error(`[Vosk] Ошибка распознавания (${totalDuration} сек):`, error);
    throw error;
  }
}

module.exports = {
  transcribeFromBuffer,
  initializeModel
};

