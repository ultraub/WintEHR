import { avatarColorFor, initialsOf } from '../avatarColor';
import { avatarFills } from '../../themes/auroraPalette';

describe('avatarColorFor', () => {
  it('gives the same name the same colour, from the palette', () => {
    const first = avatarColorFor('Mauro Hodkiewicz');
    expect(avatarColorFor('Mauro Hodkiewicz')).toBe(first);
    expect(avatarFills).toContain(first);
    expect(avatarFills).toContain(avatarColorFor(''));
  });
});

describe('initialsOf', () => {
  it('takes the first and last name', () => {
    expect(initialsOf('Mauro Garland Hodkiewicz')).toBe('MH');
    expect(initialsOf('débora')).toBe('D');
    expect(initialsOf('  ')).toBe('?');
  });
});
