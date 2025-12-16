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
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(['session'], { user: null });
      queryClient.clear();
      setLocation('/auth');
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      queryClient.setQueryData(['session'], { user: data.user });
      setLocation('/student');
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
