import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resultsApi } from '../api';

export function useResults(studentId?: number, enableQuery: boolean = true) {
  const queryClient = useQueryClient();

  const { data: results = [], isLoading } = useQuery({
    queryKey: studentId ? ['results', 'student', studentId] : ['results'],
    queryFn: studentId ? () => resultsApi.getByStudent(studentId) : resultsApi.getAll,
    enabled: enableQuery, // Query enabled based on enableQuery flag
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const createMutation = useMutation({
    mutationFn: resultsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: resultsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });

  return {
    results,
    isLoading,
    createResult: createMutation.mutateAsync,
    deleteResult: deleteMutation.mutateAsync,
  };
}
