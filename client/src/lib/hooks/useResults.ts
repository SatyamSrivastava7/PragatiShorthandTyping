import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { resultsApi } from '../api';

export interface ResultsParams {
  type?: 'typing' | 'shorthand';
  limit?: number;
}

export function useResults(studentId?: number, enableQuery: boolean = true, params?: ResultsParams) {
  const queryClient = useQueryClient();
  const resultType = params?.type || 'all';
  const limit = params?.limit || 50;

  // Fetch paged results using infinite query for proper pagination accumulation
  const { 
    data: infiniteData,
    isLoading, 
    refetch: refetchResults,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['results', 'paged', studentId, resultType],
    queryFn: ({ pageParam = 0 }) => 
      resultsApi.getPaged({ studentId, type: params?.type, limit: limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage: any[], pages: any[][]) => {
      const totalFetched = pages.reduce((acc: number, p: any[]) => acc + p.length, 0);
      return lastPage.length === limit ? totalFetched : undefined;
    },
    enabled: enableQuery,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Flatten pages into single results array
  const results = infiniteData?.pages.flat() ?? [];

  // Fetch result counts
  const { data: counts = {} } = useQuery({
    queryKey: ['results', 'counts', studentId],
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
    isFetchingNextPage,
    hasNextPage,
    refetchResults,
    fetchNextPage,
    createResult: createMutation.mutateAsync,
    deleteResult: deleteMutation.mutateAsync,
  };
}
