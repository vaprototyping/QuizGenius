import React, { useState } from 'react';
import { Language, QuizType, SubjectType, QuizOptions as QuizOptionsType, MathQuizType, Difficulty, TextQuizOptions, MathQuizOptions } from '../types';
import { SparklesIcon } from './icons/SparklesIcon';
import { useI18n } from '../context/i18n';

interface QuizOptionsProps {
  extractedText: string;
  initialLanguage: Language;
  initialSubjectType: SubjectType;
  onQuizGenerate: (options: QuizOptionsType) => void;
  onBack: () => void;
}

export const QuizOptions: React.FC<QuizOptionsProps> = ({
  extractedText,
  initialLanguage,
  initialSubjectType,
  onQuizGenerate,
  onBack,
}) => {
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);

  // State for Text-based quizzes
  const [quizType, setQuizType] = useState<QuizType>(QuizType.MultipleChoice);

  // State for Math-based quizzes
  const [mathQuizType, setMathQuizType] = useState<MathQuizType>(MathQuizType.SimilarExercises);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Medium);

  const { t } = useI18n();

  const handleSubmit = () => {
    let options: QuizOptionsType;
    if (initialSubjectType === SubjectType.Math) {
      options = {
        subjectType: SubjectType.Math,
        numberOfQuestions,
        mathQuizType,
        difficulty,
        language: initialLanguage,
      } as MathQuizOptions;
    } else {
      options = {
        subjectType: SubjectType.Text,
        numberOfQuestions,
        quizType,
        language: initialLanguage,
      } as TextQuizOptions;
    }
    onQuizGenerate(options);
  };

  const renderTextOptions = () => (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {t('quizOptions.questionType')}
      </label>
      <div className="flex rounded-md shadow-sm">
          {Object.values(QuizType).map((type, idx) => (
              <button
                  key={type}
                  onClick={() => setQuizType(type as QuizType)}
                  className={`px-3 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:z-10 w-full whitespace-nowrap
                  ${quizType === type ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}
                  ${idx === 0 ? 'rounded-l-md' : ''}
                  ${idx === Object.values(QuizType).length -1 ? 'rounded-r-md' : ''}
                  `}
              >
                  {t(`enums.quizType.${type}`)}
              </button>
          ))}
      </div>
    </div>
  );

  const renderMathOptions = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('quizOptions.exerciseStyle')}
        </label>
        <div className="flex rounded-md shadow-sm">
            {Object.values(MathQuizType).map((type, idx) => (
                <button
                    key={type}
                    onClick={() => setMathQuizType(type as MathQuizType)}
                    className={`px-3 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:z-10 w-full whitespace-nowrap
                    ${mathQuizType === type ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}
                    ${idx === 0 ? 'rounded-l-md' : ''}
                    ${idx === Object.values(MathQuizType).length -1 ? 'rounded-r-md' : ''}
                    `}
                >
                    {t(`enums.mathQuizType.${type}`)}
                </button>
            ))}
        </div>
      </div>
       <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('quizOptions.difficulty')}
        </label>
        <div className="flex rounded-md shadow-sm">
            {Object.values(Difficulty).map((level, idx) => (
                <button
                    key={level}
                    onClick={() => setDifficulty(level as Difficulty)}
                    className={`px-3 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:z-10 w-full whitespace-nowrap
                    ${difficulty === level ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}
                    ${idx === 0 ? 'rounded-l-md' : ''}
                    ${idx === Object.values(Difficulty).length -1 ? 'rounded-r-md' : ''}
                    `}
                >
                    {t(`enums.difficulty.${level}`)}
                </button>
            ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-slate-800 dark:text-slate-200">{t('quizOptions.title')}</h2>
      <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
        {t('quizOptions.description')}
      </p>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">{t('quizOptions.preview')}</h3>
        <div className="max-h-40 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{extractedText}</p>
        </div>
      </div>

      <div className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="num-questions" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('quizOptions.numQuestions')}
            </label>
            <input
              type="number"
              id="num-questions"
              value={numberOfQuestions}
              onChange={(e) => setNumberOfQuestions(Math.max(1, parseInt(e.target.value, 10)))}
              min="1"
              max="20"
              className="mt-1 block w-full pl-3 pr-3 py-2 text-base bg-white dark:bg-slate-900 focus:outline-none focus:ring-indigo-500 sm:text-sm rounded-md border-2 border-dashed border-indigo-400 dark:border-indigo-500"
            />
          </div>
          {initialSubjectType === SubjectType.Math ? renderMathOptions() : renderTextOptions()}
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-6 py-3 border border-slate-300 dark:border-slate-600 text-base font-medium rounded-md text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {t('quizOptions.back')}
        </button>
        <button
          onClick={handleSubmit}
          className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <SparklesIcon className="w-5 h-5 mr-2" />
          {t('quizOptions.generate')}
        </button>
      </div>
    </div>
  );
};
