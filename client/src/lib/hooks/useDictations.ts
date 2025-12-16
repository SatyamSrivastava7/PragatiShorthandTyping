import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dictationsApi } from '../api';

export function useDictations() {
  const queryClient = useQueryClient();

  const { data: dictations = [], isLoading } = useQuery({
    queryKey: ['dictations'],
    queryFn: dictationsApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: dictationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dictations'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: dictationsApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dictations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: dictationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dictations'] });
    },
  });

  return {
    dictations,
    isLoading,
    createDictation: createMutation.mutateAsync,
    toggleDictation: toggleMutation.mutateAsync,
    deleteDictation: deleteMutation.mutateAsync,
  };
}
