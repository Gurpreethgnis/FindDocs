# FindDocs - AI-Powered Document Search & Chat

A modern React-based RAG (Retrieval-Augmented Generation) application that allows you to upload, search, and chat with your documents using AI. Built with React, DocLing for document processing, and Ollama for AI chat capabilities.

## ✨ Features

- **📄 Multi-format Support**: PDF, DOCX, TXT, PNG, JPG, JPEG
- **🔍 Smart Search**: AI-powered document search with relevance scoring
- **💬 AI Chat**: Interactive chat interface with document context
- **📁 Batch Processing**: Upload entire directories at once
- **🔄 Real-time Processing**: Live progress tracking and status updates
- **📱 Responsive Design**: Works on desktop and mobile devices
- **🔒 Local Processing**: All document processing happens locally via DocLing
- **🤖 AI Integration**: Powered by Ollama for local AI chat

## 🏗️ Architecture

```
FindDocs React App (Port 3000)
    ↓
DocLing Server (Port 35111) - Document Processing
    ↓
Ollama Server (Port 11434) - AI Chat
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Docker** (for DocLing server)
- **Ollama** (for AI chat)

### 1. Clone the Repository

```bash
git clone https://github.com/Gurpreethgnis/FindDocs.git
cd FindDocs
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start DocLing Server

```bash
docker-compose up -d
```

This starts the DocLing server on port 35111 with OCR capabilities.

### 4. Start Ollama Server

```bash
# Install Ollama (if not already installed)
# Visit: https://ollama.ai/download

# Start Ollama and pull a model
ollama serve
ollama pull llama3.1:8b-instruct-q4_K_M
```

### 5. Start the React Application

```bash
npm start
```

The app will be available at `http://localhost:3000`

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# DocLing Server Configuration
REACT_APP_DOCLING_URL=http://localhost:35111

# Ollama Server Configuration
REACT_APP_OLLAMA_URL=/api

# Debug Logging
REACT_APP_ENABLE_DEBUG_LOGGING=true
```

### Docker Configuration

The `docker-compose.yml` file configures DocLing with:
- Tesseract OCR engine
- English language support
- PDF parsing with dlparse_v4 backend
- Image processing capabilities

## 📖 Usage

### Uploading Documents

1. **Single File**: Drag & drop or click to select a file
2. **Batch Upload**: Select a directory for multiple files
3. **Supported Formats**: PDF, DOCX, TXT, PNG, JPG, JPEG

### Searching Documents

1. Type your query in the search box
2. View relevant document snippets
3. Click on sources to see full context

### AI Chat

1. Ask questions about your documents
2. AI provides answers based on document content
3. Maintains conversation context
4. References source documents

## 🛠️ Development

### Project Structure

```
FindDocs/
├── IDEA/src/           # Main React application
│   ├── App.js         # Main application component
│   ├── App.css        # Application styles
│   └── config.js      # Configuration settings
├── src/               # Alternative source directory
├── public/            # Static assets
├── docker-compose.yml # DocLing server configuration
├── package.json       # Node.js dependencies
└── README.md          # This file
```

### Available Scripts

```bash
npm start          # Start development server
npm run build      # Build for production
npm run test       # Run tests
npm run eject      # Eject from Create React App
```

### Adding New Features

1. **New File Types**: Update `SUPPORTED_FILE_TYPES` in `config.js`
2. **API Endpoints**: Modify `DOCLING_URL` or `OLLAMA_URL` in configuration
3. **UI Components**: Add new components in the `IDEA/src/` directory

## 🔧 Troubleshooting

### Common Issues

#### DocLing Server Not Starting
```bash
# Check Docker status
docker ps

# View logs
docker-compose logs docling

# Restart service
docker-compose restart
```

#### Ollama Connection Issues
```bash
# Check if Ollama is running
ollama list

# Restart Ollama
ollama serve
```

#### CORS Errors
- Ensure the proxy configuration in `package.json` is correct
- Check that both servers are running on expected ports

### Performance Tips

- **Large Documents**: Use batch processing for multiple files
- **OCR Processing**: Tesseract processing can take time for image-heavy PDFs
- **Memory Usage**: Monitor Docker container memory usage

## 🔒 Security Considerations

- **Local Processing**: All document processing happens locally
- **No Cloud Storage**: Documents are stored in your browser's localStorage
- **Network Access**: Only localhost connections are used by default
- **Environment Variables**: Sensitive configuration should use environment variables

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Gurpreethgnis/FindDocs/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Gurpreethgnis/FindDocs/discussions)

## 🙏 Acknowledgments

- **DocLing**: Document processing and OCR capabilities
- **Ollama**: Local AI model serving
- **React**: Frontend framework
- **Tesseract**: OCR engine

---

**Note**: This application is designed for local use. Ensure you have proper security measures in place if deploying to production environments.
