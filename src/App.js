import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, FileText, MessageSquare, Search, Loader2, CheckCircle, XCircle, FolderOpen, HardDrive, Database, SkipForward } from 'lucide-react';
import './App.css';
import config from './config';

function App() {
  const [documents, setDocuments] = useState([]);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedDirectory, setSelectedDirectory] = useState('');
  const [directoryFiles, setDirectoryFiles] = useState([]);
  const [isScanningDirectory, setIsScanningDirectory] = useState(false);
  const [processedFileHashes, setProcessedFileHashes] = useState(new Set());
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, skipped: 0 });
  const [processingProgress, setProcessingProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0,
    estimatedTime: 0,
    startTime: null
  });
  
  // New state for conversational chat
  const [chatHistory, setChatHistory] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  
  // Tab navigation state
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'upload'


  
  // Configuration
  const DOCLING_URL = config.DOCLING_URL;
  const OLLAMA_URL = config.OLLAMA_URL;
  const STORAGE_KEY = config.STORAGE_KEY;
  const HASHES_KEY = config.HASHES_KEY;
  const CHAT_HISTORY_KEY = config.CHAT_HISTORY_KEY;
  const CURRENT_CONVERSATION_KEY = config.CURRENT_CONVERSATION_KEY;

  // Load saved documents and hashes on component mount
  useEffect(() => {
    loadSavedDocuments();
    loadProcessedHashes();
    loadChatHistory();
  }, []);

  // Save documents to storage whenever they change
  useEffect(() => {
    if (documents.length > 0) {
      saveDocumentsToStorage(documents);
    }
  }, [documents]);

  // Save processed hashes whenever they change
  useEffect(() => {
    if (processedFileHashes.size > 0) {
      localStorage.setItem(HASHES_KEY, JSON.stringify(Array.from(processedFileHashes)));
    }
  }, [processedFileHashes]);

  // Save chat history whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  // Save current conversation whenever it changes
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem(CURRENT_CONVERSATION_KEY, currentConversationId);
    }
  }, [currentConversationId]);





  // Progress calculation functions
  const calculateProgress = (current, total, startTime) => {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    let estimatedTime = 0;
    
    if (startTime && current > 0) {
      const elapsed = Date.now() - startTime;
      const rate = current / elapsed; // items per millisecond
      const remaining = total - current;
      estimatedTime = Math.round(remaining / rate); // milliseconds
    }
    
    return { percentage, estimatedTime };
  };

  const formatTime = (milliseconds) => {
    if (milliseconds < 1000) return 'Less than 1 second';
    const seconds = Math.round(milliseconds / 1000);
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.round(seconds / 60);
    return `${minutes} minutes`;
  };

  // Smart storage functions for handling large documents
  const saveDocumentsToStorage = (docs) => {
    try {
      // Try localStorage first for small documents
      const docsForLocalStorage = docs.map(doc => {
        // If content is too large, store a reference instead
        if (doc.content && doc.content.length > 100000) { // 100KB limit
          return {
            ...doc,
            content: `[Large content stored separately - ${doc.content.length} characters]`,
            _largeContentId: `${doc.id}_${Date.now()}`
          };
        }
        return doc;
      });

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(docsForLocalStorage));
        
        // Store large content in IndexedDB
        const largeDocs = docs.filter(doc => doc.content && doc.content.length > 100000);
        if (largeDocs.length > 0) {
          saveLargeContentToIndexedDB(largeDocs);
        }
        
        return;
      } catch (localError) {
        console.log('localStorage failed, using IndexedDB only');
      }

      // Fallback to IndexedDB for everything
      saveAllToIndexedDB(docs);
    } catch (error) {
      console.error('Error saving documents:', error);
    }
  };

  const saveLargeContentToIndexedDB = (largeDocs) => {
    if (!window.indexedDB) return;
    
    const request = indexedDB.open('RAGDocuments', 1);
    
    request.onerror = () => console.error('IndexedDB error:', request.error);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('largeContent')) {
        db.createObjectStore('largeContent', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['largeContent'], 'readwrite');
      const store = transaction.objectStore('largeContent');
      
      largeDocs.forEach(doc => {
        const key = `${doc.id}_${Date.now()}`;
        store.put({ id: key, content: doc.content, timestamp: Date.now() });
      });
      
      console.log(`Stored ${largeDocs.length} large documents in IndexedDB`);
    };
  };

  const saveAllToIndexedDB = (docs) => {
    if (!window.indexedDB) return;
    
    const request = indexedDB.open('RAGDocuments', 1);
    
    request.onerror = () => console.error('IndexedDB error:', request.error);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('largeContent')) {
        db.createObjectStore('largeContent', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['documents'], 'readwrite');
      const store = transaction.objectStore('documents');
      
      // Clear existing data
      store.clear();
      
      // Add new data
      docs.forEach((doc, index) => {
        store.add({ id: index, data: doc });
      });
      
      console.log('Documents saved to IndexedDB');
    };
  };

  const loadSavedDocuments = () => {
    try {
      // Try localStorage first
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Check if we have large content references
        const docsWithLargeContent = parsed.filter(doc => doc._largeContentId);
        
        if (docsWithLargeContent.length > 0) {
          // Load large content from IndexedDB
          loadLargeContentFromIndexedDB(docsWithLargeContent, parsed);
        } else {
          setDocuments(parsed);
          setUploadStatus(`Loaded ${parsed.length} previously processed documents`);
          setTimeout(() => setUploadStatus(''), 3000);
        }
      }
    } catch (error) {
      console.error('Error loading saved documents:', error);
      // Try IndexedDB as fallback
      loadFromIndexedDB();
    }
  };

  const loadLargeContentFromIndexedDB = (largeDocs, allDocs) => {
    if (!window.indexedDB) {
      setDocuments(allDocs);
      return;
    }
    
    const request = indexedDB.open('RAGDocuments', 1);
    
    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      setDocuments(allDocs);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('largeContent')) {
        db.createObjectStore('largeContent', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['largeContent'], 'readonly');
      const store = transaction.objectStore('largeContent');
      
      let loadedCount = 0;
      const totalLargeDocs = largeDocs.length;
      
      largeDocs.forEach(doc => {
        const getRequest = store.get(doc._largeContentId);
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            // Find the document and restore its content
            const docIndex = allDocs.findIndex(d => d._largeContentId === doc._largeContentId);
            if (docIndex !== -1) {
              allDocs[docIndex].content = getRequest.result.content;
              delete allDocs[docIndex]._largeContentId;
            }
          }
          
          loadedCount++;
          if (loadedCount === totalLargeDocs) {
            setDocuments(allDocs);
            setUploadStatus(`Loaded ${allDocs.length} previously processed documents`);
            setTimeout(() => setUploadStatus(''), 3000);
          }
        };
      });
    };
  };

  const loadFromIndexedDB = () => {
    if (!window.indexedDB) return;
    
    const request = indexedDB.open('RAGDocuments', 1);
    
    request.onerror = () => console.error('IndexedDB error:', request.error);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('largeContent')) {
        db.createObjectStore('largeContent', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['documents'], 'readonly');
      const store = transaction.objectStore('documents');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const docs = getAllRequest.result.map(item => item.data);
        setDocuments(docs);
        setUploadStatus(`Loaded ${docs.length} documents from IndexedDB`);
        setTimeout(() => setUploadStatus(''), 3000);
      };
    };
  };

  // Clear storage when needed
  const clearStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(HASHES_KEY);
      localStorage.removeItem(CHAT_HISTORY_KEY);
      localStorage.removeItem(CURRENT_CONVERSATION_KEY);
      
      // Clear IndexedDB as well
      if (window.indexedDB) {
        const request = indexedDB.deleteDatabase('RAGDocuments');
        request.onsuccess = () => console.log('IndexedDB cleared');
        request.onerror = () => console.log('IndexedDB clear failed');
      }
      
      setDocuments([]);
      setProcessedFileHashes(new Set());
      setChatHistory([]);
      setCurrentConversationId(null);
      
      setUploadStatus('Storage cleared successfully');
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  };

  const loadProcessedHashes = () => {
    try {
      const saved = localStorage.getItem(HASHES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setProcessedFileHashes(new Set(parsed));
      }
    } catch (error) {
      console.error('Error loading processed hashes:', error);
    }
  };

  const loadChatHistory = () => {
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setChatHistory(parsed);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  // Start a new conversation
  const startNewConversation = () => {
    const newConversationId = Date.now().toString();
    setCurrentConversationId(newConversationId);
    setChatHistory(prev => [...prev, {
      id: newConversationId,
      title: `Conversation ${newConversationId.slice(-6)}`,
      messages: [],
      timestamp: new Date().toISOString()
    }]);
    setAnswer('');
    setSources([]);
  };

  // Get current conversation messages
  const getCurrentConversation = () => {
    return chatHistory.find(conv => conv.id === currentConversationId);
  };

  // Generate a simple hash for file deduplication
  const generateFileHash = (file) => {
    return `${file.name}_${file.size}_${file.lastModified}`;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    await processSingleFile(file);
  };

  const processSingleFile = async (file) => {
    const fileHash = generateFileHash(file);
    
    // Check if file was already processed
    if (processedFileHashes.has(fileHash)) {
      setUploadStatus(`${file.name} already processed - skipping duplicate`);
      setTimeout(() => setUploadStatus(''), 3000);
      return;
    }

    setIsProcessing(true);
    setUploadStatus(`Processing ${file.name}...`);
    
    // Initialize progress tracking
    const startTime = Date.now();
    setProcessingProgress({
      current: 0,
      total: 100, // Start with estimated total
      percentage: 0,
      estimatedTime: 0,
      startTime: startTime
    });

    try {
      console.log(`Starting to process: ${file.name}`);
      console.log(`File size: ${file.size} bytes`);
      console.log(`File type: ${file.type}`);
      
      const formData = new FormData();
      formData.append('files', file);
      
      // Use consistent configuration matching docker-compose settings
      const options = {
        pdf_backend: "dlparse_v4", // Match docker-compose setting
        pipeline: "standard",
        pipeline_options: {
          do_ocr: true,
          ocr_options: {
            kind: "TESSERACT", // Match docker-compose setting
            lang: ["eng"], // Match docker-compose setting
            dpi: 300,
            force_full_page_ocr: true
          },
          pdf_options: {
            extract_images: true,
            process_images: true
          }
        }
      };
      
      // Send options as JSON blob
      const optionsBlob = new Blob([JSON.stringify(options)], { type: "application/json" });
      formData.append("options", optionsBlob, "options.json");

      console.log('Sending request to Docling...');
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        if (key === 'options') {
          // Log the actual JSON content, not the Blob object
          console.log(`${key}: ${await value.text()}`);
        } else {
          console.log(`${key}: ${value}`);
        }
      }
      
      // Use async endpoint for now since sync endpoint has auth issues
      const asyncResponse = await axios.post(`${DOCLING_URL}/v1/convert/file/async`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 120000, // 2 minutes timeout
      });
      
      console.log('Async task started:', asyncResponse.data);
      
      // Poll for completion
      const taskId = asyncResponse.data.task_id;
      let response = null;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        try {
          const statusResponse = await axios.get(`${DOCLING_URL}/v1/status/poll/${taskId}`);
          
          if (statusResponse.data.task_status === 'success') {
            // Get the result
            const resultResponse = await axios.get(`${DOCLING_URL}/v1/result/${taskId}`);
            response = resultResponse;
            break;
          } else if (statusResponse.data.task_status === 'failure') {
            console.error('Task failed with details:', statusResponse.data);
            console.error('Full status response:', JSON.stringify(statusResponse.data, null, 2));
            
            // Try to get more error details from the result endpoint
            try {
              const resultResponse = await axios.get(`${DOCLING_URL}/v1/result/${taskId}`);
              console.error('Result response on failure:', resultResponse.data);
              
              if (resultResponse.data.errors && resultResponse.data.errors.length > 0) {
                const errorDetails = resultResponse.data.errors.map(e => `${e.type}: ${e.msg}`).join(', ');
                throw new Error(`Task failed: ${errorDetails}`);
              }
            } catch (resultError) {
              console.error('Could not get result details:', resultError.message);
            }
            
            // Try to get more error details from status
            let errorMessage = 'Unknown error';
            if (statusResponse.data.task_meta?.error) {
              errorMessage = statusResponse.data.task_meta.error;
            } else if (statusResponse.data.errors && statusResponse.data.errors.length > 0) {
              errorMessage = statusResponse.data.errors.join(', ');
            } else if (statusResponse.data.message) {
              errorMessage = statusResponse.data.message;
            }
            
            throw new Error(`Task failed: ${errorMessage}`);
          }
          
          attempts++;
        } catch (error) {
          console.log(`Poll attempt ${attempts + 1} failed:`, error.message);
          attempts++;
        }
      }
      
      if (!response) {
        throw new Error('Task timed out after 5 minutes');
      }
      
      console.log('File processed successfully:', response.data);
      
      // Show completion progress
      setProcessingProgress(prev => ({
        ...prev,
        current: 1,
        total: 1,
        percentage: 100,
        estimatedTime: 0
      }));


      console.log('Docling response received:', response.data);
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      // Check what content types are available
      if (response.data.document) {
        console.log('Document object keys:', Object.keys(response.data.document));
        console.log('Document content types available:', {
          md_content: !!response.data.document.md_content,
          text_content: !!response.data.document.text_content,
          html_content: !!response.data.document.html_content,
          json_content: !!response.data.document.json_content
        });
        
        if (response.data.document.md_content) {
          console.log('Markdown content preview:', response.data.document.md_content.substring(0, 500));
        }
        if (response.data.document.text_content) {
          console.log('Text content preview:', response.data.document.text_content.substring(0, 500));
        }
        
        // Log the full document object for debugging
        console.log('Full document object:', JSON.stringify(response.data.document, null, 2));
      }
      
      // Extract content from response
      const content = response.data.document?.md_content || 
                     response.data.document?.text_content || 
                     response.data.document?.html_content ||
                     'No content extracted';

      if (response.data) {
        const newDoc = {
          id: Date.now() + Math.random(),
          filename: file.name,
          content: content,
          metadata: response.data.document || {},
          timestamp: new Date().toISOString(),
          filePath: file.webkitRelativePath || file.name,
          fileHash: fileHash,
          // Store the actual file object for opening
          originalFile: file,
          // Store the actual file path if available
          actualFilePath: file.webkitRelativePath || null,
          // Store file type for proper handling
          fileType: file.type
        };

        console.log('=== DOCUMENT PROCESSING DEBUG ===');
        console.log('Raw response data:', response.data);
        console.log('Document object:', response.data.document);
        console.log('MD content length:', response.data.document?.md_content?.length || 0);
        console.log('Text content length:', response.data.document?.text_content?.length || 0);
        console.log('Final content length:', newDoc.content.length);
        console.log('Content preview (first 500 chars):', newDoc.content.substring(0, 500));
        console.log('Content preview (last 500 chars):', newDoc.content.substring(Math.max(0, newDoc.content.length - 500)));
        console.log('File path stored:', newDoc.filePath);
        console.log('Actual file path:', newDoc.actualFilePath);
        console.log('File type:', newDoc.fileType);
        console.log('Original file object:', newDoc.originalFile);
        console.log('=== END DEBUG ===');

        setDocuments(prev => [...prev, newDoc]);
        setProcessedFileHashes(prev => new Set([...prev, fileHash]));
        setUploadStatus(`${file.name} processed successfully!`);
        
        // Keep progress bar visible for a moment to show completion
        setTimeout(() => {
          setProcessingProgress(prev => ({
            ...prev,
            current: 0,
            total: 0,
            percentage: 0,
            estimatedTime: 0,
            startTime: null
          }));
        }, 2000);
        
        setIsProcessing(false);
        setTimeout(() => setUploadStatus(''), 3000);
      }
    } catch (error) {
      console.error('Detailed error processing document:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      console.error('Error detail array:', error.response?.data?.detail);
      
      if (error.response?.data?.detail && Array.isArray(error.response.data.detail)) {
        error.response.data.detail.forEach((detail, index) => {
          console.error(`Detail ${index}:`, detail);
          console.error(`Detail location:`, detail.loc);
          console.error(`Detail message:`, detail.msg);
          console.error(`Detail type:`, detail.type);
        });
      }
      
      // Reset progress bar on error
      setProcessingProgress({
        current: 0,
        total: 0,
        percentage: 0,
        estimatedTime: 0,
        startTime: null
      });
      
      setIsProcessing(false);
      let errorMessage = `Failed to process ${file.name}. `;
      
      if (error.response?.status === 413) {
        errorMessage += 'File too large.';
      } else if (error.response?.status === 422) {
        errorMessage += 'Unsupported file format.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage += 'Request timed out.';
      } else if (error.response?.data?.detail) {
        errorMessage += error.response.data.detail;
      } else {
        errorMessage += 'Please try again.';
      }
      
      setUploadStatus(errorMessage);
      
      setTimeout(() => setUploadStatus(''), 8000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDirectorySelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const directoryPath = files[0].webkitRelativePath.split('/')[0];
    setSelectedDirectory(directoryPath);
    setDirectoryFiles(files);
    
    // Filter for supported file types and check duplicates
    const supportedFiles = files.filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return ['pdf', 'txt', 'docx', 'png', 'jpg', 'jpeg'].includes(ext);
    });

    if (supportedFiles.length === 0) {
      setUploadStatus('No supported files found in directory');
      return;
    }

    // Count duplicates
    const newFiles = supportedFiles.filter(file => !processedFileHashes.has(generateFileHash(file)));
    const duplicates = supportedFiles.length - newFiles.length;

    setUploadStatus(`Found ${supportedFiles.length} files (${newFiles.length} new, ${duplicates} already processed) from ${directoryPath}`);
  };

  const processEntireDirectory = async () => {
    if (directoryFiles.length === 0) return;

    setIsScanningDirectory(true);
    
    const supportedFiles = directoryFiles.filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return ['pdf', 'txt', 'docx', 'png', 'jpg', 'jpeg'].includes(ext);
    });

    // Filter out already processed files
    const newFiles = supportedFiles.filter(file => !processedFileHashes.has(generateFileHash(file)));
    
    if (newFiles.length === 0) {
      setUploadStatus('All files in directory have already been processed!');
      setIsScanningDirectory(false);
      setTimeout(() => setUploadStatus(''), 5000);
      return;
    }

    setScanProgress({ current: 0, total: newFiles.length, skipped: supportedFiles.length - newFiles.length });
    setUploadStatus(`Starting batch processing: ${newFiles.length} new files, ${supportedFiles.length - newFiles.length} skipped (already processed)`);

    let processedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      try {
        setScanProgress(prev => ({ ...prev, current: i + 1 }));
        setUploadStatus(`Processing ${file.name} (${i + 1}/${newFiles.length})...`);
        
        console.log(`Processing file ${i + 1}/${newFiles.length}: ${file.name}`);
        console.log(`File size: ${file.size} bytes, type: ${file.type}`);
        
        const formData = new FormData();
        formData.append('files', file); // Changed from 'file' to 'files' as required by API
        
        // Use consistent configuration matching docker-compose settings
        const options = {
          pdf_backend: "dlparse_v4", // Match docker-compose setting
          pipeline: "standard",
          pipeline_options: {
            do_ocr: true,
            ocr_options: { 
              kind: "TESSERACT", // Match docker-compose setting
              lang: ["eng"], // Match docker-compose setting
              dpi: 300,
              force_full_page_ocr: true
            },
            pdf_options: {
              extract_images: true,
              process_images: true
            }
          }
        };
        
        // IMPORTANT: Send options as application/json Blob
        const optionsBlob = new Blob([JSON.stringify(options)], { type: "application/json" });
        formData.append("options", optionsBlob, "options.json");

        console.log('Sending request to Docling...');
        console.log('FormData contents:');
        for (let [key, value] of formData.entries()) {
          if (key === 'options') {
            // Log the actual JSON content, not the Blob object
            console.log(`${key}: ${await value.text()}`);
          } else {
            console.log(`${key}: ${value}`);
          }
        }
        
        // Use async endpoint for better reliability
        const asyncResponse = await axios.post(`${DOCLING_URL}/v1/convert/file/async`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
            // Temporarily removed API key to test
          },
          timeout: 120000, // 2 minutes timeout
        });
        
        console.log('Async task started:', asyncResponse.data);
        
        // Poll for completion
        const taskId = asyncResponse.data.task_id;
        let response = null;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          
          try {
            const statusResponse = await axios.get(`${DOCLING_URL}/v1/status/poll/${taskId}`);
            
            // Update progress status for batch processing
            const progress = statusResponse.data.task_meta;
            if (progress) {
              const numProcessed = progress.num_processed || 0;
              const numDocs = progress.num_docs || 1;
              const currentProgress = Math.min(numProcessed, numDocs);
              
              // Update progress state for batch processing
              const { percentage, estimatedTime } = calculateProgress(currentProgress, numDocs, Date.now());
              setProcessingProgress({
                current: currentProgress,
                total: numDocs,
                percentage,
                estimatedTime,
                startTime: Date.now()
              });
              
              setUploadStatus(`Processing ${file.name} (${i + 1}/${newFiles.length})... ${numProcessed}/${numDocs} pages (${percentage}%)`);
            }
            
            if (statusResponse.data.task_status === 'success') {
              // Get the result
              const resultResponse = await axios.get(`${DOCLING_URL}/v1/result/${taskId}`);
              response = resultResponse;
              break;
            } else if (statusResponse.data.task_status === 'failure') {
              console.error('Task failed with details:', statusResponse.data);
              console.error('Full status response:', JSON.stringify(statusResponse.data, null, 2));
              
              // Try to get more error details
              let errorMessage = 'Unknown error';
              if (statusResponse.data.task_meta?.error) {
                errorMessage = statusResponse.data.task_meta.error;
              } else if (statusResponse.data.errors && statusResponse.data.errors.length > 0) {
                errorMessage = statusResponse.data.errors.join(', ');
              } else if (statusResponse.data.message) {
                errorMessage = statusResponse.data.message;
              }
              
              throw new Error(`Task failed: ${errorMessage}`);
            }
            
            attempts++;
          } catch (error) {
            console.log(`Poll attempt ${attempts + 1} failed:`, error.message);
            attempts++;
          }
        }
        
        if (!response) {
          throw new Error('Task timed out after 5 minutes');
        }

        console.log('Docling response received:', response.data);
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        // Check what content types are available
        if (response.data.document) {
          console.log('Document object keys:', Object.keys(response.data.document));
          console.log('Document content types available:', {
            md_content: !!response.data.document.md_content,
            text_content: !!response.data.document.text_content,
            html_content: !!response.data.document.html_content,
            json_content: !!response.data.document.json_content
          });
          
          if (response.data.document.md_content) {
            console.log('Markdown content preview:', response.data.document.md_content.substring(0, 500));
          }
          if (response.data.document.text_content) {
            console.log('Text content preview:', response.data.document.text_content.substring(0, 500));
          }
          
          // Log the full document object for debugging
          console.log('Full document object:', JSON.stringify(response.data.document, null, 2));
        }
        
        // Extract content from response
        const content = response.data.document?.md_content || 
                       response.data.document?.text_content || 
                       response.data.document?.html_content ||
                       'No content extracted';

        if (response.data) {
          const fileHash = generateFileHash(file);
          const newDoc = {
            id: Date.now() + Math.random(),
            filename: file.name,
            content: content,
            metadata: response.data.document || {},
            timestamp: new Date().toISOString(),
            filePath: file.webkitRelativePath || file.name,
            fileHash: fileHash,
            // Store the actual file object for opening
            originalFile: file,
            // Store the actual file path if available
            actualFilePath: file.webkitRelativePath || null,
            // Store file type for proper handling
            fileType: file.type
          };

          setDocuments(prev => [...prev, newDoc]);
          setProcessedFileHashes(prev => new Set([...prev, fileHash]));
          processedCount++;
          console.log(`Successfully processed: ${file.name}`);
          console.log(`File path stored: ${newDoc.actualFilePath || 'No path available'}`);
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        console.error(`Error details:`, error.response?.data || error.message);
        failedCount++;
      }

      // Small delay to prevent overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const finalMessage = `Batch processing complete! ${processedCount} files processed, ${failedCount} failed, ${scanProgress.skipped} skipped (already processed).`;
    setUploadStatus(finalMessage);
    
    // Reset progress bar after batch completion
    setProcessingProgress({
      current: 0,
      total: 0,
      percentage: 0,
      estimatedTime: 0,
      startTime: null
    });
    
    setIsScanningDirectory(false);
    setTimeout(() => setUploadStatus(''), 10000);
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!query.trim() || documents.length === 0) return;

    setIsQuerying(true);
    setAnswer('');
    setSources([]);

    try {
      // Search documents for relevant content - optimized for thousands of documents
      const relevantDocs = documents.filter(doc => {
        const queryLower = query.toLowerCase().replace(/\s+/g, ' ').trim();
        const contentLower = doc.content.toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Try multiple search strategies with improved relevance scoring
        const exactMatch = contentLower.includes(queryLower);
        const wordMatch = queryLower.split(' ').filter(word => word.length > 2).some(word => 
          contentLower.includes(word)
        );
        
        // Calculate relevance score based on multiple factors
        const queryWords = queryLower.split(' ').filter(word => word.length > 2);
        const wordMatches = queryWords.filter(word => contentLower.includes(word)).length;
        const relevanceScore = wordMatches / queryWords.length;
        
        const hasMatch = exactMatch || wordMatch || relevanceScore > 0.3;
        
        console.log(`Checking document: ${doc.filename}`);
        console.log(`Query (normalized): "${queryLower}"`);
        console.log(`Content preview (normalized): "${contentLower.substring(0, 100)}..."`);
        console.log(`Exact match: ${exactMatch}, Word match: ${wordMatch}, Relevance score: ${relevanceScore.toFixed(2)}, Has match: ${hasMatch}`);
        
        return hasMatch;
      }).map(doc => {
        // Calculate comprehensive relevance score
        const queryLower = query.toLowerCase().replace(/\s+/g, ' ').trim();
        const contentLower = doc.content.toLowerCase().replace(/\s+/g, ' ').trim();
        const queryWords = queryLower.split(' ').filter(word => word.length > 2);
        const wordMatches = queryWords.filter(word => contentLower.includes(word)).length;
        const relevanceScore = wordMatches / queryWords.length;
        
        return {
          filename: doc.filename,
          content: doc.content, // Full content for context
          relevance: relevanceScore,
          originalDoc: doc // Keep reference to original document
        };
      }).sort((a, b) => b.relevance - a.relevance).slice(0, 5); // Increased from 3 to 5 for better coverage

      console.log('=== RAG DEBUG INFO ===');
      console.log('Query:', query);
      console.log('Total documents available:', documents.length);
      console.log('Documents content previews:', documents.map(d => ({ name: d.filename, content: d.content.substring(0, 100) })));
      console.log('Relevant docs found:', relevantDocs.length);
      console.log('Relevant docs:', relevantDocs);

      setSources(relevantDocs);

      // Build context from sources with intelligent size management for thousands of documents
      let context = '';
      let totalContextLength = 0;
      const MAX_CONTEXT_LENGTH = 8000; // Limit context to prevent token overflow
      
      for (const doc of relevantDocs) {
        const docContext = `Document: ${doc.filename}\n${doc.content}`;
        
        // Check if adding this document would exceed context limit
        if (totalContextLength + docContext.length > MAX_CONTEXT_LENGTH) {
          // Truncate document content to fit within limit
          const remainingSpace = MAX_CONTEXT_LENGTH - totalContextLength - 100; // Leave space for formatting
          if (remainingSpace > 200) { // Only add if we have meaningful space
            const truncatedContent = doc.content.substring(0, remainingSpace) + '... [Content truncated for context limit]';
            context += `Document: ${doc.filename}\n${truncatedContent}\n\n`;
            totalContextLength += truncatedContent.length + doc.filename.length + 20;
          }
          break; // Stop adding more documents
        }
        
        context += docContext + '\n\n';
        totalContextLength += docContext.length;
      }
      
      // If context is still empty, add at least one document (truncated if necessary)
      if (!context.trim() && relevantDocs.length > 0) {
        const firstDoc = relevantDocs[0];
        const truncatedContent = firstDoc.content.substring(0, MAX_CONTEXT_LENGTH - 200) + '... [Content truncated for context limit]';
        context = `Document: ${firstDoc.filename}\n${truncatedContent}`;
        totalContextLength = truncatedContent.length + firstDoc.filename.length + 20;
      }

      console.log('=== CONTEXT BEING SENT TO AI ===');
      console.log('Context length:', context.length);
      console.log('Context content:', context);
      console.log('=== END CONTEXT ===');

      // Query Ollama with conversation context
      const currentConversation = getCurrentConversation();
      const conversationContext = currentConversation ? 
        currentConversation.messages.slice(-6).map(msg => `${msg.role}: ${msg.content}`).join('\n') : '';
      
      const fullPrompt = `IMPORTANT: You are analyzing documents in a conversational context. ONLY use the information provided below. DO NOT make up or infer any information not explicitly stated in the document.

${conversationContext ? `Previous conversation context:\n${conversationContext}\n\n` : ''}Document Content:
${context}

Current Question: ${query}

Instructions: Answer ONLY using the information from the document above. If the information is not in the document, say "This information is not provided in the document." Do not add any external knowledge or assumptions. Be conversational and reference previous questions when relevant.

Answer:`;

              const ollamaResponse = await axios.post(`${OLLAMA_URL}/generate`, {
        model: 'llama3.1:8b-instruct-q4_K_M', // Changed back to llama3.1:8b-instruct-q4_K_M
        prompt: fullPrompt,
        stream: false
      }, { timeout: 60000 });

      const aiResponse = ollamaResponse.data.response || 'No response generated';
      
      // Clear the input field after sending (like ChatGPT)
      setQuery('');

      // Save to chat history
      if (currentConversationId) {
        setChatHistory(prev => prev.map(conv => 
          conv.id === currentConversationId 
            ? {
                ...conv,
                messages: [...conv.messages, 
                  { role: 'user', content: query, timestamp: new Date().toISOString() },
                  { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() }
                ]
              }
            : conv
        ));
        
        // Clear the separate answer state since it's now in chat history
        setAnswer('');
      }
    } catch (error) {
      console.error('Error querying Ollama:', error);
      setAnswer('Error: Failed to generate answer. Please try again.');
    } finally {
      setIsQuerying(false);
    }
  };

  // Handle query input changes and auto-start conversations
  const handleQueryChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    // Auto-start new conversation if user types /new
    if (value === '/new') {
      startNewConversation();
      setQuery('');
    }
  };

  // Auto-start conversation if none exists
  useEffect(() => {
    if (!currentConversationId && chatHistory.length === 0) {
      startNewConversation();
    }
  }, [currentConversationId, chatHistory.length]);

  // Open the actual original file
  const openDocument = (document) => {
    try {
      console.log('Attempting to open document:', document);
      console.log('Document object:', document);
      console.log('Original file:', document.originalFile);
      console.log('File path:', document.filePath);
      console.log('Actual file path:', document.actualFilePath);
      console.log('File type:', document.fileType);
      
      // Method 1: Try to open using the File object directly (works for recently uploaded files)
      if (document.originalFile) {
        console.log('Opening using original file object...');
        
        // Create a temporary URL for the file
        const fileUrl = URL.createObjectURL(document.originalFile);
        console.log('Created file URL:', fileUrl);
        
        // Open in new tab/window
        const newWindow = window.open(fileUrl, '_blank');
        
        // Clean up the URL after a delay
        setTimeout(() => {
          URL.revokeObjectURL(fileUrl);
          console.log('Cleaned up file URL');
        }, 5000);
        
        if (!newWindow) {
          alert('Please allow popups to view documents');
        }
        return;
      }
      
      // Method 2: If we have an actual file path, try to provide helpful information
      if (document.actualFilePath && document.actualFilePath !== document.filename) {
        console.log('Document has actual file path:', document.actualFilePath);
        
        // Show a message with the actual file location
        const message = `This document is located at:\n\n${document.actualFilePath}\n\nDue to browser security restrictions, I cannot directly open files from your file system. You can:\n\n1. Navigate to this location in File Explorer\n2. Open the file manually with the appropriate application\n3. Copy the path and paste it in your file manager`;
        
        alert(message);
        return;
      }
      
      // Method 3: Fallback - show content in formatted view with honest message
      console.log('Falling back to formatted content view...');
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${document.filename || 'Document'}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              line-height: 1.6;
              color: #1a202c;
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem;
              background: #f8fafc;
            }
            .document-header {
              background: white;
              padding: 2rem;
              border-radius: 12px;
              margin-bottom: 2rem;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              border: 1px solid #e2e8f0;
            }
            .document-title {
              font-size: 1.75rem;
              font-weight: 700;
              color: #1a202c;
              margin-bottom: 0.5rem;
            }
            .document-meta {
              color: #4a5568;
              font-size: 0.9rem;
            }
            .document-content {
              background: white;
              padding: 2rem;
              border-radius: 12px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              border: 1px solid #e2e8f0;
              white-space: pre-wrap;
              word-wrap: break-word;
              font-size: 1rem;
              line-height: 1.7;
            }
            .download-btn {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 0.75rem 1.5rem;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              margin-top: 1rem;
              transition: background-color 0.2s;
            }
            .download-btn:hover {
              background: #5a6fd8;
            }
            .close-btn {
              position: fixed;
              top: 1rem;
              right: 1rem;
              background: #fed7d7;
              color: #742a2a;
              border: none;
              padding: 0.5rem 1rem;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 600;
            }
            .close-btn:hover {
              background: #feb2b2;
            }
            .info-box {
              background: #e6fffa;
              border: 1px solid #38b2ac;
              color: #234e52;
              padding: 1rem;
              border-radius: 8px;
              margin-bottom: 1rem;
            }
            .file-path {
              background: #f7fafc;
              border: 1px solid #e2e8f0;
              padding: 0.75rem;
              border-radius: 6px;
              font-family: monospace;
              font-size: 0.9rem;
              margin: 0.5rem 0;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <button class="close-btn" onclick="window.close()">Close</button>
          <div class="document-header">
            <h1 class="document-title">${document.filename || 'Document'}</h1>
            <div class="info-box">
              <strong>📄 Document Information:</strong><br>
              This is the extracted text content from your document. 
              ${document.actualFilePath ? 
                `The original file is located at the path shown below.` : 
                `The original file path was not captured during processing.`
              }
            </div>
            ${document.actualFilePath ? 
              `<div class="file-path"><strong>File Location:</strong><br>${document.actualFilePath}</div>` : 
              ''
            }
            <div class="document-meta">
              <strong>File:</strong> ${document.filename || 'Unknown'}<br>
              <strong>Content Length:</strong> ${document.content?.length || 0} characters<br>
              <strong>Opened:</strong> ${new Date().toLocaleString()}
            </div>
            <a href="#" class="download-btn" onclick="downloadDocument()">Download as Text</a>
          </div>
          <div class="document-content">${document.content || 'No content available'}</div>
          
          <script>
            function downloadDocument() {
              const content = \`${document.content || ''}\`;
              const filename = \`${document.filename || 'document'}.txt\`;
              const blob = new Blob([content], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
          </script>
        </body>
        </html>
      `;
      
      // Create a blob URL from the HTML content
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // Open in new tab
      const newWindow = window.open(url, '_blank');
      
      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      if (!newWindow) {
        alert('Please allow popups to view documents');
      }
      
    } catch (error) {
      console.error('Error opening document:', error);
      alert('Error opening document. Please try again.');
    }
  };

  const removeDocument = (id) => {
    const docToRemove = documents.find(doc => doc.id === id);
    if (docToRemove && docToRemove.fileHash) {
      setProcessedFileHashes(prev => {
        const newSet = new Set(prev);
        newSet.delete(docToRemove.fileHash);
        return newSet;
      });
    }
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const clearAllDocuments = () => {
    clearStorage();
  };

  const getStorageStats = () => {
    const totalSize = documents.reduce((acc, doc) => acc + doc.content.length, 0);
    const avgSize = documents.length > 0 ? Math.round(totalSize / documents.length) : 0;
    return {
      totalDocs: documents.length,
      totalChars: totalSize,
      avgChars: avgSize,
      storageUsed: Math.round((JSON.stringify(documents).length / 1024 / 1024) * 100) / 100
    };
  };

  const stats = getStorageStats();

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 RAG React Interface</h1>
        <p>Document Processing + AI Generation using Docling & Ollama</p>
        <div className="storage-stats">
          <Database size={16} />
          <span>Documents: {stats.totalDocs} | Storage: {stats.storageUsed}MB</span>
        </div>
      </header>

      <main className="app-main">
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={18} />
            RAG Chat Interface
          </button>
          <button 
            className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={18} />
            Document Upload
          </button>
        </div>

        <div className="tab-content">
          {/* RAG Chat Interface Tab */}
          {activeTab === 'chat' && (
            <div className="chat-interface">
              {/* Conversation Management */}
              <div className="conversation-controls">
                <button 
                  onClick={startNewConversation}
                  className="new-conversation-btn"
                  disabled={isQuerying}
                >
                  <MessageSquare size={16} />
                  New Conversation
                </button>
                {currentConversationId && (
                  <span className="current-conversation">
                    Current: {getCurrentConversation()?.title || 'Conversation'}
                  </span>
                )}
              </div>
              
              {/* Chat Messages Container */}
              <div className="chat-messages-container">
                {/* Chat History Display */}
                {currentConversationId && getCurrentConversation()?.messages.length > 0 && (
                  <div className="chat-messages">
                    {getCurrentConversation().messages.map((message, index) => (
                      <div key={index} className={`chat-message ${message.role}`}>
                        <div className="message-avatar">
                          {message.role === 'user' ? '👤' : '🤖'}
                        </div>
                        <div className="message-content">
                          <div className="message-text">{message.content}</div>
                          
                          {/* Show sources only for AI responses */}
                          {message.role === 'assistant' && sources.length > 0 && (
                            <div className="sources-display">
                              <h4>📚 Sources:</h4>
                              {sources.map((source, sourceIndex) => (
                                <div key={sourceIndex} className="source-item">
                                  <div className="source-header">
                                    <strong>{source.filename}</strong>
                                    <div className="source-actions">
                                      <button 
                                        onClick={() => openDocument(source.originalDoc || source)}
                                        className="open-doc-btn"
                                        title="Open document or show file location"
                                      >
                                        <FileText size={14} />
                                        Open Document
                                      </button>
                                      <span className="relevance-score">
                                        {(source.relevance * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="source-preview">
                                    {source.content.substring(0, 150)}...
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="message-timestamp">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Show loading state if querying */}
                {isQuerying && (
                  <div className="chat-message assistant">
                    <div className="message-avatar">🤖</div>
                    <div className="message-content">
                      <div className="message-text">
                        <Loader2 size={20} className="spinner" /> Thinking...
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Persistent Chat Input at Bottom */}
              <div className="chat-input-container">
                <form onSubmit={handleQuery} className="chat-input-form">
                  <div className="input-wrapper">
                    <textarea
                      value={query}
                      onChange={handleQueryChange}
                      placeholder="Ask a question about your documents... (Type /new to start a new conversation)"
                      rows={1}
                      required
                      disabled={isQuerying || documents.length === 0}
                      className="chat-textarea"
                    />
                    <button 
                      type="submit" 
                      className="send-button"
                      disabled={isQuerying || documents.length === 0 || !query.trim()}
                    >
                      {isQuerying ? (
                        <Loader2 size={18} className="spinner" />
                      ) : (
                        <Search size={18} />
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Document Upload Tab */}
          {activeTab === 'upload' && (
            <div className="upload-interface">
              <h2>
                <Upload size={20} />
                Document Upload & Processing
              </h2>
              
              {/* Single File Upload */}
              <div className="upload-area">
                <input
                  type="file"
                  accept=".pdf,.txt,.docx,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  disabled={isProcessing || isScanningDirectory}
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="upload-label">
                  {isProcessing ? (
                    <>
                      <Loader2 size={24} className="spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload size={24} />
                      Choose a single file
                    </>
                  )}
                </label>
              </div>

              {/* Directory Upload */}
              <div className="directory-upload">
                <h3>
                  <FolderOpen size={18} />
                  Scan Entire Directory/Drive
                </h3>
                <input
                  type="file"
                  webkitdirectory=""
                  directory=""
                  onChange={handleDirectorySelect}
                  disabled={isProcessing || isScanningDirectory}
                  id="directory-upload"
                />
                <label htmlFor="directory-upload" className="directory-label">
                  <HardDrive size={24} />
                  Select entire folder/drive
                </label>
                
                {selectedDirectory && (
                  <div className="directory-info">
                    <p><strong>Selected:</strong> {selectedDirectory}</p>
                    <p><strong>Files found:</strong> {directoryFiles.length}</p>
                    {scanProgress.total > 0 && (
                      <div className="progress-info">
                        <p><strong>Progress:</strong> {scanProgress.current}/{scanProgress.total}</p>
                        <p><strong>Skipped (duplicates):</strong> {scanProgress.skipped}</p>
                      </div>
                    )}
                    <button 
                      onClick={processEntireDirectory}
                      className="process-directory-btn"
                      disabled={isScanningDirectory || directoryFiles.length === 0}
                    >
                      {isScanningDirectory ? (
                        <>
                          <Loader2 size={16} className="spin" />
                          Processing Directory...
                        </>
                      ) : (
                        <>
                          <HardDrive size={16} />
                          Process All Files
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {uploadStatus && (
                <div className={`status-message ${uploadStatus.includes('successfully') ? 'success' : uploadStatus.includes('Failed') ? 'error' : uploadStatus.includes('skipped') ? 'warning' : 'info'}`}>
                  {uploadStatus.includes('successfully') ? <CheckCircle size={16} /> : 
                   uploadStatus.includes('Failed') ? <XCircle size={16} /> : 
                   uploadStatus.includes('skipped') ? <SkipForward size={16} /> : 
                   <Loader2 size={16} />}
                  {uploadStatus}
                </div>
              )}

              {/* Progress Bar for OCR Processing */}
              {isProcessing && processingProgress.total > 0 && (
                <div className="progress-container">
                  <div className="progress-header">
                    <span>OCR Progress</span>
                    <span>{processingProgress.percentage}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${processingProgress.percentage}%` }}
                    ></div>
                  </div>
                  <div className="progress-details">
                    <span>Page {processingProgress.current} of {processingProgress.total}</span>
                    {processingProgress.estimatedTime > 0 && (
                      <span>Estimated: {formatTime(processingProgress.estimatedTime)}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="documents-list">
                <div className="documents-header">
                  <h3>
                    <FileText size={18} />
                    Processed Documents ({documents.length})
                  </h3>
                  {documents.length > 0 && (
                    <button onClick={clearAllDocuments} className="clear-all-btn">
                      Clear All
                    </button>
                  )}
                </div>
                {documents.map(doc => (
                  <div key={doc.id} className="document-card">
                    <div className="document-header">
                      <strong>{doc.filename}</strong>
                      <button 
                        onClick={() => removeDocument(doc.id)}
                        className="remove-btn"
                        title="Remove document"
                      >
                        ×
                      </button>
                    </div>
                    <small>Processed: {new Date(doc.timestamp).toLocaleString()}</small>
                    {doc.filePath && <small>Path: {doc.filePath}</small>}
                    <div className="document-content">
                      {doc.content.substring(0, 300)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>Powered by Docling + Ollama | React RAG Interface | Persistent Storage Enabled</p>
      </footer>
    </div>
  );
}

export default App;
