// Human-like username generator for better email deliverability
// Generates usernames that look like real person usernames: firstname + optional lastname + numbers

const firstNames = [
  'james', 'john', 'robert', 'michael', 'david', 'william', 'richard', 'joseph', 'thomas', 'charles',
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah', 'karen',
  'alex', 'chris', 'jordan', 'taylor', 'morgan', 'casey', 'riley', 'quinn', 'avery', 'skyler',
  'emma', 'olivia', 'ava', 'sophia', 'isabella', 'mia', 'charlotte', 'amelia', 'harper', 'evelyn',
  'liam', 'noah', 'oliver', 'elijah', 'lucas', 'mason', 'logan', 'alexander', 'ethan', 'jacob',
  'daniel', 'matthew', 'henry', 'sebastian', 'jack', 'aiden', 'owen', 'samuel', 'ryan', 'nathan',
  'grace', 'chloe', 'victoria', 'penelope', 'riley', 'layla', 'zoey', 'nora', 'lily', 'eleanor',
  'leo', 'jayden', 'carter', 'dylan', 'luke', 'gabriel', 'anthony', 'isaac', 'wyatt', 'caleb'
];

const lastNames = [
  'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez',
  'anderson', 'taylor', 'thomas', 'jackson', 'white', 'harris', 'martin', 'thompson', 'moore', 'young',
  'allen', 'king', 'wright', 'scott', 'torres', 'nguyen', 'hill', 'flores', 'green', 'adams',
  'nelson', 'baker', 'hall', 'rivera', 'campbell', 'mitchell', 'carter', 'roberts', 'gomez', 'phillips',
  'evans', 'turner', 'diaz', 'parker', 'cruz', 'edwards', 'collins', 'reyes', 'stewart', 'morris',
  'lee', 'kim', 'chen', 'patel', 'shah', 'wang', 'liu', 'kumar', 'singh', 'wu'
];

const separators = ['', '.', '_', '-'];

type UsernameStyle = 'random' | 'human' | 'mixed';

/**
 * Generate a random alphanumeric username (original style)
 */
function generateRandomUsername(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a human-like username
 * Examples: john.smith42, sarah_jones123, michael.brown7
 */
function generateHumanUsername(): string {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const includeLastName = Math.random() > 0.3; // 70% chance to include last name
  const separator = separators[Math.floor(Math.random() * separators.length)];
  
  let username = firstName;
  
  if (includeLastName) {
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    username = firstName + separator + lastName;
  }
  
  // Add numbers at the end (1-4 digits)
  const addNumbers = Math.random() > 0.2; // 80% chance to add numbers
  if (addNumbers) {
    const numDigits = Math.floor(Math.random() * 4) + 1; // 1-4 digits
    const maxNum = Math.pow(10, numDigits);
    const number = Math.floor(Math.random() * maxNum);
    username += number.toString().padStart(numDigits > 2 ? 0 : numDigits, '0');
  }
  
  return username.toLowerCase();
}

/**
 * Generate a username based on the specified style
 */
export function generateUsername(style: UsernameStyle = 'human'): string {
  switch (style) {
    case 'random':
      return generateRandomUsername();
    case 'human':
      return generateHumanUsername();
    case 'mixed':
      // 70% human, 30% random
      return Math.random() > 0.3 ? generateHumanUsername() : generateRandomUsername();
    default:
      return generateHumanUsername();
  }
}

/**
 * Check if username looks human-like
 */
export function isHumanLikeUsername(username: string): boolean {
  // Has at least one common name pattern
  const hasName = firstNames.some(name => username.toLowerCase().includes(name)) ||
                  lastNames.some(name => username.toLowerCase().includes(name));
  
  // Has reasonable length (5-20 chars)
  const hasReasonableLength = username.length >= 5 && username.length <= 20;
  
  // Ends with numbers (common pattern)
  const endsWithNumbers = /\d+$/.test(username);
  
  return hasName || (hasReasonableLength && endsWithNumbers);
}

export { generateRandomUsername, generateHumanUsername };
export type { UsernameStyle };
