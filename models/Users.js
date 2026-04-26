import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";
import { encrypt, decrypt } from "@/lib/encryption";

const userSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
  },
  firstName: {
    type: String,
    required: [true, "First name is required"],
  },
  lastName: {
    type: String,
    required: [true, "Last name is required"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    lowercase: true,
    unique: true,
    validate: [
      (val) => {
        return validator.isEmail(val);
      },
      "Invalid email address",
    ],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [8, "Password must be at least 8 characters long"],
  },
  userId: {
    type: String,
    required: true,
  },
  userSecret: {
    type: String,
    set: encrypt,
    get: decrypt,
  },
  preferences: {
    baseCurrency: {
      type: String,
      default: "USD",
    },
    benchmark: {
      type: String,
      default: "SPY",
    },
  },
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt();
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.statics.login = async function (email, password) {
  const user = await this.findOne({ email });
  if (user) {
    const auth = await bcrypt.compare(password, user.password);
    if (auth) {
      return user;
    }
    throw new Error("Incorrect password");
  }
  throw new Error("Incorrect email");
};

userSchema.statics.findByEmail = async function (email) {
  const user = await this.findOne({ email });
  if (user) {
    return user;
  }
  throw new Error("User not found");
};

userSchema.index({ userId: 1 }, { unique: true });

const User = mongoose.models.user || mongoose.model("user", userSchema);

export default User;
