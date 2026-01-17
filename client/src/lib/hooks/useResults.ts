import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resultsApi } from '../api';

export interface ResultsParams {
  type?: 'typing' | 'shorthand';
  limit?: number;
  offset?: number;
}

export function useResults(studentId?: number, enableQuery: boolean = true, params?: ResultsParams) {
  const queryClient = useQueryClient();

  // Fetch paged results
  const { data: results = [], isLoading, refetch: refetchResults } = useQuery({
    queryKey: ['results', 'paged', { studentId, ...params }],
    queryFn: () => resultsApi.getPaged({ studentId, ...params }),
    enabled: enableQuery,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch result counts
  const { data: counts = {} } = useQuery({
    queryKey: ['results', 'counts', { studentId }],
    queryFn: () => resultsApi.getCounts({ studentId }),
    enabled: enableQuery,
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
    counts: counts as Record<string, number>,
    isLoading,
    refetchResults,
    createResult: createMutation.mutateAsync,
    deleteResult: deleteMutation.mutateAsync,
  };
}
