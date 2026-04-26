import { NextResponse } from "next/server";
import crypto from "crypto";
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
    const { firstName, lastName, email, password } = await request.json();

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "All fields are required" } },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters" } },
        { status: 400 }
      );
    }

    const userId = crypto.randomUUID();

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      userId,
      preferences: { baseCurrency: "USD", benchmark: "SPY" },
    });

    const accessToken = generateAccessToken({ id: user._id.toString() });
    const refreshToken = generateRefreshToken({ id: user._id.toString() });

    const response = NextResponse.json(
      {
        user: {
          id: user._id.toString(),
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          preferences: user.preferences,
        },
        accessToken,
      },
      { status: 201 }
    );

    response.cookies.set("jwt", accessToken, cookieOptions(15 * 60));
    response.cookies.set("refreshToken", refreshToken, cookieOptions(7 * 24 * 60 * 60));

    return response;
  } catch (error) {
    console.error("Signup error:", error);

    if (error.code === 11000) {
      return NextResponse.json(
        { error: { code: "EMAIL_TAKEN", message: "An account with this email already exists" } },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: { code: "SIGNUP_FAILED", message: "Could not create account" } },
      { status: 400 }
    );
  }
}
