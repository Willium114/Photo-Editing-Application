
import React, { useRef } from 'react';
import { PhotoIcon } from './PhotoIcon';

interface ImageUploaderProps {
  id: string;
  label: string;
  imagePreview: string | null;
  onImageUpload: (base64: string) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ id, label, imagePreview, onImageUpload }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if(file.size > 10 * 1024 * 1024) {
        alert("File is too large. Please select a file smaller than 10MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };
  
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
     if (file) {
      if(file.size > 10 * 1024 * 1024) {
        alert("File is too large. Please select a file smaller than 10MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-lg font-semibold text-slate-700 mb-2 text-center md:text-left">
        {label}
      </label>
      <div
        className="relative w-full aspect-video bg-white rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-slate-50 transition-all duration-300 group overflow-hidden"
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          id={id}
          ref={inputRef}
          type="file"
          accept="image/png, image/jpeg, image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
        {imagePreview ? (
          <img
            src={imagePreview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-500 text-center p-4">
            <PhotoIcon className="w-12 h-12 mb-2 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <p className="font-semibold">
              <span className="text-blue-500">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm mt-1">PNG, JPG, or GIF (max 10MB)</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
