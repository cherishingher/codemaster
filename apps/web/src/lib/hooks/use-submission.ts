import useSWR from 'swr';
import { api } from '@/lib/api-client';
import type { SubmissionUiStatus } from '@/lib/oj';

export type SubmissionStatus = SubmissionUiStatus;

type SubmissionArtifact = {
  message?: string | null;
  stderrPreview?: string | null;
  checkerMessage?: string | null;
  exitCode?: number | null;
};

type SourceCodeArtifact = {
  storageType?: string | null;
  source?: string | null;
  objectKey?: string | null;
  sourceSize?: number | null;
};

type SubmissionCase = {
  id: string;
  ordinal?: number | null;
  status: string;
  judgeResult: number;
  timeMs: number;
  memoryMb: number;
  score: number;
  testcase?: {
    id: string;
    title?: string | null;
    caseType?: number;
    groupId?: string | null;
    isSample?: boolean;
  } | null;
  inputPreview?: string | null;
  outputPreview?: string | null;
  expectedPreview?: string | null;
  checkerMessage?: string | null;
};

export interface Submission {
  id: string;
  status: SubmissionStatus;
  rawStatus?: string;
  judgeResult?: number | null;
  score?: number;
  timeUsed?: number;
  memoryUsed?: number;
  errorMessage?: string;
  createdAt: string;
  finishedAt?: string | null;
  language?: string | null;
  languageId?: number | null;
  judgeBackend?: string | null;
  problem?: {
    id: string;
    slug: string;
    title: string;
  };
  sourceCode?: SourceCodeArtifact | null;
  compileInfo?: SubmissionArtifact | null;
  runtimeInfo?: SubmissionArtifact | null;
  cases?: SubmissionCase[];
}

export function useSubmission(submissionId: string | null) {
  const { data, error, isLoading } = useSWR<Submission>(
    submissionId ? `/submissions/${submissionId}` : null,
    () => api.submissions.get(submissionId!),
    {
      refreshInterval: (data) => {
        // Stop polling if finished
        if (data && ['PENDING', 'JUDGING'].includes(data.status)) {
          return 1000; // Poll every second
        }
        return 0;
      },
      revalidateOnFocus: false,
    }
  );

  return {
    submission: data,
    isLoading,
    isError: error,
    isFinished: data && !['PENDING', 'JUDGING'].includes(data.status),
  };
}
