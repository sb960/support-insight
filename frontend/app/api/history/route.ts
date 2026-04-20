import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || 
  (process.env.NODE_ENV === "production" 
    ? "https://support-insight.vercel.app/" 
    : "http://localhost:8000");

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    
    // Build query string
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    if (priority) params.append("priority", priority);
    if (search) params.append("search", search);
    
    const queryString = params.toString();
    const url = `${FASTAPI_URL}/history${queryString ? `?${queryString}` : ""}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error("Failed to fetch history");
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("History proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
