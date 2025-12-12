import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password: string; // hashed
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
  },
  { timestamps: true }
);

const User = model<IUser>("User", userSchema);

export default User;
