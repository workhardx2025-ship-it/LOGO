const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
require('dotenv').config();

// Импортируем сервисы распознавания с обработкой ошибок
let whisperLocal = null;
let whisperOpenAI = null;
let whisperVosk = null;

try {
  whisperLocal = require('../services/whisperLocal');
  console.log('Local Whisper service loaded');
} catch (error) {
  console.warn('Failed to load local Whisper service:', error.message);
  console.warn('Local recognition will not be available');
}

try {
  whisperOpenAI = require('../services/whisperOpenAI');
  console.log('OpenAI Whisper service loaded');
} catch (error) {
  console.error('Failed to load OpenAI Whisper service:', error.message);
  throw error; // OpenAI service is critical
}

try {
  whisperVosk = require('../services/whisperVosk');
  console.log('Vosk service loaded');
} catch (error) {
  console.warn('Failed to load Vosk service:', error.message);
  console.warn('Vosk recognition will not be available');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Получаем настройку системы распознавания из переменных окружения
// Возможные значения: 'local', 'openai', 'vosk' (по умолчанию 'openai')
const RECOGNITION_SYSTEM = (process.env.SPEECH_RECOGNITION_SYSTEM || 'openai').toLowerCase();

console.log(`Используется система распознавания: ${RECOGNITION_SYSTEM}`);

// Распознавание речи
router.post('/recognize', upload.single('audio'), async (req, res) => {
  try {
    console.log('Received audio recognition request');
    console.log('Recognition system:', RECOGNITION_SYSTEM);
    console.log('File info:', req.file ? {
      size: req.file.size,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname
    } : 'No file');

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let recognizedText;

    // Выбираем систему распознавания
    if (RECOGNITION_SYSTEM === 'vosk') {
      // Используем Vosk
      console.log('Using Vosk recognition...');
      
      if (!whisperVosk) {
        const errorMsg = 'Vosk service is not available. Install vosk package and download a model, or use another recognition system.';
        console.error(errorMsg);
        return res.status(500).json({ 
          error: errorMsg,
          hint: 'Install vosk package, download a model from https://alphacephei.com/vosk/models, or switch to another system (SPEECH_RECOGNITION_SYSTEM=openai or local)'
        });
      }

      try {
        recognizedText = await whisperVosk.transcribeFromBuffer(
          req.file.buffer,
          tempDir,
          req.file.mimetype || 'audio/webm',
          'ru'
        );
      } catch (error) {
        console.error('Vosk recognition error:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
        
        // Если Vosk не работает, пробуем fallback на другие системы
        const allowFallback = process.env.AUTO_FALLBACK_TO_LOCAL !== 'false';
        
        if (allowFallback && whisperLocal) {
          console.log('[Fallback] Vosk failed, trying local Whisper...');
          try {
            recognizedText = await whisperLocal.transcribeFromBuffer(
              req.file.buffer,
              tempDir,
              req.file.mimetype,
              'ru'
            );
            console.log('[Fallback] Local Whisper успешно обработал запрос');
          } catch (localError) {
            console.error('[Fallback] Local Whisper также не сработал:', localError.message);
            // Пробуем OpenAI как последний вариант
            if (process.env.OPENAI_API_KEY && whisperOpenAI) {
              console.log('[Fallback] Пробуем OpenAI API...');
              try {
                recognizedText = await whisperOpenAI.transcribe(
                  req.file.buffer,
                  tempDir,
                  req.file.mimetype,
                  'ru'
                );
                console.log('[Fallback] OpenAI успешно обработал запрос');
              } catch (openAIError) {
                throw new Error(`Vosk failed: ${error.message}. Fallback to local Whisper failed: ${localError.message}. Fallback to OpenAI failed: ${openAIError.message}`);
              }
            } else {
              throw new Error(`Vosk failed: ${error.message}. Fallback to local Whisper also failed: ${localError.message}`);
            }
          }
        } else if (allowFallback && process.env.OPENAI_API_KEY && whisperOpenAI) {
          console.log('[Fallback] Vosk failed, trying OpenAI API...');
          try {
            recognizedText = await whisperOpenAI.transcribe(
              req.file.buffer,
              tempDir,
              req.file.mimetype,
              'ru'
            );
            console.log('[Fallback] OpenAI успешно обработал запрос');
          } catch (openAIError) {
            throw new Error(`Vosk failed: ${error.message}. Fallback to OpenAI also failed: ${openAIError.message}`);
          }
        } else {
          throw error;
        }
      }
    } else if (RECOGNITION_SYSTEM === 'local') {
      console.log('Using local Whisper model...');
      
      if (!whisperLocal) {
        const errorMsg = 'Local Whisper service is not available. Check server logs for details.';
        console.error(errorMsg);
        
        // Если локальный сервис недоступен, пробуем OpenAI как fallback только если явно разрешено
        // Fallback работает ТОЛЬКО если явно установлено FALLBACK_TO_OPENAI=true
        const allowFallback = process.env.FALLBACK_TO_OPENAI === 'true';
        
        if (allowFallback && process.env.OPENAI_API_KEY && whisperOpenAI) {
          console.log('⚠️ Local Whisper unavailable, falling back to OpenAI API (fallback enabled)...');
          try {
            recognizedText = await whisperOpenAI.transcribe(
              req.file.buffer,
              tempDir,
              req.file.mimetype,
              'ru'
            );
          } catch (fallbackError) {
            console.error('Fallback to OpenAI also failed:', fallbackError);
            return res.status(500).json({ 
              error: 'Local Whisper service unavailable and OpenAI fallback failed',
              details: fallbackError.message,
              hint: 'Install @xenova/transformers or set FALLBACK_TO_OPENAI=false to disable fallback'
            });
          }
        } else {
          return res.status(500).json({ 
            error: errorMsg,
            hint: 'Install @xenova/transformers or set FALLBACK_TO_OPENAI=true to enable OpenAI fallback, or switch to OpenAI API (SPEECH_RECOGNITION_SYSTEM=openai)'
          });
        }
      } else {
        try {
          recognizedText = await whisperLocal.transcribeFromBuffer(
            req.file.buffer,
            tempDir,
            req.file.mimetype || 'audio/webm',
            'ru'
          );
        } catch (error) {
          console.error('Local Whisper error:', error);
          console.error('Error details:', {
            message: error.message,
            stack: error.stack
          });
          
          // Если локальное распознавание не работает и включен fallback
          // Fallback работает ТОЛЬКО если явно установлено FALLBACK_TO_OPENAI=true
          const allowFallback = process.env.FALLBACK_TO_OPENAI === 'true';
          
          if (allowFallback && process.env.OPENAI_API_KEY && whisperOpenAI) {
            console.log('⚠️ Local Whisper failed, falling back to OpenAI API (fallback enabled)...');
            try {
              recognizedText = await whisperOpenAI.transcribe(
                req.file.buffer,
                tempDir,
                req.file.mimetype,
                'ru'
              );
            } catch (fallbackError) {
              console.error('Fallback to OpenAI also failed:', fallbackError);
              throw new Error(`Local recognition failed: ${error.message}. Fallback to OpenAI also failed: ${fallbackError.message}`);
            }
          } else {
            // Если fallback отключен или не настроен, возвращаем ошибку локального распознавания
            throw new Error(`Local Whisper recognition failed: ${error.message}. To enable fallback to OpenAI, set FALLBACK_TO_OPENAI=true in .env`);
          }
        }
      }
    } else {
      // Используем OpenAI API
      console.log('Using OpenAI Whisper API...');
      
      if (!whisperOpenAI) {
        return res.status(500).json({ 
          error: 'OpenAI Whisper service is not available',
          hint: 'Check server logs for details'
        });
      }
      
      if (!process.env.OPENAI_API_KEY) {
        console.error('OpenAI API key not configured');
        return res.status(500).json({ 
          error: 'OpenAI API key not configured',
          hint: 'Set OPENAI_API_KEY in .env file or switch to local recognition (SPEECH_RECOGNITION_SYSTEM=local)'
        });
      }

      try {
        recognizedText = await whisperOpenAI.transcribe(
          req.file.buffer,
          tempDir,
          req.file.mimetype,
          'ru'
        );
      } catch (openAIError) {
        // Проверяем, является ли ошибка проблемой подключения
        const isConnectionError = openAIError.code === 'ECONNRESET' || 
                                  openAIError.code === 'ETIMEDOUT' ||
                                  openAIError.type === 'system' ||
                                  openAIError.message?.includes('Connection error') ||
                                  openAIError.message?.includes('socket hang up') ||
                                  openAIError.cause?.code === 'ECONNRESET';
        
        if (isConnectionError) {
          console.error('[OpenAI] Ошибка подключения к API:', openAIError.message);
          console.log('[OpenAI] Пробуем переключиться на локальный Whisper...');
          
          // Пробуем использовать другие системы как fallback
          const fallbackOrder = [];
          if (whisperLocal && process.env.AUTO_FALLBACK_TO_LOCAL !== 'false') {
            fallbackOrder.push({ name: 'local', service: whisperLocal, method: 'transcribeFromBuffer' });
          }
          if (whisperVosk) {
            fallbackOrder.push({ name: 'vosk', service: whisperVosk, method: 'transcribeFromBuffer' });
          }
          
          if (fallbackOrder.length > 0) {
            let fallbackSuccess = false;
            for (const fallback of fallbackOrder) {
              try {
                console.log(`[Fallback] Пробуем ${fallback.name}...`);
                if (fallback.method === 'transcribeFromBuffer') {
                  recognizedText = await fallback.service.transcribeFromBuffer(
                    req.file.buffer,
                    tempDir,
                    req.file.mimetype,
                    'ru'
                  );
                }
                console.log(`[Fallback] ${fallback.name} успешно обработал запрос`);
                fallbackSuccess = true;
                break;
              } catch (fallbackError) {
                console.error(`[Fallback] ${fallback.name} не сработал:`, fallbackError.message);
                // Пробуем следующий fallback
              }
            }
            
            if (!fallbackSuccess) {
              return res.status(500).json({
                error: 'OpenAI API connection failed and all fallback systems also failed',
                details: {
                  openaiError: openAIError.message,
                  hint: 'Проверьте подключение к интернету, настройки VPN или используйте SPEECH_RECOGNITION_SYSTEM=local или vosk'
                }
              });
            }
          } else {
            // Если локальный Whisper недоступен или отключен fallback
            return res.status(500).json({
              error: 'OpenAI API connection failed',
              details: openAIError.message,
              hint: 'Проверьте подключение к интернету, настройки VPN. Для автоматического переключения на локальный Whisper установите AUTO_FALLBACK_TO_LOCAL=true в .env'
            });
          }
        } else {
          // Другие ошибки OpenAI API
          throw openAIError;
        }
      }
    }

    console.log('Recognized text:', recognizedText);

    res.json({
      text: recognizedText,
      success: true,
      system: RECOGNITION_SYSTEM
    });
  } catch (error) {
    console.error('Speech recognition error:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Speech recognition failed',
      details: error.message,
      system: RECOGNITION_SYSTEM,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack
      })
    });
  }
});

// Проверка правильности произношения
router.post('/check', (req, res) => {
  const { recognizedText, expectedWord } = req.body;

  if (!recognizedText || !expectedWord) {
    return res.status(400).json({ error: 'Recognized text and expected word are required' });
  }

  // Нормализация текста для сравнения
  const normalize = (text) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:]/g, '')
      .replace(/\s+/g, ' ');
  };

  const normalizedRecognized = normalize(recognizedText);
  const normalizedExpected = normalize(expectedWord);

  // Простое сравнение (можно улучшить с помощью фонетического сравнения)
  const isCorrect = normalizedRecognized === normalizedExpected || 
                    normalizedRecognized.includes(normalizedExpected) ||
                    normalizedExpected.includes(normalizedRecognized);

  res.json({
    isCorrect,
    recognizedText: normalizedRecognized,
    expectedWord: normalizedExpected
  });
});

// Endpoint для проверки статуса систем распознавания
router.get('/status', (req, res) => {
  res.json({
    recognitionSystem: RECOGNITION_SYSTEM,
    localWhisperAvailable: whisperLocal !== null,
    openAIWhisperAvailable: whisperOpenAI !== null,
    voskAvailable: whisperVosk !== null,
    openAIKeyConfigured: !!process.env.OPENAI_API_KEY,
    voskModelPath: process.env.VOSK_MODEL_PATH || './models/vosk-model-ru-0.22',
    fallbackEnabled: process.env.FALLBACK_TO_OPENAI === 'true',
    autoFallbackToLocal: process.env.AUTO_FALLBACK_TO_LOCAL !== 'false'
  });
});

module.exports = router;

