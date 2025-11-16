export type AssessmentContext = {
  job_description?: string | null;
  company_bio?: string | null;
  recruiter_notes?: string | null;
  resume_text?: string | null;
  application_answers?: Record<string, unknown> | null;
  candidate_name?: string | null;
  duration_minutes?: number | null;
};

/**
 * Builds job context from database fields.
 * Combines: job_description, company_bio, recruiter_notes
 * Structures for job-fit assessment analysis
 */
export function buildJobContext(params: {
  jobDescription?: string | null | undefined;
  companyBio?: string | null | undefined;
  recruiterNotes?: string | null | undefined;
  jobId?: string;
}): string {
  const parts: string[] = [];

  if (params.jobDescription) {
    parts.push(`JOB DESCRIPTION:\n${params.jobDescription}`);
  }

  if (params.companyBio) {
    parts.push(`COMPANY CONTEXT:\n${params.companyBio}`);
  }

  if (params.recruiterNotes) {
    parts.push(`RECRUITER NOTES (Areas to probe):\n${params.recruiterNotes}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : '';
}

/**
 * Builds applicant context from database fields.
 * Combines: candidate name, resume_text, application_answers
 * Structures for personalized, job-fit assessment
 */
export function buildApplicantContext(params: {
  candidateName?: string | null | undefined;
  resumeText?: string | null | undefined;
  applicationAnswers?: Record<string, unknown> | null | undefined;
  jobId?: string;
}): string {
  const parts: string[] = [];

  if (params.candidateName) {
    parts.push(`CANDIDATE NAME:\n${params.candidateName}`);
  }

  if (params.resumeText) {
    // Truncate resume to first 2000 chars to avoid token limits
    const resumePreview =
      params.resumeText.length > 2000
        ? params.resumeText.substring(0, 2000) + '...'
        : params.resumeText;
    parts.push(`RESUME:\n${resumePreview}`);
  }

  if (params.applicationAnswers && typeof params.applicationAnswers === 'object') {
    const answers = Object.entries(params.applicationAnswers)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join('\n');
    if (answers) {
      parts.push(`APPLICATION ANSWERS:\n${answers}`);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : '';
}
