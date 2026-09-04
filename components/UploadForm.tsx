"use client";

import { useRef } from "react";

interface UploadFormProps {
  onUpload: (file: File) => Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
}

export default function UploadForm({
  onUpload,
  isLoading,
  disabled = false,
}: UploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        onChange={handleChange}
        disabled={disabled || isLoading}
        style={{ display: "none" }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isLoading}
        className={`px-4 py-2 rounded ${
          disabled || isLoading
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-green-500 text-white hover:bg-green-600"
        }`}
      >
        {isLoading ? "업로드 중..." : "주문 파일 올리기"}
      </button>
    </div>
  );
}
