import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/Users";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth";

const isProd = process.env.NODE_ENV === "production";

function cookieOptions(maxAgeSeconds) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  };
}

export async function POST(request) {
  try {
    await connectDB();
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Email and password are required" } },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid email format" } },
        { status: 400 }
      );
    }

    const user = await User.login(email, password);

    const accessToken = generateAccessToken({ id: user._id.toString() });
    const refreshToken = generateRefreshToken({ id: user._id.toString() });

    const response = NextResponse.json({
      user: {
        id: user._id.toString(),
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        preferences: user.preferences,
      },
      accessToken,
    });

    response.cookies.set("jwt", accessToken, cookieOptions(15 * 60));
    response.cookies.set("refreshToken", refreshToken, cookieOptions(7 * 24 * 60 * 60));

    return response;
  } catch (error) {
    console.error("Login error:", error);

    if (error.message?.includes("Incorrect")) {
      return NextResponse.json(
        { error: { code: "LOGIN_FAILED", message: "Invalid email or password" } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Login failed" } },
      { status: 500 }
    );
  }
}
