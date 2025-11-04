import { GoogleGenAI, Type } from "@google/genai";
import { Quiz, QuizType, Language, Question } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = (base64Data: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
};

export const extractTextFromImage = async (base64Data: string, mimeType: string, language: Language): Promise<string> => {
  const model = ai.models;
  const imagePart = fileToGenerativePart(base64Data, mimeType);
  
  const prompt = `You are an expert OCR system specializing in extracting text from educational documents.
Analyze the provided image of a document. Extract all textual content in the natural reading order.
- The document language is ${language}.
- Preserve original paragraphs and list formatting.
- Do not include text from image captions.
- Respond ONLY with the clean, extracted text.`;

  const result = await model.generateContent({
    model: 'gemini-2.5-flash',
    contents: { 
      parts: [
        { text: prompt },
        imagePart
      ]
    },
  });
  
  return result.text;
};

const getQuizSchema = (quizType: QuizType) => {
    const questionProperties: any = {
        question: { type: Type.STRING, description: 'The question text.' },
        answer: {
            type: Type.STRING,
            description: `The correct answer. For True/False, must be "True" or "False". For Multiple Choice, must be one of the options.`,
        },
        explanation: {
            type: Type.STRING,
            description: 'A brief explanation for why the answer is correct.',
        },
    };

    if (quizType === QuizType.MultipleChoice) {
        questionProperties.options = {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'An array of 4 distinct options for a multiple-choice question. One of them must be the correct answer.',
        };
    }

    return {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: 'A short, engaging title for the quiz based on the text.' },
            questions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: questionProperties,
                    required: ['question', 'answer', 'explanation'].concat(quizType === QuizType.MultipleChoice ? ['options'] : []),
                },
            },
        },
        required: ['title', 'questions'],
    };
};

export const generateQuiz = async (context: string, quizType: QuizType, questionCount: number): Promise<Quiz> => {
    const model = ai.models;
    const schema = getQuizSchema(quizType);

    const prompt = `Based on the following text, generate a quiz with ${questionCount} ${quizType} questions.

Text:
---
${context}
---
`;

    const result = await model.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
        }
    });
    
    const parsedJson = JSON.parse(result.text);

    // DEFENSIVE FIX: Ensure questions is an array before mapping.
    const questions = Array.isArray(parsedJson.questions) ? parsedJson.questions : [];
    const questionsWithType: Question[] = questions.map((q: any) => ({
      ...q,
      type: quizType,
    }));

    // DEFENSIVE FIX: Ensure title is a string.
    const title = typeof parsedJson.title === 'string' ? parsedJson.title : 'Generated Quiz';

    return { title, questions: questionsWithType };
};