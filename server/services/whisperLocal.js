const { pipeline } = require('@xenova/transformers');
const fs = require('fs');
const path = require('path');
const { WaveFile } = require('wavefile');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// Устанавливаем путь к ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

let transcriber = null;
let isInitializing = false;
let initPromise = null;

/**
 * Инициализация локального Whisper модели
 */
async function initializeModel() {
  if (transcriber) {
    return transcriber;
  }

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      console.log('Инициализация локальной Whisper модели...');
      console.log('Это может занять несколько минут при первом запуске...');
      
      // Используем модель 'Xenova/whisper-small' - хороший баланс между качеством и скоростью
      // Доступны также: 'Xenova/whisper-tiny', 'Xenova/whisper-base', 'Xenova/whisper-medium', 'Xenova/whisper-large'
      transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-small',
        {
          device: 'cpu', // Используем CPU, можно изменить на 'cuda' если есть GPU
          quantized: true, // Используем квантованную модель для экономии памяти
        }
      );

      console.log('Whisper модель успешно загружена!');
      isInitializing = false;
      return transcriber;
    } catch (error) {
      console.error('Ошибка инициализации Whisper модели:', error);
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
    console.log(`[FFmpeg] Начало конвертации: ${inputPath}`);
    
    ffmpeg(inputPath)
      .toFormat('wav')
      .audioFrequency(16000) // Whisper требует 16kHz
      .audioChannels(1) // Моно
      .audioCodec('pcm_s16le') // 16-bit PCM
      .on('end', () => {
        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`[FFmpeg] Конвертация завершена за ${duration} секунд`);
        resolve();
      })
      .on('error', (err) => {
        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.error(`[FFmpeg] Ошибка конвертации (${duration} сек):`, err);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Конвертация аудио буфера в Float32Array для Node.js
 * @param {Buffer} audioBuffer - Буфер с аудио данными
 * @param {string} mimetype - MIME тип аудио
 * @param {string} tempDir - Директория для временных файлов
 * @returns {Promise<Float32Array>} - Массив сэмплов аудио
 */
async function convertAudioToFloat32Array(audioBuffer, mimetype, tempDir) {
  const conversionStartTime = performance.now();
  
  try {
    // Если это WAV файл, используем wavefile для декодирования
    if (mimetype.includes('wav') || mimetype.includes('wave')) {
      const decodeStartTime = performance.now();
      const wav = new WaveFile(audioBuffer);
      wav.toBitDepth('32f'); // Конвертируем в 32-bit float
      wav.toSampleRate(16000); // Whisper требует 16kHz
      const audioData = new Float32Array(wav.getSamples(false));
      const decodeEndTime = performance.now();
      const decodeDuration = ((decodeEndTime - decodeStartTime) / 1000).toFixed(3);
      console.log(`[Конвертация WAV] Декодирование завершено за ${decodeDuration} секунд`);
      return audioData;
    }
    
    // Для других форматов (webm, mp3 и т.д.) конвертируем в WAV с помощью ffmpeg
    console.log(`[Конвертация] Начало конвертации ${mimetype} в WAV формат...`);
    console.log(`[Конвертация] Размер входного файла: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
    
    const tempInputPath = path.join(tempDir, `input_${Date.now()}.${mimetype.includes('webm') ? 'webm' : 'mp3'}`);
    const tempOutputPath = path.join(tempDir, `output_${Date.now()}.wav`);
    
    try {
      // Сохраняем входной файл
      const writeStartTime = performance.now();
      fs.writeFileSync(tempInputPath, audioBuffer);
      const writeEndTime = performance.now();
      const writeDuration = ((writeEndTime - writeStartTime) / 1000).toFixed(3);
      console.log(`[Конвертация] Запись временного файла: ${writeDuration} секунд`);
      
      // Конвертируем в WAV
      await convertToWav(tempInputPath, tempOutputPath);
      
      // Читаем конвертированный WAV файл
      const readStartTime = performance.now();
      const wavBuffer = fs.readFileSync(tempOutputPath);
      const wav = new WaveFile(wavBuffer);
      wav.toBitDepth('32f'); // Конвертируем в 32-bit float
      wav.toSampleRate(16000); // Убеждаемся что 16kHz
      const audioData = new Float32Array(wav.getSamples(false));
      const readEndTime = performance.now();
      const readDuration = ((readEndTime - readStartTime) / 1000).toFixed(3);
      console.log(`[Конвертация] Чтение и декодирование WAV: ${readDuration} секунд`);
      
      // Удаляем временные файлы
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
      
      const conversionEndTime = performance.now();
      const totalDuration = ((conversionEndTime - conversionStartTime) / 1000).toFixed(2);
      console.log(`[Конвертация] Общее время конвертации: ${totalDuration} секунд`);
      
      return audioData;
    } catch (conversionError) {
      // Удаляем временные файлы в случае ошибки
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
      throw conversionError;
    }
  } catch (error) {
    const conversionEndTime = performance.now();
    const totalDuration = ((conversionEndTime - conversionStartTime) / 1000).toFixed(2);
    console.error(`[Конвертация] Ошибка конвертации (${totalDuration} сек):`, error);
    throw error;
  }
}

/**
 * Распознавание речи из аудио файла (используется для прямого пути к файлу)
 * В Node.js это не работает напрямую, поэтому лучше использовать transcribeFromBuffer
 * @param {string} audioFilePath - Путь к аудио файлу
 * @param {string} language - Язык (по умолчанию 'ru')
 * @returns {Promise<string>} - Распознанный текст
 */
async function transcribe(audioFilePath, language = 'ru') {
  const transcriptionStartTime = performance.now();
  
  try {
    // Инициализируем модель если нужно
    if (!transcriber) {
      await initializeModel();
    }

    console.log('[Распознавание] Начало распознавания речи из файла...');
    console.log('[Распознавание] Файл:', audioFilePath);
    
    // Проверяем существование файла
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Аудио файл не найден: ${audioFilePath}`);
    }

    const fileStats = fs.statSync(audioFilePath);
    console.log('[Распознавание] Размер файла:', fileStats.size, 'байт', `(${(fileStats.size / 1024).toFixed(2)} KB)`);

    // Читаем файл и конвертируем в правильный формат
    const readStartTime = performance.now();
    const audioBuffer = fs.readFileSync(audioFilePath);
    const readEndTime = performance.now();
    const readDuration = ((readEndTime - readStartTime) / 1000).toFixed(3);
    console.log(`[Распознавание] Чтение файла: ${readDuration} секунд`);
    
    const extension = path.extname(audioFilePath).toLowerCase();
    
    let mimetype = 'audio/wav';
    if (extension === '.webm') mimetype = 'audio/webm';
    else if (extension === '.mp3') mimetype = 'audio/mp3';
    else if (extension === '.m4a') mimetype = 'audio/m4a';
    
    console.log('[Распознавание] MIME тип:', mimetype);
    console.log('[Распознавание] Язык:', language);
    
    // Конвертируем в Float32Array
    const audioData = await convertAudioToFloat32Array(audioBuffer, mimetype, path.dirname(audioFilePath));
    console.log(`[Распознавание] Размер аудио данных: ${audioData.length} сэмплов`);

    // Выполняем транскрипцию с передачей данных напрямую
    const recognitionStartTime = performance.now();
    console.log('[Распознавание] Начало обработки моделью Whisper...');
    
    const result = await transcriber(audioData, {
      language: language,
      task: 'transcribe',
      return_timestamps: false,
    });

    const recognitionEndTime = performance.now();
    const recognitionDuration = ((recognitionEndTime - recognitionStartTime) / 1000).toFixed(2);
    console.log(`[Распознавание] Модель обработала аудио за ${recognitionDuration} секунд`);

    const recognizedText = result.text || result;
    console.log('[Распознавание] Распознанный текст:', recognizedText);

    const transcriptionEndTime = performance.now();
    const totalDuration = ((transcriptionEndTime - transcriptionStartTime) / 1000).toFixed(2);
    console.log(`[Распознавание] Общее время распознавания: ${totalDuration} секунд`);

    return recognizedText.trim().toLowerCase();
  } catch (error) {
    const transcriptionEndTime = performance.now();
    const totalDuration = ((transcriptionEndTime - transcriptionStartTime) / 1000).toFixed(2);
    console.error(`[Распознавание] Ошибка распознавания (${totalDuration} сек):`, error);
    throw error;
  }
}

/**
 * Распознавание речи из буфера
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
    if (!transcriber) {
      await initializeModel();
    }

    console.log('[Распознавание] Начало распознавания речи из буфера...');
    console.log('[Распознавание] Размер буфера:', audioBuffer.length, 'байт', `(${(audioBuffer.length / 1024).toFixed(2)} KB)`);
    console.log('[Распознавание] MIME тип:', mimetype);
    console.log('[Распознавание] Язык:', language);

    // Конвертируем аудио в Float32Array
    const audioData = await convertAudioToFloat32Array(audioBuffer, mimetype, tempDir);
    console.log(`[Распознавание] Размер аудио данных: ${audioData.length} сэмплов`);

    // Выполняем транскрипцию с передачей данных напрямую
    const recognitionStartTime = performance.now();
    console.log('[Распознавание] Начало обработки моделью Whisper...');
    
    const result = await transcriber(audioData, {
      language: language,
      task: 'transcribe',
      return_timestamps: false,
    });

    const recognitionEndTime = performance.now();
    const recognitionDuration = ((recognitionEndTime - recognitionStartTime) / 1000).toFixed(2);
    console.log(`[Распознавание] Модель обработала аудио за ${recognitionDuration} секунд`);

    const recognizedText = result.text || result;
    console.log('[Распознавание] Распознанный текст:', recognizedText);

    const transcriptionEndTime = performance.now();
    const totalDuration = ((transcriptionEndTime - transcriptionStartTime) / 1000).toFixed(2);
    console.log(`[Распознавание] Общее время распознавания: ${totalDuration} секунд`);

    return recognizedText.trim().toLowerCase();
  } catch (error) {
    const transcriptionEndTime = performance.now();
    const totalDuration = ((transcriptionEndTime - transcriptionStartTime) / 1000).toFixed(2);
    console.error(`[Распознавание] Ошибка распознавания (${totalDuration} сек):`, error);
    throw error;
  }
}

module.exports = {
  transcribe,
  transcribeFromBuffer,
  initializeModel
};

