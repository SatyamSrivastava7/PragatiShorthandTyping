import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi, galleryApi, selectedCandidatesApi } from '../api';

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const updateMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateMutation.mutateAsync,
  };
}

export function useGallery() {
  const queryClient = useQueryClient();

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['gallery'],
    queryFn: galleryApi.getImages,
  });

  const addMutation = useMutation({
    mutationFn: galleryApi.addImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: galleryApi.deleteImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });

  return {
    images: images.map(img => img.url),
    isLoading,
    addImage: addMutation.mutateAsync,
    deleteImage: deleteMutation.mutateAsync,
  };
}

export function useSelectedCandidates() {
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['selected-candidates'],
    queryFn: selectedCandidatesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: selectedCandidatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selected-candidates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: selectedCandidatesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selected-candidates'] });
    },
  });

  return {
    candidates,
    isLoading,
    addCandidate: createMutation.mutateAsync,
    deleteCandidate: deleteMutation.mutateAsync,
  };
}
