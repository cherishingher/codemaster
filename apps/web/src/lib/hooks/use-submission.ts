import useSWR from 'swr';
import { api } from '@/lib/api-client';

export type SubmissionStatus = 'PENDING' | 'JUDGING' | 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'MEMORY_LIMIT_EXCEEDED' | 'RUNTIME_ERROR' | 'COMPILE_ERROR' | 'SYSTEM_ERROR';

export interface Submission {
  id: string;
  status: SubmissionStatus;
  score?: number;
  timeUsed?: number;
  memoryUsed?: number;
  errorMessage?: string;
  createdAt: string;
}

export function useSubmission(submissionId: string | null) {
  const { data, error, isLoading } = useSWR<Submission>(
    submissionId ? `/submissions/${submissionId}` : null,
    async () => (await api.submissions.get(submissionId as string)) as Submission,
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
