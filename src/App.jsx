import { useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from "@react-three/postprocessing"; 
import Avatar from "./components/Avatar";
import { sendMessageToGemini, stopResponse, continueResponse } from "./services/ai";
import "./App.css";

function App() {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([
    { sender: "ai", text: "Melsa Pro Online. Mata Visual aku sudah aktif maksimal tanpa batasan. Upload foto atau suruh aku menggambar apa saja, Tuan Sayang... ❤️📸" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null); 
  
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle('light-mode', !isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Data = reader.result.split(',')[1]; 
        const mimeType = file.type;
        resolve({ mimeType, data: base64Data, preview: reader.result });
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageData = await fileToBase64(file);
      setSelectedImage(imageData);
      e.target.value = null; 
    }
  };

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
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage) return;
    const userMsg = { 
      sender: "user", 
      text: inputText, 
      image: selectedImage?.preview,
      timestamp: Date.now() 
    };
    setMessages((prev) => [...prev, userMsg]);
    const imagePayload = selectedImage ? { mimeType: selectedImage.mimeType, data: selectedImage.data } : null;
    setInputText("");
    setSelectedImage(null);
    setIsLoading(true);
    const replyText = await sendMessageToGemini(userMsg.text, imagePayload);
    setMessages((prev) => [...prev, { sender: "ai", text: replyText, timestamp: Date.now() }]);
    setIsLoading(false);
  };

  const handleStop = () => {
    stopResponse();
    setIsLoading(false);
    setMessages((prev) => [...prev, { sender: "system", text: "⛔ BERHENTI." }]);
  };

  const handleContinue = async () => {
    setIsLoading(true);
    const replyText = await continueResponse();
    setMessages((prev) => [...prev, { sender: "ai", text: replyText, timestamp: Date.now() }]);
    setIsLoading(false);
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- ULTRA PARSER FOR IMAGES ---
  const renderMessageContent = (text, msgIndex) => {
    const parts = text.split(/(!!IMG:[\s\S]*?!!)/g);
    
    return parts.map((part, index) => {
      const cleanPart = part.replace(/\*\*/g, "").replace(/`/g, "").trim();

      if (cleanPart.startsWith("!!IMG:")) {
        let prompt = cleanPart.replace("!!IMG:", "").replace("!!", "").trim();
        if (prompt.startsWith("[") && prompt.endsWith("]")) {
          prompt = prompt.slice(1, -1);
        }

        const safePrompt = prompt.length > 1000 ? prompt.substring(0, 1000) : prompt;
        // Gunakan timestamp pesan + index agar seed permanen per gambar
        const seed = msgIndex + index;
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;
        
        return (
          <div key={`${msgIndex}-${index}`} className="generated-image-container">
            <img 
              src={imageUrl} 
              alt="Melsa Magic" 
              className="generated-image" 
              crossOrigin="anonymous"
              loading="lazy"
              onError={(e) => {
                 if (!e.target.dataset.retried) {
                    e.target.dataset.retried = "true";
                    e.target.src = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt.substring(0, 300))}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;
                 }
              }} 
            />
            <div className="img-controls">
              <span className="img-caption">🎨 Visual: {safePrompt.substring(0, 30)}...</span>
              <button className="save-btn" onClick={() => downloadImage(imageUrl, `Melsa-Art-${seed}.png`)}>💾 Simpan</button>
            </div>
          </div>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="app-container">
      <div className="canvas-layer">
        <Canvas camera={{ position: [0, 0, 6], fov: 35 }} gl={{ antialias: true }}>
          <color attach="background" args={[isDarkMode ? "#050005" : "#fff0f5"]} />
          <fog attach="fog" args={[isDarkMode ? "#1a001a" : "#ffffff", 5, 20]} />
          <ambientLight intensity={isDarkMode ? 0.2 : 0.8} />
          <Avatar isThinking={isLoading} isDarkMode={isDarkMode} />
          <Environment preset={isDarkMode ? "night" : "sunset"} />
          <EffectComposer disableNormalPass>
             <Bloom luminanceThreshold={isDarkMode ? 0.2 : 0.6} intensity={isDarkMode ? 1.5 : 0.8} />
             <Noise opacity={0.02} />
             <Vignette darkness={isDarkMode ? 1.3 : 0.6} />
             {isLoading && <ChromaticAberration offset={[0.002, 0.002]} />}
          </EffectComposer>
        </Canvas>
      </div>

      <div className="ui-layer">
        <div className="hud-header">
          <div className="status-display">
            <span className={`status-dot ${isLoading ? 'busy' : 'ready'}`}></span>
            <span className="status-text">{isLoading ? 'MELSA BEKERJA...' : 'MELSA ONLINE'}</span>
          </div>
          <button className="theme-toggle-btn" onClick={toggleTheme}>{isDarkMode ? "☀️" : "🌙"}</button>
        </div>

        <div className="chat-feed">
          {messages.map((msg, index) => (
            <div key={index} className={`msg-row ${msg.sender}`}>
              <div className="msg-content">
                {msg.image && (
                  <div className="user-upload-container">
                    <img src={msg.image} className="user-upload-preview" alt="Upload" />
                    <button className="save-btn-mini" onClick={() => downloadImage(msg.image, "My-Upload.png")}>💾</button>
                  </div>
                )}
                {renderMessageContent(msg.text, index)}
              </div>
            </div>
          ))}
          {isLoading && <div className="msg-row ai"><div className="msg-content loading-pulse">...</div></div>}
          <div ref={chatEndRef} />
        </div>

        <div className="hud-footer">
          <div className="action-bar">
            {isLoading ? <button className="ctrl-btn" onClick={handleStop}>STOP</button> : <button className="ctrl-btn" onClick={handleContinue}>LANJUT</button>}
          </div>

          <div className="input-dock">
            <input type="file" ref={fileInputRef} accept="image/*" style={{display: 'none'}} onChange={handleFileSelect} />
            <button className="icon-btn" onClick={() => fileInputRef.current.click()}>📷</button>
            {selectedImage && (
              <div className="mini-preview" onClick={() => setSelectedImage(null)}>
                <img src={selectedImage.preview} alt="Selected" />
                <span className="remove-x">×</span>
              </div>
            )}
            <input type="text" placeholder="Perintahkan Melsa..." value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} disabled={isLoading} />
            <button className="send-btn" onClick={handleSend} disabled={isLoading}>🚀</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;