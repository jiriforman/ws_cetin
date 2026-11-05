import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { extractVideoId } from '@/lib/video';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, Video, Image as ImageIcon } from 'lucide-react';
import { adminApi, uploadImage } from '@/lib/api';
import { sanitizeHtml } from '@/lib/sanitize';
import { useToast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const IMAGE_ALIGNMENT_STYLES: Record<string, string> = {
  left: 'margin-right: auto;',
  center: 'margin-left: auto; margin-right: auto;',
  right: 'margin-left: auto;',
};

const imageHtmlOf = (url: string, width: string, alignment: string) => `
      <div class="image-wrapper" style="width: ${width}%; ${IMAGE_ALIGNMENT_STYLES[alignment]} margin-top: 1rem; margin-bottom: 1rem; display: block;" data-width="${width}" data-align="${alignment}">
        <img 
          src="${url}" 
          style="width: 100%; height: auto; border-radius: 0.5rem; display: block;"
          alt="Inserted image"
        />
      </div>
    `;

const TABLE_STYLE = 'border-collapse: collapse; width: 100%; margin: 1rem 0;';
const CELL_STYLE = 'border: 1px solid hsl(var(--border)); padding: 0.25rem 0.5rem; vertical-align: top; text-align: left;';

/** Keeps only the tables of pasted HTML, reduced to plain structure with the editor's own borders. */
const pastedTablesHtml = (html: string): string => {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['colspan', 'rowspan', 'href'],
  });
  const container = document.createElement('div');
  container.innerHTML = clean;
  const tables = Array.from(container.querySelectorAll('table')).filter((table) => !table.parentElement?.closest('table'));
  if (!tables.length) return '';
  return tables
    .map((table) => {
      table.setAttribute('style', TABLE_STYLE);
      table.querySelectorAll('th, td').forEach((cell) => cell.setAttribute('style', CELL_STYLE));
      table.querySelectorAll('th').forEach((cell) => cell.setAttribute('style', `${CELL_STYLE} font-weight: 600;`));
      return `<div class="table-wrapper" style="overflow-x: auto;">${table.outerHTML}</div><p><br></p>`;
    })
    .join('');
};

export const RichTextEditor = ({ value, onChange, placeholder, className = '' }: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [linkUrl, setLinkUrl] = useState('');
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoAspectRatio, setVideoAspectRatio] = useState('16:9');
  const [videoWidth, setVideoWidth] = useState('100');
  const [isVideoPopoverOpen, setIsVideoPopoverOpen] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageWidth, setImageWidth] = useState('100');
  const [imageAlignment, setImageAlignment] = useState('center');
  const [isImagePopoverOpen, setIsImagePopoverOpen] = useState(false);
  const [imageError, setImageError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const savedSelectionRef = useRef<Range | null>(null);

  // Keep DOM as source of truth to avoid caret jumps on Enter
  useEffect(() => {
    if (!editorRef.current) return;
    const current = editorRef.current.innerHTML;
    if ((value || '') !== current) {
      editorRef.current.innerHTML = sanitizeHtml(value);
    }
  }, [value]);

  const execCommand = (command: string, commandValue?: string) => {
    document.execCommand(command, false, commandValue);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const cleanupHTML = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Remove empty video embeds
    const videoEmbeds = tempDiv.querySelectorAll('.video-embed');
    videoEmbeds.forEach((embed) => {
      const iframe = embed.querySelector('iframe');
      if (!iframe || !iframe.src) {
        embed.remove();
      }
    });
    
    // Image wrappers without an image: the browser splits the wrapper when Enter is pressed
    // next to the image, so text typed there lives in an image-less wrapper. Keep that text
    // as a plain paragraph and drop only truly empty wrappers.
    const imageWrappers = tempDiv.querySelectorAll('.image-wrapper');
    imageWrappers.forEach((wrapper) => {
      const img = wrapper.querySelector('img');
      if (img && img.src) return;
      if (wrapper.textContent?.trim()) {
        const paragraph = document.createElement('p');
        while (wrapper.firstChild) paragraph.appendChild(wrapper.firstChild);
        wrapper.replaceWith(paragraph);
      } else {
        wrapper.remove();
      }
    });
    
    // Remove consecutive empty paragraphs/divs (keep single empty lines)
    const allElements = Array.from(tempDiv.querySelectorAll('p, div, h1, h2, h3'));
    let consecutiveEmpty = 0;
    
    allElements.forEach((el, index) => {
      const text = el.textContent?.trim() || '';
      const hasContent = el.querySelector('img, iframe, video, .video-embed, .image-wrapper');
      
      if (!text && !hasContent) {
        consecutiveEmpty++;
        // Remove if this is the 2nd or more consecutive empty element
        if (consecutiveEmpty > 1) {
          el.remove();
        }
      } else {
        consecutiveEmpty = 0;
      }
    });
    
    return tempDiv.innerHTML;
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleSave = () => {
    if (editorRef.current) {
      const cleaned = cleanupHTML(editorRef.current.innerHTML);
      if (cleaned !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = cleaned;
        onChange(cleaned);
      }
    }
  };

  const insertHtmlAtCaret = (html: string, range?: Range | null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (range) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    document.execCommand('insertHTML', false, html);
    onChange(editorRef.current.innerHTML);
  };

  const pasteImage = async (file: File) => {
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    setUploadingImage(true);
    try {
      const publicUrl = await uploadImage(file, (ext) =>
        adminApi<{ path: string; token: string; publicUrl: string }>('upload-url', { ext }),
      );
      insertHtmlAtCaret(imageHtmlOf(publicUrl, '100', 'center'), range);
    } catch (error) {
      toast({ title: 'Paste Failed', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    // Tables (Excel, Word, web pages) keep their structure; checked before images because
    // spreadsheets also put a picture of the copied cells on the clipboard
    const tables = /<table[\s>]/i.test(html) ? pastedTablesHtml(html) : '';
    if (tables) {
      insertHtmlAtCaret(tables);
      return;
    }
    const image = Array.from(e.clipboardData.files).find((file) => file.type.startsWith('image/'));
    if (image) {
      void pasteImage(image);
      return;
    }
    const text = e.clipboardData.getData('text/plain');
    // Use insertText if supported; fallback to simple paste
    if (document.queryCommandSupported('insertText')) {
      document.execCommand('insertText', false, text);
    } else if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('paste');
    }
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0);
    }
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    if (savedSelectionRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(savedSelectionRef.current);
    }
  };

  const insertVideo = () => {
    setVideoError('');
    
    if (!videoUrl) {
      setVideoError('Please enter a video URL');
      return;
    }
    
    const { type, id } = extractVideoId(videoUrl);
    
    if (!type || !id) {
      setVideoError('Invalid YouTube or Vimeo URL. Please use formats like: youtube.com/watch?v=VIDEO_ID or vimeo.com/VIDEO_ID');
      return;
    }
    
    // Calculate padding-bottom for aspect ratio
    const aspectRatioPadding: Record<string, string> = {
      '16:9': '56.25%',
      '4:3': '75%',
      '1:1': '100%',
      '21:9': '42.86%'
    };
    
    const embedUrl = type === 'youtube' 
      ? `https://www.youtube.com/embed/${id}`
      : `https://player.vimeo.com/video/${id}`;
    
    const videoHtml = `
      <div class="video-embed" style="width: ${videoWidth}%; margin: 1rem auto;" data-width="${videoWidth}" data-ratio="${videoAspectRatio}">
        <div style="position: relative; padding-bottom: ${aspectRatioPadding[videoAspectRatio]}; height: 0; overflow: hidden;">
          <iframe 
            src="${embedUrl}" 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 0.5rem;"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      </div>
    `;
    
    if (editorRef.current) {
      editorRef.current.focus();
      
      if (savedSelectionRef.current) {
        restoreSelection();
      }
      
      document.execCommand('insertHTML', false, videoHtml);
      onChange(editorRef.current.innerHTML);
    }
    
    setVideoUrl('');
    setVideoAspectRatio('16:9');
    setVideoWidth('100');
    setIsVideoPopoverOpen(false);
    setVideoError('');
    savedSelectionRef.current = null;
  };

  const insertLink = () => {
    if (!/^(https?:\/\/|mailto:)/i.test(linkUrl.trim())) {
      toast({ title: 'Invalid Link', description: 'Links must start with https://, http:// or mailto:', variant: 'destructive' });
      return;
    }
    if (linkUrl && savedSelectionRef.current) {
      restoreSelection();
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        
        if (selectedText) {
          // Create link element
          const link = document.createElement('a');
          link.href = linkUrl.trim();
          link.textContent = selectedText;
          link.style.color = 'hsl(var(--primary))';
          link.style.textDecoration = 'underline';
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
          
          // Replace selection with link
          range.deleteContents();
          range.insertNode(link);
          
          // Move cursor after link
          range.setStartAfter(link);
          range.setEndAfter(link);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
      
      setLinkUrl('');
      setIsLinkPopoverOpen(false);
      savedSelectionRef.current = null;
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setImageError('');

    try {
      const publicUrl = await uploadImage(file, (ext) =>
        adminApi<{ path: string; token: string; publicUrl: string }>('upload-url', { ext }),
      );
      setImageUrl(publicUrl);

      toast({
        title: 'Image Uploaded',
        description: 'Your image has been uploaded successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const insertImage = () => {
    setImageError('');
    
    if (!imageUrl) {
      setImageError('Please enter or upload an image');
      return;
    }
    
    const imageHtml = imageHtmlOf(imageUrl, imageWidth, imageAlignment);
    
    if (editorRef.current) {
      editorRef.current.focus();
      
      if (savedSelectionRef.current) {
        restoreSelection();
      }
      
      document.execCommand('insertHTML', false, imageHtml);
      onChange(editorRef.current.innerHTML);
    }
    
    setImageUrl('');
    setImageWidth('100');
    setImageAlignment('center');
    setIsImagePopoverOpen(false);
    setImageError('');
    savedSelectionRef.current = null;
  };

  return (
    <div className={`border border-border rounded-lg ${className}`}>
      <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('bold')}
          className="h-8 w-8 p-0"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('italic')}
          className="h-8 w-8 p-0"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('insertUnorderedList')}
          className="h-8 w-8 p-0"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('insertOrderedList')}
          className="h-8 w-8 p-0"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('formatBlock', '<h1>')}
          className="h-8 w-8 p-0"
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('formatBlock', '<h2>')}
          className="h-8 w-8 p-0"
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('formatBlock', '<h3>')}
          className="h-8 w-8 p-0"
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('formatBlock', '<p>')}
          className="h-8 px-2"
          title="Paragraph"
        >
          P
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={saveSelection}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Insert Link</h4>
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && insertLink()}
              />
              <Button onClick={insertLink} size="sm" className="w-full">
                Insert
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Popover open={isVideoPopoverOpen} onOpenChange={setIsVideoPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={saveSelection}
              title="Insert Video"
            >
              <Video className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Insert Video</h4>
              <Input
                placeholder="YouTube or Vimeo URL"
                value={videoUrl}
                onChange={(e) => {
                  setVideoUrl(e.target.value);
                  setVideoError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && insertVideo()}
              />
              {videoError && (
                <p className="text-xs text-destructive">{videoError}</p>
              )}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Aspect Ratio</label>
                <Select value={videoAspectRatio} onValueChange={setVideoAspectRatio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Standard)</SelectItem>
                    <SelectItem value="4:3">4:3 (Classic)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                    <SelectItem value="21:9">21:9 (Ultrawide)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Width</label>
                <Select value={videoWidth} onValueChange={setVideoWidth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25%</SelectItem>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="75">75%</SelectItem>
                    <SelectItem value="100">100% (Full Width)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={insertVideo} size="sm" className="w-full">
                Insert Video
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Popover 
          open={isImagePopoverOpen} 
          onOpenChange={(open) => {
            if (open) {
              saveSelection();
            }
            setIsImagePopoverOpen(open);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent focus loss
                saveSelection();
              }}
              title="Insert Image"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Insert Image</h4>
              <div className="space-y-2">
                <Label htmlFor="image-upload" className="text-xs text-muted-foreground">Upload Image</Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Max 2MB. Formats: JPG, PNG, GIF, WEBP
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-popover px-2 text-muted-foreground">Or enter URL</span>
                </div>
              </div>
              <Input
                placeholder="Image URL"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && !uploadingImage && insertImage()}
                disabled={uploadingImage}
              />
              {imageError && (
                <p className="text-xs text-destructive">{imageError}</p>
              )}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Width</label>
                <Select value={imageWidth} onValueChange={setImageWidth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25%</SelectItem>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="75">75%</SelectItem>
                    <SelectItem value="100">100% (Full Width)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Alignment</label>
                <Select value={imageAlignment} onValueChange={setImageAlignment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={insertImage} size="sm" className="w-full" disabled={uploadingImage}>
                {uploadingImage ? 'Uploading...' : 'Insert Image'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('justifyLeft')}
          className="h-8 w-8 p-0"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('justifyCenter')}
          className="h-8 w-8 p-0"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('justifyRight')}
          className="h-8 w-8 p-0"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => execCommand('justifyFull')}
          className="h-8 w-8 p-0"
        >
          <AlignJustify className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleSave}
          onPaste={handlePaste}
          className="min-h-[100px] p-3 focus:outline-none prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2 [&_*]:text-inherit"
          suppressContentEditableWarning
        />
        {!value && (
          <div className="absolute top-3 left-3 text-muted-foreground pointer-events-none">
            {placeholder}
          </div>
        )}
        {uploadingImage && !isImagePopoverOpen && (
          <div className="absolute right-3 top-3 rounded bg-muted px-2 py-1 text-xs text-muted-foreground pointer-events-none">
            Uploading image…
          </div>
        )}
      </div>
    </div>
  );
};
