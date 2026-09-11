"use client";

import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DashboardProps {
  channel: "all" | "smartstore" | "cafe24" | "coupang";
  startDate?: string;
  endDate?: string;
}

interface DailyRevenue {
  date: string;
  revenue: number;
}

interface TopProduct {
  name: string;
  quantity: number;
}

interface PaymentMethod {
  name: string;
  value: number;
}

interface StatsData {
  kpi: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
  };
  dailyRevenue: DailyRevenue[];
  topProducts: TopProduct[];
  paymentMethods: PaymentMethod[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function Dashboard({
  channel,
  startDate,
  endDate,
}: DashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const hasGeneratedSummary = useRef(false);
  const isFirstChannelRender = useRef(true);

  const fetchSummary = async (ch: string) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await fetch(
        `/api/ai-summary?channel=${encodeURIComponent(ch)}`
      );
      const data = await response.json();
      if (!response.ok) {
        setSummaryError(data.error || "AI 요약을 가져오지 못했어요");
        setSummary(null);
      } else {
        setSummary(data.summary);
      }
    } catch (error) {
      setSummaryError(`AI 요약 실패: ${String(error)}`);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleAiSummaryClick = () => {
    hasGeneratedSummary.current = true;
    fetchSummary(channel);
  };

  useEffect(() => {
    if (isFirstChannelRender.current) {
      isFirstChannelRender.current = false;
      return;
    }
    if (hasGeneratedSummary.current) {
      fetchSummary(channel);
    }
  }, [channel]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const params = new URLSearchParams({ channel });
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);

        const response = await fetch(`/api/stats?${params.toString()}`);
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [channel, startDate, endDate]);

  if (loading) {
    return <div className="text-center py-8">데이터 로딩 중...</div>;
  }

  if (!stats) {
    return <div className="text-center py-8">데이터가 없습니다</div>;
  }

  const { kpi, dailyRevenue, topProducts, paymentMethods } = stats;

  const formatCurrency = (value: number) => {
    return `₩${value.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* 이번 주 요약 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">이번 주 요약</h2>
          <button
            onClick={handleAiSummaryClick}
            disabled={summaryLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
          >
            {summaryLoading ? "생성 중..." : "AI 요약"}
          </button>
        </div>
        {summaryError && (
          <p className="text-red-500 text-sm">{summaryError}</p>
        )}
        {summary && !summaryLoading && (
          <p className="text-gray-700 whitespace-pre-line leading-relaxed">
            {summary}
          </p>
        )}
        {!summary && !summaryError && !summaryLoading && (
          <p className="text-gray-400 text-sm">
            AI 요약 버튼을 눌러 이번 주 매출을 확인하세요
          </p>
        )}
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">총매출</p>
          <p className="text-2xl font-bold mt-2">
            {formatCurrency(kpi.totalRevenue)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">주문수</p>
          <p className="text-2xl font-bold mt-2">
            {kpi.totalOrders.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">객단가</p>
          <p className="text-2xl font-bold mt-2">
            {formatCurrency(kpi.avgOrderValue)}
          </p>
        </div>
      </div>

      {/* 날짜별 매출 선 그래프 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">날짜별 매출</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyRevenue}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value) => formatCurrency(value as number)}
              labelFormatter={(label) => `날짜: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#3b82f6"
              dot={{ r: 4 }}
              name="매출"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 상품 상위 5 & 결제수단 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 상품 상위 5 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">상품 상위 5</h2>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400">상품 데이터가 없습니다</p>
          )}
        </div>

        {/* 결제수단 원형 그래프 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">결제수단</h2>
          {paymentMethods.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethods}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) =>
                    `${name}: ${formatCurrency(value)}`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethods.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400">결제수단 데이터가 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
}
