import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Students API
export const studentsAPI = {
  getAll: () => api.get('/students'),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`)
};

// Lessons API
export const lessonsAPI = {
  getByStudent: (studentId) => api.get(`/lessons/student/${studentId}`),
  getById: (id) => api.get(`/lessons/${id}`),
  create: (data) => api.post('/lessons', data),
  update: (id, data) => api.put(`/lessons/${id}`, data),
  delete: (id) => api.delete(`/lessons/${id}`),
  startSession: (lessonId) => api.post(`/lessons/${lessonId}/start`),
  completeSession: (sessionId) => api.post('/lessons/complete', { sessionId }),
  saveAttempt: (data) => api.post('/lessons/attempt', data),
  getProgress: (studentId) => api.get(`/lessons/student/${studentId}/progress`)
};

// Speech API
export const speechAPI = {
  recognize: (audioFile) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    return api.post('/speech/recognize', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  check: (recognizedText, expectedWord) => 
    api.post('/speech/check', { recognizedText, expectedWord })
};

// Images API
export const imagesAPI = {
  getAll: () => api.get('/images'),
  getById: (id) => api.get(`/images/${id}`),
  upload: (imageFile, word) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('word', word);
    return api.post('/images/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  update: (id, word) => api.put(`/images/${id}`, { word }),
  delete: (id) => api.delete(`/images/${id}`)
};

export default api;

