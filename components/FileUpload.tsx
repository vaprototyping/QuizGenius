import React, { useEffect, useRef, useState } from 'react';
import { Language, SubjectType } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { useI18n } from '../context/i18n';
import { isDocxMime } from '../services/textExtractionService';
import { SUBJECT_GROUPS, SubjectKey } from '../studyContext';

interface FileUploadProps {
  initialFiles?: File[];
  initialLanguage?: Language;
  initialFocus?: SubjectType;
  initialStudySubject?: SubjectKey | '';
  initialCustomSubject?: string;
  onMaterialChange?: () => void;
  onFileProcessed: (files: File[], language: Language, focus: SubjectType, studySubject: SubjectKey, customSubject?: string) => void;
  onTextProcessed: (text: string, language: Language, focus: SubjectType, studySubject: SubjectKey, customSubject?: string) => void;
}

type SelectedFile = { id: number; file: File; thumbnail?: string };

export const FileUpload: React.FC<FileUploadProps> = ({ initialFiles, initialLanguage, initialFocus, initialStudySubject, initialCustomSubject, onMaterialChange, onFileProcessed, onTextProcessed }) => {
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [language, setLanguage] = useState<Language>(initialLanguage ?? Language.English);
  const [subjectType, setSubjectType] = useState<SubjectType>(initialFocus ?? SubjectType.Text);
  const [studySubject, setStudySubject] = useState<SubjectKey | ''>(initialStudySubject ?? '');
  const [customSubject, setCustomSubject] = useState(initialCustomSubject ?? '');
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<SelectedFile[]>([]);
  const nextId = useRef(0);
  const { t } = useI18n();
  const subjectReady = Boolean(studySubject && (studySubject !== 'other' || customSubject.trim().length >= 2));
  const subjectSelector = <div className="study-subject-field"><label htmlFor="study-subject">{t('fileUpload.studySubject')}</label><select id="study-subject" value={studySubject} onChange={event => { const value = event.target.value as SubjectKey | ''; setStudySubject(value); if (value === 'mathematics' || value === 'statistics') setSubjectType(SubjectType.Math); }} required><option value="">{t('fileUpload.chooseSubject')}</option>{SUBJECT_GROUPS.map(group => <optgroup label={t(`subjectGroups.${group.key}`)} key={group.key}>{group.subjects.map(key => <option value={key} key={key}>{t(`subjects.${key}`)}</option>)}</optgroup>)}</select>{studySubject === 'other' && <input value={customSubject} maxLength={80} onChange={event => setCustomSubject(event.target.value)} aria-label={t('fileUpload.otherSubject')} placeholder={t('fileUpload.otherSubject')} />}</div>;

  // Each preview belongs to its selection and is released when the item goes away.
  useEffect(() => {
    filesRef.current = selected;
  }, [selected]);
  useEffect(() => () => filesRef.current.forEach(item => {
    if (item.thumbnail) URL.revokeObjectURL(item.thumbnail);
  }), []);
  useEffect(() => {
    if (!initialFiles?.length) return;
    const restored = initialFiles.map((file, id) => ({ id, file, thumbnail: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined }));
    nextId.current = restored.length;
    filesRef.current = restored;
    setSelected(restored);
  }, []);

  const addFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    const current = filesRef.current;
    const isImage = (file: File) => file.type.startsWith('image/');
    const isDocument = (file: File) => file.type === 'application/pdf' || isDocxMime(file.type);
    if (incoming.some(file => !isImage(file) && !isDocument(file))) {
      setError(t('errors.unsupportedFile'));
      return;
    }
    const combined = [...current.map(item => item.file), ...incoming];
    if (combined.filter(isImage).length > 5) {
      setError(t('errors.tooManyImages'));
      return;
    }
    if (combined.some(isDocument) && combined.length > 1) {
      setError(t('errors.mixedFiles'));
      return;
    }
    const items = incoming.map(file => ({ id: nextId.current++, file, thumbnail: isImage(file) ? URL.createObjectURL(file) : undefined }));
    filesRef.current = [...current, ...items];
    setSelected(filesRef.current);
    setError(null);
    onMaterialChange?.();
  };

  const removeFile = (id: number) => {
    const removed = filesRef.current.find(item => item.id === id);
    if (removed?.thumbnail) URL.revokeObjectURL(removed.thumbnail);
    filesRef.current = filesRef.current.filter(item => item.id !== id);
    setSelected(filesRef.current);
    setError(null);
    onMaterialChange?.();
  };

  const handleSubmit = async () => {
    const files = selected.map(item => item.file);
    if (!files.length) return;
    const pdf = files.find(file => file.type === 'application/pdf');
    if (pdf) {
      try {
        const pdfjsLib = (window as any).pdfjsLib;
        const document = await pdfjsLib.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) }).promise;
        if (document.numPages > 15) {
          setError(t('errors.pdfPageLimit'));
          return;
        }
      } catch {
        setError(t('errors.pdfRender'));
        return;
      }
    }
    if (!subjectReady || !studySubject) return;
    onFileProcessed(files, language, subjectType, studySubject, studySubject === 'other' ? customSubject.trim() : undefined);
  };

  return <div className="upload-panel">
    <div className="panel-heading"><div><span className="eyebrow">{t('fileUpload.yourMaterial')}</span><h2>{t('fileUpload.title')}</h2><p>{t('fileUpload.subtitle')}</p></div><span className="panel-decoration" aria-hidden="true">✳</span></div>
    <div className="input-tabs"><button className={inputMode === 'file' ? 'active' : ''} type="button" onClick={() => setInputMode('file')}>{t('fileUpload.uploadTab')}</button><button className={inputMode === 'text' ? 'active' : ''} type="button" onClick={() => setInputMode('text')}>{t('fileUpload.pasteTab')}</button></div>
    {inputMode === 'file' ? <>
      <label htmlFor="file-upload" className="upload-dropzone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}>
        <span className="upload-illustration" aria-hidden="true">🖼️ &nbsp; 📄</span><UploadIcon className="h-11 w-11" />
        <span><strong>{t('fileUpload.clickToUpload')}</strong> {t('fileUpload.dragAndDrop')}</span>
        <small>{t('fileUpload.fileTypes')}</small>
      </label>
      <input ref={pickerInputRef} id="file-upload" type="file" className="sr-only" accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
      <input ref={cameraInputRef} id="camera-upload" type="file" accept="image/*" capture="environment" className="sr-only" onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
      <div className="camera-action"><button type="button" className="secondary-button" onClick={() => cameraInputRef.current?.click()}>{t('fileUpload.useCamera')}</button><p>{t('fileUpload.cameraDescription')}</p></div>
      {selected.length > 0 && <section className="selected-files" aria-label={t('fileUpload.selectedFiles')}><div className="selected-heading"><h3>{t('fileUpload.selectedFiles')}</h3><span>{selected.length} / 5</span></div><ul>{selected.map(({ id, file, thumbnail }) => <li key={id}>
        {thumbnail ? <img src={thumbnail} alt="" /> : <span className="document-thumb" aria-hidden="true">📄</span>}
        <span className="file-name" title={file.name}>{file.name}</span>
        <button type="button" onClick={() => removeFile(id)} aria-label={t('fileUpload.removeFile', { name: file.name })} title={t('fileUpload.removeFile', { name: file.name })}>×</button>
      </li>)}</ul></section>}
      {error && <p role="alert" className="upload-error">{error}</p>}
      {selected.length > 0 && <div className="file-settings">{subjectSelector}<div className="input-row"><label>{t('fileUpload.subjectType')}<select value={subjectType} onChange={event => setSubjectType(event.target.value as SubjectType)}>{Object.values(SubjectType).map(value => <option key={value} value={value}>{t(`enums.subjectType.${value}`)}</option>)}</select></label><label>{t('fileUpload.documentLanguage')}<select value={language} onChange={event => setLanguage(event.target.value as Language)}>{[Language.English, Language.Dutch, Language.Italian].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div><button type="button" className="primary-button" disabled={!subjectReady} onClick={handleSubmit}>{t('fileUpload.analyzeMaterial')} <span aria-hidden="true">→</span></button></div>}
    </> : <><div className="paste-area"><label htmlFor="study-text">{t('fileUpload.pasteLabel')}</label><textarea id="study-text" rows={8} value={pastedText} onChange={event => setPastedText(event.target.value)} placeholder={t('fileUpload.pastePlaceholder')} /><p>{t('fileUpload.pasteHint')}</p></div><div className="paste-footer">{subjectSelector}<div className="input-row"><label>{t('fileUpload.subjectType')}<select value={subjectType} onChange={event => setSubjectType(event.target.value as SubjectType)}>{Object.values(SubjectType).map(value => <option key={value} value={value}>{t(`enums.subjectType.${value}`)}</option>)}</select></label><label>{t('fileUpload.documentLanguage')}<select value={language} onChange={event => setLanguage(event.target.value as Language)}>{[Language.English, Language.Dutch, Language.Italian].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div><button className="primary-button" type="button" disabled={!subjectReady || pastedText.trim().length < 50 || pastedText.length > 24000} onClick={() => onTextProcessed(pastedText, language, subjectType, studySubject as SubjectKey, studySubject === 'other' ? customSubject.trim() : undefined)}>{t('fileUpload.analyzeMaterial')} <span aria-hidden="true">→</span></button></div></>}
  </div>;
};
