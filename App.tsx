import React, { useState, useRef } from 'react';
import ImageUploader from './components/ImageUploader';
import { GoogleGenAI, Modality } from "@google/genai";

// For using html2canvas from CDN
declare const html2canvas: any;

const App: React.FC = () => {
  const [image1, setImage1] = useState<string | null>(null);
  const [image2, setImage2] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const hugContainerRef = useRef<HTMLDivElement>(null);

  const handleReset = () => {
    setImage1(null);
    setImage2(null);
    setFinalImage(null);
    setPrompt('');
    setError(null);
    setIsLoading(false);
  };

  const handleDownload = () => {
    if (hugContainerRef.current) {
      html2canvas(hugContainerRef.current, {
        useCORS: true,
        backgroundColor: null,
        scale: window.devicePixelRatio,
      }).then((canvas: HTMLCanvasElement) => {
        const link = document.createElement('a');
        link.download = 'photo-hug-edited.png';
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }
  };
  
  const combineImagesAndGenerate = async () => {
     if (!prompt || !image1 || !image2) {
      setError("Please provide a prompt and two images.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setFinalImage(null);

    try {
      // 1. Combine images on a canvas
      const combinedImageBase64 = await new Promise<string>((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));

        const img1 = new Image();
        const img2 = new Image();
        img1.crossOrigin = "anonymous";
        img2.crossOrigin = "anonymous";

        let loaded = 0;
        const onBothLoaded = () => {
          loaded++;
          if (loaded < 2) return;

          const aspectRatio = 2 / 1;
          canvas.width = 1024;
          canvas.height = canvas.width / aspectRatio;

          // Draw image 2 on the right
          ctx.drawImage(img2, canvas.width * 0.45, 0, canvas.width * 0.55, canvas.height);
          
          // Create clipping path for image 1
          ctx.save();
          const path = new Path2D();
          path.moveTo(0, 0);
          path.lineTo(canvas.width * 0.55 * 0.91, 0);
          path.lineTo(canvas.width * 0.55, canvas.height / 2);
          path.lineTo(canvas.width * 0.55 * 0.91, canvas.height);
          path.lineTo(0, canvas.height);
          path.closePath();
          ctx.clip(path);

          // Draw image 1 on the left
          ctx.drawImage(img1, 0, 0, canvas.width * 0.55, canvas.height);
          ctx.restore();
          
          resolve(canvas.toDataURL('image/png'));
        };

        img1.onload = onBothLoaded;
        img2.onload = onBothLoaded;
        img1.onerror = reject;
        img2.onerror = reject;

        img1.src = image1;
        img2.src = image2;
      });

      // 2. Send the combined image to Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const fullPrompt = `
**ROLE:** You are a professional digital artist specializing in photorealistic edits.

**TASK:** Your job is to edit the provided photograph according to the user's request, while strictly adhering to the constraints below.

**USER REQUEST:** "${prompt}"

**CRITICAL CONSTRAINTS:**
1.  **PRESERVE FACES:** The single most important rule is to preserve the exact faces and facial expressions of the people in the photograph. Do NOT alter their features, likeness, or identity in any way. The final image must be clearly recognizable as the same people.
2.  **EDIT, DON'T REPLACE:** You must modify the existing image. Do not create a new image from scratch or replace the subjects.
3.  **APPLY ONLY THE REQUESTED EDIT:** Only apply the changes described in the "USER REQUEST". Do not add, remove, or change any other elements of the photo unless it is a necessary part of the request.
`;
      
      const imagePart = {
        inlineData: {
          mimeType: 'image/png',
          data: combinedImageBase64.split(',')[1],
        },
      };
      const textPart = { text: fullPrompt };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });
      
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setFinalImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
          return;
        }
      }
      throw new Error("No image data was returned from the API.");

    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(`Sorry, something went wrong: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans text-slate-800">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400">
            Photo Hug
          </h1>
          <p className="text-slate-500 mt-2 text-lg">Combine and edit two photos into a single, seamless creation with AI.</p>
        </header>

        <main>
          {!finalImage && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <ImageUploader
                id="uploader1"
                label="First Photo"
                imagePreview={image1}
                onImageUpload={setImage1}
              />
              <ImageUploader
                id="uploader2"
                label="Second Photo"
                imagePreview={image2}
                onImageUpload={setImage2}
              />
            </div>
          )}

          {image1 && image2 && !finalImage && (
            <div className="w-full max-w-2xl mx-auto mb-8 animate-fade-in">
              <label htmlFor="prompt" className="block text-lg font-semibold text-slate-700 mb-2">Describe your edit</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., 'Change the background to a futuristic city'"
                className="w-full p-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow duration-200"
                rows={2}
                disabled={isLoading}
              ></textarea>
               <button
                  onClick={combineImagesAndGenerate}
                  disabled={isLoading || !prompt}
                  className="mt-4 w-full bg-gradient-to-r from-blue-500 to-teal-400 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    "✨ Generate Hug"
                  )}
                </button>
            </div>
          )}
          
          {error && <p className="text-red-500 text-center mb-4 bg-red-100 p-3 rounded-lg">{error}</p>}

          {(image1 && image2) && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-semibold text-slate-700 text-center mb-4">
                {finalImage ? "Your AI-Edited Photo Hug!" : "Here's your Photo Hug!"}
              </h2>
              <div 
                ref={hugContainerRef}
                className="relative max-w-2xl mx-auto p-1.5 bg-white rounded-2xl shadow-2xl overflow-hidden hover:shadow-blue-200 transition-shadow duration-300">
                  {isLoading && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-2xl">
                       <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="mt-4 text-slate-600 font-semibold">AI is working its magic...</p>
                    </div>
                  )}

                  {finalImage ? (
                    <img src={finalImage} alt="Final edited hug" className="w-full h-auto object-contain rounded-xl" />
                  ) : (
                    <div className="relative w-full aspect-[2/1]">
                      <img
                        src={image2}
                        alt="Second upload"
                        className="absolute top-0 right-0 w-[55%] h-full object-cover"
                      />
                      <img
                        src={image1}
                        alt="First upload"
                        className="absolute top-0 left-0 w-[55%] h-full object-cover"
                        style={{
                          clipPath: 'polygon(0% 0%, 91% 0%, 100% 50%, 91% 100%, 0% 100%)',
                        }}
                      />
                    </div>
                  )}

                 <div className="absolute bottom-2 right-4 text-white font-bold text-base pointer-events-none z-10" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}>
                  SHAHKAR
                </div>
              </div>
            </div>
          )}

          {(image1 || image2) && (
             <div className="text-center mt-8 flex justify-center items-center gap-4">
                <button
                  onClick={handleReset}
                  disabled={isLoading}
                  className="bg-red-500 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-red-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
                {(image1 && image2) && (
                   <button
                    onClick={handleDownload}
                    disabled={isLoading}
                    className="bg-blue-500 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-blue-600 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                  </button>
                )}
              </div>
          )}
        </main>
      </div>
       <footer className="text-center text-slate-400 mt-12 text-sm">
          <p>Built with Gemini, React, and Tailwind CSS.</p>
        </footer>
    </div>
  );
};

export default App;
