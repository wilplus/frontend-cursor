/**
 * Post-Recording Questions Pool (Solo-Relevant)
 * 20 question sets, each with 3 questions:
 * - Q1: Scale (1-5) - Solo-focused awareness/control
 * - Q2: Binary (YES/NO) - Solo-focused self-observation
 * - Q3: Free text (no minimum) - Solo reflection
 * 
 * All questions focus on: body, voice, attention, control, effort
 * No imaginary listeners, no theatre - just solo speaker reflection
 */

export type PostQuestionSet = {
  id: number;
  name: string;
  q1: { text: string; type: "scale" };
  q2: { text: string; type: "binary" };
  q3: { text: string; type: "free_text" };
};

export const POST_QUESTIONS_POOL_SOLO: PostQuestionSet[] = [
  // Awareness & Attention
  {
    id: 1,
    name: "Awareness & Attention",
    q1: { text: "How aware were you of your voice?", type: "scale" },
    q2: { text: "Did your attention drift?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 2,
    name: "Presence & Body",
    q1: { text: "How present were you in your body?", type: "scale" },
    q2: { text: "Did you catch yourself zoning out?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  
  // Control & Pacing
  {
    id: 3,
    name: "Control & Pacing",
    q1: { text: "How controlled was your pace?", type: "scale" },
    q2: { text: "Did you rush at any point?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 4,
    name: "Pauses & Silence",
    q1: { text: "How intentional were your pauses?", type: "scale" },
    q2: { text: "Did silence feel uncomfortable?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  
  // Effort & Discipline
  {
    id: 5,
    name: "Effort & Discipline",
    q1: { text: "How much effort did you apply?", type: "scale" },
    q2: { text: "Did you want to stop early?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 6,
    name: "Voice Stability",
    q1: { text: "How steady was your voice?", type: "scale" },
    q2: { text: "Did tension show up in your body?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  
  // Self-Regulation
  {
    id: 7,
    name: "Nervousness Management",
    q1: { text: "How well did you manage nervousness?", type: "scale" },
    q2: { text: "Did you regain control after mistakes?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 8,
    name: "State Improvement",
    q1: { text: "How calm did you feel by the end?", type: "scale" },
    q2: { text: "Did your state improve while speaking?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  
  // Ownership
  {
    id: 9,
    name: "Voice Honesty",
    q1: { text: "How honest did your voice feel?", type: "scale" },
    q2: { text: "Did you speak on autopilot?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 10,
    name: "Intentionality",
    q1: { text: "How intentional were your words?", type: "scale" },
    q2: { text: "Would you repeat this recording differently?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  
  // Additional solo-focused sets
  {
    id: 11,
    name: "Body Awareness",
    q1: { text: "How aware were you of your body while speaking?", type: "scale" },
    q2: { text: "Did you notice physical tension?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 12,
    name: "Breath Control",
    q1: { text: "How controlled was your breathing?", type: "scale" },
    q2: { text: "Did you run out of breath?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 13,
    name: "Focus & Clarity",
    q1: { text: "How clear was your thinking while speaking?", type: "scale" },
    q2: { text: "Did your mind wander?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 14,
    name: "Energy Management",
    q1: { text: "How well did you manage your energy?", type: "scale" },
    q2: { text: "Did you feel drained by the end?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 15,
    name: "Self-Observation",
    q1: { text: "How well did you observe yourself speaking?", type: "scale" },
    q2: { text: "Did you notice patterns in your speech?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 16,
    name: "Voice Quality",
    q1: { text: "How consistent was your voice quality?", type: "scale" },
    q2: { text: "Did your voice change during the recording?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 17,
    name: "Emotional Regulation",
    q1: { text: "How well did you regulate your emotions?", type: "scale" },
    q2: { text: "Did emotions affect your speaking?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 18,
    name: "Flow State",
    q1: { text: "How much did you get into a flow state?", type: "scale" },
    q2: { text: "Did time feel different while speaking?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 19,
    name: "Self-Confidence",
    q1: { text: "How confident did you feel in your voice?", type: "scale" },
    q2: { text: "Did self-doubt show up?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
  {
    id: 20,
    name: "Authenticity",
    q1: { text: "How authentic did your voice feel?", type: "scale" },
    q2: { text: "Did you feel like yourself while speaking?", type: "binary" },
    q3: { text: "What is one thing you noticed about your speaking today?", type: "free_text" },
  },
];

/**
 * Select a question set for a session
 * Strategy: Rotate through sets to avoid repetition
 */
export function selectQuestionSet(
  previousSetIds: number[] = [],
  userId?: string
): PostQuestionSet {
  // Simple rotation: pick least recently used set
  const usedIds = new Set(previousSetIds);
  const available = POST_QUESTIONS_POOL_SOLO.filter((set) => !usedIds.has(set.id));
  
  if (available.length > 0) {
    // Pick random from available (or could use user history)
    return available[Math.floor(Math.random() * available.length)];
  }
  
  // All sets used, reset and pick random
  return POST_QUESTIONS_POOL_SOLO[Math.floor(Math.random() * POST_QUESTIONS_POOL_SOLO.length)];
}
