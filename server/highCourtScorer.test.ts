import assert from "node:assert/strict";
import { scoreHighCourtTest } from "./highCourtScorer";

function alignmentFor(type: "typing" | "pitman" | "shorthand", original: string, typed: string) {
  return JSON.parse(scoreHighCourtTest(type, original, typed).alignmentData) as Array<{
    original: string;
    typed: string;
    status: string;
    errorType: string;
  }>;
}

{
  const result = scoreHighCourtTest("typing", "alpha beta gamma", "alpha zeta gamma");
  assert.equal(result.fullMistakes, 1);
  assert.equal(result.marks, 99.8);
  assert.deepEqual(alignmentFor("typing", "alpha beta gamma", "alpha zeta gamma").map((entry) => entry.status), [
    "match", "substitution", "match",
  ]);
}

{
  const result = scoreHighCourtTest("pitman", "alpha beta gamma", "alpha gamma");
  assert.equal(result.fullMistakes, 1);
  assert.equal(alignmentFor("pitman", "alpha beta gamma", "alpha gamma")[1].status, "missing");
}

{
  const result = scoreHighCourtTest("pitman", "alpha beta gamma", "alpha beta delta gamma");
  assert.equal(result.fullMistakes, 1);
  assert.equal(alignmentFor("pitman", "alpha beta gamma", "alpha beta delta gamma")[2].status, "extra");
}

{
  const result = scoreHighCourtTest("typing", "“Court’s” ruling… well—known", "\"Court's\" ruling... well-known");
  assert.equal(result.fullMistakes, 0);
  assert.equal(result.marks, 100);
}

{
  const result = scoreHighCourtTest("shorthand", "One, two.\n\nThree", "One two\nThree");
  assert.equal(result.fullMistakes, 0);
  assert.equal(result.halfMistakes, 2);
  assert.equal(alignmentFor("shorthand", "One, two.\n\nThree", "One two\nThree")[1].errorType, "half");
}

{
  const result = scoreHighCourtTest("shorthand", "One\nTwo", "One Two");
  assert.equal(result.fullMistakes, 0);
  assert.equal(result.halfMistakes, 1);
}

{
  const original = "the court heard the court today";
  const typed = "the court saw the court today";
  const result = scoreHighCourtTest("typing", original, typed);
  assert.equal(result.fullMistakes, 1);
  assert.equal(alignmentFor("typing", original, typed)[2].status, "substitution");
}

{
  const original = Array.from({ length: 650 }, (_, index) => `word${index}`).join(" ");
  const typed = original.replace("word420", "replaced");
  const result = scoreHighCourtTest("typing", original, typed);
  assert.equal(result.fullMistakes, 1);
  assert.equal(alignmentFor("typing", original, typed)[420].status, "substitution");
}

{
  const original = "<b>bold</b> <i>italic</i> <u>underlined</u>";
  const typed = "<strong>bold</strong> <em>italic</em> <u>underlined</u>";
  assert.equal(scoreHighCourtTest("typing", original, typed).fullMistakes, 0);
}

{
  const original = '<span style="font-weight: 700">bold</span> <span style="font-style: oblique">italic</span> <span style="text-decoration: underline">underlined</span>';
  const typed = "<strong>bold</strong> <i>italic</i> <u>underlined</u>";
  assert.equal(scoreHighCourtTest("typing", original, typed).fullMistakes, 0);
}

{
  const original = "<b><i>important</i></b> <u>notice</u>";
  const typed = "<strong>important</strong> notice";
  const result = scoreHighCourtTest("typing", original, typed);
  assert.equal(result.fullMistakes, 2);
  assert.equal(result.marks, 99.6);
}

console.log("High Court scorer comparison checks passed.");