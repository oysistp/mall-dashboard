import { readFile } from "fs/promises";
import * as XLSX from "xlsx";

export type Channel = "smartstore" | "cafe24";

export interface NormalizedOrder {
  channel: string;
  order_number: string;
  order_date: string;
  status: string;
  is_cancelled: string;
  product_name: string;
  quantity: number;
  amount: number;
  payment_method: string;
}

export async function parseExcelFile(
  filePath: string
): Promise<Record<string, unknown>[]> {
  const fileBuffer = await readFile(filePath);
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  return data as Record<string, unknown>[];
}

function isCancelled(
  channel: Channel,
  row: Record<string, unknown>
): boolean {
  if (channel === "smartstore") {
    const orderStatus = String(row["주문상태"] || "");
    const claimStatus = String(row["클레임상태"] || "");
    return (
      orderStatus.includes("취소") ||
      orderStatus.includes("반품") ||
      claimStatus.includes("취소") ||
      claimStatus.includes("반품")
    );
  } else if (channel === "cafe24") {
    const status = String(row["주문처리상태"] || "");
    return status.includes("주문취소") || status.includes("반품");
  }
  return false;
}

function parseAmount(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "");
    return parseInt(cleaned, 10) || 0;
  }
  return 0;
}

export function normalizeSmartstore(
  rows: Record<string, unknown>[],
  channel: string
): NormalizedOrder[] {
  return rows
    .filter((row) => row["주문번호"]) // 주문번호가 있는 행만
    .map((row) => ({
      channel,
      order_number: String(row["주문번호"]),
      order_date: extractDate(String(row["주문일시"] || "")),
      status: String(row["주문상태"] || ""),
      is_cancelled: isCancelled("smartstore", row) ? "취소" : "",
      product_name: String(row["상품명"] || ""),
      quantity: parseInt(String(row["수량"] || "0"), 10),
      amount: parseAmount(row["상품별 총 주문금액"]),
      payment_method: String(row["결제수단"] || ""),
    }));
}

export function normalizeCafe24(
  rows: Record<string, unknown>[],
  channel: string
): NormalizedOrder[] {
  return rows
    .filter((row) => row["주문번호"])
    .map((row) => ({
      channel,
      order_number: String(row["주문번호"]),
      order_date: String(row["주문일자"] || ""),
      status: String(row["주문처리상태"] || ""),
      is_cancelled: isCancelled("cafe24", row) ? "취소" : "",
      product_name: String(row["상품명"] || ""),
      quantity: parseInt(String(row["수량"] || "0"), 10),
      amount: parseAmount(row["총 결제금액"]),
      payment_method: String(row["결제방식"] || ""),
    }));
}

function extractDate(datetime: string): string {
  // "2026-06-08 16:14:17" -> "2026-06-08"
  if (datetime.includes(" ")) {
    return datetime.split(" ")[0];
  }
  return datetime;
}

export function normalizeOrders(
  rows: Record<string, unknown>[],
  channel: Channel,
  channelName: string
): NormalizedOrder[] {
  if (channel === "smartstore") {
    return normalizeSmartstore(rows, channelName);
  } else if (channel === "cafe24") {
    return normalizeCafe24(rows, channelName);
  }
  return [];
}
