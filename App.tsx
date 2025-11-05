import React, { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { QuizOptions as QuizOptionsComponent } from './components/QuizOptions';
import { QuizDisplay } from './components/QuizDisplay';
import { QuizResults } from './components/QuizResults';
import { Spinner } from './components/Spinner';
import { extractTextFromImage, generateQuiz } from './services/geminiService';
import { Quiz, Language, SubjectType, QuizOptions } from './types';
import { SparklesIcon } from './components/icons/SparklesIcon';

const App: React.FC = () => {
  const [step, setStep] = useState<'upload' | 'options' | 'quiz' | 'results' | 'loading'>('upload');
  const [error, setError] = useState<string | null>(null);
  
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [currentQuizOptions, setCurrentQuizOptions] = useState<QuizOptions | null>(null);
  
  const [language, setLanguage] = useState<Language>(Language.English);
  const [subjectType, setSubjectType] = useState<SubjectType>(SubjectType.Text);

  const handleFileProcessed = async (base64Data: string, mimeType: string, lang: Language, subject: SubjectType) => {
    setStep('loading');
    setError(null);
    setLanguage(lang);
    setSubjectType(subject);
    try {
      const text = await extractTextFromImage(base64Data, mimeType, lang, subject);
      setExtractedText(text ?? '');
      setStep('options');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred during text extraction.');
      setStep('upload');
    }
  };

  const handleQuizGenerate = async (options: QuizOptions) => {
    if (!extractedText) return;
    setStep('loading');
    setError(null);
    setCurrentQuizOptions(options);
    try {
      const quizData = await generateQuiz(extractedText, options);
      setQuiz(quizData);
      setUserAnswers({}); // Reset answers for new quiz
      setStep('quiz');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred during quiz generation.');
      setStep('options'); // Go back to options on error
    }
  };

  const handleSubmitQuiz = (answers: Record<number, string>) => {
    setUserAnswers(answers);
    setStep('results');
  };

  const handleRestart = () => {
    setStep('upload');
    setError(null);
    setExtractedText(null);
    setQuiz(null);
    setUserAnswers({});
    setCurrentQuizOptions(null);
  };
  
  const handleTryAgain = () => {
      if (extractedText && currentQuizOptions) {
          handleQuizGenerate(currentQuizOptions);
      } else {
          // Fallback if something is wrong with the state
          handleRestart();
      }
  }

  const renderContent = () => {
    if (step === 'loading') {
      return (
        <div className="text-center">
          <Spinner />
          <p className="mt-4 text-slate-500 dark:text-slate-400">AI is thinking...</p>
        </div>
      );
    }

    if (error) {
        return (
            <div className="text-center max-w-xl mx-auto">
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">An Error Occurred</h2>
                <p className="mt-2 text-slate-600 dark:text-slate-300 bg-red-50 dark:bg-red-900/20 p-4 rounded-md">{error}</p>
                <button
                    onClick={handleRestart}
                    className="mt-6 px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                    Start Over
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
        return <p>Something went wrong.</p>;
      case 'results':
        if (quiz) {
          return <QuizResults 
            quiz={quiz} 
            userAnswers={userAnswers} 
            onRestart={handleRestart}
            onTryAgain={handleTryAgain}
            subjectType={subjectType}
          />;
        }
        return <p>Something went wrong.</p>;
      default:
        return <FileUpload onFileProcessed={handleFileProcessed} />;
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-900 dark:text-slate-100 font-sans">
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-3">
            <SparklesIcon className="w-8 h-8 text-indigo-500" />
            Quiz Wiz
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Instantly generate quizzes from your documents or images using AI.
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto flex justify-center">
          {renderContent()}
        </div>
      </main>
      <footer className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
        <p>Powered by Google Gemini</p>
      </footer>
    </div>
  );
};

export default App;