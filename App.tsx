import React, { useState, useCallback, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { QuizOptions as QuizOptionsComponent } from './components/QuizOptions';
import { QuizDisplay } from './components/QuizDisplay';
import { QuizResults } from './components/QuizResults';
import { ProgressBar } from './components/ProgressBar';
import { LanguageSelector } from './components/LanguageSelector';
import { extractTextFromImage } from './services/geminiService';
import { Quiz, Language, SubjectType, QuizOptions } from './types';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { useI18n } from './context/i18n';
import { generateQuiz as generateQuizAPI } from './lib/api';

const App: React.FC = () => {
  const [step, setStep] = useState<'upload' | 'options' | 'quiz' | 'results' | 'loading'>('upload');
  const [error, setError] = useState<string | null>(null);
  
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [currentQuizOptions, setCurrentQuizOptions] = useState<QuizOptions | null>(null);
  
  const [language, setLanguage] = useState<Language>(Language.English);
  const [subjectType, setSubjectType] = useState<SubjectType>(SubjectType.Text);

  const { t } = useI18n();

  // State for progress bar
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState(t('loading.thinking'));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleFileProcessed = async (base64Data: string, mimeType: string, lang: Language, subject: SubjectType) => {
    setStep('loading');
    setError(null);
    setLanguage(lang);
    setSubjectType(subject);
    startProgressSimulation([t('loading.analyzing'), t('loading.extracting'), t('loading.finalizing')], 5);
    try {
      const text = await extractTextFromImage(base64Data, mimeType, lang, subject);
      stopProgressSimulation();
      setProgress(100);
      setLoadingMessage(t('loading.extractionComplete'));
      setExtractedText(text ?? '');
      setTimeout(() => setStep('options'), 500);
    } catch (e) {
      stopProgressSimulation();
      console.error(e);
      setError(e instanceof Error ? e.message : t('errors.unknownExtraction'));
      setStep('upload');
    }
  };

  const handleQuizGenerate = async (options: QuizOptions) => {
    if (!extractedText) return;
    setStep('loading');
    setError(null);
    setCurrentQuizOptions(options);
    startProgressSimulation([
        t('loading.understanding'),
        t('loading.crafting'),
        t('loading.developing'),
        t('loading.assembling')
    ], 10);
    try {
      const quizData = await generateQuiz(extractedText, options);
      stopProgressSimulation();
      setProgress(100);
      setLoadingMessage(t('loading.quizGenerated'));
      setQuiz(quizData);
      setUserAnswers({}); // Reset answers for new quiz
      setTimeout(() => setStep('quiz'), 500);
    } catch (e) {
      stopProgressSimulation();
      console.error(e);
      setError(e instanceof Error ? e.message : t('errors.unknownQuizGeneration'));
      setStep('options'); // Go back to options on error
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
  };
  
  const handleGenerateNewQuiz = () => {
      stopProgressSimulation();
      setStep('options');
      setQuiz(null);
      setUserAnswers({});
  }

  const renderContent = () => {
    if (step === 'loading') {
      return (
        <div className="w-full max-w-lg mx-auto">
            <div className="flex justify-between mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <span>{loadingMessage}</span>
                <span>{`${Math.round(progress)}%`}</span>
            </div>
            <ProgressBar progress={progress} />
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
        // Fallback, should not happen, reset state
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
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-900 dark:text-slate-100 font-sans relative">
      <header className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </header>
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-3">
            <SparklesIcon className="w-8 h-8 text-indigo-500" />
            QwitzMe.ai
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t('app.description')}
          </p>
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
