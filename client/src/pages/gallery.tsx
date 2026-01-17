import { useGallery } from "@/lib/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown } from "lucide-react";

export default function GalleryPage() {
  const { 
    images: galleryImages,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGallery(true); // Gallery page always enabled

  return (
    <div className="container px-4 md:px-6 py-12 mx-auto">
      <h1 className="text-4xl font-bold text-center mb-4">Photo Gallery</h1>
      <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
        Glimpses of life and events at Pragati Institute of Professional Studies.
      </p>
      
      {galleryImages.length > 0 ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryImages.map((url, idx) => (
              <Dialog key={idx}>
                <DialogTrigger asChild>
                  <div className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
                    <img src={url} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                  <img src={url} alt={`Gallery ${idx}`} className="w-full h-auto max-h-[90vh] object-contain rounded-md" />
                </DialogContent>
              </Dialog>
            ))}
          </div>
          
          {hasNextPage && (
            <div className="flex justify-center pt-8">
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                size="lg"
                className="gap-2 bg-gradient-to-r from-primary to-blue-600 hover:shadow-lg transition-all"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading more...
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-5 w-5" />
                    Load More Images
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/30 rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground">No images uploaded yet.</p>
        </div>
      )}
    </div>
  );
}