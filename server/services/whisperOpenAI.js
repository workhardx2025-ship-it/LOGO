const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { File } = require('formdata-node');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Распознавание речи через OpenAI Whisper API
 * @param {Buffer} audioBuffer - Буфер с аудио данными
 * @param {string} tempDir - Директория для временных файлов
 * @param {string} mimetype - MIME тип аудио
 * @param {string} language - Язык (по умолчанию 'ru')
 * @returns {Promise<string>} - Распознанный текст
 */
async function transcribe(audioBuffer, tempDir, mimetype = 'audio/webm', language = 'ru') {
  const transcriptionStartTime = performance.now();
  let tempFilePath = null;

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('[OpenAI Whisper] Начало распознавания речи...');
    console.log('[OpenAI Whisper] Размер буфера:', audioBuffer.length, 'байт', `(${(audioBuffer.length / 1024).toFixed(2)} KB)`);
    console.log('[OpenAI Whisper] MIME тип:', mimetype);
    console.log('[OpenAI Whisper] Язык:', language);

    // Создаем директорию temp если её нет
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Определяем расширение файла на основе mimetype
    let extension = 'webm';
    if (mimetype.includes('wav')) {
      extension = 'wav';
    } else if (mimetype.includes('mp3')) {
      extension = 'mp3';
    } else if (mimetype.includes('m4a')) {
      extension = 'm4a';
    }

    tempFilePath = path.join(tempDir, `audio_${Date.now()}.${extension}`);

    // Записываем buffer во временный файл
    const writeStartTime = performance.now();
    fs.writeFileSync(tempFilePath, audioBuffer);
    const writeEndTime = performance.now();
    const writeDuration = ((writeEndTime - writeStartTime) / 1000).toFixed(3);
    console.log(`[OpenAI Whisper] Запись временного файла: ${writeDuration} секунд`);
    console.log('[OpenAI Whisper] Временный файл:', tempFilePath);

    // Создаем File объект для OpenAI API
    const file = new File([audioBuffer], `audio.${extension}`, {
      type: mimetype || 'audio/webm'
    });

    // Отправляем запрос к API
    const apiStartTime = performance.now();
    console.log('[OpenAI Whisper] Отправка запроса к OpenAI Whisper API...');
    
    let transcription;
    try {
      transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: language,
        response_format: 'text',
        timeout: 30000 // 30 секунд таймаут
      });

      const apiEndTime = performance.now();
      const apiDuration = ((apiEndTime - apiStartTime) / 1000).toFixed(2);
      console.log(`[OpenAI Whisper] API обработал запрос за ${apiDuration} секунд`);

      console.log('[OpenAI Whisper] Получен ответ:', transcription);
    } catch (apiError) {
      const apiEndTime = performance.now();
      const apiDuration = ((apiEndTime - apiStartTime) / 1000).toFixed(2);
      console.error(`[OpenAI Whisper] Ошибка API запроса (${apiDuration} сек):`, apiError);
      
      // Дополнительная информация об ошибке
      if (apiError.code === 'ECONNRESET' || apiError.cause?.code === 'ECONNRESET') {
        console.error('[OpenAI Whisper] Ошибка: Соединение было разорвано. Возможные причины:');
        console.error('  - Проблемы с VPN (блокирует подключение к OpenAI)');
        console.error('  - Проблемы с интернет-соединением');
        console.error('  - Таймаут соединения');
        console.error('  - Брандмауэр блокирует подключение');
      }
      
      throw apiError;
    }
    
    // Обработка ответа - может быть строкой или объектом
    let recognizedText;
    if (typeof transcription === 'string') {
      recognizedText = transcription.trim().toLowerCase();
    } else if (transcription && transcription.text) {
      recognizedText = transcription.text.trim().toLowerCase();
    } else {
      recognizedText = String(transcription).trim().toLowerCase();
    }

    const transcriptionEndTime = performance.now();
    const totalDuration = ((transcriptionEndTime - transcriptionStartTime) / 1000).toFixed(2);
    console.log(`[OpenAI Whisper] Общее время распознавания: ${totalDuration} секунд`);

    return recognizedText;
  } catch (error) {
    const transcriptionEndTime = performance.now();
    const totalDuration = ((transcriptionEndTime - transcriptionStartTime) / 1000).toFixed(2);
    console.error(`[OpenAI Whisper] Ошибка распознавания (${totalDuration} сек):`, error);
    console.error('[OpenAI Whisper] Детали ошибки:', {
      message: error.message,
      status: error.status,
      response: error.response?.data
    });
    throw error;
  } finally {
    // Удаляем временный файл
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        const deleteStartTime = performance.now();
        fs.unlinkSync(tempFilePath);
        const deleteEndTime = performance.now();
        const deleteDuration = ((deleteEndTime - deleteStartTime) / 1000).toFixed(3);
        console.log(`[OpenAI Whisper] Удаление временного файла: ${deleteDuration} секунд`);
      } catch (err) {
        console.error('[OpenAI Whisper] Ошибка удаления временного файла:', err);
      }
    }
  }
}

module.exports = {
  transcribe
};

