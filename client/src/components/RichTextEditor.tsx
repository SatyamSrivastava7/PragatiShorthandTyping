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
  AlignJustify,
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
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter text here...",
  className,
  label,
  fontClass = "",
  showWordCount = true,
  onKeyDown: customOnKeyDown,
  onPaste: customOnPaste,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState("16");
  const [lineSpacing, setLineSpacing] = useState("1.5");
  const [isEditing, setIsEditing] = useState(false);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    alignJustify: false,
  });

  // Initialize editor content from value prop
  useEffect(() => {
    if (editorRef.current && !isEditing) {
      // Only update if not currently editing to avoid cursor displacement
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
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
      onChange(editorRef.current.innerHTML);
      updateActiveFormats();
      setTimeout(() => setIsEditing(false), 100);
    }
  };

  const updateActiveFormats = () => {
    // Check which formatting commands are currently active at cursor position
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      alignLeft: document.queryCommandState("justifyLeft"),
      alignCenter: document.queryCommandState("justifyCenter"),
      alignRight: document.queryCommandState("justifyRight"),
      alignJustify: document.queryCommandState("justifyFull"),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Call custom handler first if provided
    if (customOnKeyDown) {
      customOnKeyDown(e);
      if (e.defaultPrevented) return;
    }
    
    // Allow keyboard shortcuts to work properly
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      document.execCommand("undo");
      setTimeout(() => updateActiveFormats(), 0);
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
      e.preventDefault();
      document.execCommand("redo");
      setTimeout(() => updateActiveFormats(), 0);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (customOnPaste) {
      customOnPaste(e);
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
    isActive: boolean,
    value?: string
  ) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-8 w-8 p-0",
        isActive && "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        execCommand(command, value);
        // Update active formats after command executes
        setTimeout(() => updateActiveFormats(), 0);
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
          {formatButton(<Bold className="h-4 w-4" />, "bold", "Bold (Ctrl+B)", activeFormats.bold)}
          {formatButton(
            <Italic className="h-4 w-4" />,
            "italic",
            "Italic (Ctrl+I)",
            activeFormats.italic
          )}
          {formatButton(
            <Underline className="h-4 w-4" />,
            "underline",
            "Underline (Ctrl+U)",
            activeFormats.underline
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
            "Align Left",
            activeFormats.alignLeft
          )}
          {formatButton(
            <AlignCenter className="h-4 w-4" />,
            "justifyCenter",
            "Align Center",
            activeFormats.alignCenter
          )}
          {formatButton(
            <AlignRight className="h-4 w-4" />,
            "justifyRight",
            "Align Right",
            activeFormats.alignRight
          )}
          {formatButton(
            <AlignJustify className="h-4 w-4" />,
            "justifyFull",
            "Justify",
            activeFormats.alignJustify
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
          }
        }}
        onMouseUp={() => updateActiveFormats()}
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
