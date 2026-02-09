'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { useState, useCallback } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, Image as ImageIcon,
  Link as LinkIcon, List, ListOrdered, Quote, Code, Heading1,
  Heading2, Heading3, Undo, Redo, Palette, Highlighter,
  Code2, Eye, MonitorPlay,
} from 'lucide-react'

interface BioEditorProps {
  initialContent: string
  onSave: (html: string) => void
  saving?: boolean
}

export default function BioEditor({ initialContent, onSave, saving }: BioEditorProps) {
  const [mode, setMode] = useState<'visual' | 'code' | 'preview'>('visual')
  const [codeContent, setCodeContent] = useState(initialContent || '')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({ inline: true, allowBase64: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none min-h-[200px] focus:outline-none px-4 py-3 text-nouveau-cream/90',
      },
    },
    onUpdate: ({ editor }) => {
      setCodeContent(editor.getHTML())
    },
  })

  const addImage = useCallback(() => {
    const url = window.prompt('ใส่ URL ของรูปภาพ:')
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const addLink = useCallback(() => {
    const url = window.prompt('ใส่ URL ลิงก์:')
    if (url && editor) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }, [editor])

  const setColor = useCallback(() => {
    const color = window.prompt('ใส่สี (เช่น #D4AF37, red):')
    if (color && editor) {
      editor.chain().focus().setColor(color).run()
    }
  }, [editor])

  function handleSwitchToVisual() {
    if (editor) {
      editor.commands.setContent(codeContent)
    }
    setMode('visual')
  }

  function handleSwitchToCode() {
    if (editor) {
      setCodeContent(editor.getHTML())
    }
    setMode('code')
  }

  function handleSwitchToPreview() {
    if (mode === 'visual' && editor) {
      setCodeContent(editor.getHTML())
    }
    setMode('preview')
  }

  function handleSave() {
    if (mode === 'code' || mode === 'preview') {
      onSave(codeContent)
    } else if (editor) {
      onSave(editor.getHTML())
    }
  }

  if (!editor) return null

  const ToolButton = ({ onClick, active, children, title }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title?: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-sm cursor-pointer transition-colors
        ${active ? 'bg-gold-400/20 text-gold-400' : 'text-victorian-400 hover:text-gold-400 hover:bg-white/5'}`}
    >
      {children}
    </button>
  )

  return (
    <div className="border border-gold-400/20 rounded-md overflow-hidden bg-victorian-950/40">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-gold-400/10 bg-victorian-950/60">
        {/* Mode switch */}
        <div className="flex items-center gap-1 mr-2 pr-2 border-r border-gold-400/10">
          <ToolButton onClick={handleSwitchToVisual} active={mode === 'visual'} title="Visual Editor">
            <Eye className="w-4 h-4" />
          </ToolButton>
          <ToolButton onClick={handleSwitchToCode} active={mode === 'code'} title="HTML Code">
            <Code2 className="w-4 h-4" />
          </ToolButton>
          <ToolButton onClick={handleSwitchToPreview} active={mode === 'preview'} title="Preview">
            <MonitorPlay className="w-4 h-4" />
          </ToolButton>
        </div>

        {mode === 'visual' && (
          <>
            {/* Undo/Redo */}
            <ToolButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
              <Undo className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
              <Redo className="w-4 h-4" />
            </ToolButton>

            <div className="w-px h-5 bg-gold-400/10 mx-1" />

            {/* Headings */}
            <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1">
              <Heading1 className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2">
              <Heading2 className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3">
              <Heading3 className="w-4 h-4" />
            </ToolButton>

            <div className="w-px h-5 bg-gold-400/10 mx-1" />

            {/* Formatting */}
            <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
              <Bold className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
              <Italic className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
              <UnderlineIcon className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
              <Strikethrough className="w-4 h-4" />
            </ToolButton>

            <div className="w-px h-5 bg-gold-400/10 mx-1" />

            {/* Color / Highlight */}
            <ToolButton onClick={setColor} title="Text Color">
              <Palette className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleHighlight({ color: '#D4AF37' }).run()} active={editor.isActive('highlight')} title="Highlight">
              <Highlighter className="w-4 h-4" />
            </ToolButton>

            <div className="w-px h-5 bg-gold-400/10 mx-1" />

            {/* Alignment */}
            <ToolButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
              <AlignLeft className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
              <AlignCenter className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
              <AlignRight className="w-4 h-4" />
            </ToolButton>

            <div className="w-px h-5 bg-gold-400/10 mx-1" />

            {/* Lists */}
            <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
              <List className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered List">
              <ListOrdered className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">
              <Quote className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code Block">
              <Code className="w-4 h-4" />
            </ToolButton>

            <div className="w-px h-5 bg-gold-400/10 mx-1" />

            {/* Media */}
            <ToolButton onClick={addImage} title="Insert Image (URL)">
              <ImageIcon className="w-4 h-4" />
            </ToolButton>
            <ToolButton onClick={addLink} active={editor.isActive('link')} title="Insert Link">
              <LinkIcon className="w-4 h-4" />
            </ToolButton>
          </>
        )}
      </div>

      {/* Content Area */}
      {mode === 'visual' && (
        <EditorContent editor={editor} className="min-h-[200px] bg-victorian-950/30" />
      )}
      {mode === 'code' && (
        <textarea
          value={codeContent}
          onChange={e => setCodeContent(e.target.value)}
          className="w-full min-h-[200px] bg-victorian-950 text-nouveau-cream/90 font-mono text-sm p-4 
                     focus:outline-none resize-y border-none"
          placeholder="<p>เขียน HTML ได้เลย...</p>"
          spellCheck={false}
        />
      )}
      {mode === 'preview' && (
        <div className="min-h-[200px] bg-victorian-950/20">
          {codeContent && codeContent !== '<p></p>' ? (
            <BioRenderer html={codeContent} />
          ) : (
            <p className="text-victorian-500 text-sm italic p-4">ไม่มีเนื้อหาสำหรับตัวอย่าง...</p>
          )}
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gold-400/10 bg-victorian-950/60">
        <p className="text-victorian-500 text-[10px]">
          {mode === 'code' ? 'โหมด HTML — รองรับ CSS inline, Google Fonts, link/style tags' : mode === 'preview' ? 'โหมดตัวอย่าง (Preview)' : 'โหมด Visual Editor'}
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-gold !py-1.5 !px-4 !text-sm disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกประวัติ'}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   BIO RENDERER — Isolated sandbox using iframe
   Allows external CSS, Google Fonts, link/style tags
   without affecting the main app
   ══════════════════════════════════════════════ */
export function BioRenderer({ html, className }: { html: string; className?: string }) {
  if (!html || html === '<p></p>') return null

  const iframeDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Kanit', sans-serif;
      color: #F5F0E1;
      background: transparent;
      padding: 16px;
      line-height: 1.7;
      font-size: 14px;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    a { color: #D4AF37; text-decoration: underline; }
    a:hover { color: #C5A55A; }
    img { max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0; }
    h1 { font-size: 1.8em; color: #D4AF37; margin: 0.5em 0; }
    h2 { font-size: 1.4em; color: #D4AF37; margin: 0.5em 0; }
    h3 { font-size: 1.15em; color: #C5A55A; margin: 0.4em 0; }
    p { margin: 0.4em 0; }
    ul, ol { padding-left: 1.5em; margin: 0.4em 0; }
    blockquote { border-left: 3px solid #D4AF37; padding-left: 1em; margin: 0.5em 0; color: #A89070; }
    code { background: rgba(212,175,55,0.1); padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #0F0D0A; padding: 12px; border-radius: 4px; overflow-x: auto; margin: 0.5em 0; }
    pre code { background: none; padding: 0; }
    mark { background: rgba(212,175,55,0.3); color: #F5F0E1; padding: 1px 4px; }
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600&display=swap" rel="stylesheet">
</head>
<body>${html}</body>
<script>
  // Auto-resize iframe to content height
  function postHeight() {
    const h = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: 'bio-iframe-height', height: h }, '*');
  }
  window.addEventListener('load', postHeight);
  new MutationObserver(postHeight).observe(document.body, { childList: true, subtree: true, attributes: true });
  // Also resize after images load
  document.querySelectorAll('img').forEach(img => img.addEventListener('load', postHeight));
  setTimeout(postHeight, 500);
</script>
</html>`

  return (
    <iframe
      srcDoc={iframeDoc}
      sandbox="allow-scripts allow-same-origin"
      className={`w-full border-0 ${className || ''}`}
      style={{ minHeight: 60, background: 'transparent' }}
      onLoad={(e) => {
        const iframe = e.currentTarget
        // Listen for height messages
        const handler = (ev: MessageEvent) => {
          if (ev.data?.type === 'bio-iframe-height') {
            iframe.style.height = ev.data.height + 'px'
          }
        }
        window.addEventListener('message', handler)
        // Cleanup on unmount handled by React
      }}
    />
  )
}
