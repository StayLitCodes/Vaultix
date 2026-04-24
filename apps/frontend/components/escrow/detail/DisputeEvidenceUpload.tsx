'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  progress: number;
  error?: string;
}

interface DisputeEvidenceUploadProps {
  files: UploadedFile[];
  onChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-400" />;
  return <FileText className="w-5 h-5 text-gray-400" />;
}

export function DisputeEvidenceUpload({ files, onChange }: DisputeEvidenceUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const simulateUpload = useCallback((uploadedFile: UploadedFile) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      onChange((prev: UploadedFile[]) =>
        prev.map((f) => (f.id === uploadedFile.id ? { ...f, progress: Math.round(progress) } : f)),
      );
    }, 200);
  }, [onChange]);

  const processFiles = useCallback((rawFiles: FileList | File[]) => {
    const incoming = Array.from(rawFiles);
    const remaining = MAX_FILES - files.length;
    if (remaining <= 0) return;

    const toAdd: UploadedFile[] = incoming.slice(0, remaining).map((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { id: crypto.randomUUID(), file, progress: 0, error: 'Unsupported file type' };
      }
      if (file.size > MAX_FILE_SIZE) {
        return { id: crypto.randomUUID(), file, progress: 0, error: 'File exceeds 10 MB limit' };
      }
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      return { id: crypto.randomUUID(), file, preview, progress: 0 };
    });

    onChange((prev: UploadedFile[]) => [...prev, ...toAdd]);
    toAdd.filter((f) => !f.error).forEach(simulateUpload);
  }, [files.length, onChange, simulateUpload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const removeFile = (id: string) => {
    onChange((prev: UploadedFile[]) => {
      const f = prev.find((f) => f.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        } ${files.length >= MAX_FILES ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600 font-medium">
          {isDragging ? 'Drop files here' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Images, PDFs, text files · max 10 MB · up to {MAX_FILES} files
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-2">
              {/* Thumbnail or icon */}
              {f.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.preview} alt={f.file.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <FileIcon type={f.file.type} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{f.file.name}</p>
                {f.error ? (
                  <p className="text-xs text-red-500">{f.error}</p>
                ) : f.progress < 100 ? (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-200"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                  </div>
                ) : (
                  <p className="text-xs text-green-600">Uploaded</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeFile(f.id)}
                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
