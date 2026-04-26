import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import User from "@/models/Users";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    await connectDB();
    const user = await User.findById(auth.id);
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "User not found" } },
        { status: 401 },
      );
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json(
      {
        error: {
          code: "USER_RETRIEVAL_FAILED",
          message: "Failed to retrieve user information",
        },
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireAuth();
    if (!auth) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    await connectDB();
    const updateData = await request.json();

    const ALLOWED_FIELDS = ["firstName", "lastName", "email", "preferences"];
    const allowedUpdates = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in updateData) {
        allowedUpdates[field] = updateData[field];
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "No valid fields provided for update",
          },
        },
        { status: 400 },
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      auth.id,
      { $set: allowedUpdates },
      { new: true, runValidators: true },
    );

    return NextResponse.json({
      user: {
        id: updatedUser._id.toString(),
        userId: updatedUser.userId,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        preferences: updatedUser.preferences,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      {
        error: {
          code: "PROFILE_UPDATE_FAILED",
          message: "Failed to update profile",
        },
      },
      { status: 400 },
    );
  }
}
