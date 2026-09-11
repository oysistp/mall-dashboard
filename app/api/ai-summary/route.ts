import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const baseUrl = process.env.AXROUTER_BASE_URL;
    const apiKey = process.env.AXROUTER_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase 환경변수가 설정되지 않았습니다" },
        { status: 500 }
      );
    }
    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "AI 환경변수가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    const channel = request.nextUrl.searchParams.get("channel") || "all";
    const channelLabel =
      channel === "smartstore"
        ? "스마트스토어"
        : channel === "cafe24"
        ? "카페24"
        : channel === "coupang"
        ? "쿠팡"
        : "전체";

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase.from("orders").select("*");
    if (channel !== "all") {
      query = query.eq("channel", channelLabel);
    }

    const today = new Date();
    const currentStart = addDays(today, -6);
    const prevEnd = addDays(currentStart, -1);
    const prevStart = addDays(currentStart, -7);

    const todayStr = formatDate(today);
    const currentStartStr = formatDate(currentStart);
    const prevStartStr = formatDate(prevStart);
    const prevEndStr = formatDate(prevEnd);

    query = query.gte("order_date", prevStartStr).lte("order_date", todayStr);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: `데이터 조회 실패: ${error.message}` },
        { status: 500 }
      );
    }

    const orders = (data as any[]) || [];

    const currentOrders = orders.filter(
      (o) => o.order_date >= currentStartStr && o.order_date <= todayStr
    );
    const prevOrders = orders.filter(
      (o) => o.order_date >= prevStartStr && o.order_date <= prevEndStr
    );

    const validCurrent = currentOrders.filter((o) => !o.is_cancelled);
    const validPrev = prevOrders.filter((o) => !o.is_cancelled);

    const sum = (list: any[]) => list.reduce((s, o) => s + (o.amount || 0), 0);
    const countOrders = (list: any[]) =>
      new Set(list.map((o) => o.order_number)).size;

    if (currentOrders.length === 0) {
      return NextResponse.json({
        summary: `${channelLabel} 채널에는 최근 데이터가 없어요.`,
      });
    }

    const productMap = new Map<string, number>();
    validCurrent.forEach((o) => {
      const name = o.product_name || "알 수 없음";
      productMap.set(name, (productMap.get(name) || 0) + (o.quantity || 0));
    });
    const topProducts = Array.from(productMap.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const daysAvailable = new Set(currentOrders.map((o) => o.order_date)).size;

    const facts = {
      채널: channelLabel,
      분석기간: `${currentStartStr} ~ ${todayStr}`,
      실제_데이터_보유일수: daysAvailable,
      "7일치_데이터_아님": daysAvailable < 7,
      이번기간: {
        총매출: Math.round(sum(validCurrent)),
        주문수: countOrders(validCurrent),
        취소건수: currentOrders.filter((o) => o.is_cancelled).length,
      },
      지난기간: {
        총매출: Math.round(sum(validPrev)),
        주문수: countOrders(validPrev),
        취소건수: prevOrders.filter((o) => o.is_cancelled).length,
      },
      많이_팔린_상품: topProducts,
    };

    const systemPrompt = `너는 온라인 쇼핑몰 사장님에게 매출을 브리핑하는 데이터 비서야. 아래 JSON 데이터만 근거로 요약을 작성해.

규칙:
1. 총매출과 주문수를 먼저 말하고, 지난 7일(지난기간)과 비교해서 늘었는지 줄었는지 말해.
2. 많이 팔린 상품과 눈에 띄는 변화를 짚어줘.
3. 확인이 필요한 이상한 점(예: 취소 급증)이 있으면 알려줘. 특별히 이상한 점이 없으면 억지로 만들지 마.
4. 매출·주문수는 이미 취소 주문을 제외한 수치야.
5. "7일치_데이터_아님"이 true면, 아직 데이터가 7일치가 안 돼서 있는 기간(실제_데이터_보유일수)만큼만 봤다는 걸 먼저 짧게 말해줘.
6. 전체 답변은 세 줄 이내로, 사장님한테 편하게 구어체로 존댓말로 말해줘. 숫자는 쉼표나 "만 원" 단위를 자연스럽게 써줘.
7. 데이터에 없는 내용은 지어내지 마.`;

    const aiRes = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: JSON.stringify(facts) }],
      }),
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) {
      return NextResponse.json({ error: aiData }, { status: aiRes.status });
    }

    const textBlock = aiData.content?.find(
      (block: { type: string }) => block.type === "text"
    );

    return NextResponse.json({
      summary: textBlock?.text ?? "AI 응답을 가져오지 못했어요.",
    });
  } catch (error) {
    console.error("AI summary error:", error);
    return NextResponse.json(
      { error: `AI 요약 실패: ${String(error)}` },
      { status: 500 }
    );
  }
}
