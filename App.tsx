import React, { useState, useCallback, useRef, FormEvent } from 'react';
import { FileUpload } from './components/FileUpload';
import { QuizOptions as QuizOptionsComponent } from './components/QuizOptions';
import { QuizDisplay } from './components/QuizDisplay';
import { QuizResults } from './components/QuizResults';
import { LanguageSelector } from './components/LanguageSelector';
import { ThemeSelector } from './components/ThemeSelector';
import { extractTextFromUploads, isDocxMime } from './services/textExtractionService';
import {
  Quiz,
  Language,
  SubjectType,
  QuizOptions,
  QuizType,
  Question,
  TextQuizOptions
} from './types';
import LogoImage from './components/icons/logo.png';
import UploadStepImage from './components/icons/upload-step.png';
import ExtractStepImage from './components/icons/extract-step.png';
import QuizStepImage from './components/icons/quiz-step.png';
import { useI18n } from './context/i18n';
import { generateQuiz as generateQuizAPI } from './src/lib/api';

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
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [currentQuizOptions, setCurrentQuizOptions] = useState<QuizOptions | null>(null);
  const [language, setLanguage] = useState<Language>(Language.English);
  const [subjectType, setSubjectType] = useState<SubjectType>(SubjectType.Text);
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
  const handleFileProcessed = async (selectedFiles: File[], lang: Language, subject: SubjectType) => {
    setStep('loading');
    setError(null);
    setLanguage(lang);
    setSubjectType(subject);
    const images = selectedFiles.filter((file) => file.type.startsWith('image/'));
    const pdfFile = selectedFiles.find((file) => file.type === 'application/pdf');
    const docxFile = selectedFiles.find((file) => isDocxMime(file.type));
    if (images.length > 0) {
      setProcessingDetails({ type: 'images', totalItems: images.length });
    } else if (pdfFile) {
      const pageCount = await getPdfPageCount(pdfFile);
      setProcessingDetails({ type: 'pdf', totalPages: Math.max(1, pageCount) });
    } else if (docxFile) {
      setProcessingDetails({ type: 'docx' });
    }
    const duration = Math.min(15, Math.max(6, selectedFiles.length * 3));
    startProgressSimulation([t('loading.analyzing'), t('loading.extracting'), t('loading.finalizing')], duration);
    try {
      const text = await extractTextFromUploads(selectedFiles, lang, subject);
      if (!text || text.trim().length < 50) throw new Error(t('errors.tooLittleText'));
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
      setError(e instanceof Error ? e.message : t('errors.unknownExtraction'));
      setProcessingDetails(null);
      setStep('upload');
    }
  };
  const handleQuizGenerate = async (options: QuizOptions) => {
    if (!extractedText) return;
    setStep('loading');
    setError(null);
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
      setError(e instanceof Error ? e.message : t('errors.unknownQuizGeneration'));
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
    setExtractedText(null);
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
  if (!accessCode) return <main className="min-h-screen grid place-items-center bg-amber-50 px-4 dark:bg-slate-950">
    <form onSubmit={verifyAccess}
      className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl dark:bg-slate-800">
      <h1 className="text-3xl font-bold mb-3">QwitzMe.ai</h1>
      <p className="mb-6 text-slate-600 dark:text-slate-300">{t('app.accessPrompt')}</p>
      <label htmlFor="access-code" className="block font-medium mb-2">{t('app.accessLabel')}</label>
      <input id="access-code" type="password" autoComplete="off" value={accessInput}
        onChange={event => { setAccessInput(event.target.value); setAccessError(''); }}
        className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 dark:bg-slate-900 dark:text-white" />
      {accessError && <p role="alert" className="mt-2 text-red-600">{accessError}</p>}
      <button disabled={checkingAccess} className="mt-5 w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50" type="submit">{t('app.continue')}</button>
    </form>
  </main>;
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
    if (error) {
        return (
            <div className="text-center max-w-xl mx-auto">
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">{t('app.errorTitle')}</h2>
                <p className="mt-2 text-slate-600 dark:text-slate-300 bg-red-50 dark:bg-red-900/20 p-4 rounded-md">{error}</p>
                <button
                    onClick={handleRestart}
                    className="mt-6 px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                    {t('app.startOver')}
                </button>
            </div>
        )
    }
    switch (step) {
      case 'upload':
        return <FileUpload onFileProcessed={handleFileProcessed} />;
      case 'options':
        if (extractedText !== null) {
          return <QuizOptionsComponent 
            extractedText={extractedText} 
            initialLanguage={language} 
            initialSubjectType={subjectType}
            onQuizGenerate={handleQuizGenerate} 
            onBack={handleRestart}
          />;
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
        return <FileUpload onFileProcessed={handleFileProcessed} />;
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-slate-900 dark:text-slate-100 font-sans relative">
      <header className="flex justify-end gap-3 px-4 pt-5 max-w-5xl mx-auto">
        <ThemeSelector />
        <LanguageSelector />
      </header>
      <main className="container mx-auto px-4 py-10">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-violet-800 dark:text-violet-200 flex items-center justify-center gap-3 tracking-tight">
            <img src={LogoImage} alt="QwitzMe.ai logo" className="w-10 h-10" />
            QwitzMe.ai
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t('app.description')}
          </p>
          {step === 'upload' && <div className="mt-8 flex justify-center gap-3" role="group" aria-label={t('app.modeLabel')}>
            {(['student', 'parent'] as const).map(value => <button key={value} type="button" onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={`rounded-full px-6 py-3 font-semibold transition-colors ${mode === value ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200'}`}>
              {t(`app.${value}Mode`)}
            </button>)}
          </div>}
          {step === 'upload' && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t(`app.${mode}Description`)}</p>}
          {step === 'upload' && extractedText === null && (
            <div className="mt-10 text-center">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 text-center">{t('app.howItWorks')}</h2>
              <div className="mt-5 max-w-2xl mx-auto">
                <div className="p-4 sm:p-5 rounded-3xl border border-white/80 dark:border-slate-700 bg-white/85 dark:bg-slate-800/60 shadow-lg shadow-violet-100/60 dark:shadow-none">
                  <div className="flex flex-col items-center divide-y divide-slate-200/80 dark:divide-slate-700">
                    {[{
                      text: t('app.uploadStep'),
                      image: UploadStepImage,
                      alt: 'Upload step icon'
                    }, {
                      text: t('app.extractStep'),
                      image: ExtractStepImage,
                      alt: 'Text extraction icon'
                    }, {
                      text: t('app.quizStep'),
                      image: QuizStepImage,
                      alt: 'Quiz generation icon'
                    }].map((stepItem, index, array) => (
                      <div
                        key={stepItem.text}
                        className={`flex items-center justify-center gap-3 sm:gap-4 ${index > 0 ? 'pt-3 sm:pt-4' : ''} ${index < array.length - 1 ? 'pb-3 sm:pb-4' : ''}`}
                      >
                        <img
                          src={stepItem.image}
                          alt={stepItem.alt}
                          className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0"
                        />
                        <p className="text-sm sm:text-base font-medium text-slate-800 dark:text-slate-100 text-center">
                          {stepItem.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="max-w-4xl mx-auto flex justify-center">
          {renderContent()}
        </div>
      </main>
      <footer className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
        <p>{t('app.poweredBy')}</p>
      </footer>
    </div>
  );
};

export default App;
