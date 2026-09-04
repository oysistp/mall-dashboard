import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseExcelFile, normalizeOrders } from "@/lib/normalizers";
import { writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase 환경변수가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const channel = formData.get("channel") as string;

    if (!file || !channel) {
      return NextResponse.json(
        { error: "파일과 채널을 선택하세요" },
        { status: 400 }
      );
    }

    // 파일 임시 저장
    const bytes = await file.arrayBuffer();
    const tempPath = join(tmpdir(), `upload_${Date.now()}.xlsx`);
    await writeFile(tempPath, Buffer.from(bytes));

    // 엑셀 파일 파싱
    const rows = await parseExcelFile(tempPath);

    // 데이터 정규화
    const normalizedData = normalizeOrders(
      rows,
      channel as "smartstore" | "cafe24",
      channel === "smartstore" ? "스마트스토어" : "카페24"
    );

    // Supabase에 저장
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase
      .from("orders")
      .insert(normalizedData);

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: `데이터 저장 실패: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${normalizedData.length}개의 주문이 저장되었습니다`,
      count: normalizedData.length,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: `업로드 실패: ${String(error)}` },
      { status: 500 }
    );
  }
}
