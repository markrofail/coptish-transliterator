// Every line is copied exactly from data/reference.json; examples.test.ts checks it.
export type Example = {
  id: "risen" | "name" | "prayer" | "conclusion";
  title: string;
  coptic: string;
};

export const EXAMPLES: readonly Example[] = [
  {
    id: "risen",
    title: "Christ is risen",
    coptic: ["Ⲡⲓⲭ̀ⲣⲓⲥⲧⲟⲥ ⲁϥⲧⲱⲛϥ", "Ϧⲉⲛ ⲟⲩⲙⲉⲑⲙⲏⲓ ⲁϥⲧⲱⲛϥ"].join("\n"),
  },
  {
    id: "name",
    title: "In the name of the Father",
    coptic: [
      "Ϧⲉⲛ ⲫ̀ⲣⲁⲛ ⲙ̀ⲫ̀ⲓⲱⲧ",
      "ⲛⲉⲙ ⲡ̀ϣⲏⲣⲓ",
      "ⲛⲉⲙ Ⲡⲓⲡⲛⲉⲩⲙⲁ ⲉⲑⲟⲩⲁⲃ",
      "ⲟⲩⲛⲟⲩϯ ⲛ̀ⲟⲩⲱⲧ Ⲁⲙⲏⲛ.",
    ].join("\n"),
  },
  {
    id: "prayer",
    title: "The Lord’s Prayer",
    coptic: [
      "Ϫⲉ ⲡⲉⲛⲓⲱⲧ ⲉⲧϧⲉⲛ ⲛⲓⲫⲏⲟⲩⲓ: ⲙⲁⲣⲉϥⲧⲟⲩⲃⲟ ⲛ̀ϫⲉ ⲡⲉⲕⲣⲁⲛ: ⲙⲁⲣⲉⲥⲓ ⲛ̀ϫⲉ ⲧⲉⲕⲙⲉⲧⲟⲩⲣⲟ: ⲡⲉⲧⲉϩⲛⲁⲕ ⲙⲁⲣⲉϥϣⲱⲡⲓ",
      "Ⲙ̀ⲫⲣⲏϯ ϧⲉⲛ ⲧ̀ⲫⲉ ⲛⲉⲙ ϩⲓϫⲉⲛ ⲡⲓⲕⲁϩⲓ: ⲡⲉⲛⲱⲓⲕ ⲛ̀ⲧⲉ ⲣⲁⲥϯ ⲙⲏⲓϥ ⲛⲁⲛ ⲙ̀ⲫⲟⲟⲩ:",
      "Ⲟⲩⲟϩ ⲭⲁ ⲛⲏⲉⲧⲉⲣⲟⲛ ⲛⲁⲛ ⲉ̀ⲃⲟⲗ: ⲙ̀ⲫ̀ⲣⲏϯ ϩⲱⲛ ⲛ̀ⲧⲉⲛⲭⲱ ⲉ̀ⲃⲟⲗ ⲛ̀ⲛⲏⲉⲧⲉ ⲟⲩⲟⲛ ⲛ̀ⲧⲁⲛ ⲉⲣⲱⲟⲩ:",
      "Ⲟⲩⲟϩ ⲙ̀ⲡⲉⲣⲉⲛⲧⲉⲛ ⲉϧⲟⲩⲛ ⲉ̀ⲡⲓⲣⲁⲥⲙⲟⲥ: ⲁⲗⲗⲁ ⲛⲁϩⲙⲉⲛ ⲉⲃⲟⲗϩⲁ ⲡⲓⲡⲉⲧϩⲱⲟⲩ:",
      "Ϧⲉⲛ Ⲡⲭ̅ⲥ̅ Ⲓⲏ̅ⲥ̅ Ⲡⲉⲛⲟ̅ⲥ̅.",
      "Ϫⲉ ⲑⲱⲕ ⲧⲉ ϯⲙⲉⲧⲟⲩⲣⲟ ⲛⲉⲙ ϯϫⲟⲙ",
      "ⲛⲉⲙ ⲡⲓⲱⲟⲩ ϣⲁ ⲉⲛⲉϩ. Ⲁⲙⲏⲛ.",
    ].join("\n"),
  },
  {
    id: "conclusion",
    title: "Through the intercessions",
    coptic: [
      "Ϩⲓⲧⲉⲛ ⲛⲓⲡ̀ⲣⲉⲥⲃⲓⲁ:",
      "ⲛ̀ⲧⲉ Ϯⲑⲉⲟ̀ⲧⲟⲕⲟⲥ ⲉⲑⲟⲩⲁⲃ Ⲙⲁⲣⲓⲁ:",
      "Ⲡ̀ϭⲟⲓⲥ ⲁ̀ⲣⲓϩ̀ⲙⲟⲧ ⲛⲁⲛ:",
      "ⲙ̀ⲡⲓⲭⲱ ⲉ̀ⲃⲟⲗ ⲛ̀ⲧⲉ ⲛⲉⲛⲛⲟⲃⲓ.",
    ].join("\n"),
  },
];
