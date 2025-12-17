import React, { useState, useCallback, ChangeEvent, useRef } from 'react';
import { Language, SubjectType } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { useI18n } from '../context/i18n';
import { isDocxMime } from '../services/textExtractionService';

interface FileUploadProps {
  onFileProcessed: (files: File[], language: Language, subject: SubjectType) => void;
}

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
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | 'docx' | 'multiple' | null>(null);
  const [language, setLanguage] = useState<Language>(Language.English);
  const [subjectType, setSubjectType] = useState<SubjectType>(SubjectType.Text);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const buttonLabel = files.length > 0 ? t('fileUpload.analyzeMaterial') : t('fileUpload.extractText');

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files || []);

      if (selectedFiles.length === 0) {
        setFiles([]);
        setPreview(null);
        setPreviewType(null);
        return;
      }

      const images = selectedFiles.filter((file) => file.type.startsWith('image/'));
      const pdfs = selectedFiles.filter((file) => file.type === 'application/pdf');
      const docxs = selectedFiles.filter((file) => isDocxMime(file.type));

      if (images.length > 0 && (pdfs.length > 0 || docxs.length > 0)) {
        setError(t('errors.mixedFiles'));
        setFiles([]);
        setPreview(null);
        setPreviewType(null);
        return;
      }

      if (images.length > 5) {
        setError(t('errors.tooManyImages'));
        setFiles([]);
        setPreview(null);
        setPreviewType(null);
        return;
      }

      if (pdfs.length + docxs.length > 1) {
        setError(t('errors.tooManyDocuments'));
        setFiles([]);
        setPreview(null);
        setPreviewType(null);
        return;
      }

      if (pdfs.length === 1 && selectedFiles.length > 1) {
        setError(t('errors.singleDocumentOnly'));
        setFiles([]);
        setPreview(null);
        setPreviewType(null);
        return;
      }

      setError(null);
      setFiles(selectedFiles);

      if (images.length > 1) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
          setPreviewType('multiple');
        };
        reader.readAsDataURL(images[0]);
        return;
      }

      const selectedFile = selectedFiles[0];

      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
          setPreviewType('image');
        };
        reader.readAsDataURL(selectedFile);
        return;
      }

      if (selectedFile.type === 'application/pdf') {
        setPreview('pdf');
        setPreviewType('pdf');
        try {
          const base64Image = await renderPdfToCanvas(selectedFile);
          setPreview(`data:image/jpeg;base64,${base64Image}`);
        } catch (e) {
          console.error('PDF rendering failed:', e);
          setError(t('errors.pdfRender'));
          setFiles([]);
          setPreview(null);
          setPreviewType(null);
        }
        return;
      }

      if (isDocxMime(selectedFile.type)) {
        setPreview(null);
        setPreviewType('docx');
        return;
      }

      setError(t('errors.unsupportedFile'));
      setFiles([]);
      setPreview(null);
      setPreviewType(null);
    },
    [t]
  );

  const getPdfPageCount = useCallback(async (file: File): Promise<number> => {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) return 0;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    return pdf.numPages || 0;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (files.length === 0) return;

    const documentFile = files.find((file) => file.type === 'application/pdf');
    if (documentFile) {
      const pageCount = await getPdfPageCount(documentFile);
      if (pageCount > 15) {
        setError(t('errors.pdfPageLimit'));
        return;
      }
    }

    onFileProcessed(files, language, subjectType);
  }, [files, language, subjectType, onFileProcessed, t, getPdfPageCount]);

  return (
    <div className="flex flex-col items-center w-full">
      <label
        htmlFor="file-upload"
        className="w-full h-64 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors shadow-inner"
      >
        {preview ? (
          preview === 'pdf' ? (
            <div className="text-center">
              <p className="text-slate-500 dark:text-slate-400">{t('fileUpload.renderingPdf')}</p>
            </div>
          ) : (
            <div className="relative flex items-center justify-center w-full h-full">
              <img src={preview} alt="File preview" className="max-h-full max-w-full object-contain rounded-md" />
              {previewType === 'multiple' && files.length > 1 && (
                <span className="absolute bottom-2 right-2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
                  {t('fileUpload.multipleCount', { count: files.length })}
                </span>
              )}
            </div>
          )
        ) : previewType === 'docx' ? (
          <div className="text-center">
            <UploadIcon className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('fileUpload.docxReady')}</p>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="text-xl" aria-hidden>🖼️</span>
              <span className="text-xl" aria-hidden>📄</span>
            </div>
            <UploadIcon className="mx-auto h-12 w-12 text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-indigo-500">{t('fileUpload.clickToUpload')}</span> {t('fileUpload.dragAndDrop')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Images: JPG/PNG (max 5) · PDF/DOCX (max 15 pages)</p>
          </div>
        )}
      </label>
      <input
        id="file-upload"
        name="file-upload"
        type="file"
        className="sr-only"
        onChange={handleFileChange}
        accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
      />
      <input
        id="camera-upload"
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFileChange}
      />
      {files.length === 0 && (
        <div className="mt-4 w-full max-w-lg">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="w-full whitespace-nowrap px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {t('fileUpload.useCamera')}
          </button>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
            {t('fileUpload.cameraDescription')}
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {files.length > 0 && (
        <div className="mt-6 w-full max-w-lg">
          <p className="text-center truncate text-sm text-slate-500 dark:text-slate-400 mb-4">
            {files.length === 1 ? files[0].name : t('fileUpload.multipleFiles', { count: files.length })}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('fileUpload.subjectType')}</label>
              <div className="flex rounded-md shadow-sm">
                {Object.values(SubjectType).map((type, idx) => (
                  <button
                    key={type}
                    onClick={() => setSubjectType(type as SubjectType)}
                    className={`px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:z-10 w-full
                        ${subjectType === type ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}
                        ${idx === 0 ? 'rounded-l-md' : ''}
                        ${idx === Object.values(SubjectType).length -1 ? 'rounded-r-md' : ''}
                        `}
                  >
                    {t(`enums.subjectType.${type}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('fileUpload.documentLanguage')}
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                {Object.values(Language).map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleSubmit}
              disabled={files.length === 0}
              className="w-full whitespace-nowrap px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
