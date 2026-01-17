import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pdfApi } from '../api';
import type { PdfFolder, PdfResource } from '@shared/schema';

export function usePdf(selectedFolderId?: string | null) {
  const queryClient = useQueryClient();

  // Always fetch folders (needed to show folder list)
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['pdf', 'folders'],
    queryFn: pdfApi.getFolders,
    staleTime: 30000,
  });

  // Only fetch resources when a folder is selected (lazy loading)
  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ['pdf', 'resources'],
    queryFn: pdfApi.getResources,
    staleTime: 30000,
    enabled: !!selectedFolderId, // Only fetch when folder is selected
  });

  const createFolderMutation = useMutation({
    mutationFn: pdfApi.createFolder,
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: ['pdf', 'folders'] });
      const previousFolders = queryClient.getQueryData<PdfFolder[]>(['pdf', 'folders']);
      
      const optimisticFolder: PdfFolder = {
        id: -Math.floor(Math.random() * 1000000),
        name,
        createdAt: new Date(),
      };
      
      queryClient.setQueryData<PdfFolder[]>(['pdf', 'folders'], (old = []) => [...old, optimisticFolder]);
      
      return { previousFolders };
    },
    onError: (err, name, context) => {
      if (context?.previousFolders) {
        queryClient.setQueryData(['pdf', 'folders'], context.previousFolders);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf', 'folders'] });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: pdfApi.deleteFolder,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['pdf', 'folders'] });
      await queryClient.cancelQueries({ queryKey: ['pdf', 'resources'] });
      
      const previousFolders = queryClient.getQueryData<PdfFolder[]>(['pdf', 'folders']);
      const previousResources = queryClient.getQueryData<PdfResource[]>(['pdf', 'resources']);
      
      queryClient.setQueryData<PdfFolder[]>(['pdf', 'folders'], (old = []) =>
        old.filter((folder) => folder.id !== id)
      );
      
      queryClient.setQueryData<PdfResource[]>(['pdf', 'resources'], (old = []) =>
        old.filter((resource) => resource.folderId !== id)
      );
      
      return { previousFolders, previousResources };
    },
    onError: (err, id, context) => {
      if (context?.previousFolders) {
        queryClient.setQueryData(['pdf', 'folders'], context.previousFolders);
      }
      if (context?.previousResources) {
        queryClient.setQueryData(['pdf', 'resources'], context.previousResources);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf', 'folders'] });
      queryClient.invalidateQueries({ queryKey: ['pdf', 'resources'] });
    },
  });

  const createResourceMutation = useMutation({
    mutationFn: pdfApi.createResource,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['pdf', 'resources'] });
      const previousResources = queryClient.getQueryData<PdfResource[]>(['pdf', 'resources']);
      
      const optimisticResource: PdfResource = {
        id: -Math.floor(Math.random() * 1000000),
        name: data.name,
        url: data.url,
        pageCount: data.pageCount,
        price: data.price.toString(),
        folderId: data.folderId,
        createdAt: new Date(),
      };
      
      queryClient.setQueryData<PdfResource[]>(['pdf', 'resources'], (old = []) => [...old, optimisticResource]);
      
      return { previousResources };
    },
    onError: (err, data, context) => {
      if (context?.previousResources) {
        queryClient.setQueryData(['pdf', 'resources'], context.previousResources);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf', 'resources'] });
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: pdfApi.deleteResource,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['pdf', 'resources'] });
      const previousResources = queryClient.getQueryData<PdfResource[]>(['pdf', 'resources']);
      
      queryClient.setQueryData<PdfResource[]>(['pdf', 'resources'], (old = []) =>
        old.filter((resource) => resource.id !== id)
      );
      
      return { previousResources };
    },
    onError: (err, id, context) => {
      if (context?.previousResources) {
        queryClient.setQueryData(['pdf', 'resources'], context.previousResources);
      }
    },
    onSettled: () => {
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
