import { GoogleGenAI, Type } from "@google/genai";
import { Quiz, QuizOptions, Language, SubjectType, QuizType, TextQuizOptions, MathQuizOptions } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractTextFromImage = async (
  base64Data: string,
  mimeType: string,
  language: Language,
  subject: SubjectType
): Promise<string> => {
  const model = "gemini-2.5-flash";

  let prompt = `You are an expert in optical character recognition (OCR) and document analysis. 
    Extract all the text from the provided image. The document is in ${language}.
    Present the output clearly.`;

  if (subject === SubjectType.Math) {
    prompt += ` The subject is Math, so pay special attention to preserving all mathematical equations, formulas, and symbols. Format these expressions using LaTeX syntax (e.g., $E=mc^2$ or $$\\frac{a}{b}$$).`
  } else {
    prompt += ` The subject is ${subject}. Follow standard paragraph and text structure.`
  }


  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: mimeType,
    },
  };

  const textPart = { text: prompt };

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [imagePart, textPart] },
  });
  
  return response.text;
};

export const generateQuiz = async (
  text: string,
  options: QuizOptions
): Promise<Quiz> => {
  const model = "gemini-2.5-flash";
  let prompt: string;
  let schema: any;

  if (options.subjectType === SubjectType.Text) {
    const textOptions = options as TextQuizOptions;
    prompt = `Based on the following text, generate a quiz.
    
    Text: "${text}"
    
    Quiz requirements:
    - Language: ${textOptions.language}
    - Subject: ${textOptions.subjectType}
    - Number of questions: ${textOptions.numberOfQuestions}
    - Question type: ${textOptions.quizType}
    - Generate a suitable title for the quiz based on the text.
    - For each question, provide:
        1. The question itself.
        2. The correct answer.
        3. A brief explanation for the answer.
        4. For Multiple Choice questions, provide 4 options including the correct one.
    - Ensure the quiz is relevant to the provided text.
    `;

    const questionSchema = {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING, description: "The quiz question." },
        options: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "A list of 4 options for a multiple choice question. Required only for Multiple Choice type.",
          nullable: true,
        },
        answer: { type: Type.STRING, description: "The correct answer to the question." },
        explanation: { type: Type.STRING, description: "A brief explanation of why the answer is correct." },
        type: {
          type: Type.STRING,
          enum: Object.values(QuizType),
          description: "The type of question.",
        },
      },
      required: ["question", "answer", "explanation", "type"],
    };

    schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "A title for the quiz." },
        questions: {
          type: Type.ARRAY,
          items: questionSchema,
          description: `An array of ${textOptions.numberOfQuestions} quiz questions.`
        },
      },
      required: ["title", "questions"],
    };

  } else { // SubjectType.Math
    const mathOptions = options as MathQuizOptions;
    prompt = `You are a math teacher. Based on the following text containing mathematical concepts or problems, generate a quiz.

    Text: "${text}"

    Quiz requirements:
    - Language: ${mathOptions.language}
    - Number of questions: ${mathOptions.numberOfQuestions}
    - Difficulty level: ${mathOptions.difficulty}
    - Style of questions: ${mathOptions.mathQuizType}. For "Similar Exercises", create problems that are structurally similar to the ones in the text. For "Application Problems", create word problems or scenarios where the formulas/concepts from the text can be applied.
    - Generate a suitable title for the quiz.
    - For each question, provide:
        1. The question itself (as an open-ended problem).
        2. The final correct answer.
        3. A step-by-step explanation showing how to arrive at the answer.
    - **Crucially, format ALL mathematical equations, variables, and symbols using valid KaTeX-compatible LaTeX syntax. Enclose inline math in single dollar signs (e.g., $x^2$) and block equations in double dollar signs (e.g., $$y = mx + b$$). For placeholders or fill-in-the-blank boxes, use the \`\\Box\` command. Ensure all commands are valid; for example, \`\\frac\` must always have two arguments like \`\\frac{numerator}{denominator}\`.**
    `;

    const mathQuestionSchema = {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING, description: "The math problem, formatted with LaTeX." },
        answer: { type: Type.STRING, description: "The final correct answer, formatted with LaTeX if necessary." },
        explanation: { type: Type.STRING, description: "A step-by-step explanation of the solution, formatted with LaTeX if necessary." },
        type: { type: Type.STRING, enum: [QuizType.Open], description: "The type is 'Open Ended' for math problems." },
      },
      required: ["question", "answer", "explanation", "type"],
    };

    schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "A title for the quiz." },
        questions: {
          type: Type.ARRAY,
          items: mathQuestionSchema,
          description: `An array of ${mathOptions.numberOfQuestions} math problems.`
        },
      },
      required: ["title", "questions"],
    };
  }


  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  const jsonText = response.text.trim();
  const sanitizedJson = jsonText.startsWith('```json') ? jsonText.replace(/^```json\n|```$/g, '') : jsonText;
  
  try {
    const quizData = JSON.parse(sanitizedJson);
    if (quizData && quizData.title && Array.isArray(quizData.questions)) {
      return quizData as Quiz;
    } else {
      throw new Error("Invalid quiz data structure received from API.");
    }
  } catch (e) {
    console.error("Failed to parse quiz JSON:", e);
    console.error("Raw response:", jsonText);
    throw new Error("Failed to generate a valid quiz. The response from the AI was not in the expected format.");
  }
};