import React, { useMemo, useEffect } from 'react';
import { Quiz, Question, SubjectType } from '../types';
import { RestartIcon } from './icons/RestartIcon';
import { EditIcon } from './icons/EditIcon';
import MathText from './MathText';

interface QuizResultsProps {
  quiz: Quiz;
  userAnswers: Record<number, string>;
  onRestart: () => void;
  onTryAgain: () => void;
  subjectType: SubjectType;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-red-500';
};

/**
 * A robust function to check if the user's answer is correct.
 * It handles plain text and math answers by stripping LaTeX delimiters before comparison.
 */
const isAnswerCorrect = (userAnswer: string | undefined, correctAnswer: string, subjectType: SubjectType): boolean => {
    if (userAnswer === undefined) {
        return false;
    }

    const userAnswerClean = userAnswer.trim();
    let correctAnswerClean = correctAnswer.trim();

    // For math, strip delimiters like '$...$' for a fair comparison
    if (subjectType === SubjectType.Math) {
        if (correctAnswerClean.startsWith('$') && correctAnswerClean.endsWith('$')) {
            correctAnswerClean = correctAnswerClean.substring(1, correctAnswerClean.length - 1).trim();
        }
    }
    
    // Final comparison is case-insensitive
    return userAnswerClean.toLowerCase() === correctAnswerClean.toLowerCase();
};


export const QuizResults: React.FC<QuizResultsProps> = ({ quiz, userAnswers, onRestart, onTryAgain, subjectType }) => {

  useEffect(() => {
    // When the component mounts, try to render any math equations in the content.
    if (subjectType === SubjectType.Math && window.renderMathInElement) {
      const element = document.getElementById('quiz-results');
      if (element) {
        window.renderMathInElement(element);
      }
    }
  }, [quiz, subjectType]);

  const { score, correctAnswers } = useMemo(() => {
    let correct = 0;
    quiz.questions.forEach((q, index) => {
        if (isAnswerCorrect(userAnswers[index], q.answer, subjectType)) {
            correct++;
        }
    });
    const scorePercentage = quiz.questions.length > 0 ? (correct / quiz.questions.length) * 100 : 0;
    return { score: Math.round(scorePercentage), correctAnswers: correct };
  }, [quiz, userAnswers, subjectType]);

  const renderResult = (question: Question, index: number) => {
    const userAnswer = userAnswers[index] || 'No Answer';
    const isCorrect = isAnswerCorrect(userAnswer, question.answer, subjectType);
    
    const resultColor = isCorrect ? 'border-green-500 dark:border-green-400' : 'border-red-500 dark:border-red-400';
    const resultBg = isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20';
    
    return (
      <div key={index} className={`mb-6 p-5 rounded-xl border-l-4 ${resultColor} ${resultBg}`}>
        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-3">
          <span className="font-bold mr-2">{index + 1}.</span>
          {subjectType === SubjectType.Math ? <MathText text={question.question} /> : question.question}
        </p>
        
        <div className="text-sm space-y-3 pl-6">
            <div className={`p-3 rounded-md ${isCorrect ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <p className="font-medium text-slate-600 dark:text-slate-400">Your Answer:</p>
                <p className="text-slate-800 dark:text-slate-200">
                    {subjectType === SubjectType.Math ? <MathText text={userAnswer} /> : userAnswer}
                </p>
            </div>
            {!isCorrect && (
                <div className="p-3 rounded-md bg-green-100 dark:bg-green-900/30">
                    <p className="font-medium text-slate-600 dark:text-slate-400">Correct Answer:</p>
                    <p className="text-slate-800 dark:text-slate-200">
                      {subjectType === SubjectType.Math ? <MathText text={question.answer} /> : question.answer}
                    </p>
                </div>
            )}
            <div className="pt-2">
                <p className="font-medium text-slate-600 dark:text-slate-400">Explanation:</p>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                   {subjectType === SubjectType.Math ? <MathText text={question.explanation} /> : question.explanation}
                </p>
            </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="w-full max-w-3xl mx-auto" id="quiz-results">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Quiz Results</h2>
        <div className="mt-4">
            <p className="text-lg text-slate-600 dark:text-slate-400">You scored</p>
            <p className={`text-6xl font-extrabold ${getScoreColor(score)}`}>{score}%</p>
            <p className="text-lg text-slate-600 dark:text-slate-400">({correctAnswers} out of {quiz.questions.length} correct)</p>
        </div>
      </div>

      <div>
        {quiz.questions.map(renderResult)}
      </div>

      <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
        <button
          onClick={onTryAgain}
          className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-slate-300 dark:border-slate-600 text-base font-medium rounded-md text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <EditIcon className="w-5 h-5 mr-2" />
          Generate New Quiz
        </button>
        <button
          onClick={onRestart}
          className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <RestartIcon className="w-5 h-5 mr-2" />
          Start Over
        </button>
      </div>
    </div>
  );
};