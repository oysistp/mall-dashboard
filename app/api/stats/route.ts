import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase 환경변수가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    const channel = request.nextUrl.searchParams.get("channel") || "all";
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase.from("orders").select("*");

    // 채널 필터
    if (channel !== "all") {
      const channelName = channel === "smartstore" ? "스마트스토어" : "카페24";
      query = query.eq("channel", channelName);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: `데이터 조회 실패: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        kpi: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
        dailyRevenue: [],
        topProducts: [],
        paymentMethods: [],
      });
    }

    // KPI 계산
    const validOrders = (data as any[]).filter((o) => !o.is_cancelled);
    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const uniqueOrderNumbers = new Set(validOrders.map((o) => o.order_number));
    const totalOrders = uniqueOrderNumbers.size;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // 날짜별 매출
    const dailyMap = new Map<string, number>();
    validOrders.forEach((o) => {
      const date = o.order_date || "unknown";
      dailyMap.set(date, (dailyMap.get(date) || 0) + (o.amount || 0));
    });
    const dailyRevenue = Array.from(dailyMap.entries())
      .map(([date, revenue]) => ({
        date,
        revenue: Math.round(revenue),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 상품 상위 5
    const productMap = new Map<string, number>();
    validOrders.forEach((o) => {
      const product = o.product_name || "unknown";
      productMap.set(product, (productMap.get(product) || 0) + (o.quantity || 0));
    });
    const topProducts = Array.from(productMap.entries())
      .map(([name, qty]) => ({
        name,
        quantity: qty,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // 결제수단
    const paymentMap = new Map<string, number>();
    validOrders.forEach((o) => {
      const method = o.payment_method || "unknown";
      paymentMap.set(method, (paymentMap.get(method) || 0) + (o.amount || 0));
    });
    const paymentMethods = Array.from(paymentMap.entries()).map(
      ([name, value]) => ({
        name,
        value: Math.round(value),
      })
    );

    return NextResponse.json({
      kpi: {
        totalRevenue: Math.round(totalRevenue),
        totalOrders,
        avgOrderValue: Math.round(avgOrderValue),
      },
      dailyRevenue,
      topProducts,
      paymentMethods,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: `통계 조회 실패: ${String(error)}` },
      { status: 500 }
    );
  }
}
