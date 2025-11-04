import React, { useState, useCallback } from 'react';
import { QuizType, Language, Quiz } from './types';
import { FileUpload } from './components/FileUpload';
import { QuizOptions } from './components/QuizOptions';
import { QuizDisplay } from './components/QuizDisplay';
import { QuizResults } from './components/QuizResults';
import { Spinner } from './components/Spinner';
import { extractTextFromImage, generateQuiz } from './services/geminiService';

type AppStep = 'upload' | 'edit' | 'quiz' | 'results';

export default function App() {
  const [step, setStep] = useState<AppStep>('upload');
  const [extractedText, setExtractedText] = useState<string>('');
  const [quizData, setQuizData] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>('');
  
  const handleFileProcessed = useCallback(async (base64Data: string, mimeType: string, language: Language) => {
    setIsLoading(true);
    setError(null);
    try {
      const text = await extractTextFromImage(base64Data, mimeType, language);
      setExtractedText(text);
      setStep('edit');
    } catch (e) {
      console.error(e);
      setError('Failed to extract text from the file. Please try another file.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleQuizGeneration = useCallback(async (type: QuizType, count: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const generatedQuiz = await generateQuiz(extractedText, type, count);
      setQuizData(generatedQuiz);
      setQuizTitle(generatedQuiz.title);
      setUserAnswers({});
      setStep('quiz');
    } catch (e) {
      console.error(e);
      setError('Failed to generate quiz. The content might be too short or the AI service is currently unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, [extractedText]);

  const handleAnswersSubmit = useCallback(() => {
    setStep('results');
  }, []);
  
  const handleRestart = useCallback(() => {
    setStep('upload');
    setExtractedText('');
    setQuizData(null);
    setUserAnswers({});
    setError(null);
    setQuizTitle('');
  }, []);

  const handleBackToEdit = useCallback(() => {
    setStep('edit');
    setQuizData(null);
  }, []);

  const renderStep = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-8">
          <Spinner />
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            {step === 'upload' ? 'Analyzing your document...' : 'Generating your quiz...'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">This might take a moment.</p>
        </div>
      );
    }

    switch (step) {
      case 'upload':
        return <FileUpload onFileProcessed={handleFileProcessed} />;
      case 'edit':
        return (
          <QuizOptions
            extractedText={extractedText}
            onTextChange={setExtractedText}
            onGenerateQuiz={handleQuizGeneration}
            onRestart={handleRestart}
          />
        );
      case 'quiz':
        return quizData ? (
          <QuizDisplay
            quiz={quizData}
            userAnswers={userAnswers}
            setUserAnswers={setUserAnswers}
            onSubmit={handleAnswersSubmit}
          />
        ) : null;
      case 'results':
        return quizData ? (
          <QuizResults
            quiz={quizData}
            userAnswers={userAnswers}
            onRestart={handleRestart}
            onTryAgain={handleBackToEdit}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen w-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
       <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-600">
            Quiz Genius
          </h1>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
            Create quizzes from your schoolbook in seconds.
          </p>
        </header>
        
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-500">
           <div className="p-6 sm:p-8 lg:p-10">
            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
                <p className="font-bold">An Error Occurred</p>
                <p>{error}</p>
              </div>
            )}
            {renderStep()}
          </div>
        </div>
        <footer className="text-center mt-8 text-slate-500 dark:text-slate-400 text-sm">
            <p>Powered by React, Tailwind CSS, and Gemini API.</p>
        </footer>
       </div>
    </main>
  );
}
