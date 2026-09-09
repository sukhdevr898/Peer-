import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  File as FileIcon,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Video,
  Code,
  Download,
  CheckCircle2,
  AlertCircle,
  Zap,
  Radio,
  Server,
  X,
  ExternalLink,
} from 'lucide-react';
import { FileTransfer } from '../types';

interface FileTransferHubProps {
  transfers: FileTransfer[];
  onSendFile: (file: File) => void;
  selectedPeerName?: string;
}

export const FileTransferHub: React.FC<FileTransferHubProps> = ({
  transfers,
  onSendFile,
  selectedPeerName,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file) => onSendFile(file));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file) => onSendFile(file));
      e.target.value = '';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSec: number): string => {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const getFileIcon = (fileName: string, type: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || type.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    }
    if (['mp4', 'mkv', 'mov', 'webm'].includes(ext) || type.startsWith('video/')) {
      return <Video className="w-5 h-5 text-purple-400" />;
    }
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
      return <FileArchive className="w-5 h-5 text-amber-400" />;
    }
    if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'html', 'css'].includes(ext)) {
      return <Code className="w-5 h-5 text-cyan-400" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) {
      return <FileText className="w-5 h-5 text-blue-400" />;
    }
    return <FileIcon className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Drag & Drop File Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer select-none overflow-hidden ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-950/30 scale-[0.99]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Drop files here or <span className="text-indigo-400 hover:underline">browse</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Encrypted chunk-by-chunk with AES-256-GCM. Any size, any type.
              {selectedPeerName && (
                <span className="text-indigo-300 font-medium"> Sending to: {selectedPeerName}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Transfers List */}
      {transfers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active & Recent Transfers ({transfers.length})
            </h4>
          </div>

          <div className="space-y-2.5">
            {transfers.map((t) => {
              const isDone = t.status === 'completed';
              const isTransferring = t.status === 'transferring';
              const isFailed = t.status === 'failed';

              return (
                <div
                  key={t.id}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center shrink-0">
                        {getFileIcon(t.fileName, t.fileType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate max-w-xs md:max-w-md">
                          {t.fileName}
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                          <span>{formatBytes(t.fileSize)}</span>
                          <span>•</span>
                          <span>{t.direction === 'upload' ? 'To' : 'From'}: {t.peerName}</span>
                          <span>•</span>
                          {t.isLocalNetwork ? (
                            <span className="text-emerald-400 flex items-center gap-0.5 font-sans">
                              <Zap className="w-3 h-3" /> LAN Turbo
                            </span>
                          ) : t.isRelayed ? (
                            <span className="text-indigo-400 flex items-center gap-0.5 font-sans">
                              <Server className="w-3 h-3" /> Relayed
                            </span>
                          ) : (
                            <span className="text-cyan-400 flex items-center gap-0.5 font-sans">
                              <Radio className="w-3 h-3" /> P2P
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Actions / Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isDone && t.blobUrl && (
                        <a
                          href={t.blobUrl}
                          download={t.fileName}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </a>
                      )}
                      {isDone && !t.blobUrl && (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Uploaded</span>
                        </span>
                      )}
                      {isFailed && (
                        <span className="flex items-center gap-1 text-rose-400 text-xs font-medium">
                          <AlertCircle className="w-4 h-4" />
                          <span>Failed</span>
                        </span>
                      )}
                      {isTransferring && (
                        <span className="text-xs font-mono text-indigo-400 font-semibold">
                          {t.progress}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden relative">
                    <div
                      className={`h-full transition-all duration-200 ${
                        isDone
                          ? 'bg-emerald-500'
                          : isFailed
                          ? 'bg-rose-500'
                          : 'bg-gradient-to-r from-indigo-500 to-emerald-400'
                      }`}
                      style={{ width: `${t.progress}%` }}
                    />
                  </div>

                  {/* Transfer Speed & Verification Hash Footer */}
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <div>
                      {isTransferring && (
                        <span className="text-indigo-300">
                          {formatBytes(t.transferredBytes)} / {formatBytes(t.fileSize)} ({formatSpeed(t.speed)})
                        </span>
                      )}
                      {isDone && (
                        <span className="text-slate-400">
                          Transfer verified • 100% complete
                        </span>
                      )}
                    </div>

                    {t.sha256 && (
                      <span className="truncate max-w-[140px] text-slate-500" title={`SHA-256 Checksum: ${t.sha256}`}>
                        SHA: {t.sha256.slice(0, 10)}...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
