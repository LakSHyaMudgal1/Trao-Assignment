/**
 * Stable ID Generator for PrepKit entities.
 * Ensures consistent sequential IDs without collisions across regenerations.
 */

export function getNextStableId(prefix: string, existingIds: string[]): string {
  const regex = new RegExp(`^${prefix}(\\d+)$`);
  let maxNum = 0;

  for (const id of existingIds) {
    const match = id.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `${prefix}${maxNum + 1}`;
}

export function generateRequirementId(
  existingIds: string[],
  origin: 'generated' | 'user_created' = 'generated'
): string {
  const prefix = origin === 'user_created' ? 'r_usr_' : 'r';
  return getNextStableId(prefix, existingIds);
}

export function generateQuestionId(
  existingIds: string[],
  origin: 'generated' | 'user_created' = 'generated'
): string {
  const prefix = origin === 'user_created' ? 'q_usr_' : 'q';
  return getNextStableId(prefix, existingIds);
}

export function generateFlashcardId(
  existingIds: string[],
  origin: 'generated' | 'user_created' = 'generated'
): string {
  const prefix = origin === 'user_created' ? 'f_usr_' : 'f';
  return getNextStableId(prefix, existingIds);
}
