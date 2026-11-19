export type CorrectionCategory = 'spelling' | 'grammar' | 'punctuation' | 'style';

export type ProofreadMode = 'comprehensive' | 'orthography_grammar';

export type CategoryFilter = 'all' | CorrectionCategory;

export type WorkspaceTab = 'proofread' | 'irab' | 'eloquence';

export type ThemeMode = 'light' | 'dark';

export interface AdvisorMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string;
}

export interface CorrectionItem {
  id: string;
  original: string;
  corrected: string;
  category: CorrectionCategory;
  ruleTitle: string;
  explanation: string;
  context: string;
}

export interface RhetoricalInsightItem {
  id: string;
  excerpt: string;
  phenomenon: string;
  rhetoricalFacet: string;
  grammaticalInterpretations: string;
}

export interface ProofreadResult {
  correctedText: string;
  summary: string;
  corrections: CorrectionItem[];
  overallAssessment: 'flawless' | 'minor_edits' | 'needs_revision';
  containsQuranicText?: boolean;
  isPoetryOrRhetoric?: boolean;
  rhetoricalInsights?: RhetoricalInsightItem[];
}

export interface TashkeelResult {
  vocalizedText: string;
  notes: string;
}

export interface IrabWordBreakdown {
  token: string;
  role: string;
  irab: string;
}

export interface IrabResult {
  target: string;
  mode: 'word' | 'sentence';
  grammaticalRole: string;
  detailedIrab: string;
  morphologicalNote: string;
  breakdown: IrabWordBreakdown[];
}

export interface EloquenceAlternative {
  phrase: string;
  nuance: string;
  register: string;
}

export interface EloquenceSuggestion {
  id: string;
  originalPhrase: string;
  rhetoricalReason: string;
  alternatives: EloquenceAlternative[];
}

export interface EloquenceResult {
  overallStyleNote: string;
  suggestions: EloquenceSuggestion[];
}

export interface ProofreadHistoryEntry {
  id: string;
  createdAt: string;
  mode: ProofreadMode;
  originalText: string;
  result: ProofreadResult;
}

export interface TextStats {
  words: number;
  characters: number;
  charactersWithoutSpaces: number;
  sentences: number;
  paragraphs: number;
  readingTimeSeconds: number;
  readingTimeLabel: string;
}

export interface HighlightSegment {
  type: 'text' | 'error';
  text: string;
  correctionIndex?: number;
  correction?: CorrectionItem;
}
