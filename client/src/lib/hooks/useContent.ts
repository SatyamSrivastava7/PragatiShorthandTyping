import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contentApi } from '../api';

export function useContent() {
  const queryClient = useQueryClient();

  const { data: content = [], isLoading } = useQuery({
    queryKey: ['content'],
    queryFn: contentApi.getAll,
  });

  const { data: enabledContent = [] } = useQuery({
    queryKey: ['content', 'enabled'],
    queryFn: contentApi.getEnabled,
  });

  const createMutation = useMutation({
    mutationFn: contentApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: contentApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: contentApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });

  return {
    content,
    enabledContent,
    isLoading,
    createContent: createMutation.mutateAsync,
    toggleContent: toggleMutation.mutateAsync,
    deleteContent: deleteMutation.mutateAsync,
  };
}
