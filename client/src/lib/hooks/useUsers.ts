import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api';

export function useUsers() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return {
    users,
    isLoading,
    updateUser: updateMutation.mutateAsync,
    deleteUser: deleteMutation.mutateAsync,
  };
}
