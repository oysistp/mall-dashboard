"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [uploadChannel, setUploadChannel] = useState<
    "smartstore" | "cafe24" | "coupang" | null
  >(null);
  const [filterChannel, setFilterChannel] = useState<
    "all" | "smartstore" | "cafe24" | "coupang"
  >("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpload = async (file: File) => {
    if (!uploadChannel) {
      setMessage("채널을 선택하세요");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("channel", uploadChannel);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(`오류: ${data.error}`);
      } else {
        setMessage(`✓ ${data.message}`);
        setUploadChannel(null);
      }
    } catch (error) {
      setMessage(`업로드 실패: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">채널 통합 매출 대시보드</h1>

        {/* 채널 선택 & 파일 업로드 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-2">
                채널 선택
              </label>
              <select
                value={uploadChannel || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setUploadChannel(
                    value === ""
                      ? null
                      : (value as "smartstore" | "cafe24" | "coupang")
                  );
                }}
                className="border rounded px-3 py-2"
              >
                <option value="">-- 선택하세요 --</option>
                <option value="smartstore">스마트스토어</option>
                <option value="cafe24">카페24</option>
                <option value="coupang">쿠팡</option>
              </select>
            </div>

            <UploadForm
              onUpload={handleUpload}
              isLoading={isLoading}
              disabled={!uploadChannel}
            />
          </div>

          {message && (
            <p className="mt-4 text-sm font-medium text-gray-700">{message}</p>
          )}
        </div>

        {/* 기간 선택 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-2">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border rounded px-3 py-2"
              />
            </div>
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              초기화
            </button>
          </div>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilterChannel("all")}
            className={`px-4 py-2 rounded ${
              filterChannel === "all"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilterChannel("smartstore")}
            className={`px-4 py-2 rounded ${
              filterChannel === "smartstore"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            스마트스토어
          </button>
          <button
            onClick={() => setFilterChannel("cafe24")}
            className={`px-4 py-2 rounded ${
              filterChannel === "cafe24"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            카페24
          </button>
          <button
            onClick={() => setFilterChannel("coupang")}
            className={`px-4 py-2 rounded ${
              filterChannel === "coupang"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            쿠팡
          </button>
        </div>

        {/* 대시보드 */}
        <Dashboard
          channel={filterChannel}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
    </div>
  );
}
