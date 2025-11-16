/**
 * Resume parser for intelligent candidate context extraction
 * Extracts projects, inconsistencies, and red flags from resume text
 */

export interface ParsedProject {
  description: string;
  technologies: string[];
}

export interface ResumeAnalysis {
  projects: ParsedProject[];
  technologies: string[];
  inconsistencies: { what: string; severity: 'low' | 'medium' | 'high' }[];
  redFlags: { flag: string; severity: 'low' | 'medium' | 'high' }[];
  careerPattern: string;
  totalYearsExperience: number;
  voiceAnalysis: string;
}

/**
 * Parse resume text to extract structured insights
 */
// Tech keywords for resume analysis
const TECH_KEYWORDS = [
  'typescript',
  'javascript',
  'python',
  'java',
  'go',
  'rust',
  'c#',
  'ruby',
  'scala',
  'kotlin',
  'react',
  'vue',
  'angular',
  'node.js',
  'fastapi',
  'django',
  'spring',
  'aws',
  'gcp',
  'azure',
  'docker',
  'kubernetes',
  'postgresql',
  'mongodb',
  'redis',
  'elasticsearch',
  'graphql',
  'rest',
  'kafka',
  'rabbitmq',
  'grpc',
  'tdd',
  'testing',
  'ci/cd',
];

export function parseResume(resumeText: string | null | undefined): ResumeAnalysis {
  if (!resumeText) {
    return {
      projects: [],
      technologies: [],
      inconsistencies: [],
      redFlags: [],
      careerPattern: 'unknown',
      totalYearsExperience: 0,
      voiceAnalysis: 'minimal',
    };
  }

  const analysis: ResumeAnalysis = {
    projects: [],
    technologies: [],
    inconsistencies: [],
    redFlags: [],
    careerPattern: 'unknown',
    totalYearsExperience: 0,
    voiceAnalysis: '',
  };

  const textLower = resumeText.toLowerCase();
  const foundTechs = new Set<string>();

  for (const tech of TECH_KEYWORDS) {
    if (textLower.includes(tech.toLowerCase())) {
      foundTechs.add(tech);
    }
  }

  analysis.technologies = Array.from(foundTechs);

  // Extract projects (look for common project markers)
  const projectPatterns = [
    /project:?\s+([^\n]+)/gi,
    /built:?\s+([^\n]+)/gi,
    /developed:?\s+([^\n]+)/gi,
    /created:?\s+([^\n]+)/gi,
  ];

  const seenProjects = new Set<string>();
  for (const pattern of projectPatterns) {
    let match;
    while ((match = pattern.exec(resumeText)) !== null) {
      const desc = (match[1] || '').trim();
      if (desc && !seenProjects.has(desc) && desc.length > 10 && desc.length < 200) {
        seenProjects.add(desc);
        analysis.projects.push({
          description: desc,
          technologies: extractTechsFromText(desc),
        });
      }
    }
  }

  // Extract experience claims
  const experienceClaims = resumeText.match(/(\d+)\s*\+?\s*(year|yr)s?\s+(?:of\s+)?experience/gi);
  if (experienceClaims && experienceClaims.length > 0) {
    const years = experienceClaims.map((claim) => {
      const match = claim.match(/(\d+)/);
      return match && match[1] ? parseInt(match[1]) : 0;
    });
    analysis.totalYearsExperience = years.length > 0 ? Math.max(...years) : 0;
  }

  // Detect voice/tone
  const confidenceMarkers = [
    { marker: /led\s+team/gi, signal: 'leadership' },
    { marker: /architected/gi, signal: 'architecture' },
    { marker: /optimized/gi, signal: 'optimization' },
    { marker: /scaled/gi, signal: 'scaling' },
    { marker: /responsible\s+for/gi, signal: 'accountability' },
  ];

  const signalsFound = new Set<string>();
  for (const { marker, signal } of confidenceMarkers) {
    if (marker.test(resumeText)) {
      signalsFound.add(signal);
    }
  }

  if (signalsFound.size >= 4) {
    analysis.voiceAnalysis = 'confident';
  } else if (signalsFound.size >= 2) {
    analysis.voiceAnalysis = 'balanced';
  } else {
    analysis.voiceAnalysis = 'cautious';
  }

  // Detect red flags
  if (analysis.totalYearsExperience < 2 && foundTechs.size > 10) {
    analysis.redFlags.push({
      flag: 'Claims many technologies with minimal experience',
      severity: 'medium',
    });
  }

  if (resumeText.match(/job\s+hopping|multiple\s+short|left\s+after/gi)) {
    analysis.redFlags.push({
      flag: 'Possible frequent job changes detected',
      severity: 'low',
    });
  }

  if (foundTechs.has('typescript') && foundTechs.has('python') && foundTechs.has('java')) {
    if (analysis.projects.length < 3) {
      analysis.redFlags.push({
        flag: 'Claims many languages but limited project evidence',
        severity: 'medium',
      });
    }
  }

  return analysis;
}

/**
 * Extract technologies from a text snippet
 */
function extractTechsFromText(text: string): string[] {
  const textLower = text.toLowerCase();
  return TECH_KEYWORDS.filter((tech) => textLower.includes(tech));
}
