import { useRef, useCallback } from 'react';

const GUESS_THRESHOLD_SECONDS = 4;
const DIFFICULTY_THRESHOLD_SECONDS = 120;

interface QuestionTimingResult {
  timeSpentSeconds: number;
  possibleGuess: boolean;
  difficultyDetected: boolean;
}

/**
 * Tracks time spent on each question.
 * Call `startQuestion(questionId)` when a question becomes visible.
 * Call `stopQuestion(questionId)` when the student answers.
 * Call `abandonQuestion(questionId)` when the student leaves without answering.
 */
export function useQuestionTimer() {
  const startTimesRef = useRef<Map<string, number>>(new Map());

  const startQuestion = useCallback((questionId: string) => {
    startTimesRef.current.set(questionId, Date.now());
  }, []);

  const stopQuestion = useCallback((questionId: string): QuestionTimingResult => {
    const startTime = startTimesRef.current.get(questionId);
    startTimesRef.current.delete(questionId);

    if (!startTime) {
      return { timeSpentSeconds: 0, possibleGuess: false, difficultyDetected: false };
    }

    const timeSpentSeconds = Math.round((Date.now() - startTime) / 1000);
    return {
      timeSpentSeconds,
      possibleGuess: timeSpentSeconds < GUESS_THRESHOLD_SECONDS,
      difficultyDetected: timeSpentSeconds > DIFFICULTY_THRESHOLD_SECONDS,
    };
  }, []);

  const getAbandonedQuestions = useCallback((): string[] => {
    return Array.from(startTimesRef.current.keys());
  }, []);

  const clearAll = useCallback(() => {
    startTimesRef.current.clear();
  }, []);

  return { startQuestion, stopQuestion, getAbandonedQuestions, clearAll };
}
