import useSWR from 'swr';
import { api } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'student' | 'admin';
  avatar?: string;
}

export function useAuth({
  redirectTo = '',
  redirectIfFound = false,
} = {}) {
  const { data: user, error, mutate } = useSWR<User>(
    '/auth/me',
    async () => (await api.auth.me()) as User,
    {
    shouldRetryOnError: false,
  });

  const router = useRouter();
  const loading = !user && !error;
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
      await mutate(undefined, false);
      router.push('/login');
    },
  };
}
