// Configuration file for FindDocs RAG Application
// This file contains all configurable settings that can be overridden via environment variables

const config = {
  // DocLing Server Configuration
  DOCLING_URL: process.env.REACT_APP_DOCLING_URL || 'http://localhost:35111',
  
  // Ollama Server Configuration  
  OLLAMA_URL: process.env.REACT_APP_OLLAMA_URL || '/api',
  
  // Storage Keys (these are safe to expose - they're just localStorage keys)
  STORAGE_KEY: 'rag_documents',
  HASHES_KEY: 'rag_file_hashes', 
  CHAT_HISTORY_KEY: 'rag_chat_history',
  CURRENT_CONVERSATION_KEY: 'rag_current_conversation',
  
  // Application Settings
  MAX_CONTEXT_LENGTH: 8000,
  SUPPORTED_FILE_TYPES: ['pdf', 'txt', 'docx', 'png', 'jpg', 'jpeg'],
  
  // API Timeouts
  UPLOAD_TIMEOUT: 120000, // 2 minutes
  OLLAMA_TIMEOUT: 60000,  // 1 minute
  
  // Development Settings
  ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
  
  // Feature Flags
  ENABLE_BATCH_PROCESSING: true,
  ENABLE_DIRECTORY_UPLOAD: true,
  ENABLE_CHAT_HISTORY: true,
};

export default config;
