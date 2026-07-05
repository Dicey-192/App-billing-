import React, { useState, useEffect } from 'react';
import { Tenant, Property } from '../types';
import { X, Download, Share2, Clipboard, Check, Image, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReceiptSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant | null;
  property: Property | null;
  imageUrl: string | null;
  imageBlob: Blob | null;
  filename: string;
}

export const ReceiptSaveModal: React.FC<ReceiptSaveModalProps> = ({
  isOpen,
  onClose,
  tenant,
  property,
  imageUrl,
  imageBlob,
  filename,
}) => {
  const [copied, setCopied] = useState(false);
  const [shareSupported, setShareSupported] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Check if Web Share API is available safely
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share !== 'undefined') {
      setShareSupported(true);
    } else {
      setShareSupported(false);
    }
  }, []);

  const handleShareToGallery = async () => {
    if (!imageBlob || !imageUrl) return;
    setShareError(null);
    try {
      const shareData: ShareData = {
        title: `Receipt for ${tenant?.name || 'Tenant'}`,
        text: `Rent receipt for Room ${tenant?.roomNumber || ''} - ${property?.name || ''}`,
      };

      if (typeof File !== 'undefined' && typeof navigator.canShare !== 'undefined') {
        try {
          const file = new File([imageBlob], filename, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        } catch (fileErr) {
          console.warn('Could not create file for sharing:', fileErr);
        }
      }
      
      await navigator.share(shareData);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
        setShareError(err.message || 'Unable to open system share menu.');
      }
    }
  };

  const handleCopyImage = async () => {
    if (!imageBlob) return;
    try {
      if (typeof window !== 'undefined' && 'ClipboardItem' in window) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({
            'image/png': imageBlob,
          }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error('ClipboardItem not supported');
      }
    } catch (err) {
      console.warn('Failed to copy image binary, falling back to URL copy:', err);
      // Fallback: copy data URL as text if writing binary image fails
      try {
        if (imageUrl) {
          await navigator.clipboard.writeText(imageUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch (textErr) {
        console.error('Text copy fallback failed:', textErr);
      }
    }
  };

  const handleDownloadFallback = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !tenant) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative glass-panel rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.6)] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/10 bg-slate-900"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Image className="w-5 h-5 text-amber-500" />
                Receipt Save Center
              </h3>
              <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider mt-0.5">
                In-app downloader and mobile gallery portal
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col items-center space-y-6">
            
            {/* Action Panel */}
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Button 1: Share / Save to Gallery */}
              <button
                onClick={handleShareToGallery}
                disabled={!shareSupported}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center group cursor-pointer ${
                  shareSupported
                    ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-400 hover:border-amber-500/40'
                    : 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Share2 className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-[11px] uppercase tracking-wider">Save to Gallery</span>
                <span className="text-[8px] opacity-75 mt-0.5 leading-tight">
                  {shareSupported ? 'Share sheet & photos' : 'Not supported on this browser'}
                </span>
              </button>

              {/* Button 2: Copy to Clipboard */}
              <button
                onClick={handleCopyImage}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border bg-[#111111] border-white/5 hover:bg-white/5 hover:border-white/10 text-white text-center group cursor-pointer transition-all"
              >
                {copied ? (
                  <Check className="w-6 h-6 mb-2 text-green-400 scale-110" />
                ) : (
                  <Clipboard className="w-6 h-6 mb-2 text-[#A3A3A3] group-hover:scale-110 transition-transform" />
                )}
                <span className="font-bold text-[11px] uppercase tracking-wider">
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </span>
                <span className="text-[8px] text-[#A3A3A3] mt-0.5 leading-tight">
                  Paste directly into WhatsApp/Chat
                </span>
              </button>

              {/* Button 3: Fallback Download File */}
              <button
                onClick={handleDownloadFallback}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white text-center group cursor-pointer transition-all"
              >
                <Download className="w-6 h-6 mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-[11px] uppercase tracking-wider">Download Image File</span>
                <span className="text-[8px] text-[#A3A3A3] mt-0.5 leading-tight">
                  Direct browser file save
                </span>
              </button>
            </div>

            {/* Error Banner */}
            {shareError && (
              <div className="w-full p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-2 text-[10px]">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold uppercase">Save Portal Message:</span>
                  <p className="mt-0.5 opacity-80">{shareError}</p>
                </div>
              </div>
            )}

            {/* mobile tip */}
            <div className="w-full p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-left">
              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                💡 Mobile & Tablet Instruction
              </p>
              <p className="text-[10px] text-[#A3A3A3] leading-relaxed">
                If your browser limits automatic downloads inside sandboxed frame environments, simply{' '}
                <span className="text-white font-semibold">tap and hold (long-press)</span> on the receipt image preview below to directly choose{' '}
                <span className="text-amber-400 font-bold">"Save Image"</span> or{' '}
                <span className="text-amber-400 font-bold">"Add to Photos"</span> to send it straight to your native device gallery.
              </p>
            </div>

            {/* Live Receipt Image Preview */}
            <div className="w-full flex flex-col items-center">
              <span className="text-[9px] text-[#A3A3A3] uppercase tracking-widest font-bold mb-2">
                Live High-Res Generated Image Preview:
              </span>
              <div className="w-full max-w-[480px] bg-slate-950 p-2 rounded-2xl border border-white/5 shadow-2xl overflow-hidden relative group">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Rentflo Receipt"
                    className="w-full rounded-xl object-contain select-text border border-white/10"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-80 flex flex-col items-center justify-center text-slate-500 space-y-2">
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs uppercase font-bold tracking-wider">Generating high-res image...</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="bg-slate-900/90 text-white font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-white/10">
                    Long Press Image to Save
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/10 flex items-center justify-end bg-slate-950/30 gap-3">
            <span className="text-[8px] font-mono text-slate-500 mr-auto uppercase hidden sm:inline">
              File: {filename}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl border border-white/5 cursor-pointer transition-colors"
            >
              Close Save Portal
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
