import React, { useState } from 'react';
import { QuizType } from '../types';
import { SparklesIcon } from './icons/SparklesIcon';
import { RestartIcon } from './icons/RestartIcon';

interface QuizOptionsProps {
  extractedText: string;
  onTextChange: (text: string) => void;
  onGenerateQuiz: (type: QuizType, count: number) => void;
  onRestart: () => void;
}

export const QuizOptions: React.FC<QuizOptionsProps> = ({ extractedText, onTextChange, onGenerateQuiz, onRestart }) => {
  const [quizType, setQuizType] = useState<QuizType>(QuizType.MultipleChoice);
  const [questionCount, setQuestionCount] = useState<number>(5);

  const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col w-full">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Review Extracted Text</h2>
        <span className="text-sm text-slate-500">{wordCount} words</span>
      </div>
      <textarea
        value={extractedText}
        onChange={(e) => onTextChange(e.target.value)}
        className="w-full h-48 p-3 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
        placeholder="Extracted text will appear here. You can edit it before generating the quiz."
      />

      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-6 mb-4">Quiz Settings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Question Type</label>
          <div className="mt-2 space-y-2">
            {Object.values(QuizType).map((type) => (
              <label key={type} className="flex items-center">
                <input
                  type="radio"
                  name="quizType"
                  value={type}
                  checked={quizType === type}
                  onChange={() => setQuizType(type)}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-300"
                />
                <span className="ml-3 text-sm text-slate-600 dark:text-slate-400">{type}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="questionCount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Number of Questions
          </label>
          <select
            id="questionCount"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option>3</option>
            <option>5</option>
            <option>10</option>
          </select>
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
         <button
          onClick={onRestart}
          className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <RestartIcon className="w-5 h-5 mr-2" />
          Start Over
        </button>
        <button
          onClick={() => onGenerateQuiz(quizType, questionCount)}
          disabled={!extractedText.trim()}
          className="w-full sm:w-auto flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          <SparklesIcon className="w-5 h-5 mr-2" />
          Generate Quiz
        </button>
      </div>
    </div>
  );
};
