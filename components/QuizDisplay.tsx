import React, { useEffect, useState } from 'react';
import { Quiz, Question, QuizType, SubjectType } from '../types';
import MathText from './MathText';
import { useI18n } from '../context/i18n';

interface QuizDisplayProps {
  quiz: Quiz;
  userAnswers: Record<number, string>;
  setUserAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onSubmit: () => void;
  subjectType: SubjectType;
}

export const QuizDisplay: React.FC<QuizDisplayProps> = ({ quiz, userAnswers, setUserAnswers, onSubmit, subjectType }) => {
  const { t } = useI18n();
  const [current, setCurrent] = useState(0);

  const isTrueFalseQuestion = (question: Question) => {
    const normalizedType = typeof question.type === 'string' ? question.type.toLowerCase().replace(/[-_\s]/g, '') : '';

    if (
      normalizedType === 'truefalse' ||
      normalizedType === 'boolean' ||
      normalizedType === 'true/false' ||
      normalizedType.includes('truefalse') ||
      normalizedType.includes('boolean')
    ) {
      return true;
    }

    const normalizedOptions = question.options?.map((option) => option.toLowerCase().trim());
    if (normalizedOptions && normalizedOptions.length === 2) {
      const uniqueOptions = new Set(normalizedOptions);
      if (uniqueOptions.has('true') && uniqueOptions.has('false')) {
        return true;
      }
    }

    return false;
  };

  useEffect(() => {
    if (subjectType === SubjectType.Math && window.renderMathInElement) {
      const element = document.getElementById('quiz-display');
      if (element) {
        window.renderMathInElement(element);
      }
    }
  }, [quiz, subjectType]);

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const renderQuestion = (question: Question, index: number) => {
    const userAnswer = userAnswers[index] || '';
    const isTrueFalse = isTrueFalseQuestion(question);
    const trueFalseOptions = ['True', 'False'];

    return (
      <div key={index} className="mb-8 p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-violet-100 dark:border-slate-700">
        <div className="flex items-start">
          <span className="font-bold text-indigo-500 mr-3">{index + 1}.</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200 mb-4">
              {subjectType === SubjectType.Math ? <MathText text={question.question} /> : question.question}
            </p>
            
            {question.type === QuizType.MultipleChoice && question.options && !isTrueFalse && (
              <div className="space-y-3">
                {question.options.map((option, i) => (
                  <label key={i} className="flex items-center p-3 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/20 has-[:checked]:border-indigo-500">
                    <input
                      type="radio"
                      name={`question-${index}`}
                      value={option}
                      checked={userAnswer === option}
                      onChange={() => handleAnswerChange(index, option)}
                      className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-slate-700 dark:text-slate-300">
                      {subjectType === SubjectType.Math ? <MathText text={option} /> : option}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {isTrueFalse && (
              <div className="flex space-x-4">
                {trueFalseOptions.map((option) => (
                  <label key={option} className="flex-1 flex items-center justify-center p-3 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/20 has-[:checked]:border-indigo-500">
                    <input
                      type="radio"
                      name={`question-${index}`}
                      value={option}
                      checked={userAnswer === option}
                      onChange={() => handleAnswerChange(index, option)}
                      className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-slate-700 dark:text-slate-300">{t(`quizDisplay.${option.toLowerCase()}`)}</span>
                  </label>
                ))}
              </div>
            )}
            
            {question.type === QuizType.Open && (
              <textarea
                value={userAnswer}
                onChange={(e) => handleAnswerChange(index, e.target.value)}
                rows={4}
                className="mt-1 block w-full p-3 text-base border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                placeholder={t('quizDisplay.placeholder')}
              />
            )}
          </div>
        </div>
      </div>
    );
  };
  
  const allQuestionsAnswered = Object.keys(userAnswers).length === quiz.questions.length && Object.values(userAnswers).every(ans => typeof ans === 'string' && ans.trim() !== '');

  return (
    <div className="w-full max-w-3xl mx-auto" id="quiz-display">
      <h2 className="text-3xl font-bold text-center mb-2 text-slate-800 dark:text-slate-200">{quiz.title}</h2>
      <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
        {t('quizDisplay.description')}
      </p>

      <div className="question-progress"><span>{t('quizDisplay.questionOf', {current: current + 1, total: quiz.questions.length})}</span><span>{Math.round((current / quiz.questions.length) * 100)}%</span></div><div className="progress-track"><span style={{width: `${((current + 1) / quiz.questions.length) * 100}%`}} /></div>
      <div>{renderQuestion(quiz.questions[current], current)}</div>

      <div className="quiz-navigation"><button type="button" className="secondary-button" onClick={() => { setCurrent(c => Math.max(0,c-1)); window.scrollTo({top:0,behavior:'smooth'}); }} disabled={current === 0}>{t('quizDisplay.previous')}</button>{current < quiz.questions.length - 1 ? <button type="button" className="primary-button" onClick={() => { setCurrent(c => c+1); window.scrollTo({top:0,behavior:'smooth'}); }} disabled={!userAnswers[current]?.trim()}>{t('quizDisplay.next')} →</button> : <button type="button" className="primary-button" onClick={onSubmit} disabled={!allQuestionsAnswered}>{t('app.submit')} →</button>}</div>
      {current === quiz.questions.length - 1 && !allQuestionsAnswered && <p className="answer-hint">{t('quizDisplay.allAnswered')}</p>}
    </div>
  );
};
