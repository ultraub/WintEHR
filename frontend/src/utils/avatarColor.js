/**
 * A stable colour for a person's initials avatar: the same name always gets
 * the same fill, so a patient is recognisable across lists.
 */
import { avatarFills } from '../themes/auroraPalette';

export const avatarColorFor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 100003;
  return avatarFills[hash % avatarFills.length];
};

/** "Mauro Hodkiewicz" -> "MH" */
export const initialsOf = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};
