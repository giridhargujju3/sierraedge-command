import test from "node:test";
import assert from "node:assert/strict";

import { getGenderLabel, getLanguageLabel, pickVoice, speakGreeting } from "./voiceSettings.ts";

test("labels use full language and gender names", () => {
  assert.equal(getLanguageLabel("en"), "English");
  assert.equal(getLanguageLabel("hi"), "Hindi");
  assert.equal(getLanguageLabel("te"), "Telugu");
  assert.equal(getLanguageLabel("kn"), "Kannada");
  assert.equal(getGenderLabel("female"), "Female");
  assert.equal(getGenderLabel("male"), "Male");
});

test("pickVoice prefers a matching female Hindi voice", () => {
  const voices = [
    { name: "Microsoft David - English (United States)", lang: "en-US" },
    { name: "Google Hindi Female", lang: "hi-IN" },
    { name: "Microsoft Zira - English (United States)", lang: "en-US" },
  ] as SpeechSynthesisVoice[];

  const selected = pickVoice(voices, "hi", "female");
  assert.equal(selected?.name, "Google Hindi Female");
});

test("pickVoice prefers a matching Telugu voice", () => {
  const voices = [
    { name: "Microsoft David - English (United States)", lang: "en-US" },
    { name: "Google Telugu Female", lang: "te-IN" },
    { name: "Microsoft Zira - English (United States)", lang: "en-US" },
  ] as SpeechSynthesisVoice[];

  const selected = pickVoice(voices, "te", "female");
  assert.equal(selected?.name, "Google Telugu Female");
});

test("pickVoice prefers a matching Kannada voice", () => {
  const voices = [
    { name: "Microsoft David - English (United States)", lang: "en-US" },
    { name: "Google Kannada Female", lang: "kn-IN" },
    { name: "Microsoft Zira - English (United States)", lang: "en-US" },
  ] as SpeechSynthesisVoice[];

  const selected = pickVoice(voices, "kn", "female");
  assert.equal(selected?.name, "Google Kannada Female");
});

test("pickVoice does not silently fall back to a different language", () => {
  const voices = [
    { name: "Microsoft David - English (United States)", lang: "en-US" },
    { name: "Microsoft Zira - English (United States)", lang: "en-US" },
  ] as SpeechSynthesisVoice[];

  const selected = pickVoice(voices, "te", "female");
  assert.equal(selected, undefined);
});

test("speakGreeting still triggers end callback when browser speech is unavailable", () => {
  let called = false;

  speakGreeting("Operator", "en", "female", () => {
    called = true;
  });

  assert.equal(called, true);
});
