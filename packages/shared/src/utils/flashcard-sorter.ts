export interface FlashcardPracticeItem {
  id: string;
  front: string;
  back: string;
  requirement_ids?: string[];
  confidence_score?: number;
  last_reviewed_at?: string | Date;
  review_count?: number;
  is_covered?: boolean;
  [key: string]: any;
}

export const CONFIDENCE_LEVELS = [
  {
    score: 1,
    label: 'Very Weak',
    description: 'Complete blackout or incorrect recall',
    keyHint: '1',
    color: 'rose',
    textColor: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
  },
  {
    score: 2,
    label: 'Weak',
    description: 'Vague recognition, substantial errors',
    keyHint: '2',
    color: 'amber',
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  {
    score: 3,
    label: 'Okay',
    description: 'Correct but required serious hesitation',
    keyHint: '3',
    color: 'yellow',
    textColor: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  {
    score: 4,
    label: 'Strong',
    description: 'Accurate recall with quick confidence',
    keyHint: '4',
    color: 'emerald',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  {
    score: 5,
    label: 'Very Strong',
    description: 'Effortless, instant, complete mastery',
    keyHint: '5',
    color: 'indigo',
    textColor: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
  },
] as const;

export type ConfidenceScore = 1 | 2 | 3 | 4 | 5;

/**
 * Determines whether a flashcard has been covered/practiced.
 */
export function isCardCovered(card: FlashcardPracticeItem): boolean {
  if (card.is_covered === true) return true;
  if ((card.review_count ?? 0) > 0) return true;
  if (card.confidence_score !== undefined && card.confidence_score !== null) return true;
  return false;
}

/**
 * Deterministic Confidence-Weighted Ordering Comparator:
 * Sort order:
 * 1. Never practiced cards first
 * 2. Lowest confidence score first (1 = very weak, up to 5 = very strong)
 * 3. Oldest review first (earliest last_reviewed_at timestamp)
 * 4. Deterministic tiebreak by card ID
 */
export function sortCardsForPractice<T extends FlashcardPracticeItem>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const aCovered = isCardCovered(a);
    const bCovered = isCardCovered(b);

    // 1. Never practiced first
    if (!aCovered && bCovered) return -1;
    if (aCovered && !bCovered) return 1;
    if (!aCovered && !bCovered) {
      return a.id.localeCompare(b.id);
    }

    // 2. Lowest confidence first (1 = very weak, 5 = very strong)
    const aConfidence = a.confidence_score ?? 1;
    const bConfidence = b.confidence_score ?? 1;
    if (aConfidence !== bConfidence) {
      return aConfidence - bConfidence;
    }

    // 3. Oldest review first (earliest timestamp)
    const aTime = a.last_reviewed_at ? new Date(a.last_reviewed_at).getTime() : 0;
    const bTime = b.last_reviewed_at ? new Date(b.last_reviewed_at).getTime() : 0;
    if (aTime !== bTime) {
      return aTime - bTime;
    }

    // 4. Deterministic tiebreak by card ID
    return a.id.localeCompare(b.id);
  });
}
