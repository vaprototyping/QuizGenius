import React, { useState, useCallback, useRef, useEffect, FormEvent } from 'react';
import { FileUpload } from './components/FileUpload';
import { QuizOptions as QuizOptionsComponent } from './components/QuizOptions';
import { QuizDisplay } from './components/QuizDisplay';
import { QuizResults } from './components/QuizResults';
import { LanguageSelector } from './components/LanguageSelector';
import { ThemeSelector } from './components/ThemeSelector';
import { StudentProfileForm } from './components/StudentProfileForm';
import { extractTextFromUploads, ImageQualityError } from './services/textExtractionService';
import { StudentProfile, SubjectKey, EMPTY_STUDENT_PROFILE, isStudentProfileReady } from './studyContext';
import {
  Quiz,
  Language,
  SubjectType,
  QuizOptions,
  QuizType,
  Question,
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
  const [step, setStep] = useState<'upload' | 'profile' | 'options' | 'quiz' | 'results' | 'loading'>('upload');
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
  const [studentProfile, setStudentProfile] = useState<StudentProfile>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('qwitzme-student-profile-v1') || 'null');
      return saved && isStudentProfileReady(saved) ? saved : EMPTY_STUDENT_PROFILE;
    } catch { return EMPTY_STUDENT_PROFILE; }
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'processing' | 'ready' | 'failed'>('idle');
  const extractionRunRef = useRef(0);
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
  useEffect(() => {
    try { localStorage.setItem('qwitzme-student-profile-v1', JSON.stringify(studentProfile)); } catch { /* Storage may be unavailable. */ }
  }, [studentProfile]);
  useEffect(() => {
    if (!profileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [profileOpen]);
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
    const run = ++extractionRunRef.current;
    setStep('profile');
    setExtractionStatus('processing');
    setExtractedText(null);
    setUploadedFiles(selectedFiles);
    setError(null);
    setErrorDetails(null);
    setLanguage(lang);
    setSubjectType(subject);
    setStudySubject(selectedSubject);
    setCustomSubject(otherSubject || '');
    const images = selectedFiles.filter((file) => file.type.startsWith('image/'));
    try {
      const text = await extractTextFromUploads(selectedFiles, lang, subject);
      if (run !== extractionRunRef.current) return;
      if (!text || text.trim().length < 50) throw new Error(t(images.length ? 'errors.lowQualityImage' : 'errors.tooLittleText'));
      if (text.length > 24000) throw new Error(t('errors.tooMuchText'));
      setExtractedText(text ?? '');
      setExtractionStatus('ready');
    } catch (e) {
      if (run !== extractionRunRef.current) return;
      console.error(e);
      setError(e instanceof ImageQualityError ? t('errors.lowQualityImageNumber', {number: e.imageNumber}) : e instanceof Error ? e.message : t('errors.unknownExtraction'));
      setExtractionStatus('failed');
    }
  };
  const handleTextProcessed = (text: string, lang: Language, subject: SubjectType, selectedSubject: SubjectKey, otherSubject?: string) => {
    const clean = text.trim();
    if (clean.length < 50 || clean.length > 24000) { setError(t(clean.length < 50 ? 'errors.tooLittleText' : 'errors.tooMuchText')); return; }
    ++extractionRunRef.current;
    setUploadedFiles([]); setExtractedText(clean); setExtractionStatus('ready'); setLanguage(lang); setSubjectType(subject); setStudySubject(selectedSubject); setCustomSubject(otherSubject || ''); setError(null); setStep('profile');
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
    ++extractionRunRef.current;
    stopProgressSimulation();
    setStep('upload');
    setError(null);
    setErrorDetails(null);
    setExtractedText(null);
    setUploadedFiles([]);
    setStudySubject('');
    setCustomSubject('');
    setExtractionStatus('idle');
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
  const chrome = <><span className="wordmark"><span className="brand-spark" aria-hidden="true">✳</span> QwitzMe<span className="brand-dot">.ai</span></span><div className="header-actions">{accessCode && <button className="icon-button profile-trigger" type="button" title={t('studentFlow.profile')} aria-label={t('studentFlow.profile')} onClick={() => setProfileOpen(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/></svg></button>}<LanguageSelector /><ThemeSelector /></div></>;
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
      case 'profile':
        return <div className="profile-stage"><section className="student-card"><span className="eyebrow">{t('quizOptions.learnerStep')}</span><h2>{t('quizOptions.studentTitle')}</h2><p>{t('quizOptions.studentDescription')}</p><StudentProfileForm profile={studentProfile} onChange={setStudentProfile} idPrefix="learner"/><p className="subject-summary">{t('quizOptions.subjectSummary')}: <strong>{studySubject === 'other' ? customSubject : t(`subjects.${studySubject}`)}</strong></p><p className="profile-storage-note">{t('studentFlow.savedOnDevice')}</p></section>
          <div className={`extraction-state ${extractionStatus === 'failed' ? 'failed' : ''}`} role="status" aria-live="polite">{extractionStatus === 'processing' ? <><span className="small-spinner" aria-hidden="true"/>{t('studentFlow.analyzing')}</> : extractionStatus === 'ready' ? <>✓ {t('studentFlow.ready')}</> : extractionStatus === 'failed' ? <>{error}<button type="button" className="secondary-button" onClick={() => { ++extractionRunRef.current; setStep('upload'); }}>{t('studentFlow.changeMaterial')}</button></> : null}</div>
          <div className="profile-actions"><button type="button" className="primary-button" disabled={!isStudentProfileReady(studentProfile) || extractionStatus !== 'ready'} onClick={() => setStep('options')}>{t('studentFlow.continue')}</button><button type="button" className="secondary-button" onClick={() => { ++extractionRunRef.current; setStep('upload'); }}>{t('quizOptions.back')}</button></div></div>;
      case 'upload':
        return <>{errorMessage}<FileUpload initialFiles={uploadedFiles} initialLanguage={language} initialFocus={subjectType} initialStudySubject={studySubject} initialCustomSubject={customSubject} onMaterialChange={() => setError(null)} onFileProcessed={handleFileProcessed} onTextProcessed={handleTextProcessed} /></>;
      case 'options':
        if (extractedText !== null) {
          return <>{errorMessage}<QuizOptionsComponent
            extractedText={extractedText} 
            initialLanguage={language} 
            initialSubjectType={subjectType}
            studentProfile={studentProfile}
            onEditProfile={() => setProfileOpen(true)}
            studySubject={studySubject as SubjectKey}
            customSubject={customSubject}
            onQuizGenerate={handleQuizGenerate} 
            onBack={() => setStep('profile')}
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
  const stage = step === 'upload' ? 0 : step === 'profile' || step === 'options' || (step === 'loading' && !quiz) ? 1 : step === 'quiz' ? 2 : 3;
  return <div className="app-shell"><header className="site-header">{chrome}</header><main className="workspace">
    <nav className="steps" aria-label={t('app.progressLabel')}>{[t('app.addNotes'), t('app.setUp'), t('app.takeQuiz'), t('app.review')].map((label, index) => <div key={label} className={`step-chip ${stage === index ? 'active' : ''} ${stage > index ? 'complete' : ''}`}><span>{stage > index ? '✓' : index + 1}</span><span>{label}</span></div>)}</nav>
    {step === 'upload' && <div className="upload-intro"><span className="eyebrow">{t('app.eyebrow')}</span><h1>{t('app.workspaceTitle')}</h1><p>{t('app.workspaceCopy')}</p><div className="mode-switch" role="group" aria-label={t('app.modeLabel')}>{(['student','parent'] as const).map(value => <button key={value} type="button" onClick={() => setMode(value)} aria-pressed={mode === value} className={mode === value ? 'selected' : ''}>{value === 'student' ? '✏' : '♥'} &nbsp;{t(`app.${value}Mode`)}</button>)}</div><p className="mode-description">{t(`app.${mode}Description`)}</p></div>}
    <div className="stage-content">{renderContent()}</div>
    {profileOpen && <div className="profile-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setProfileOpen(false); }}><section className="student-card profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title"><button className="profile-close" type="button" onClick={() => setProfileOpen(false)} aria-label={t('studentFlow.close')}>×</button><h2 id="profile-dialog-title">{t('studentFlow.profile')}</h2><p>{t('quizOptions.studentDescription')}</p><StudentProfileForm profile={studentProfile} onChange={setStudentProfile} idPrefix="profile-dialog"/><p className="profile-storage-note">{t('studentFlow.savedOnDevice')}</p><div className="profile-actions"><button className="primary-button" type="button" onClick={() => setProfileOpen(false)}>{t('studentFlow.done')}</button><button className="secondary-button" type="button" onClick={() => setStudentProfile(EMPTY_STUDENT_PROFILE)}>{t('studentFlow.clear')}</button></div></section></div>}
  </main></div>;
};
export default App;
