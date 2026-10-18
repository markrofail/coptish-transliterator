// Spells out the jinkim before the text reaches Gemini, which often drops the e it stands for
// (ⲛ̀ⲧⲉ → nte instead of ente). A jinkim on a consonant becomes an ⲉ before it, unless the letter
// before it in the same word is a vowel (Ⲡⲓⲭ̀ⲣⲓⲥⲧⲟⲥ → Pikhristos); then the mark is only dropped.

const JINKIM = "̀";
const COPTIC_LETTER = /[Ⲁ-ⳣϢ-ϯ]/u;
const VOWELS = "ⲁⲉⲏⲓⲟⲩⲱ";

export function expandJinkim(text: string): string {
  const chars = [...text];
  let result = "";
  let previous: string | undefined; // the last letter of the current word, lower-cased
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const lower = char.toLowerCase();
    if (chars[i + 1] === JINKIM && COPTIC_LETTER.test(char) && !VOWELS.includes(lower)) {
      if (previous !== undefined && VOWELS.includes(previous)) result += char;
      else if (previous === undefined && char !== lower) result += `Ⲉ${lower}`;
      else result += `ⲉ${char}`;
      i++; // skip the jinkim itself
    } else {
      result += char;
    }
    if (/\p{L}/u.test(char)) previous = lower;
    else if (!/\p{M}/u.test(char)) previous = undefined;
  }
  return result;
}
