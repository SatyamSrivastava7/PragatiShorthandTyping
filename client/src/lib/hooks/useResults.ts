import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resultsApi } from '../api';

export function useResults(studentId?: number, enableQuery: boolean = true) {
  const queryClient = useQueryClient();

  const { data: results = [], isLoading } = useQuery({
    queryKey: studentId ? ['results', 'student', studentId] : ['results'],
    queryFn: studentId ? () => resultsApi.getByStudent(studentId) : resultsApi.getAll,
    enabled: enableQuery && (!!studentId || false), // Only run if enabled AND studentId exists, or if enableQuery and no studentId
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
