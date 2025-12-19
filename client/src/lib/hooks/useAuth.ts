import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api';
import { useLocation } from 'wouter';

export function useAuth() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: authApi.getSession,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ mobile, password }: { mobile: string; password: string }) =>
      authApi.login(mobile, password),
    onSuccess: (data) => {
      queryClient.setQueryData(['session'], { user: data.user });
      setLocation(data.user.role === 'admin' ? '/admin' : '/student');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Capture user role before logout
      const currentSession = queryClient.getQueryData<{ user: { role: string } | null }>(['session']);
      const wasAdmin = currentSession?.user?.role === 'admin';
      await authApi.logout();
      return { wasAdmin };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['session'], { user: null });
      queryClient.clear();
      // Redirect admin to admin login, students to regular auth
      setLocation(data.wasAdmin ? '/adminlogin' : '/auth');
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      // New students need admin approval, don't auto-login
      if (data.pendingApproval) {
        // Don't navigate or set session - user needs approval first
        return;
      }
      // For backwards compatibility if user is returned
      if (data.user) {
        queryClient.setQueryData(['session'], { user: data.user });
        setLocation('/student');
      }
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: authApi.resetPassword,
  });

  return {
    user: sessionData?.user ?? null,
    isLoading,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}
