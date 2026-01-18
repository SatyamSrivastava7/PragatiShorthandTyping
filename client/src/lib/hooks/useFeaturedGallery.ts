import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { galleryApi } from '../api';

export function useFeaturedGallery() {
  const queryClient = useQueryClient();

  const {
    data: featuredImages = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['gallery', 'featured'],
    queryFn: () => galleryApi.getFeaturedImages(),
  });

  const { mutateAsync: updateImageOrder, isPending: isUpdating } = useMutation({
    mutationFn: (imageIds: number[]) => galleryApi.updateImageOrder(imageIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery', 'featured'] });
    },
  });

  return {
    featuredImages,
    isLoading,
    isUpdating,
    updateImageOrder,
    refetch,
  };
}
