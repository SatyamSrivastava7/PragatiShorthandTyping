import { useState } from "react";
import { useTestFolders, useCreateTestFolder } from "@/lib/hooks/useTestFolders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FolderPlus, Loader2 } from "lucide-react";
import type { TestFolder } from "@shared/schema";

interface FolderSelectorProps {
  language: string;
  type: "typing" | "shorthand" | "pitman"; // Type is required to properly filter folders
  selectedFolderId?: number | null;
  onFolderSelect: (folderId: number | null) => void;
}

/**
 * Component for selecting and creating test folders
 * Allows admin to choose existing folder or create new one during test creation
 */
export function FolderSelector({
  language,
  type,
  selectedFolderId,
  onFolderSelect,
}: FolderSelectorProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Fetch folders for the selected language and type
  const { 
    data: folders = [], 
    isLoading: isLoadingFolders,
    error: foldersError,
    isError: isFoldersError
  } = useTestFolders(language, type);

  // Mutation for creating new folder
  const { mutate: createFolder, isPending: isCreatingFolder } =
    useCreateTestFolder();

  const { toast } = useToast();

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newFolderName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Folder name is required",
      });
      return;
    }

    createFolder(
      { name: newFolderName.trim(), language, type },
      {
        onSuccess: (newFolder) => {
          toast({
            variant: "success",
            title: "Success",
            description: `Folder "${newFolderName}" created`,
          });
          setNewFolderName("");
          setIsCreateDialogOpen(false);
          // Auto-select the newly created folder
          onFolderSelect(newFolder.id);
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Error",
            description:
              error instanceof Error ? error.message : "Failed to create folder",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        Test Folder (Optional)
      </Label>
      <div className="flex gap-2">
        <Select
          value={selectedFolderId?.toString() || "none"}
          onValueChange={(value) => {
            onFolderSelect(value === "none" ? null : parseInt(value));
          }}
          disabled={isLoadingFolders}
        >
          <SelectTrigger className="bg-white flex-1">
            <SelectValue placeholder="Select a folder or create new one..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Folder</SelectItem>
            {folders.map((folder: TestFolder) => (
              <SelectItem key={folder.id} value={folder.id.toString()}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoadingFolders}
              className="whitespace-nowrap"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="folder-name">Folder Name</Label>
                <Input
                  id="folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g., Bank PO 2024, SSC CGL..."
                  className="bg-white"
                  disabled={isCreatingFolder}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isCreatingFolder}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isCreatingFolder ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Folder"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoadingFolders && (
        <p className="text-xs text-muted-foreground">Loading folders...</p>
      )}
      {isFoldersError && foldersError && (
        <p className="text-xs text-destructive">Failed to load folders. You can still create tests without assigning a folder.</p>
      )}
    </div>
  );
}
