import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api';
import { useAuth } from './useAuth';
import type { User } from '@shared/schema';

export function useUsers(fetchAllUsers = false) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Optimized: Fetch only the current logged-in user by default (lightweight).
  // Pass fetchAllUsers=true (admin views) to fetch all users instead.
  const { data: users = [], isLoading } = useQuery({
    queryKey: fetchAllUsers ? ['users', 'all'] : ['users', 'current', currentUser?.id],
    queryFn: () => {
      if (fetchAllUsers) {
        return usersApi.getAll();
      }
      // Fetch only current user if authenticated
      return currentUser?.id ? usersApi.getById(currentUser.id).then(u => [u]) : Promise.resolve([]);
    },
    enabled: fetchAllUsers || !!currentUser?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes - keep in cache longer
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) =>
      usersApi.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel any in-flight queries
      await queryClient.cancelQueries({ queryKey: ['users'] });
      
      // Save previous data for rollback
      const previousAllUsers = queryClient.getQueryData<User[]>(['users', 'all']);
      const previousCurrentUser = queryClient.getQueryData<User[]>(['users', 'current']);
      
      // Optimistically update all users cache
      if (previousAllUsers) {
        queryClient.setQueryData<User[]>(['users', 'all'], (old = []) =>
          old.map((user) =>
            user.id === id ? { ...user, ...data } : user
          )
        );
      }
      
      // Optimistically update current user cache
      if (previousCurrentUser) {
        queryClient.setQueryData<User[]>(['users', 'current'], (old = []) =>
          old.map((user) =>
            user.id === id ? { ...user, ...data } : user
          )
        );
      }
      
      return { previousAllUsers, previousCurrentUser, updatedUserId: id };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousAllUsers) {
        queryClient.setQueryData(['users', 'all'], context.previousAllUsers);
      }
      if (context?.previousCurrentUser) {
        queryClient.setQueryData(['users', 'current'], context.previousCurrentUser);
      }
    },
    onSettled: (data, error, variables, context) => {
      // Only invalidate if we actually have cached data to refresh
      // Don't invalidate if the cache is empty (query was skipped or not yet run)
      const hasCurrentUserCache = !!context?.previousCurrentUser && context.previousCurrentUser.length > 0;
      const hasAllUsersCache = !!context?.previousAllUsers && context.previousAllUsers.length > 0;
      
      if (hasCurrentUserCache) {
        queryClient.invalidateQueries({ queryKey: ['users', 'current'] });
      }
      if (hasAllUsersCache) {
        queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onMutate: async (id) => {
      // Cancel any in-flight queries
      await queryClient.cancelQueries({ queryKey: ['users'] });
      
      // Save previous data for rollback
      const previousAllUsers = queryClient.getQueryData<User[]>(['users', 'all']);
      const previousCurrentUser = queryClient.getQueryData<User[]>(['users', 'current']);
      
      // Optimistically remove from all users cache
      if (previousAllUsers) {
        queryClient.setQueryData<User[]>(['users', 'all'], (old = []) =>
          old.filter((user) => user.id !== id)
        );
      }
      
      // Optimistically remove from current user cache
      if (previousCurrentUser) {
        queryClient.setQueryData<User[]>(['users', 'current'], (old = []) =>
          old.filter((user) => user.id !== id)
        );
      }
      
      return { previousAllUsers, previousCurrentUser };
    },
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousAllUsers) {
        queryClient.setQueryData(['users', 'all'], context.previousAllUsers);
      }
      if (context?.previousCurrentUser) {
        queryClient.setQueryData(['users', 'current'], context.previousCurrentUser);
      }
    },
    onSettled: (data, error, deletedId, context) => {
      // Only invalidate if we actually have cached data to refresh
      // Don't invalidate if the cache is empty (query was skipped or not yet run)
      const hasCurrentUserCache = !!context?.previousCurrentUser && context.previousCurrentUser.length > 0;
      const hasAllUsersCache = !!context?.previousAllUsers && context.previousAllUsers.length > 0;
      
      if (hasCurrentUserCache) {
        queryClient.invalidateQueries({ queryKey: ['users', 'current'] });
      }
      if (hasAllUsersCache) {
        queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      }
    },
  });

  return {
    users,
    isLoading,
    updateUser: updateMutation.mutateAsync,
    deleteUser: deleteMutation.mutateAsync,
  };
}
