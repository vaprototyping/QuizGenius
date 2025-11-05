import React from 'react';
import { Quiz, Question, QuizType, SubjectType } from '../types';
import { MathText } from './MathText';

interface QuizDisplayProps {
  quiz: Quiz;
  userAnswers: Record<number, string>;
  setUserAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onSubmit: () => void;
  subjectType: SubjectType;
}

const QuestionCard: React.FC<{
  question: Question;
  index: number;
  userAnswer: string | undefined;
  onAnswerChange: (questionIndex: number, answer: string) => void;
  subjectType: SubjectType;
}> = ({ question, index, userAnswer, onAnswerChange, subjectType }) => {

  const renderContent = (content: string) => {
    return subjectType === SubjectType.Math ? <MathText text={content} /> : <span>{content}</span>;
  };

  const renderAnswerOptions = () => {
    switch (question.type) {
      case QuizType.MultipleChoice:
        return (
          <div className="space-y-3">
            {question.options?.map((option, optIndex) => (
              <label key={optIndex} className="flex items-center p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/50 has-[:checked]:border-indigo-300 dark:has-[:checked]:border-indigo-600">
                <input
                  type="radio"
                  name={`question-${index}`}
                  value={option}
                  checked={userAnswer === option}
                  onChange={(e) => onAnswerChange(index, e.target.value)}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-300 dark:border-slate-600"
                />
                <span className="ml-3 text-slate-700 dark:text-slate-300">{renderContent(option)}</span>
              </label>
            ))}
          </div>
        );
      case QuizType.TrueFalse:
        return (
          <div className="space-y-3">
            {['True', 'False'].map((option) => (
              <label key={option} className="flex items-center p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/50 has-[:checked]:border-indigo-300 dark:has-[:checked]:border-indigo-600">
                <input
                  type="radio"
                  name={`question-${index}`}
                  value={option}
                  checked={userAnswer === option}
                  onChange={(e) => onAnswerChange(index, e.target.value)}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-300 dark:border-slate-600"
                />
                <span className="ml-3 text-slate-700 dark:text-slate-300">{option}</span>
              </label>
            ))}
          </div>
        );
      case QuizType.Open:
        return (
          <textarea
            value={userAnswer || ''}
            onChange={(e) => onAnswerChange(index, e.target.value)}
            className="w-full h-24 p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500"
            placeholder="Type your answer here..."
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
      <div className="font-semibold text-lg text-slate-800 dark:text-slate-200">
        <span className="text-indigo-500 mr-2">Q{index + 1}:</span>
        {renderContent(question.question)}
      </div>
      <div className="mt-4">{renderAnswerOptions()}</div>
    </div>
  );
};


export const QuizDisplay: React.FC<QuizDisplayProps> = ({ quiz, userAnswers, setUserAnswers, onSubmit, subjectType }) => {
  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionIndex]: answer }));
  };

  const sanitizedQuestions = React.useMemo(() => {
    return (quiz?.questions || []).filter(
      (q): q is Question =>
        q && typeof q.question === 'string' && typeof q.answer === 'string'
    );
  }, [quiz]);
  
  const allQuestionsAnswered = Object.keys(userAnswers).length === sanitizedQuestions.length && Object.values(userAnswers).every(ans => typeof ans === 'string' && ans.trim() !== '');

  return (
    <div className="w-full">
      <h2 className="text-3xl font-bold text-center mb-2 text-slate-800 dark:text-slate-200">{quiz.title}</h2>
      <p className="text-center text-slate-500 dark:text-slate-400 mb-8">Answer all the questions below.</p>
      <div className="space-y-6">
        {sanitizedQuestions.map((q, index) => (
          <QuestionCard
            key={index}
            question={q}
            index={index}
            userAnswer={userAnswers[index]}
            onAnswerChange={handleAnswerChange}
            subjectType={subjectType}
          />
        ))}
      </div>
      <div className="mt-10 text-center">
        <button
          onClick={onSubmit}
          disabled={!allQuestionsAnswered}
          className="px-10 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          Check Answers
        </button>
        {!allQuestionsAnswered && <p className="text-sm text-slate-500 mt-2">Please answer all questions to see your results.</p>}
      </div>
    </div>
  );
};