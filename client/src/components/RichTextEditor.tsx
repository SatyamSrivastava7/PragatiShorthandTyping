import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Bold,
  Italic,
  Underline,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Maximize2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  fontClass?: string;
  showWordCount?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter text here...",
  className,
  label,
  fontClass = "",
  showWordCount = true,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState("16");
  const [lineSpacing, setLineSpacing] = useState("1.5");
  const [isEditing, setIsEditing] = useState(false);

  // Initialize editor content from value prop
  useEffect(() => {
    if (editorRef.current && !isEditing) {
      // Only update if not currently editing to avoid cursor displacement
      // Store plain text only (no HTML formatting)
      if (editorRef.current.innerText !== value) {
        editorRef.current.innerText = value || "";
      }
    }
  }, [value, isEditing]);

  const execCommand = (command: string, value?: string) => {
    // Ensure the editor is focused before executing command
    if (editorRef.current) {
      // Save the current selection before focusing
      const selection = window.getSelection();
      let savedRange = null;
      
      if (selection && selection.rangeCount > 0) {
        savedRange = selection.getRangeAt(0);
      }
      
      editorRef.current.focus();
      
      // Restore the selection if we had one
      if (savedRange) {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(savedRange);
        }
      }
      
      // Use a small delay to ensure focus is applied before command
      setTimeout(() => {
        document.execCommand(command, false, value);
        // Ensure cursor stays in editor after command
        editorRef.current?.focus();
      }, 0);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      setIsEditing(true);
      // Extract plain text without HTML tags
      const plainText = editorRef.current.innerText || "";
      onChange(plainText);
      setTimeout(() => setIsEditing(false), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Allow keyboard shortcuts to work properly
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      document.execCommand("undo");
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
      e.preventDefault();
      document.execCommand("redo");
    }
  };

  const handleFontSizeChange = (newSize: string) => {
    setFontSize(newSize);
    execCommand("fontSize", newSize);
  };

  const formatButton = (
    icon: React.ReactNode,
    command: string,
    title: string,
    value?: string
  ) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 w-8 p-0"
      onMouseDown={(e) => {
        e.preventDefault();
        execCommand(command, value);
      }}
      title={title}
    >
      {icon}
    </Button>
  );

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-medium">{label}</Label>}

      {/* Toolbar */}
      <div className="border rounded-t-md bg-slate-50 dark:bg-slate-900 p-2 flex flex-wrap gap-1">
        {/* Text Format */}
        <div className="flex gap-1 border-r pr-2">
          {formatButton(<Bold className="h-4 w-4" />, "bold", "Bold (Ctrl+B)")}
          {formatButton(
            <Italic className="h-4 w-4" />,
            "italic",
            "Italic (Ctrl+I)"
          )}
          {formatButton(
            <Underline className="h-4 w-4" />,
            "underline",
            "Underline (Ctrl+U)"
          )}
        </div>

        {/* Font Size */}
        <div className="flex items-center gap-2 border-r pr-2">
          <Type className="h-4 w-4 text-muted-foreground" />
          <Select value={fontSize} onValueChange={handleFontSizeChange}>
            <SelectTrigger className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-0">
              <SelectItem value="1">10px</SelectItem>
              <SelectItem value="2">12px</SelectItem>
              <SelectItem value="3">16px</SelectItem>
              <SelectItem value="4">18px</SelectItem>
              <SelectItem value="5">24px</SelectItem>
              <SelectItem value="6">32px</SelectItem>
              <SelectItem value="7">48px</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Line Spacing */}
        <div className="flex items-center gap-2 border-r pr-2">
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
          <Select value={lineSpacing} onValueChange={setLineSpacing}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-0">
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="1.25">1.25</SelectItem>
              <SelectItem value="1.5">1.5</SelectItem>
              <SelectItem value="1.75">1.75</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="2.5">2.5</SelectItem>
              <SelectItem value="3">3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Alignment */}
        <div className="flex gap-1 border-r pr-2">
          {formatButton(
            <AlignLeft className="h-4 w-4" />,
            "justifyLeft",
            "Align Left"
          )}
          {formatButton(
            <AlignCenter className="h-4 w-4" />,
            "justifyCenter",
            "Align Center"
          )}
          {formatButton(
            <AlignRight className="h-4 w-4" />,
            "justifyRight",
            "Align Right"
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (editorRef.current) {
            // Extract plain text without HTML tags when saving
            const plainText = editorRef.current.innerText || "";
            onChange(plainText);
          }
        }}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          "min-h-[200px] p-4 border-2 rounded-b-md bg-white dark:bg-zinc-900 focus:outline-none focus:border-primary/50 overflow-auto",
          fontClass,
          className
        )}
        style={{ fontSize: fontSize === "3" ? "16px" : undefined, lineHeight: lineSpacing }}
      />

      {/* Word Count */}
      {showWordCount && (
        <p className="text-xs text-muted-foreground">
          {value.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length}{" "}
          words |{" "}
          {value.replace(/<[^>]*>/g, "").length} characters
        </p>
      )}
    </div>
  );
}
