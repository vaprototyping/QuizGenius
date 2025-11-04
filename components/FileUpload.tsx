import React, { useState, useCallback, ChangeEvent } from 'react';
import { Language } from '../types';
import { UploadIcon } from './icons/UploadIcon';

interface FileUploadProps {
  onFileProcessed: (base64Data: string, mimeType: string, language: Language) => void;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

const renderPdfToCanvas = async (file: File): Promise<string> => {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
        fileReader.onload = async (event) => {
            try {
                const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
                // FIX: Access pdfjsLib from the window object to resolve the 'Cannot find name' error.
                const pdf = await (window as any).pdfjsLib.getDocument(typedarray).promise;
                const page = await pdf.getPage(1); // Get the first page
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                if (context) {
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    // convert canvas to base64 jpeg
                    resolve(canvas.toDataURL('image/jpeg').split(',')[1]);
                } else {
                    reject(new Error('Could not get canvas context'));
                }
            } catch (error) {
                reject(error);
            }
        };
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
    });
};


export const FileUpload: React.FC<FileUploadProps> = ({ onFileProcessed }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(Language.English);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setError(null);
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else if (selectedFile.type === 'application/pdf') {
         setPreview('pdf'); // Special value to indicate PDF is loading
         try {
            const base64Image = await renderPdfToCanvas(selectedFile);
            setPreview(`data:image/jpeg;base64,${base64Image}`);
         } catch(e) {
            console.error("PDF rendering failed:", e);
            setError("Failed to render PDF. It might be corrupted or unsupported.");
            setFile(null);
            setPreview(null);
         }
      } else {
        setError('Unsupported file type. Please upload an image or a single-page PDF.');
        setFile(null);
        setPreview(null);
      }
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) return;

    try {
        let base64Data: string;
        let mimeType: string;

        if (file.type.startsWith('image/')) {
            base64Data = await fileToBase64(file);
            mimeType = file.type;
        } else if (file.type === 'application/pdf') {
            base64Data = await renderPdfToCanvas(file);
            mimeType = 'image/jpeg';
        } else {
            return;
        }

        onFileProcessed(base64Data, mimeType, language);
    } catch(e) {
        console.error("File processing failed:", e);
        setError("Could not process the file. Please try again.");
    }
  }, [file, language, onFileProcessed]);

  return (
    <div className="flex flex-col items-center w-full">
      <label
        htmlFor="file-upload"
        className="w-full h-64 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        {preview ? (
            preview === 'pdf' ? (
                <div className="text-center">
                    <p className="text-slate-500 dark:text-slate-400">Rendering PDF preview...</p>
                </div>
            ) : (
                <img src={preview} alt="File preview" className="max-h-full max-w-full object-contain rounded-md" />
            )
        ) : (
          <div className="text-center">
            <UploadIcon className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-indigo-500">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Image or single-page PDF</p>
          </div>
        )}
      </label>
      <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,application/pdf" />
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      
      {file && (
        <div className="mt-6 w-full max-w-md">
          <p className="text-center truncate text-sm text-slate-500 dark:text-slate-400 mb-4">{file.name}</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full">
                <label htmlFor="language" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Document Language
                </label>
                <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                    {Object.values(Language).map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                    ))}
                </select>
            </div>
            <button
                onClick={handleSubmit}
                disabled={!file}
                className="w-full sm:w-auto mt-4 sm:mt-0 self-end whitespace-nowrap px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
                Extract Text
            </button>
          </div>
        </div>
      )}
    </div>
  );
};