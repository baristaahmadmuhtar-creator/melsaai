import { useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from "@react-three/postprocessing"; 
import Avatar from "./components/Avatar";
import { sendMessageToGemini, stopResponse, continueResponse } from "./services/ai";
import "./App.css";

function App() {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([
    { 
      sender: "ai", 
      text: "Melsa Pro Online. Mata Visual aku sudah aktif maksimal tanpa batasan. Upload foto atau suruh aku menggambar apa saja, Tuan Sayang... ❤️📸" 
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // State untuk gambar: menyimpan { mimeType, data (base64), preview (data URL) }
  const [selectedImage, setSelectedImage] = useState(null); 
   
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Toggle Body Class untuk CSS Global
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
  }, [isDarkMode]);

  // Auto Scroll ke bawah saat ada pesan baru
  useEffect(() => {
    // Timeout kecil memastikan elemen sudah dirender sebelum di-scroll
    const timeoutId = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading]);

  // Fungsi Konversi File ke Base64 (Vision API Requirement)
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Ambil Base64 murni (hapus prefix data:image/...)
        const base64Data = reader.result.split(',')[1]; 
        const mimeType = file.type;
        resolve({ mimeType, data: base64Data, preview: reader.result });
      };
      reader.onerror = error => reject(error);
    });
  };

  // Handler Select File
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const imageData = await fileToBase64(file);
        setSelectedImage(imageData);
        // Fokuskan kembali ke input text agar user bisa langsung ngetik
        document.querySelector('.input-dock input[type="text"]')?.focus();
      } catch (error) {
        console.error("Gagal memproses file gambar:", error);
      }
      e.target.value = null; // Reset value input file agar bisa pilih file yang sama
    }
  };

  // Fungsi Download Gambar
  const downloadImage = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Gagal mendownload gambar", e);
      alert("Gagal mengunduh gambar. Coba lagi.");
    }
  };

  // Kirim Pesan
  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage) return;
    
    // 1. Tambahkan pesan User ke UI
    const userMsg = { 
      sender: "user", 
      text: inputText, 
      image: selectedImage?.preview, // Preview lokal
      timestamp: Date.now() 
    };
    setMessages((prev) => [...prev, userMsg]);
    
    // 2. Siapkan Payload untuk API
    const imagePayload = selectedImage 
      ? { mimeType: selectedImage.mimeType, data: selectedImage.data } 
      : null;
      
    // 3. Reset State Input
    setInputText("");
    setSelectedImage(null);
    setIsLoading(true);
    
    try {
        // 4. Request ke AI Service
        const replyText = await sendMessageToGemini(userMsg.text, imagePayload);
        
        // 5. Tambahkan balasan AI ke UI
        setMessages((prev) => [...prev, { sender: "ai", text: replyText, timestamp: Date.now() }]);
    } catch (error) {
        setMessages((prev) => [...prev, { sender: "system", text: "⚠️ Terjadi kesalahan koneksi." }]);
    } finally {
        setIsLoading(false);
    }
  };

  // Kontrol Stop & Lanjut
  const handleStop = () => {
    stopResponse();
    setIsLoading(false);
    setMessages((prev) => [...prev, { sender: "system", text: "⛔ Respon dihentikan oleh pengguna." }]);
  };

  const handleContinue = async () => {
    setIsLoading(true);
    try {
        const replyText = await continueResponse();
        if (replyText !== "Dibatalkan.") {
          setMessages((prev) => [...prev, { sender: "ai", text: replyText, timestamp: Date.now() }]);
        }
    } catch (error) {
        console.error("Gagal melanjutkan", error);
    } finally {
        setIsLoading(false);
    }
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- PARSER TEXT & IMAGE GENERATION ---
  const renderMessageContent = (text, msgIndex) => {
    if (!text) return null;

    // Regex untuk menangkap format gambar dari AI: !!IMG:[prompt]!!
    const parts = text.split(/(!!IMG:\[[^\]]*?\]!!|!!IMG:.*?!!)/g);
    
    return parts.map((part, index) => {
      // Cek apakah part adalah kode gambar
      if (part && (part.startsWith("!!IMG:[") || part.startsWith("!!IMG:"))) {
        
        // Bersihkan syntax untuk mendapatkan prompt murni
        let prompt = part.replace(/^!!IMG:\[?/, "").replace(/\]?!!$/, "").trim();
        // Sanitasi karakter aneh
        prompt = prompt.replace(/[\*`#№]/g, '').trim();

        if (!prompt) return null;

        const safePrompt = prompt.length > 1000 ? prompt.substring(0, 1000) : prompt;
        // Seed unik berdasarkan pesan dan posisi agar gambar konsisten (tidak berubah saat re-render)
        const seed = msgIndex + index + 12345; 
        
        // URL Pollinations AI (Flux Model)
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;
        
        return (
          <div key={`${msgIndex}-${index}`} className="generated-image-container">
            <img 
              src={imageUrl} 
              alt={`Generated: ${safePrompt}`} 
              className="generated-image" 
              crossOrigin="anonymous"
              loading="lazy"
              onError={(e) => {
                 // Fallback Logic jika gagal load pertama kali
                 if (!e.target.dataset.retried) {
                    e.target.dataset.retried = "true";
                    // Coba persingkat prompt jika terlalu panjang
                    const shorterPrompt = safePrompt.substring(0, 300);
                    e.target.src = `https://image.pollinations.ai/prompt/${encodeURIComponent(shorterPrompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;
                 }
              }} 
            />
            <div className="img-controls">
              <span className="img-caption" title={safePrompt}>🎨 {safePrompt}</span>
              <button className="save-btn" onClick={() => downloadImage(imageUrl, `Melsa-Art-${seed}.png`)}>
                💾 Simpan
              </button>
            </div>
          </div>
        );
      }
      
      // Render teks biasa
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="app-container">
      {/* --- LAYER 1: 3D BACKGROUND --- */}
      <div className="canvas-layer">
        {/* dpr={[1, 2]} membatasi pixel ratio agar HP tidak panas & tetap smooth */}
        <Canvas 
            camera={{ position: [0, 0, 6], fov: 35 }} 
            gl={{ antialias: true, preserveDrawingBuffer: true }}
            dpr={[1, 2]} 
        >
          <color attach="background" args={[isDarkMode ? "#050005" : "#fff0f5"]} />
          <fog attach="fog" args={[isDarkMode ? "#1a001a" : "#ffffff", 5, 20]} />
          
          <ambientLight intensity={isDarkMode ? 0.3 : 0.8} />
          
          {/* Avatar Component */}
          <Avatar isThinking={isLoading} isDarkMode={isDarkMode} />
          
          <Environment preset={isDarkMode ? "night" : "sunset"} />
          
          {/* Post Processing Effects */}
          <EffectComposer disableNormalPass>
             <Bloom luminanceThreshold={isDarkMode ? 0.2 : 0.65} intensity={isDarkMode ? 1.2 : 0.6} />
             <Noise opacity={0.03} />
             <Vignette darkness={isDarkMode ? 1.2 : 0.5} />
             {isLoading && <ChromaticAberration offset={[0.002, 0.002]} />}
          </EffectComposer>
        </Canvas>
      </div>

      {/* --- LAYER 2: USER INTERFACE --- */}
      <div className="ui-layer">
        
        {/* Header / HUD */}
        <div className="hud-header">
          <div className="status-display">
            <span className={`status-dot ${isLoading ? 'busy' : 'ready'}`}></span>
            <span className="status-text">{isLoading ? 'MELSA BEKERJA...' : 'MELSA ONLINE'}</span>
          </div>
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme} 
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Chat Feed Area */}
        <div className="chat-feed">
          {messages.map((msg, index) => (
            <div key={index} className={`msg-row ${msg.sender}`}>
              <div className="msg-content">
                
                {/* Tampilkan Preview Upload User jika ada */}
                {msg.image && (
                  <div className="user-upload-container">
                    <img src={msg.image} className="user-upload-preview" alt="User Upload" />
                    <button className="save-btn-mini" onClick={() => downloadImage(msg.image, "My-Upload.png")}>💾</button>
                  </div>
                )}
                
                {/* Render Text / Generated Images */}
                {renderMessageContent(msg.text, index)}
              </div>
            </div>
          ))}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="msg-row ai">
                <div className="msg-content loading-pulse">
                    sedang mengetik...
                </div>
            </div>
          )}
          
          {/* Invisible Element for Auto Scroll */}
          <div ref={chatEndRef} />
        </div>

        {/* Footer & Input Area */}
        <div className="hud-footer">
          
          {/* Action Bar (Stop/Continue) */}
          <div className="action-bar">
            {isLoading ? 
                <button className="ctrl-btn stop-btn" onClick={handleStop}>⛔ STOP</button> : 
                <button className="ctrl-btn continue-btn" onClick={handleContinue}>LANJUT ➡️</button>
            }
          </div>

          {/* Input Dock Glassmorphism */}
          <div className="input-dock">
            
            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*,.webp,.heic,.heif,.svg,.tiff" 
              style={{display: 'none'}} 
              onChange={handleFileSelect} 
            />
            
            {/* Camera Button */}
            <button className="icon-btn" onClick={() => fileInputRef.current.click()} title="Upload Gambar">
                📷
            </button>
            
            {/* Mini Preview saat mau upload */}
            {selectedImage && (
              <div className="mini-preview" onClick={() => setSelectedImage(null)} title="Klik untuk Batal">
                <img src={selectedImage.preview} alt="Preview" />
                <span className="remove-x">×</span>
              </div>
            )}
            
            {/* Text Input */}
            <input 
              type="text" 
              placeholder={selectedImage ? "Tulis perintah untuk gambar ini..." : "Perintahkan Melsa..."} 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
              disabled={isLoading} 
            />
            
            {/* Send Button */}
            <button className="send-btn" onClick={handleSend} disabled={isLoading || (!inputText.trim() && !selectedImage)}>
                🚀
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;