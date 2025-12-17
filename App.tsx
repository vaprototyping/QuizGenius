import React, { useState, useCallback, useRef, FormEvent } from 'react';
import { FileUpload } from './components/FileUpload';
import { QuizOptions as QuizOptionsComponent } from './components/QuizOptions';
import { QuizDisplay } from './components/QuizDisplay';
import { QuizResults } from './components/QuizResults';
import { LanguageSelector } from './components/LanguageSelector';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTextQuizOptions(options: QuizOptions): options is TextQuizOptions {
  return options.subjectType === SubjectType.Text;
}

function getRequestedQuizType(options: QuizOptions): QuizType {
  if (isTextQuizOptions(options)) {
    return options.quizType;
  }

  return QuizType.Open;
}

function normalizeQuizType(input: unknown, fallbackType: QuizType): QuizType {
  if (typeof input !== 'string') {
    return fallbackType;
  }

  const normalized = input.toLowerCase();
  if (normalized.includes('true') || normalized.includes('false')) {
    return QuizType.TrueFalse;
  }

  if (normalized.includes('open') || normalized.includes('short')) {
    return QuizType.Open;
  }

  if (fallbackType === QuizType.TrueFalse) {
    return QuizType.TrueFalse;
  }

  if (fallbackType === QuizType.Open) {
    return QuizType.Open;
  }

  return QuizType.MultipleChoice;
}

function extractJsonFromContent(raw: string): string | null {
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  const jsonStart = raw.trim().match(/^[\[{].*[\]}]$/s);
  if (jsonStart) {
    return raw.trim();
  }

  return null;
}

function normalizeAnswer(
  rawAnswer: unknown,
  type: QuizType,
  options?: string[]
): string {
  if (Array.isArray(rawAnswer) && rawAnswer.length > 0) {
    return normalizeAnswer(rawAnswer[0], type, options);
  }

  if (typeof rawAnswer === 'number' && options && options[rawAnswer]) {
    return options[rawAnswer];
  }

  if (typeof rawAnswer === 'string') {
    const trimmed = rawAnswer.trim();

    if (!trimmed) {
      if (options && options.length > 0) {
        return options[0];
      }

      if (type === QuizType.Open) {
        return 'Answers may vary.';
      }

      return '';
    }

    if (type === QuizType.MultipleChoice && options) {
      const letterMatch = trimmed.match(/^[A-Z]$/i);
      if (letterMatch) {
        const index = letterMatch[0].toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
        if (options[index]) {
          return options[index];
        }
      }
    }

    if (type === QuizType.TrueFalse) {
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('t')) {
        return 'True';
      }
      if (lower.startsWith('f')) {
        return 'False';
      }
    }

    return trimmed;
  }

  if (isRecord(rawAnswer) && 'text' in rawAnswer && typeof rawAnswer.text === 'string') {
    return rawAnswer.text.trim();
  }

  if (options && options.length > 0) {
    return options[0];
  }

  if (type === QuizType.Open) {
    return 'Answers may vary.';
  }

  return '';
}

function normalizeOptions(rawOptions: unknown): string[] {
  if (Array.isArray(rawOptions)) {
    return rawOptions.map((option) => String(option).trim()).filter(Boolean);
  }

  if (isRecord(rawOptions)) {
    return Object.values(rawOptions).map((option) => String(option).trim()).filter(Boolean);
  }

  return [];
}

function mapJsonQuestionToQuestion(
  rawQuestion: unknown,
  fallbackType: QuizType
): Question | null {
  if (!isRecord(rawQuestion)) {
    return null;
  }

  const prompt =
    typeof rawQuestion.question === 'string'
      ? rawQuestion.question
      : typeof rawQuestion.prompt === 'string'
        ? rawQuestion.prompt
        : typeof rawQuestion.stem === 'string'
          ? rawQuestion.stem
          : typeof rawQuestion.text === 'string'
            ? rawQuestion.text
            : '';

  const questionText = prompt.trim();
  if (!questionText) {
    return null;
  }

  const type = normalizeQuizType(rawQuestion.type ?? rawQuestion.questionType ?? rawQuestion.format, fallbackType);
  const options = type === QuizType.MultipleChoice ? normalizeOptions(rawQuestion.options ?? rawQuestion.choices ?? rawQuestion.answers ?? rawQuestion.optionsList) : undefined;
  const answer = normalizeAnswer(rawQuestion.answer ?? rawQuestion.correctAnswer ?? rawQuestion.correct ?? rawQuestion.solution ?? rawQuestion.key, type, options);
  const explanationRaw = rawQuestion.explanation ?? rawQuestion.rationale ?? rawQuestion.reason ?? rawQuestion.feedback;
  const explanation = typeof explanationRaw === 'string' ? explanationRaw.trim() : '';

  if (type === QuizType.MultipleChoice && (!options || options.length === 0)) {
    return null;
  }

  if (type === QuizType.TrueFalse && (!answer || (answer !== 'True' && answer !== 'False'))) {
    return {
      question: questionText,
      options: ['True', 'False'],
      answer: 'True',
      explanation: explanation || 'No explanation provided.',
      type: QuizType.TrueFalse,
    };
  }

  return {
    question: questionText,
    options,
    answer: answer || (type === QuizType.Open ? 'Answers may vary.' : ''),
    explanation: explanation || 'No explanation provided.',
    type,
  };
}

function tryParseJsonQuiz(raw: string, options: QuizOptions): Quiz | null {
  const fallbackType = getRequestedQuizType(options);
  const jsonString = extractJsonFromContent(raw);
  if (!jsonString) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonString);
    let title = 'Generated Quiz';
    let rawQuestions: unknown[] = [];

    if (isRecord(parsed)) {
      const candidatePayload = isRecord(parsed.quiz) ? parsed.quiz : parsed;

      if (isRecord(candidatePayload)) {
        if (typeof candidatePayload.title === 'string' && candidatePayload.title.trim().length > 0) {
          title = candidatePayload.title.trim();
        }

        if (Array.isArray(candidatePayload.questions)) {
          rawQuestions = candidatePayload.questions;
        } else if (Array.isArray(candidatePayload.items)) {
          rawQuestions = candidatePayload.items;
        }
      }

      if (Array.isArray(parsed.quiz)) {
        rawQuestions = parsed.quiz;
      } else if (isRecord(parsed.data)) {
        const dataPayload = parsed.data;
        if (isRecord(dataPayload.quiz) && Array.isArray(dataPayload.quiz.questions)) {
          rawQuestions = dataPayload.quiz.questions;
        } else if (Array.isArray(dataPayload.questions)) {
          rawQuestions = dataPayload.questions;
        }
      } else if (Array.isArray(parsed.data)) {
        rawQuestions = parsed.data;
      }
    } else if (Array.isArray(parsed)) {
      rawQuestions = parsed;
    }

    const questions = rawQuestions
      .map((item) => mapJsonQuestionToQuestion(item, fallbackType))
      .filter((item): item is Question => Boolean(item));

    if (questions.length === 0) {
      return null;
    }

    return {
      title,
      questions,
    };
  } catch (error) {
    console.warn('Failed to parse quiz JSON', error);
    return null;
  }
}

function fallbackParseToQuiz(raw: string, options: QuizOptions): Quiz {
  const fallbackType = getRequestedQuizType(options);
  const jsonQuiz = tryParseJsonQuiz(raw, options);
  if (jsonQuiz) {
    return jsonQuiz;
  }

  const blocks = raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const questions: Question[] = [];

  blocks.forEach((block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      return;
    }

    const firstLine = lines[0].replace(/^(?:Q\s*\d+[:.)-]|\d+[:.)-])\s*/i, '').trim();
    if (!firstLine) {
      return;
    }

    let answer = '';
    let explanation = '';
    const optionsList: string[] = [];

    for (const line of lines.slice(1)) {
      const optionMatch = line.match(/^(?:[A-Z]|\d+)[.)-]\s*(.+)$/);
      const answerMatch = line.match(/^(?:Correct\s+)?Answer[:.)-]\s*(.+)$/i);
      const explanationMatch = line.match(/^(?:Explanation|Rationale)[:.)-]\s*(.+)$/i);

      if (optionMatch) {
        optionsList.push(optionMatch[1].trim());
      } else if (answerMatch) {
        answer = answerMatch[1].trim();
      } else if (explanationMatch) {
        explanation = explanationMatch[1].trim();
      }
    }

    let questionType = fallbackType;
    if (fallbackType === QuizType.TrueFalse) {
      answer = normalizeAnswer(answer, QuizType.TrueFalse);
    } else if (fallbackType === QuizType.MultipleChoice) {
      const normalizedAnswer = normalizeAnswer(answer, QuizType.MultipleChoice, optionsList);
      answer = normalizedAnswer;
    } else if (!answer) {
      answer = 'Answers may vary.';
    }

    if (fallbackType === QuizType.TrueFalse && optionsList.length === 0) {
      optionsList.push('True', 'False');
    }

    if (fallbackType === QuizType.MultipleChoice && optionsList.length === 0) {
      questionType = QuizType.Open;
      answer = answer || 'Answers may vary.';
    }

    questions.push({
      question: firstLine,
      options: questionType === QuizType.MultipleChoice ? optionsList : undefined,
      answer,
      explanation: explanation || 'No explanation provided.',
      type: questionType,
    });
  });

  if (questions.length === 0) {
    throw new Error('Unable to parse quiz content into questions.');
  }

  return {
    title: 'Generated Quiz',
    questions,
  };
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
  const [isSecurityVerified, setIsSecurityVerified] = useState(false);
  const [securityCodeInput, setSecurityCodeInput] = useState('');
  const [securityError, setSecurityError] = useState<string | null>(null);
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
      const llmContent = await generateQuizAPI(extractedText, typeForAPI, countForAPI, locale);

      const quizData: Quiz = fallbackParseToQuiz(llmContent, options);

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
  const handleSecuritySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedCode = securityCodeInput.trim();

    if (trimmedCode === '16071982') {
      setIsSecurityVerified(true);
      setSecurityError(null);
      setSecurityCodeInput('');
      return;
    }

    setSecurityError('Incorrect access code. Please try again.');
  };
  if (!isSecurityVerified) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 shadow-xl rounded-xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Restricted Access</h1>
            <p className="text-slate-600 dark:text-slate-300">
              Enter the provided access code to continue to QwitzMe.ai.
            </p>
          </div>
          <form onSubmit={handleSecuritySubmit} className="space-y-4">
            <div>
              <label htmlFor="security-code" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Access Code
              </label>
              <input
                id="security-code"
                type="password"
                value={securityCodeInput}
                onChange={(event) => setSecurityCodeInput(event.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Enter access code"
                autoFocus
              />
            </div>
            {securityError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {securityError}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white font-semibold shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }
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
          return `Processing image ${currentItem} of ${processingDetails.totalItems}…`;
        }

        if (processingDetails.type === 'pdf') {
          const currentPage = spinnerProgressIndex(progress, processingDetails.totalPages);
          return `Processing page ${currentPage} of ${processingDetails.totalPages}…`;
        }

        if (processingDetails.type === 'docx') {
          return 'Processing document…';
        }

        return 'Assembling your quiz…';
      })();
      const supportingText = processingDetails?.type === 'quiz' ? 'This might take a minute.' : null;
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
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-900 dark:text-slate-100 font-sans relative">
      <header className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </header>
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-3">
            <img src={LogoImage} alt="QwitzMe.ai logo" className="w-10 h-10" />
            QwitzMe.ai
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t('app.description')}
          </p>
          {step === 'upload' && extractedText === null && (
            <div className="mt-10 text-center">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 text-center">How it works</h2>
              <div className="mt-5 max-w-2xl mx-auto">
                <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 shadow-sm">
                  <div className="flex flex-col items-center divide-y divide-slate-200/80 dark:divide-slate-700">
                    {[{
                      text: 'Upload your files',
                      image: UploadStepImage,
                      alt: 'Upload step icon'
                    }, {
                      text: 'AI extracts the text',
                      image: ExtractStepImage,
                      alt: 'Text extraction icon'
                    }, {
                      text: 'A quiz is generated',
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
