export type AssessmentContext = {
  job_description?: string | null;
  company_bio?: string | null;
  recruiter_notes?: string | null;
  resume_text?: string | null;
  application_answers?: Record<string, unknown> | null;
};

/**
 * Builds job context from database fields.
 * Combines: job_description, company_bio, recruiter_notes
 */
export function buildJobContext(params: {
  jobDescription?: string | null;
  companyBio?: string | null;
  recruiterNotes?: string | null;
  jobId?: string;
}): string {
  const parts: string[] = [];
  
  if (params.jobDescription) {
    parts.push(`Job Description: ${params.jobDescription}`);
  }
  
  if (params.companyBio) {
    parts.push(`Company: ${params.companyBio}`);
  }
  
  if (params.recruiterNotes) {
    parts.push(`Recruiter Notes: ${params.recruiterNotes}`);
  }
  
  return parts.length > 0 ? parts.join('\n\n') : '';
}

/**
 * Builds applicant context from database fields.
 * Combines: resume_text, application_answers
 */
export function buildApplicantContext(params: {
  resumeText?: string | null;
  applicationAnswers?: Record<string, unknown> | null;
  jobId?: string;
}): string {
  const parts: string[] = [];
  
  if (params.resumeText) {
    // Truncate resume to first 2000 chars to avoid token limits
    const resumePreview = params.resumeText.length > 2000 
      ? params.resumeText.substring(0, 2000) + '...'
      : params.resumeText;
    parts.push(`Resume: ${resumePreview}`);
  }
  
  if (params.applicationAnswers && typeof params.applicationAnswers === 'object') {
    const answers = Object.entries(params.applicationAnswers)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join('; ');
    if (answers) {
      parts.push(`Application Answers: ${answers}`);
    }
  }
  
  return parts.length > 0 ? parts.join('\n\n') : '';
}

