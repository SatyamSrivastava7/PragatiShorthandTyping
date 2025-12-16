import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pdfApi } from '../api';

export function usePdf() {
  const queryClient = useQueryClient();

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['pdf', 'folders'],
    queryFn: pdfApi.getFolders,
  });

  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ['pdf', 'resources'],
    queryFn: pdfApi.getResources,
  });

  const createFolderMutation = useMutation({
    mutationFn: pdfApi.createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf', 'folders'] });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: pdfApi.deleteFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf', 'folders'] });
      queryClient.invalidateQueries({ queryKey: ['pdf', 'resources'] });
    },
  });

  const createResourceMutation = useMutation({
    mutationFn: pdfApi.createResource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf', 'resources'] });
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: pdfApi.deleteResource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf', 'resources'] });
    },
  });

  const purchasePdfMutation = useMutation({
    mutationFn: pdfApi.purchasePdf,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['pdf', 'resources'] });
    },
  });

  const consumePdfMutation = useMutation({
    mutationFn: pdfApi.consumePdf,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['pdf', 'resources'] });
    },
  });

  return {
    folders,
    resources,
    isLoading: foldersLoading || resourcesLoading,
    createFolder: createFolderMutation.mutateAsync,
    deleteFolder: deleteFolderMutation.mutateAsync,
    createResource: createResourceMutation.mutateAsync,
    deleteResource: deleteResourceMutation.mutateAsync,
    purchasePdf: purchasePdfMutation.mutateAsync,
    consumePdfPurchase: consumePdfMutation.mutateAsync,
  };
}
