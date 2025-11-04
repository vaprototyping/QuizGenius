import React, { useMemo } from 'react';
import { Quiz, Question, QuizType } from '../types';
import { RestartIcon } from './icons/RestartIcon';
import { EditIcon } from './icons/EditIcon';

interface QuizResultsProps {
  quiz: Quiz;
  userAnswers: Record<number, string>;
  onRestart: () => void;
  onTryAgain: () => void;
}

const ResultCard: React.FC<{
  question: Question;
  index: number;
  userAnswer: string | undefined;
  isCorrect: boolean;
}> = ({ question, index, userAnswer, isCorrect }) => {
  const baseClasses = "p-6 rounded-xl border-2";
  const statusClasses = isCorrect
    ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700"
    : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700";

  return (
    <div className={`${baseClasses} ${statusClasses}`}>
      <p className="font-semibold text-lg text-slate-800 dark:text-slate-200">
        <span className="text-slate-500 dark:text-slate-400">Q{index + 1}:</span> {question.question}
      </p>
      <div className="mt-4 text-sm space-y-3">
        {!isCorrect && userAnswer && (
          <p className="text-red-700 dark:text-red-400">
            <span className="font-bold">Your answer:</span> {userAnswer}
          </p>
        )}
        <p className="text-green-700 dark:text-green-400">
          <span className="font-bold">Correct answer:</span> {question.answer}
        </p>
        <div className="pt-2 text-slate-600 dark:text-slate-300">
          <p className="font-bold">Explanation:</p>
          <p>{question.explanation}</p>
        </div>
      </div>
    </div>
  );
};

export const QuizResults: React.FC<QuizResultsProps> = ({ quiz, userAnswers, onRestart, onTryAgain }) => {
  const sanitizedQuestions = React.useMemo(() => {
    return (quiz?.questions || []).filter(
      (q): q is Question =>
        q && typeof q.question === 'string' && typeof q.answer === 'string'
    );
  }, [quiz]);

  const { score, total, percentage, correctAnswers } = useMemo(() => {
    const correctAnswers = sanitizedQuestions.map((q, index) => {
        const userAnswer = userAnswers[index] ? String(userAnswers[index]).trim() : '';
        const correctAnswer = String(q.answer).trim();

        if (q.type === QuizType.TrueFalse) {
            return userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        }
        return userAnswer.toLowerCase() === correctAnswer.toLowerCase();
    });

    const score = correctAnswers.filter(Boolean).length;
    const total = sanitizedQuestions.length;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    
    return { score, total, percentage, correctAnswers };
  }, [sanitizedQuestions, userAnswers]);
  
  const scoreColor = percentage >= 75 ? 'text-green-500' : percentage >= 40 ? 'text-yellow-500' : 'text-red-500';

  const quizTextContent = useMemo(() => {
    let text = `${quiz.title || 'Quiz'}\n\n`;
    sanitizedQuestions.forEach((q, i) => {
      text += `Q${i + 1}: ${q.question}\n`;
      if (q.type === QuizType.MultipleChoice && q.options) {
        q.options.forEach(opt => text += `- ${opt}\n`);
      }
      text += `Answer: ${q.answer}\n`;
      text += `Explanation: ${q.explanation || 'N/A'}\n\n`;
    });
    return text;
  }, [quiz.title, sanitizedQuestions]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(quizTextContent);
  };
  
  const downloadAsText = () => {
    const blob = new Blob([quizTextContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(quiz.title || 'quiz').replace(/\s/g, '_')}_quiz.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full text-center">
      <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Results for "{quiz.title || 'Your Quiz'}"</h2>
      <div className="my-8">
        <p className="text-lg text-slate-600 dark:text-slate-400">You scored</p>
        <p className={`text-7xl font-extrabold ${scoreColor}`}>{percentage}%</p>
        <p className="text-lg text-slate-600 dark:text-slate-400">({score} out of {total} correct)</p>
      </div>

      <div className="text-left space-y-6">
        {sanitizedQuestions.map((q, index) => (
          <ResultCard
            key={index}
            question={q}
            index={index}
            userAnswer={userAnswers[index]}
            isCorrect={correctAnswers[index]}
          />
        ))}
      </div>
      
      <div className="mt-8 flex justify-center gap-2">
        <button onClick={copyToClipboard} className="px-4 py-2 border rounded-md text-sm">Copy Quiz</button>
        <button onClick={downloadAsText} className="px-4 py-2 border rounded-md text-sm">Download (.txt)</button>
      </div>

      <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
        <button
          onClick={onRestart}
          className="w-full sm:w-auto flex items-center justify-center px-6 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <RestartIcon className="w-5 h-5 mr-2" />
          Create New Quiz
        </button>
        <button
          onClick={onTryAgain}
          className="w-full sm:w-auto flex items-center justify-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <EditIcon className="w-5 h-5 mr-2" />
          Generate a Different Quiz
        </button>
      </div>
    </div>
  );
};
