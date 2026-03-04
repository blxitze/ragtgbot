export type MCQ = {
    question: string;
    choices: [string, string, string, string];
    correctAnswer: string;
    explanation: string;
};

export type TF = {
    question: string;
    correctAnswer: boolean;
    explanation: string;
};

export type ShortQ = {
    question: string;
    suggestedAnswer: string;
};

export type Quiz = {
    mcq: MCQ[];
    tf: TF[];
    short: ShortQ[];
};

export type Definition = {
    term: string;
    definition: string;
};

export type Section = {
    title: string;
    content: string[];
    definitions?: Definition[];
    examples?: string[];
};

export type NotesAndQuiz = {
    tldr: string;
    outline: string[];
    sections: Section[];
    quiz: Quiz;
};
