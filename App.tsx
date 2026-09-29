import React, { useState, useCallback, useRef, FormEvent } from 'react';
import { FileUpload } from './components/FileUpload';
import { QuizOptions as QuizOptionsComponent } from './components/QuizOptions';
import { QuizDisplay } from './components/QuizDisplay';
import { QuizResults } from './components/QuizResults';
import { LanguageSelector } from './components/LanguageSelector';
import { ThemeSelector } from './components/ThemeSelector';
import { extractTextFromUploads, ImageQualityError, isDocxMime } from './services/textExtractionService';
import { StudentProfile, SubjectKey } from './studyContext';
import {
  Quiz,
  Language,
  SubjectType,
  QuizOptions,
  QuizType,
  Question,
  TextQuizOptions
} from './types';
import { useI18n } from './context/i18n';
import { generateQuiz as generateQuizAPI, QuizApiError } from './src/lib/api';

function mapQuizType(opts: QuizOptions): "mcq" | "true_false" | "open" {
  const raw =
    (opts as any).quizType || (opts as any).questionType || (opts as any).type || "mcq";
  const normalized = String(raw).toLowerCase().replace("-", "_").replace(" ", "_");

  if (normalized.includes("true") || normalized.includes("false")) return "true_false";
  if (normalized.includes("open")) return "open";
  return "mcq";
}

const App: React.FC = () => {
  const [step, setStep] = useState<'upload' | 'options' | 'quiz' | 'results' | 'loading'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<QuizApiError | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [currentQuizOptions, setCurrentQuizOptions] = useState<QuizOptions | null>(null);
  const [language, setLanguage] = useState<Language>(Language.English);
  const [subjectType, setSubjectType] = useState<SubjectType>(SubjectType.Text);
  const [studySubject, setStudySubject] = useState<SubjectKey | ''>('');
  const [customSubject, setCustomSubject] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [studentProfile, setStudentProfile] = useState<StudentProfile>({ age: null, schoolType: '', year: null });
  const [mode, setMode] = useState<'student' | 'parent'>('student');
  const [accessCode, setAccessCode] = useState('');
  const [accessInput, setAccessInput] = useState('');
  const [accessError, setAccessError] = useState('');
  const [checkingAccess, setCheckingAccess] = useState(false);
  const { t, locale } = useI18n();
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState(t('loading.thinking'));
  const [processingDetails, setProcessingDetails] = useState<
    | { type: 'images'; totalItems: number }
    | { type: 'pdf'; totalPages: number }
    | { type: 'docx' }
    | { type: 'quiz' }
    | null
  >(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const getPdfPageCount = useCallback(async (file: File): Promise<number> => {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) return 0;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    return pdf.numPages || 0;
  }, []);
  const stopProgressSimulation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);
  const startProgressSimulation = useCallback((messages: string[], durationSeconds: number) => {
    stopProgressSimulation();
    setProgress(0);
    let currentProgress = 0;
    const progressCap = 95;
    const intervalDuration = 100; // ms
    const totalUpdates = (durationSeconds * 1000) / intervalDuration;
    const increment = progressCap / totalUpdates;
    let messageIndex = 0;
    setLoadingMessage(messages[0]);
    intervalRef.current = setInterval(() => {
      currentProgress += increment;
      if (currentProgress < progressCap) {
        setProgress(currentProgress);
        const newMessageIndex = Math.floor((currentProgress / progressCap) * messages.length);
        if (newMessageIndex > messageIndex) {
          messageIndex = newMessageIndex;
          setLoadingMessage(messages[messageIndex % messages.length]);
        }
      } else {
        setProgress(progressCap);
        stopProgressSimulation();
      }
    }, intervalDuration);
  }, [stopProgressSimulation]);
  const handleFileProcessed = async (selectedFiles: File[], lang: Language, subject: SubjectType, selectedSubject: SubjectKey, otherSubject?: string) => {
    setStep('loading');
    setUploadedFiles(selectedFiles);
    setError(null);
    setErrorDetails(null);
    setLanguage(lang);
    setSubjectType(subject);
    setStudySubject(selectedSubject);
    setCustomSubject(otherSubject || '');
    const images = selectedFiles.filter((file) => file.type.startsWith('image/'));
    const pdfFile = selectedFiles.find((file) => file.type === 'application/pdf');
    const docxFile = selectedFiles.find((file) => isDocxMime(file.type));
    if (images.length > 0) {
      setProcessingDetails({ type: 'images', totalItems: images.length });
    } else if (pdfFile) {
      setProcessingDetails({ type: 'pdf', totalPages: 1 });
    } else if (docxFile) {
      setProcessingDetails({ type: 'docx' });
    }
    const duration = Math.min(15, Math.max(6, selectedFiles.length * 3));
    startProgressSimulation([t('loading.analyzing'), t('loading.extracting'), t('loading.finalizing')], duration);
    try {
      if (pdfFile) {
        const pageCount = await getPdfPageCount(pdfFile);
        setProcessingDetails({ type: 'pdf', totalPages: Math.max(1, pageCount) });
      }
      const text = await extractTextFromUploads(selectedFiles, lang, subject);
      if (!text || text.trim().length < 50) throw new Error(t(images.length ? 'errors.lowQualityImage' : 'errors.tooLittleText'));
      if (text.length > 24000) throw new Error(t('errors.tooMuchText'));
      stopProgressSimulation();
      setProgress(100);
      setLoadingMessage(t('loading.extractionComplete'));
      setExtractedText(text ?? '');
      setProcessingDetails(null);
      setTimeout(() => setStep('options'), 500);
    } catch (e) {
      stopProgressSimulation();
      console.error(e);
      setError(e instanceof ImageQualityError ? t('errors.lowQualityImageNumber', {number: e.imageNumber}) : e instanceof Error ? e.message : t('errors.unknownExtraction'));
      setProcessingDetails(null);
      setStep('upload');
    }
  };
  const handleTextProcessed = (text: string, lang: Language, subject: SubjectType, selectedSubject: SubjectKey, otherSubject?: string) => {
    const clean = text.trim();
    if (clean.length < 50 || clean.length > 24000) { setError(t(clean.length < 50 ? 'errors.tooLittleText' : 'errors.tooMuchText')); return; }
    setUploadedFiles([]); setExtractedText(clean); setLanguage(lang); setSubjectType(subject); setStudySubject(selectedSubject); setCustomSubject(otherSubject || ''); setError(null); setStep('options');
  };
  const handleQuizGenerate = async (options: QuizOptions) => {
    if (!extractedText) return;
    setStep('loading');
    setError(null);
    setErrorDetails(null);
    setCurrentQuizOptions(options);
    setProcessingDetails({ type: 'quiz' });
    startProgressSimulation([
        t('loading.understanding'),
        t('loading.crafting'),
        t('loading.developing'),
        t('loading.assembling')
    ], 10);
    try {
      const typeForAPI = mapQuizType(options);
      const countForAPI = Math.min(15, Math.max(1, Number(options.numberOfQuestions) || 1));
      const generated = await generateQuizAPI(extractedText, typeForAPI, countForAPI, locale, {
        mode,
        subject: options.subjectType === SubjectType.Math ? 'math' : 'text',
        difficulty: options.subjectType === SubjectType.Math ? options.difficulty : undefined,
        mathStyle: options.subjectType === SubjectType.Math ? options.mathQuizType : undefined,
        studySubject: studySubject as SubjectKey,
        customSubject: studySubject === 'other' ? customSubject : undefined,
        studentProfile,
      }, accessCode);
      const quizData: Quiz = {
        title: generated.title,
        questions: generated.questions.map((question: Question) => ({
          ...question,
          type: typeForAPI === 'mcq' ? QuizType.MultipleChoice : typeForAPI === 'true_false' ? QuizType.TrueFalse : QuizType.Open,
        })),
      };

      stopProgressSimulation();
      setProgress(100);
      setLoadingMessage(t('loading.quizGenerated'));
      setQuiz(quizData);
      setUserAnswers({});
      setProcessingDetails(null);
      setTimeout(() => setStep('quiz'), 500);
    } catch (e) {
      stopProgressSimulation();
      console.error(e);
      if (e instanceof Error && e.message === 'Incorrect access code.') {
        setAccessCode('');
        setAccessInput('');
        setAccessError(t('app.invalidAccess'));
      }
      if (e instanceof QuizApiError) {
        setErrorDetails(e);
        const key = `generationErrors.${e.code}`;
        setError(t(key) === key ? e.message : t(key));
      } else {
        setError(t('generationErrors.unknown'));
      }
      setProcessingDetails(null);
      setStep('options');
    }
  };
  const handleSubmitQuiz = (answers: Record<number, string>) => {
    setUserAnswers(answers);
    setStep('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleRestart = () => {
    stopProgressSimulation();
    setStep('upload');
    setError(null);
    setErrorDetails(null);
    setExtractedText(null);
    setUploadedFiles([]);
    setStudySubject('');
    setCustomSubject('');
    setStudentProfile({ age: null, schoolType: '', year: null });
    setQuiz(null);
    setUserAnswers({});
    setCurrentQuizOptions(null);
    setProcessingDetails(null);
  };
  const handleGenerateNewQuiz = () => {
      stopProgressSimulation();
      setStep('options');
      setQuiz(null);
      setUserAnswers({});
      setProcessingDetails(null);
  }
  const verifyAccess = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessInput.trim()) return;
    setCheckingAccess(true);
    try {
      const response = await fetch('/api/verify-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: accessInput.trim() }) });
      if (response.ok) { setAccessCode(accessInput.trim()); setAccessInput(''); setAccessError(''); }
      else setAccessError(t(response.status === 503 ? 'app.accessUnavailable' : 'app.invalidAccess'));
    } catch { setAccessError(t('app.accessUnavailable')); }
    finally { setCheckingAccess(false); }
  };
  const chrome = <><span className="wordmark"><span className="brand-spark" aria-hidden="true">✳</span> QwitzMe<span className="brand-dot">.ai</span></span><div className="header-actions"><LanguageSelector /><ThemeSelector /></div></>;
  if (!accessCode) return <div className="app-shell"><header className="site-header">{chrome}</header><main className="gate-layout">
    <section className="gate-story"><span className="eyebrow">{t('app.eyebrow')}</span><h1>{t('app.heroTitle')}</h1><p className="hero-copy">{t('app.heroCopy')}</p><div className="journey-chips">{[t('app.addNotes'), t('app.takeQuiz'), t('app.learnWhy')].map((label, index) => <span key={label}><b aria-hidden="true">{index + 1}</b>{label}</span>)}</div>
    <div className="sample-card" aria-hidden="true"><div className="sample-heading"><span className="sample-badge">✦ {t('app.sampleLabel')}</span><span>01 / 05</span></div><p>{t('app.sampleQuestion')}</p><div className="sample-choice">A &nbsp; {t('app.sampleAnswerA')}</div><div className="sample-choice selected">B &nbsp; {t('app.sampleAnswerB')} <span>✓</span></div></div></section>
    <form onSubmit={verifyAccess} className="gate-card"><div className="gate-icon" aria-hidden="true">↗</div><h2>{t('app.readyTitle')}</h2><p>{t('app.accessPrompt')}</p><label htmlFor="access-code">{t('app.accessLabel')}</label><input id="access-code" type="password" autoComplete="off" value={accessInput} onChange={event => { setAccessInput(event.target.value); setAccessError(''); }} />{accessError && <p role="alert" className="form-error">{accessError}</p>}<button disabled={checkingAccess} className="primary-button" type="submit">{t('app.continue')} <span aria-hidden="true">→</span></button><small>{t('app.accessNote')}</small></form>
  </main></div>;
  const renderContent = () => {
    if (step === 'loading') {
      const spinnerProgressIndex = (current: number, total: number) => {
        if (total <= 1) return 1;
        const derived = Math.max(1, Math.round((current / 100) * total));
        return Math.min(total, derived);
      };
      const processingText = (() => {
        if (!processingDetails) return loadingMessage;

        if (processingDetails.type === 'images') {
          const currentItem = spinnerProgressIndex(progress, processingDetails.totalItems);
          return t('loading.processingImage', { current: currentItem, total: processingDetails.totalItems });
        }

        if (processingDetails.type === 'pdf') {
          const currentPage = spinnerProgressIndex(progress, processingDetails.totalPages);
          return t('loading.processingPage', { current: currentPage, total: processingDetails.totalPages });
        }

        if (processingDetails.type === 'docx') {
          return t('loading.processingDocument');
        }

        return t('loading.assembling');
      })();
      const supportingText = processingDetails?.type === 'quiz' ? t('loading.mightTakeMinute') : null;
      return (
        <div
          className="w-full max-w-lg mx-auto flex flex-col items-center gap-4 py-10 min-h-[240px]"
          role="status"
          aria-live="polite"
        >
          <div className="h-12 w-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" aria-hidden="true"></div>
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{processingText}</p>
            {supportingText && <p className="text-xs text-slate-500 dark:text-slate-400">{supportingText}</p>}
          </div>
        </div>
      );
    }
    const errorMessage = error && <div role="alert" className="flow-error"><strong>{step === 'upload' ? t('errors.photoHelpTitle') : t('generationErrors.title')}</strong><p>{error}</p>{errorDetails && <details className="generation-diagnostics"><summary>{t('generationErrors.details')}</summary><ul>{errorDetails.attempts.map((attempt, index) => <li key={`${attempt.provider}-${index}`}><strong>{attempt.provider}</strong>: {t(`generationErrors.${attempt.code}`)}{attempt.status ? ` (HTTP ${attempt.status})` : ''}</li>)}</ul>{errorDetails.fallbackConfigured === false && <p>{t('generationErrors.noFallback')}</p>}{errorDetails.requestId && <p>{t('generationErrors.reference')}: <code>{errorDetails.requestId}</code></p>}</details>}</div>;
    switch (step) {
      case 'upload':
        return <>{errorMessage}<FileUpload initialFiles={uploadedFiles} initialLanguage={language} initialFocus={subjectType} initialStudySubject={studySubject} initialCustomSubject={customSubject} onMaterialChange={() => setError(null)} onFileProcessed={handleFileProcessed} onTextProcessed={handleTextProcessed} /></>;
      case 'options':
        if (extractedText !== null) {
          return <>{errorMessage}<QuizOptionsComponent
            extractedText={extractedText} 
            initialLanguage={language} 
            initialSubjectType={subjectType}
            studentProfile={studentProfile}
            onStudentProfileChange={setStudentProfile}
            studySubject={studySubject as SubjectKey}
            customSubject={customSubject}
            onQuizGenerate={handleQuizGenerate} 
            onBack={handleRestart}
          /></>;
        }
        handleRestart();
        return null;
      case 'quiz':
        if (quiz) {
          return <QuizDisplay 
            quiz={quiz} 
            userAnswers={userAnswers}
            setUserAnswers={setUserAnswers}
            onSubmit={() => handleSubmitQuiz(userAnswers)}
            subjectType={subjectType}
          />;
        }
        return <p>{t('app.errorGeneric')}</p>;
      case 'results':
        if (quiz) {
          return <QuizResults 
            quiz={quiz} 
            userAnswers={userAnswers} 
            onRestart={handleRestart}
            onGenerateNewQuiz={handleGenerateNewQuiz}
            subjectType={subjectType}
          />;
        }
        return <p>{t('app.errorGeneric')}</p>;
      default:
        return <FileUpload initialFiles={uploadedFiles} initialLanguage={language} initialFocus={subjectType} initialStudySubject={studySubject} initialCustomSubject={customSubject} onMaterialChange={() => setError(null)} onFileProcessed={handleFileProcessed} onTextProcessed={handleTextProcessed} />;
    }
  };
  const stage = step === 'upload' ? 0 : step === 'options' || (step === 'loading' && !quiz) ? 1 : step === 'quiz' ? 2 : 3;
  return <div className="app-shell"><header className="site-header">{chrome}</header><main className="workspace">
    <nav className="steps" aria-label={t('app.progressLabel')}>{[t('app.addNotes'), t('app.setUp'), t('app.takeQuiz'), t('app.review')].map((label, index) => <div key={label} className={`step-chip ${stage === index ? 'active' : ''} ${stage > index ? 'complete' : ''}`}><span>{stage > index ? '✓' : index + 1}</span><span>{label}</span></div>)}</nav>
    {step === 'upload' && <div className="upload-intro"><span className="eyebrow">{t('app.eyebrow')}</span><h1>{t('app.workspaceTitle')}</h1><p>{t('app.workspaceCopy')}</p><div className="mode-switch" role="group" aria-label={t('app.modeLabel')}>{(['student','parent'] as const).map(value => <button key={value} type="button" onClick={() => setMode(value)} aria-pressed={mode === value} className={mode === value ? 'selected' : ''}>{value === 'student' ? '✏' : '♥'} &nbsp;{t(`app.${value}Mode`)}</button>)}</div><p className="mode-description">{t(`app.${mode}Description`)}</p></div>}
    <div className="stage-content">{renderContent()}</div>
  </main></div>;
};
export default App;
