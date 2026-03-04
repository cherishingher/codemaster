import useSWR from 'swr';
import { api } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  role?: 'student' | 'admin';
  roles?: string[];
  avatar?: string | null;
}

export function useAuth({
  redirectTo = '',
  redirectIfFound = false,
} = {}) {
  const { data: rawUser, error, mutate } = useSWR<User | { user: User | null } | null>(
    '/auth/me',
    api.auth.me,
    {
      shouldRetryOnError: false,
    }
  );

  const user =
    rawUser &&
    typeof rawUser === 'object' &&
    'user' in rawUser
      ? rawUser.user
      : rawUser;

  const router = useRouter();
  const loading = rawUser === undefined && !error;
  const loggedIn = !!user && !error;

  // Handle redirects
  if (!loading) {
    if (loggedIn && redirectIfFound) {
      if (redirectTo) router.push(redirectTo);
    }
    if (!loggedIn && redirectTo && !redirectIfFound) {
      router.push(redirectTo);
    }
  }

  return {
    user,
    loading,
    loggedIn,
    mutate,
    logout: async () => {
      await api.auth.logout();
      await mutate(null, false);
      router.push('/login');
    },
  };
}
